#!/usr/bin/env python3
"""Generate the Girls' Frontline tdoll warehouse readable table from ref data.

This script updates only the Markdown table under `## 当前内容` in
`projects/少女前线/tables/readable/03-人形仓库表.md`.

Data policy:
- One row per tdoll found in `ref/gf_tdoll_data/*/*/03_基本信息.json`.
- Stable order by tdoll number (`编号`), then name.
- `数据` uses the highest level record from `04_属性数据_等级.json`.
- `改造后的MOD数据` uses `00_图鉴信息.json` mod fields when the tdoll can be
  neural-upgraded; otherwise `无`.
- `是否已获取` defaults to `否` for every generated row.
- `是否已心智改造` defaults to `否` for every generated row.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parents[1]
REF_ROOT = REPO_ROOT / "ref" / "gf_tdoll_data"
TABLE_PATH = PROJECT_ROOT / "tables" / "readable" / "03-人形仓库表.md"

HEADER = [
    "人形名称",
    "枪种",
    "星级",
    "数据",
    "是否可以心智改造",
    "是否已心智改造",
    "改造后的MOD数据",
    "是否已获取",
    "当前皮肤",
]
STAT_KEYS = ["生命", "伤害", "命中", "回避", "射速", "护甲", "移动", "穿甲", "暴击", "弹链"]
LEVEL_REQUIRED_KEYS = ["生命×5", "伤害", "命中", "回避", "射速", "护甲", "移动", "穿甲", "暴击", "弹链"]
MOD_REQUIRED_KEYS = ["mod-hp", "mod-atk", "mod-acc", "mod-eva", "mod-rate", "mod-armor"]


@dataclass(frozen=True)
class TdollRow:
    number: int
    name: str
    cells: list[str]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def md_escape(value: Any) -> str:
    return str(value).replace("\n", " ").replace("|", "\\|")


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"required file missing: {path}")


def format_stats(data: dict[str, Any]) -> str:
    return "，".join(f"{key}{data[key]}" for key in STAT_KEYS if key in data)


def base_stats_text(level_data: dict[str, Any], tdoll_dir: Path) -> str:
    missing = [key for key in LEVEL_REQUIRED_KEYS if key not in level_data]
    if missing:
        raise ValueError(f"level data missing keys {missing}: {tdoll_dir}")

    data = dict(level_data)
    data["生命"] = data["生命×5"]
    return format_stats(data)


def mod_stats_text(atlas: dict[str, Any], level_data: dict[str, Any], tdoll_dir: Path) -> str:
    missing = [key for key in MOD_REQUIRED_KEYS if key not in atlas or atlas[key] in (None, "")]
    if missing:
        raise ValueError(f"mod atlas data missing keys {missing}: {tdoll_dir}")

    data: dict[str, Any] = {
        "生命": int(atlas["mod-hp"]) * 5,
        "伤害": atlas["mod-atk"],
        "命中": atlas["mod-acc"],
        "回避": atlas["mod-eva"],
        "射速": atlas["mod-rate"],
        "护甲": atlas["mod-armor"],
    }
    for key in ["移动", "穿甲", "暴击", "弹链"]:
        if key not in level_data:
            raise ValueError(f"level data missing static key {key}: {tdoll_dir}")
        data[key] = level_data[key]
    return format_stats(data)


def default_skin(tdoll_dir: Path) -> str:
    skin_path = tdoll_dir / "08_立绘信息.json"
    if not skin_path.exists():
        return "默认立绘"

    skins = load_json(skin_path)
    if not isinstance(skins, list):
        raise ValueError(f"skin data should be a list: {skin_path}")

    for skin in skins:
        if isinstance(skin, dict) and skin.get("立绘") == "默认立绘":
            return "默认立绘"
    return "默认立绘"


def read_tdoll_row(tdoll_dir: Path) -> TdollRow:
    info_path = tdoll_dir / "03_基本信息.json"
    levels_path = tdoll_dir / "04_属性数据_等级.json"
    atlas_path = tdoll_dir / "00_图鉴信息.json"

    require_file(info_path)
    require_file(levels_path)
    require_file(atlas_path)

    info = load_json(info_path)
    levels = load_json(levels_path)
    atlas = load_json(atlas_path)

    name = str(info.get("名称") or "").strip()
    if not name:
        raise ValueError(f"tdoll name is empty: {info_path}")

    try:
        number = int(info["编号"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"invalid tdoll number: {info_path}") from exc

    weapon_type = str(info.get("枪种") or "").strip()
    if weapon_type not in {"HG", "SMG", "RF", "AR", "MG", "SG"}:
        raise ValueError(f"invalid weapon type {weapon_type!r}: {info_path}")

    rarity = info.get("星级")
    if rarity not in {"1", "2", "3", "4", "5", 1, 2, 3, 4, 5}:
        raise ValueError(f"invalid rarity {rarity!r}: {info_path}")
    rarity_text = f"{rarity}★"

    numeric_levels = sorted(int(key) for key in levels if str(key).isdigit())
    if not numeric_levels:
        raise ValueError(f"no numeric level data: {levels_path}")
    level_data = levels[str(numeric_levels[-1])]
    if not isinstance(level_data, dict):
        raise ValueError(f"highest level data should be an object: {levels_path}")

    can_mod = info.get("心智升级") == "有"
    mod_data = mod_stats_text(atlas, level_data, tdoll_dir) if can_mod else "无"

    cells = [
        name,
        weapon_type,
        rarity_text,
        base_stats_text(level_data, tdoll_dir),
        "是" if can_mod else "否",
        "否",
        mod_data,
        "否",
        default_skin(tdoll_dir),
    ]
    return TdollRow(number=number, name=name, cells=cells)


def discover_rows() -> list[TdollRow]:
    if not REF_ROOT.exists():
        raise FileNotFoundError(f"ref root missing: {REF_ROOT}")

    rows: list[TdollRow] = []
    seen_names: dict[str, Path] = {}
    seen_numbers: dict[int, Path] = {}
    for tdoll_dir in sorted(REF_ROOT.glob("*/*")):
        if not tdoll_dir.is_dir() or not (tdoll_dir / "03_基本信息.json").exists():
            continue
        row = read_tdoll_row(tdoll_dir)
        if row.name in seen_names:
            raise ValueError(f"duplicate tdoll name {row.name!r}: {seen_names[row.name]} and {tdoll_dir}")
        if row.number in seen_numbers:
            raise ValueError(f"duplicate tdoll number {row.number}: {seen_numbers[row.number]} and {tdoll_dir}")
        seen_names[row.name] = tdoll_dir
        seen_numbers[row.number] = tdoll_dir
        rows.append(row)

    rows.sort(key=lambda row: (row.number, row.name))
    return rows


def render_table(rows: list[TdollRow]) -> str:
    lines = [
        "| " + " | ".join(HEADER) + " |",
        "| " + " | ".join(["---"] * len(HEADER)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(md_escape(cell) for cell in row.cells) + " |")
    return "\n".join(lines)


def replace_current_content_table(markdown: str, table: str) -> str:
    section_match = re.search(r"(?m)^## 当前内容\s*$", markdown)
    if section_match is None:
        raise ValueError("missing section: ## 当前内容")

    next_match = re.search(r"(?m)^## 更新配置\s*$", markdown[section_match.end() :])
    if next_match is None:
        raise ValueError("missing section after current content: ## 更新配置")

    end = section_match.end() + next_match.start()
    return markdown[: section_match.end()] + "\n\n" + table + "\n" + markdown[end:]


def main() -> None:
    require_file(TABLE_PATH)
    rows = discover_rows()
    if len(rows) != 451:
        raise ValueError(f"expected 451 tdoll rows, got {len(rows)}")

    current = TABLE_PATH.read_text(encoding="utf-8")
    updated = replace_current_content_table(current, render_table(rows))
    TABLE_PATH.write_text(updated, encoding="utf-8")

    print(f"updated: {TABLE_PATH}")
    print(f"rows: {len(rows)}")
    print("acquired_default: 否")
    print("neural_upgraded_default: 否")


if __name__ == "__main__":
    main()
