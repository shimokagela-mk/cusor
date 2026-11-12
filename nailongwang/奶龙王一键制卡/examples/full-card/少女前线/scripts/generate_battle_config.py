#!/usr/bin/env python3
"""Generate the Girls' Frontline battle configuration table.

This script creates/overwrites:
`projects/少女前线/tables/readable/06-出战配置表.md`

Data policy:
- The table is a frontend-maintained battle state table and contains at most 5 rows.
- Initial content uses AR Team as an example: M4A1, M16A1, M4 SOPMODII,
  ST AR-15, RO635.
- Stats are read from the highest level record in `04_属性数据_等级.json`.
- `当前生命` is initialized to `最大生命`; both use total HP from `生命×5`.
- Every other stat is written to its own column; no packed stat string is used.
- AI update frequency is 0 and export to worldbook is disabled.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parents[1]
REF_ROOT = REPO_ROOT / "ref" / "gf_tdoll_data"
TABLE_PATH = PROJECT_ROOT / "tables" / "readable" / "06-出战配置表.md"

TEAM_NAMES = ["M4A1", "M16A1", "M4 SOPMODII", "ST AR-15", "RO635"]
HEADER = [
    "出战位",
    "人形名称",
    "当前生命",
    "最大生命",
    "伤害",
    "命中",
    "回避",
    "射速",
    "护甲",
    "移动",
    "穿甲",
    "暴击",
    "弹链",
]
STAT_KEYS = ["伤害", "命中", "回避", "射速", "护甲", "移动", "穿甲", "暴击", "弹链"]
LEVEL_REQUIRED_KEYS = ["生命×5", *STAT_KEYS]


@dataclass(frozen=True)
class BattleRow:
    slot: int
    name: str
    current_hp: int
    max_hp: int
    stats: dict[str, Any]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"required file missing: {path}")


def md_escape(value: Any) -> str:
    return str(value).replace("\n", " ").replace("|", "\\|")


def discover_tdoll_dirs() -> dict[str, Path]:
    if not REF_ROOT.exists():
        raise FileNotFoundError(f"ref root missing: {REF_ROOT}")

    by_name: dict[str, Path] = {}
    for tdoll_dir in sorted(REF_ROOT.glob("*/*")):
        info_path = tdoll_dir / "03_基本信息.json"
        if not tdoll_dir.is_dir() or not info_path.exists():
            continue
        info = load_json(info_path)
        name = str(info.get("名称") or "").strip()
        if not name:
            raise ValueError(f"tdoll name is empty: {info_path}")
        if name in by_name:
            raise ValueError(f"duplicate tdoll name {name!r}: {by_name[name]} and {tdoll_dir}")
        by_name[name] = tdoll_dir
    return by_name


def highest_level_data(tdoll_dir: Path) -> dict[str, Any]:
    levels_path = tdoll_dir / "04_属性数据_等级.json"
    require_file(levels_path)
    levels = load_json(levels_path)
    numeric_levels = sorted(int(key) for key in levels if str(key).isdigit())
    if not numeric_levels:
        raise ValueError(f"no numeric level data: {levels_path}")
    data = levels[str(numeric_levels[-1])]
    if not isinstance(data, dict):
        raise ValueError(f"highest level data should be an object: {levels_path}")
    missing = [key for key in LEVEL_REQUIRED_KEYS if key not in data]
    if missing:
        raise ValueError(f"level data missing keys {missing}: {tdoll_dir}")
    return data


def build_rows() -> list[BattleRow]:
    if len(TEAM_NAMES) > 5:
        raise ValueError(f"battle config supports at most 5 rows, got {len(TEAM_NAMES)}")

    by_name = discover_tdoll_dirs()
    rows: list[BattleRow] = []
    for slot, name in enumerate(TEAM_NAMES, 1):
        tdoll_dir = by_name.get(name)
        if tdoll_dir is None:
            raise ValueError(f"missing tdoll in ref data: {name}")
        data = highest_level_data(tdoll_dir)
        max_hp = int(data["生命×5"])
        stats = {key: data[key] for key in STAT_KEYS}
        rows.append(BattleRow(slot=slot, name=name, current_hp=max_hp, max_hp=max_hp, stats=stats))
    return rows


def render_table(rows: list[BattleRow]) -> str:
    lines = [
        "| " + " | ".join(HEADER) + " |",
        "| " + " | ".join(["---"] * len(HEADER)) + " |",
    ]
    for row in rows:
        cells = [
            row.slot,
            row.name,
            row.current_hp,
            row.max_hp,
            *[row.stats[key] for key in STAT_KEYS],
        ]
        lines.append("| " + " | ".join(md_escape(cell) for cell in cells) + " |")
    return "\n".join(lines)


def render_markdown(rows: list[BattleRow]) -> str:
    table = render_table(rows)
    return f"""# 出战配置表

- uid: `sheet_battle_config`
- orderNo: 5

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

- 记录当前出战队伍配置。每行代表一个出战位，最多 5 行。
- 本表只保留出战运行需要的字段：出战位、人形名称、当前生命、最大生命，以及各项战斗数值。
- 【列定义】
- 列1=出战位：限定 1-5，全表唯一。
- 列2=人形名称：出战人形名称。
- 列3=当前生命：当前战斗生命值，初始化时等于最大生命。
- 列4=最大生命：当前形态最大生命值。
- 列5=伤害。
- 列6=命中。
- 列7=回避。
- 列8=射速。
- 列9=护甲。
- 列10=移动。
- 列11=穿甲。
- 列12=暴击。
- 列13=弹链。
- 当前内容以 AR 小队作为示例配置。

## 更新规则

- 初始化: 以 `## 当前内容` 中已有表格作为初始出战配置，不由 AI 自动生成或补写。
- 更新: 禁止。出战配置由前端维护。
- 插入: 禁止。新增出战位由前端写入 `## 当前内容`，且总行数不得超过 5。
- 删除: 禁止。移除出战位由前端处理。

## DDL

```sql
CREATE TABLE battle_config ( -- 出战配置表
  row_id INTEGER PRIMARY KEY, -- 行号
  battle_slot INTEGER NOT NULL UNIQUE CHECK(battle_slot BETWEEN 1 AND 5), -- 出战位
  tdoll_name TEXT NOT NULL, -- 人形名称
  current_hp INTEGER NOT NULL CHECK(current_hp >= 0), -- 当前生命
  max_hp INTEGER NOT NULL CHECK(max_hp >= 0), -- 最大生命
  damage INTEGER NOT NULL, -- 伤害
  accuracy INTEGER NOT NULL, -- 命中
  evasion INTEGER NOT NULL, -- 回避
  rate_of_fire INTEGER NOT NULL, -- 射速
  armor INTEGER NOT NULL, -- 护甲
  movement INTEGER NOT NULL, -- 移动
  armor_piercing INTEGER NOT NULL, -- 穿甲
  critical_rate INTEGER NOT NULL, -- 暴击
  ammo_chain INTEGER NOT NULL, -- 弹链
  CHECK(current_hp <= max_hp)
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
  "entryName": "出战配置表",
  "entryType": "constant",
  "keywords": "",
  "preventRecursion": true,
  "injectionTemplate": "",
  "extraIndexEnabled": false,
  "extraIndexEntryName": "出战配置表-索引",
  "extraIndexColumns": [],
  "extraIndexColumnModes": {{}},
  "extraIndexInjectionTemplate": "",
  "entryPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 10040
  }},
  "extraIndexPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 8040
  }},
  "fixedEntryPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 99985
  }},
  "fixedIndexPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 99986
  }}
}}
```
"""


def main() -> None:
    rows = build_rows()
    if len(rows) > 5:
        raise ValueError(f"battle config supports at most 5 rows, got {len(rows)}")
    TABLE_PATH.write_text(render_markdown(rows), encoding="utf-8")
    print(f"updated: {TABLE_PATH}")
    print(f"rows: {len(rows)}")
    print("team: " + ", ".join(row.name for row in rows))
    print("updateFrequency: 0")
    print("export_enabled: false")


if __name__ == "__main__":
    main()
