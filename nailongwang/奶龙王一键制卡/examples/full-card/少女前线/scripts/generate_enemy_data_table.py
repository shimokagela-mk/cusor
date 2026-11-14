#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 gf_enemy_data 生成少女前线项目的敌人资料表。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parents[1]
ENEMY_ROOT = REPO_ROOT / "ref" / "gf_enemy_data" / "敌方内容"
OUT_FILE = PROJECT_ROOT / "tables" / "readable" / "18-敌人资料表.md"
INDEX_FILE = PROJECT_ROOT / "tables" / "readable" / "00-目录.md"

HEADERS = [
    "敌人名称",
    "阵营",
    "敌人类型",
    "威胁等级",
    "基础档位",
    "Boss标记",
    "章节绑定",
    "标签",
    "属性模板",
    "技能摘要",
    "剧情定位",
    "数据来源",
]

BOSS_NAMES = {
    "稻草人", "刽子手", "猎手", "干扰者", "破坏者", "衔尾蛇", "炼金术士", "梦想家",
    "法官", "代理人", "伊莱莎", "白涅托", "默莉朵", "娜希斯", "格雷", "尼梅兰",
    "盖亚", "阿瑞斯", "罪人", "苏珊娜", "叶戈尔", "卡特", "M16A1",
}

ELITE_HINTS = ("Elite", "SWAP", "Plus", "工厂", "血魄", "魇渊", "头目", "秘仪", "小姐")

THREAT_BY_TYPE = {
    "普通": "中",
    "精英": "高",
    "Boss": "章节Boss",
    "剧情特殊": "极高",
}

MANUAL_ROWS: List[Dict[str, str]] = [
    {
        "敌人名称": "刽子手", "阵营": "铁血工造", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中B,回避C,射速B,护甲D,移动B,穿甲D,暴击C,弹链D",
        "Boss标记": "是", "章节绑定": "二回声",
        "标签": "铁血工造,首领,剧情Boss,近战,Executioner,行裁者",
        "属性模板": "",
        "技能摘要": "以高速突进和近战压制为核心，适合作为二回声阶段的铁血头目。",
        "剧情定位": "二回声章节Boss；gfwiki剧情称刽子手，本地gf_enemy_data对应行裁者/Executioner。",
        "数据来源": "网页补全",
    },
    {
        "敌人名称": "盖亚", "阵营": "铁血工造", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命S,伤害A,命中A,回避B,射速B,护甲B,移动C,穿甲A,暴击B,弹链C",
        "Boss标记": "是", "章节绑定": "深层映射",
        "标签": "铁血头目,重装,高火力,剧情Boss",
        "属性模板": "",
        "技能摘要": "以高火力重装压制为核心，适合作为深层映射阶段的重型Boss。",
        "剧情定位": "深层映射关键强敌；用于补齐章节Boss胜利判定。",
        "数据来源": "维护者设计",
    },
    {
        "敌人名称": "阿瑞斯", "阵营": "正规军", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命S,伤害S,命中A,回避C,射速B,护甲S,移动C,穿甲S,暴击B,弹链B",
        "Boss标记": "是", "章节绑定": "有序紊流,偏振光",
        "标签": "正规军,重装,装甲,高穿甲,剧情Boss",
        "属性模板": "",
        "技能摘要": "重装甲与高穿甲火力并重，适合作为正规军装甲压制单位。",
        "剧情定位": "正规军线重型Boss补全；用于替代抽象阵营名作为可战斗单位。",
        "数据来源": "维护者设计",
    },
    {
        "敌人名称": "罪人", "阵营": "帕拉蒂斯", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命S,伤害A,命中S,回避A,射速A,护甲B,移动B,穿甲A,暴击A,弹链B",
        "Boss标记": "是", "章节绑定": "慢休克",
        "标签": "帕拉蒂斯,涅托,高命中,剧情Boss",
        "属性模板": "",
        "技能摘要": "兼具压制火力和高精度打击，适合作为终局阶段的帕拉蒂斯强敌。",
        "剧情定位": "慢休克终局Boss补全；承接威廉与帕拉蒂斯主线冲突。",
        "数据来源": "维护者设计",
    },
    {
        "敌人名称": "苏珊娜", "阵营": "帕拉蒂斯", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避A,射速A,护甲C,移动B,穿甲A,暴击A,弹链B",
        "Boss标记": "是", "章节绑定": "纵向应变",
        "标签": "帕拉蒂斯,高机动,剧情Boss",
        "属性模板": "",
        "技能摘要": "偏高速与高命中，强调机动突袭和单点压制。",
        "剧情定位": "纵向应变章节Boss补全。",
        "数据来源": "维护者设计",
    },
    {
        "敌人名称": "叶戈尔", "阵营": "正规军", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害S,命中A,回避B,射速B,护甲A,移动C,穿甲S,暴击B,弹链B",
        "Boss标记": "是", "章节绑定": "十三归墟",
        "标签": "正规军,指挥官,装甲,高穿甲,剧情Boss",
        "属性模板": "",
        "技能摘要": "以正规军火力协调和装甲压制为核心，适合表现战场指挥官压迫感。",
        "剧情定位": "十三归墟章节Boss补全；名称按gfwiki主线章节页面使用的“叶戈尔”。",
        "数据来源": "网页补全",
    },
    {
        "敌人名称": "卡特", "阵营": "正规军", "敌人类型": "Boss", "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避B,射速B,护甲A,移动C,穿甲A,暴击B,弹链B",
        "Boss标记": "是", "章节绑定": "十二喘息",
        "标签": "正规军,指挥官,剧情Boss",
        "属性模板": "",
        "技能摘要": "以指挥体系压迫和稳定火力为核心，不实现复杂技能。",
        "剧情定位": "十二喘息章节Boss补全。",
        "数据来源": "维护者设计",
    },
]

CHAPTER_BINDINGS = {
    "稻草人": "一苏醒·零种子", "刽子手": "二回声", "猎手": "三沉默", "干扰者": "四苏醒",
    "破坏者": "五火种", "衔尾蛇": "魔方行动+", "炼金术士": "六彗星", "梦想家": "七同伴,失温症",
    "代理人": "八火花", "法官": "九迷失", "盖亚": "深层映射", "伊莱莎": "十炼狱,塌缩点",
    "白涅托": "有序紊流", "尼梅兰": "异构体", "阿瑞斯": "裂变链接,偏振光", "卡特": "十二喘息",
    "叶戈尔": "十三归墟", "默莉朵": "双联乱数", "娜希斯": "镜像论", "格雷": "熵减焓增,静风点",
    "苏珊娜": "纵向应变", "罪人": "慢休克",
}


def clean_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").replace("|", "\\|")
    return re.sub(r"\s+", " ", text).strip()


def read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def iter_enemy_json_files() -> Iterable[Path]:
    for path in sorted(ENEMY_ROOT.glob("*/*/全部数据.json")):
        if path.is_file():
            yield path


def rating_to_grade(rating: Dict[str, Any], key: str, fallback: str = "C") -> str:
    value = clean_cell(rating.get(key, fallback)).upper()
    if value in {"N", ""}:
        return "D"
    if value == "E":
        return "D"
    if value in {"D", "C", "B", "A", "S"}:
        return value
    return fallback


def enemy_type(name: str, page_type: str) -> str:
    if name in BOSS_NAMES or "Boss" in page_type or "BOSS" in page_type.upper():
        return "Boss"
    if any(hint in name for hint in ELITE_HINTS):
        return "精英"
    return "普通"


def tags_for(name: str, faction: str, unit_type: str, ratings: Dict[str, Any]) -> str:
    tags = [faction]
    if unit_type:
        tags.append(unit_type)
    if name in BOSS_NAMES:
        tags.append("剧情Boss")
    if rating_to_grade(ratings, "护甲") in {"A", "S", "B"}:
        tags.append("装甲")
    if rating_to_grade(ratings, "回避") in {"A", "S", "B"}:
        tags.append("高闪避")
    if rating_to_grade(ratings, "命中") in {"A", "S", "B"}:
        tags.append("高命中")
    if "机械" in unit_type:
        tags.append("机械")
    return ",".join(dict.fromkeys([clean_cell(t) for t in tags if clean_cell(t)]))


def row_from_file(path: Path) -> Optional[Dict[str, str]]:
    data = read_json(path)
    if not data:
        return None
    idx = data.get("索引信息", {})
    detail = data.get("详情", {})
    atlas = detail.get("敌方图鉴信息", {}) or {}
    fields = atlas.get("基础字段", {}) or {}
    ratings = atlas.get("属性评级", {}) or {}
    name = clean_cell(idx.get("名称") or detail.get("页面标题") or path.parent.name.split("_", 1)[-1])
    if not name:
        return None
    faction = clean_cell(idx.get("首次出现势力") or fields.get("所属势力") or path.parent.parent.name.split("_", 1)[-1])
    unit_type = clean_cell(fields.get("单位类型") or detail.get("页面类型") or "普通敌方")
    etype = enemy_type(name, clean_cell(detail.get("页面类型")))
    base_grade = ",".join([
        "生命" + rating_to_grade(ratings, "生命"),
        "伤害" + rating_to_grade(ratings, "伤害"),
        "命中" + rating_to_grade(ratings, "命中"),
        "回避" + rating_to_grade(ratings, "回避"),
        "射速" + rating_to_grade(ratings, "攻速"),
        "护甲" + rating_to_grade(ratings, "护甲"),
        "移动" + rating_to_grade(ratings, "移速"),
        "穿甲" + rating_to_grade(ratings, "穿甲", "D"),
        "暴击" + rating_to_grade(ratings, "暴击", "C"),
        "弹链" + rating_to_grade(ratings, "弹链", "D"),
    ])
    skills = []
    for skill in detail.get("技能", [])[:2]:
        text = clean_cell(skill.get("表格文本"))
        if text and "Lv 1 Lv 5" != text:
            skills.append(text[:90])
    intro = clean_cell(atlas.get("简介") or detail.get("简介"))
    return {
        "敌人名称": name,
        "阵营": faction,
        "敌人类型": etype,
        "威胁等级": THREAT_BY_TYPE[etype],
        "基础档位": base_grade,
        "Boss标记": "是" if etype == "Boss" else "否",
        "章节绑定": CHAPTER_BINDINGS.get(name, ""),
        "标签": tags_for(name, faction, unit_type, ratings),
        "属性模板": "",
        "技能摘要": "；".join(skills) if skills else clean_cell(atlas.get("应对策略") or intro),
        "剧情定位": intro,
        "数据来源": "gf_enemy_data",
    }


def merge_manual(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    by_name = {row["敌人名称"]: row for row in rows}
    for manual in MANUAL_ROWS:
        current = by_name.get(manual["敌人名称"])
        if current:
            for key, value in manual.items():
                if value and (key in {"章节绑定", "剧情定位"} or not current.get(key)):
                    current[key] = value
            current["Boss标记"] = "是"
            current["敌人类型"] = "Boss"
            current["威胁等级"] = "章节Boss"
        else:
            by_name[manual["敌人名称"]] = manual
    return sorted(by_name.values(), key=lambda r: (r["阵营"], r["敌人名称"]))


def markdown_table(rows: List[Dict[str, str]]) -> str:
    lines = ["| " + " | ".join(HEADERS) + " |", "| " + " | ".join(["---"] * len(HEADERS)) + " |"]
    for row in rows:
        lines.append("| " + " | ".join(clean_cell(row.get(header, "")) for header in HEADERS) + " |")
    return "\n".join(lines)


def render(rows: List[Dict[str, str]]) -> str:
    return f"""# 敌人资料表

- uid: `sheet_enemy_data`
- orderNo: 17

## 可编辑说明

- 可以直接修改 `## 说明`，会回写到 `sourceData.note`。
- 可以直接修改 `## 更新规则`，但必须保持以下四行格式：`- 初始化: ...`、`- 更新: ...`、`- 插入: ...`、`- 删除: ...`。
- 可以直接修改 `## DDL` 中的 SQL，会回写到 `sourceData.ddl`（仅 SQLite 模式需要）。
- 可以直接修改 `## 当前内容` 下的 Markdown 表格，会回写到 `content`。
- 不要修改 `# 表名`、`uid`、`orderNo`。这些字段当前仅用于展示，不参与回写。

## 说明

- 静态敌方资料源，供战斗界面把 `<gfl-battle-encounter>` 中的新增敌人实例化为 `敌人配置表` 运行态数据。
- 本表不记录当前生命消耗；当前生命只写入 `敌人配置表`。
- `敌人名称` 必须与遭遇标签、章节 Boss、敌人配置表中的名称一致。
- `基础档位` 使用 `生命A,伤害B` 等格式；若 `属性模板` 提供具体数值，则前端优先使用属性模板。

## 更新规则

- 初始化: 从 `ref/gf_enemy_data` 导入官方敌方资料，并补入缺少官方战斗数值的剧情 Boss。
- 更新: 允许维护者根据官方资料或剧情设计修正敌人类型、章节绑定、标签、技能摘要和属性模板。
- 插入: 允许维护者新增剧情特殊敌人；新增 Boss 必须填写 `Boss标记=是`、`章节绑定` 和 `数据来源`。
- 删除: 禁止前端删除。废弃敌人应由维护者手工移除并同步章节世界书。

## DDL

```sql
CREATE TABLE enemy_data ( -- 敌人资料表
  row_id INTEGER PRIMARY KEY, -- 行号
  enemy_name TEXT NOT NULL UNIQUE, -- 敌人名称
  faction TEXT NOT NULL, -- 阵营
  enemy_type TEXT NOT NULL, -- 敌人类型
  threat_level TEXT NOT NULL, -- 威胁等级
  base_grade TEXT NOT NULL, -- 基础档位
  boss_flag TEXT NOT NULL CHECK(boss_flag IN ('是','否')), -- Boss标记
  chapter_binding TEXT, -- 章节绑定
  tags TEXT, -- 标签
  stat_template TEXT, -- 属性模板
  skill_summary TEXT, -- 技能摘要
  story_role TEXT, -- 剧情定位
  data_source TEXT NOT NULL -- 数据来源
);
```

## 当前内容

{markdown_table(rows)}

## 更新配置

```json
{{
  "uiSentinel": -1,
  "contextDepth": 3,
  "updateFrequency": 0,
  "batchSize": 5,
  "skipFloors": -1,
  "groupId": 2
}}
```

## 导出配置

```json
{{
  "enabled": false,
  "splitByRow": false,
  "entryName": "敌人资料表",
  "entryType": "constant",
  "keywords": "",
  "preventRecursion": true,
  "injectionTemplate": "",
  "extraIndexEnabled": false,
  "extraIndexEntryName": "敌人资料表-索引",
  "extraIndexColumns": [],
  "extraIndexColumnModes": {{}},
  "extraIndexInjectionTemplate": "",
  "entryPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 10160
  }},
  "extraIndexPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 8160
  }},
  "fixedEntryPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 99976
  }},
  "fixedIndexPlacement": {{
    "position": "at_depth_as_system",
    "depth": 10000,
    "order": 99977
  }}
}}
```
"""


def update_index() -> None:
    text = INDEX_FILE.read_text(encoding="utf-8")
    entry = "- [敌人资料表](./18-敌人资料表.md)"
    if entry in text:
        return
    text = text.replace("- [总章节表](./17-总章节表.md)\n", "- [总章节表](./17-总章节表.md)\n" + entry + "\n")
    INDEX_FILE.write_text(text, encoding="utf-8")


def main() -> None:
    if not ENEMY_ROOT.exists():
        raise SystemExit(f"敌人资料目录不存在: {ENEMY_ROOT}")
    rows = [row for row in (row_from_file(path) for path in iter_enemy_json_files()) if row]
    rows = merge_manual(rows)
    OUT_FILE.write_text(render(rows), encoding="utf-8")
    update_index()
    print(f"生成 {OUT_FILE}，共 {len(rows)} 条敌人资料")


if __name__ == "__main__":
    main()
