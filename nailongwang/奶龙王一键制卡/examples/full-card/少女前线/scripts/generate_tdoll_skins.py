#!/usr/bin/env python3
"""Generate the Girls' Frontline tdoll skin table from ref data.

This script creates/overwrites:
`projects/少女前线/tables/readable/05-人形皮肤表.md`

Data policy:
- One row per tdoll found in `ref/gf_tdoll_data/*/*/03_基本信息.json`.
- Stable row order by tdoll number (`编号`), then name.
- Static skins are derived from subdirectories under `01_立绘展示`; the number
  of skin folders is the source of truth, not `08_立绘信息.json`.
- Live2D skins are discovered from `ref/Girls-Frontline/*` and mapped back to
  tdoll skin folders by matching the Live2D asset directory key to portrait file
  keys such as `Pic_DSR50_2101_HD.png`. If a static skin has a matched Live2D
  package, the table renders that skin once as `皮肤名（l2d）` instead of keeping
  both `皮肤名` and `皮肤名（l2d）`.
- This table is frontend-maintained: AI update frequency is 0 and export to
  worldbook is disabled.
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
L2D_ROOT = REPO_ROOT / "ref" / "Girls-Frontline"
TABLE_PATH = PROJECT_ROOT / "tables" / "readable" / "05-人形皮肤表.md"

HEADER = ["人形名称", "皮肤列表"]


@dataclass(frozen=True)
class SkinRow:
    number: int
    name: str
    skins: list[str]


@dataclass(frozen=True)
class SkinFolder:
    tdoll_name: str
    skin_name: str
    path: Path


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"required file missing: {path}")


def require_dir(path: Path) -> None:
    if not path.is_dir():
        raise FileNotFoundError(f"required directory missing: {path}")


def md_escape(value: Any) -> str:
    return str(value).replace("\n", " ").replace("|", "\\|")


def normalize_asset_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def portrait_asset_keys(skin_dir: Path) -> set[str]:
    keys: set[str] = set()
    for file in skin_dir.iterdir():
        if not file.is_file() or file.suffix.lower() != ".png":
            continue
        stem = file.stem
        if not stem.lower().startswith("pic_"):
            continue
        stem = stem[4:]
        stem = re.sub(r"_D(?:_HD)?$", "", stem, flags=re.IGNORECASE)
        stem = re.sub(r"_HD$", "", stem, flags=re.IGNORECASE)
        key = normalize_asset_key(stem)
        if key:
            keys.add(key)
    return keys


def read_tdoll_identity(tdoll_dir: Path) -> tuple[int, str]:
    info_path = tdoll_dir / "03_基本信息.json"
    require_file(info_path)
    info = load_json(info_path)

    name = str(info.get("名称") or "").strip()
    if not name:
        raise ValueError(f"tdoll name is empty: {info_path}")

    try:
        number = int(info["编号"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"invalid tdoll number: {info_path}") from exc

    return number, name


def read_static_skin_names(tdoll_dir: Path) -> list[str]:
    portrait_root = tdoll_dir / "01_立绘展示"
    require_dir(portrait_root)

    skins: list[str] = []
    for skin_dir in sorted(portrait_root.iterdir(), key=lambda path: path.name):
        if not skin_dir.is_dir():
            continue
        skin_name = skin_dir.name.strip()
        if not skin_name:
            raise ValueError(f"empty skin folder name: {skin_dir}")
        skins.append(skin_name)

    if not skins:
        return ["默认立绘"]

    return skins


def discover_empty_portrait_warnings(tdoll_dirs: list[Path]) -> list[str]:
    warnings: list[str] = []
    for tdoll_dir in tdoll_dirs:
        _, tdoll_name = read_tdoll_identity(tdoll_dir)
        portrait_root = tdoll_dir / "01_立绘展示"
        require_dir(portrait_root)
        has_skin_folder = any(item.is_dir() for item in portrait_root.iterdir())
        if not has_skin_folder:
            warnings.append(
                f"empty portrait folder for {tdoll_name}: {portrait_root.relative_to(REPO_ROOT)}; fallback to 默认立绘"
            )
    return warnings


def build_portrait_key_index(tdoll_dirs: list[Path]) -> dict[str, list[SkinFolder]]:
    index: dict[str, list[SkinFolder]] = {}

    for tdoll_dir in tdoll_dirs:
        _, tdoll_name = read_tdoll_identity(tdoll_dir)
        portrait_root = tdoll_dir / "01_立绘展示"
        require_dir(portrait_root)

        for skin_dir in sorted(portrait_root.iterdir(), key=lambda path: path.name):
            if not skin_dir.is_dir():
                continue
            folder = SkinFolder(tdoll_name=tdoll_name, skin_name=skin_dir.name, path=skin_dir)
            for key in portrait_asset_keys(skin_dir):
                index.setdefault(key, []).append(folder)

    return index


def is_l2d_asset_dir(path: Path) -> bool:
    if not path.is_dir():
        return False
    return (path / "normal" / "model.json").exists() or (path / "destroy" / "model.json").exists()


def discover_l2d_skins(
    portrait_key_index: dict[str, list[SkinFolder]],
) -> tuple[dict[str, set[str]], list[str]]:
    require_dir(L2D_ROOT)

    l2d_by_tdoll: dict[str, set[str]] = {}
    warnings: list[str] = []

    for asset_dir in sorted(L2D_ROOT.iterdir(), key=lambda path: path.name):
        if not is_l2d_asset_dir(asset_dir):
            continue

        key = normalize_asset_key(asset_dir.name)
        matches = portrait_key_index.get(key, [])
        if not matches:
            warnings.append(f"unmatched l2d asset directory: {asset_dir.relative_to(REPO_ROOT)}")
            continue
        if len(matches) > 1:
            rendered = ", ".join(f"{item.tdoll_name}/{item.skin_name}" for item in matches)
            raise ValueError(f"ambiguous l2d asset directory {asset_dir}: {rendered}")

        match = matches[0]
        l2d_by_tdoll.setdefault(match.tdoll_name, set()).add(match.skin_name)

    return l2d_by_tdoll, warnings


def read_skin_row(tdoll_dir: Path, l2d_by_tdoll: dict[str, set[str]]) -> SkinRow:
    number, name = read_tdoll_identity(tdoll_dir)
    static_skins = read_static_skin_names(tdoll_dir)
    l2d_skins = l2d_by_tdoll.get(name, set())

    skins: list[str] = []
    seen: set[str] = set()
    for skin_name in static_skins:
        display_name = f"{skin_name}（l2d）" if skin_name in l2d_skins else skin_name
        if display_name not in seen:
            skins.append(display_name)
            seen.add(display_name)

    for skin_name in sorted(l2d_skins - set(static_skins)):
        display_name = f"{skin_name}（l2d）"
        skins.append(display_name)

    return SkinRow(number=number, name=name, skins=skins)


def discover_tdoll_dirs() -> list[Path]:
    require_dir(REF_ROOT)
    return [
        tdoll_dir
        for tdoll_dir in sorted(REF_ROOT.glob("*/*"))
        if tdoll_dir.is_dir() and (tdoll_dir / "03_基本信息.json").exists()
    ]


def discover_rows() -> tuple[list[SkinRow], list[str]]:
    tdoll_dirs = discover_tdoll_dirs()
    portrait_key_index = build_portrait_key_index(tdoll_dirs)
    l2d_by_tdoll, warnings = discover_l2d_skins(portrait_key_index)
    warnings.extend(discover_empty_portrait_warnings(tdoll_dirs))

    rows: list[SkinRow] = []
    seen_names: dict[str, Path] = {}
    seen_numbers: dict[int, Path] = {}

    for tdoll_dir in tdoll_dirs:
        row = read_skin_row(tdoll_dir, l2d_by_tdoll)
        if row.name in seen_names:
            raise ValueError(f"duplicate tdoll name {row.name!r}: {seen_names[row.name]} and {tdoll_dir}")
        if row.number in seen_numbers:
            raise ValueError(f"duplicate tdoll number {row.number}: {seen_numbers[row.number]} and {tdoll_dir}")
        seen_names[row.name] = tdoll_dir
        seen_numbers[row.number] = tdoll_dir
        rows.append(row)

    rows.sort(key=lambda row: (row.number, row.name))
    return rows, warnings


def render_table(rows: list[SkinRow]) -> str:
    lines = [
        "| " + " | ".join(HEADER) + " |",
        "| " + " | ".join(["---"] * len(HEADER)) + " |",
    ]
    for row in rows:
        lines.append(
            "| "
            + " | ".join(
                [
                    md_escape(row.name),
                    md_escape("、".join(row.skins)),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def render_markdown(rows: list[SkinRow]) -> str:
    table = render_table(rows)
    return f"""# 人形皮肤表

- uid: `sheet_tdoll_skins`
- orderNo: 4

## 可编辑说明

- 可以直接修改 `## 说明`，会回写到 `sourceData.note`。
- 可以直接修改 `## 更新规则`，但必须保持以下四行格式：`- 初始化: ...`、`- 更新: ...`、`- 插入: ...`、`- 删除: ...`。
- 可以直接修改 `## DDL` 中的 SQL，会回写到 `sourceData.ddl`（仅 SQLite 模式需要）。
- 可以直接修改 `## 当前内容` 下的 Markdown 表格，会回写到 `content`。
- 可以直接修改 `## 更新配置` 中的 JSON，会回写到 `updateConfig`，适合调整上下文深度、批次、更新频率等运行参数。
- 可以直接修改 `## 导出配置` 中的 JSON，会回写到 `exportConfig`，适合调整分组参数、导出参数与注入位置。
- 不要修改 `# 表名`、`uid`、`orderNo`。这些字段当前仅用于展示，不参与回写。
- 修改完成后，运行回包流程即可自动同步到 `embedded-template.pretty.json`。

## 说明

- 记录每名战术人形拥有的皮肤名称列表。每名人形一行，以“人形名称”作为唯一标识。
- 本表只保留两个字段：人形名称、皮肤列表。
- 【列定义】
- 列1=人形名称：战术人形名称，全表唯一。
- 列2=皮肤列表：该人形全部皮肤名称。普通皮肤以 ref 中 `01_立绘展示` 的子文件夹为准；Live2D 皮肤从 `ref/Girls-Frontline` 映射回对应立绘文件夹，并以 `（l2d）` 标注；若某皮肤存在 Live2D，则只显示 `皮肤名（l2d）`，不再重复显示同名静态皮肤；使用 `、` 分隔。

## 更新规则

- 初始化: 以 `## 当前内容` 中已有表格作为初始皮肤列表，不由 AI 自动生成或补写。
- 更新: 禁止。皮肤列表由前端或批量脚本维护。
- 插入: 禁止。新增人形皮肤由前端或批量脚本写入 `## 当前内容`。
- 删除: 禁止。移除或隐藏皮肤由前端处理。

## DDL

```sql
CREATE TABLE tdoll_skins ( -- 人形皮肤表
  row_id INTEGER PRIMARY KEY, -- 行号
  tdoll_name TEXT NOT NULL UNIQUE, -- 人形名称
  skin_list TEXT NOT NULL CHECK(TRIM(skin_list) <> '') -- 皮肤列表
);
```

## 当前内容

{table}

## 更新配置

```json
{{
  "uiSentinel": -1,
  "contextDepth": 3,
  "updateFrequency": 0,
  "batchSize": 3,
  "skipFloors": -1,
  "groupId": 2
}}
```

## 导出配置

```json
{{
  "enabled": false,
  "splitByRow": false,
  "entryName": "人形皮肤表",
  "entryType": "constant",
  "keywords": "",
  "preventRecursion": true,
  "injectionTemplate": "",
  "extraIndexEnabled": false,
  "extraIndexEntryName": "人形皮肤表-索引",
  "extraIndexColumns": [],
  "extraIndexColumnModes": {{}},
  "extraIndexInjectionTemplate": "",
  "entryPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 10030
  }},
  "extraIndexPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 8030
  }},
  "fixedEntryPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 99983
  }},
  "fixedIndexPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 99984
  }}
}}
```
"""


def main() -> None:
    rows, warnings = discover_rows()
    if len(rows) != 451:
        raise ValueError(f"expected 451 tdoll skin rows, got {len(rows)}")

    TABLE_PATH.write_text(render_markdown(rows), encoding="utf-8")
    print(f"updated: {TABLE_PATH}")
    print(f"rows: {len(rows)}")
    print("columns: 人形名称, 皮肤列表")
    print("source: ref/gf_tdoll_data/*/*/01_立绘展示 + ref/Girls-Frontline l2d assets")
    print("updateFrequency: 0")
    print("export_enabled: false")
    if warnings:
        print("warnings:")
        for warning in warnings:
            print(f"- {warning}")


if __name__ == "__main__":
    main()
