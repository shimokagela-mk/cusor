#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成战斗前端内置敌人目录。

运行时战斗页面不再读取“敌人资料表”，而是使用本脚本根据战役世界书敌人池
和 gf_enemy_data/维护者补全数据生成的静态目录。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_OUT = PROJECT_ROOT / "frontend" / "gfl-battle-enemy-catalog.js"
RELEASE_OUT = PROJECT_ROOT / "release" / "少女前线-战斗敌人目录.json"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from generate_enemy_data_table import iter_enemy_json_files, merge_manual, row_from_file  # noqa: E402

STAT_KEYS = ["生命", "伤害", "命中", "回避", "射速", "护甲", "移动", "穿甲", "暴击", "弹链"]

MANUAL_ENEMIES: Dict[str, Dict[str, str]] = {
    "铁血主脑（傀儡）": {
        "阵营": "铁血工造",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命S,伤害B,命中A,回避B,射速B,护甲D,移动D,穿甲D,暴击C,弹链D",
        "Boss标记": "是",
        "标签": "铁血工造,主脑,剧情Boss,傀儡,高命中",
        "技能摘要": "以远程指挥与傀儡接入压迫战场，不作为完全体伊莱莎处理。",
        "剧情定位": "铁血主脑在早期战役中的代理投影或傀儡节点，强调指挥压迫而非完全体降临。",
    },
    "梦想家（傀儡）": {
        "阵营": "铁血工造",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命B,伤害A,命中A,回避B,射速B,护甲D,移动B,穿甲D,暴击C,弹链D",
        "Boss标记": "是",
        "标签": "铁血工造,傀儡,远程打击,剧情Boss,高命中",
        "技能摘要": "以远距火力和虚假投影干扰战场，耐久低于本体但输出仍然危险。",
        "剧情定位": "梦想家用于拖延或诱导格里芬行动的傀儡体。",
    },
    "铁血主脑·伊莱莎": {
        "阵营": "铁血工造",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命S,伤害A,命中A,回避B,射速B,护甲D,移动D,穿甲D,暴击C,弹链D",
        "Boss标记": "是",
        "标签": "铁血工造,主脑,心智入侵,剧情Boss,高命中",
        "技能摘要": "通过心智入侵和远程指挥强化铁血单位，适合作为阶段性压迫源。",
        "剧情定位": "伊莱莎在心智战线中的主动介入形态。",
    },
    "军方人形": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命B,伤害B,命中B,回避C,射速B,护甲C,移动C,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "正规军,普通人形,装甲,高命中",
        "技能摘要": "标准军方火力小组，命中稳定并具备基础护甲。",
        "剧情定位": "叶戈尔指挥下执行封锁、搜索和压制任务的正规军人形。",
    },
    "军方封锁部队": {
        "阵营": "正规军",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命A,伤害B,命中A,回避C,射速B,护甲A,移动C,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "正规军,封锁部队,装甲,高命中",
        "技能摘要": "以装甲火力和区域封锁压制撤离路线。",
        "剧情定位": "拒绝联合行动或军方施压时出现的区域封锁单位。",
    },
    "军方封锁部队指挥官": {
        "阵营": "正规军",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避B,射速B,护甲A,移动C,穿甲A,暴击B,弹链B",
        "Boss标记": "是",
        "标签": "正规军,指挥官,装甲,剧情Boss",
        "技能摘要": "以火力协调和封锁命令提升军方单位压迫感。",
        "剧情定位": "军方封锁线的现场指挥节点。",
    },
    "军方巡逻人形": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命B,伤害B,命中B,回避C,射速B,护甲C,移动C,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "正规军,巡逻,普通人形,装甲",
        "技能摘要": "常规巡逻单位，适合中低强度遭遇战。",
        "剧情定位": "城市、封锁线和撤离路径中的军方巡逻单位。",
    },
    "军方自律部队指挥官": {
        "阵营": "正规军",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避B,射速B,护甲A,移动C,穿甲A,暴击B,弹链B",
        "Boss标记": "是",
        "标签": "正规军,自律部队,指挥官,剧情Boss",
        "技能摘要": "指挥自律部队进行围堵和火力交叉压制。",
        "剧情定位": "低氧适应阶段军方自律部队的现场指挥核心。",
    },
    "军方装甲列车先遣队": {
        "阵营": "正规军",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命S,伤害A,命中A,回避D,射速B,护甲S,移动D,穿甲A,暴击B,弹链B",
        "Boss标记": "否",
        "标签": "正规军,装甲列车,重装,装甲,高命中",
        "技能摘要": "重装火力先遣单位，移速低但护甲和压制能力极强。",
        "剧情定位": "洲际列车与军方重装线索提前接触时的高危遭遇。",
    },
    "被【伞】病毒感染的格里芬人形": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "高",
        "基础档位": "生命B,伤害B,命中B,回避B,射速B,护甲D,移动B,穿甲C,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,普通人形,高闪避",
        "技能摘要": "保留原战术人形作战习惯但识别敌我错误，适合制造混乱和误伤压力。",
        "剧情定位": "伞病毒释放后失控并攻击己方设施与人员的格里芬人形。",
    },
    "被【伞】感染的格里芬人形残余": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "中",
        "基础档位": "生命C,伤害B,命中B,回避B,射速B,护甲D,移动B,穿甲C,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,残余单位",
        "技能摘要": "残余感染单位状态不稳定，威胁低于完整感染梯队。",
        "剧情定位": "伞病毒事件后的零散失控单位。",
    },
    "涅托": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避A,射速A,护甲C,移动B,穿甲A,暴击A,弹链B",
        "Boss标记": "是",
        "标签": "帕拉蒂斯,涅托,力场盾,高闪避,高命中,剧情Boss",
        "技能摘要": "具备力场盾、无信号压制和主动突击能力。",
        "剧情定位": "帕拉蒂斯白色势力的阶段性强敌统称。",
    },
    "涅托突击队": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命A,伤害A,命中A,回避B,射速A,护甲C,移动B,穿甲A,暴击B,弹链B",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,突击队,高命中",
        "技能摘要": "多个涅托单位协同进攻，强调集火和快速突破。",
        "剧情定位": "相变跃迁阶段的帕拉蒂斯突击集群。",
    },
    "涅托白色单位": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命B,伤害B,命中B,回避B,射速B,护甲C,移动B,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,白色势力,普通人形",
        "技能摘要": "白色势力基础作战单位，综合能力均衡。",
        "剧情定位": "帕拉蒂斯在城市和撤离线中的常规单位。",
    },
    "涅托追踪者": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命B,伤害A,命中A,回避A,射速B,护甲C,移动A,穿甲B,暴击B,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,追踪,高闪避,高命中",
        "技能摘要": "擅长隐蔽追踪和城市突袭，机动性高。",
        "剧情定位": "低氧适应阶段在城市环境中追踪格里芬残部的帕拉蒂斯单位。",
    },
    "涅托下水道部队": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命B,伤害B,命中B,回避A,射速B,护甲C,移动A,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,城市战,高闪避",
        "技能摘要": "利用地下管网接近目标，适合伏击和切断撤离路线。",
        "剧情定位": "城市下水道和地下通道中的帕拉蒂斯追击部队。",
    },
    "白色势力追踪人形": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命B,伤害B,命中A,回避B,射速B,护甲C,移动B,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,白色势力,追踪,高命中",
        "技能摘要": "持续追踪目标信号，命中稳定。",
        "剧情定位": "白色势力用于追捕格里芬和AR小队残部的常规追踪单位。",
    },
    "军方突击人形": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命B,伤害B,命中B,回避C,射速B,护甲C,移动C,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "正规军,突击人形,装甲,高命中",
        "技能摘要": "标准军方突击单位，火力和命中稳定。",
        "剧情定位": "叶戈尔指挥下执行推进、清剿和封锁任务的具体军方人形。",
    },
    "军方盾卫人形": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命A,伤害C,命中B,回避D,射速C,护甲A,移动D,穿甲B,暴击D,弹链D",
        "Boss标记": "否",
        "标签": "正规军,盾卫人形,装甲,重防御",
        "技能摘要": "携带重型防护模组，负责顶线和掩护。",
        "剧情定位": "军方封锁线中承担正面抗压的具体实体。",
    },
    "军方狙击人形": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命C,伤害A,命中A,回避C,射速D,护甲D,移动C,穿甲A,暴击A,弹链D",
        "Boss标记": "否",
        "标签": "正规军,狙击人形,高命中,高穿甲",
        "技能摘要": "远程精确火力单位，低射速但单发威胁高。",
        "剧情定位": "军方封锁和屠杀行动中的远程压制实体。",
    },
    "被【伞】病毒感染的格里芬突击人形": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "高",
        "基础档位": "生命B,伤害B,命中B,回避B,射速B,护甲D,移动B,穿甲C,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,突击人形,高闪避",
        "技能摘要": "保留突击战术习惯但敌我识别失控。",
        "剧情定位": "伞病毒释放后被迫攻击己方设施的具体失控单位。",
    },
    "被【伞】病毒感染的格里芬火力人形": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "高",
        "基础档位": "生命B,伤害A,命中B,回避C,射速C,护甲D,移动C,穿甲B,暴击B,弹链B",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,火力人形",
        "技能摘要": "失控后持续输出火力，适合制造阵地压力。",
        "剧情定位": "伞病毒释放后的重火力失控单位。",
    },
    "被【伞】病毒感染的格里芬护卫人形": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "中",
        "基础档位": "生命A,伤害C,命中B,回避C,射速C,护甲B,移动C,穿甲C,暴击D,弹链D",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,护卫人形,装甲",
        "技能摘要": "失控后仍执行护卫和阻拦行为。",
        "剧情定位": "伞病毒释放后的防御型失控单位。",
    },
    "涅托下水道突击者": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命B,伤害B,命中B,回避A,射速B,护甲C,移动A,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,城市战,下水道,高闪避",
        "技能摘要": "利用地下管网近距离突入，机动性强。",
        "剧情定位": "贝莱格莱德地下通道中的帕拉蒂斯突击实体。",
    },
    "涅托下水道狙击者": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命B,伤害A,命中A,回避B,射速C,护甲C,移动B,穿甲A,暴击B,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,城市战,下水道,高命中",
        "技能摘要": "在地下空间利用长走廊进行精确压制。",
        "剧情定位": "贝莱格莱德地下通道中的帕拉蒂斯远程实体。",
    },
    "被【伞】感染的格里芬突击残余": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "中",
        "基础档位": "生命C,伤害B,命中B,回避B,射速B,护甲D,移动B,穿甲C,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,残余单位,突击人形",
        "技能摘要": "残余感染突击单位，状态不稳定。",
        "剧情定位": "溃败线中散落的伞病毒感染残余实体。",
    },
    "被【伞】感染的格里芬火力残余": {
        "阵营": "失控格里芬",
        "敌人类型": "剧情特殊",
        "威胁等级": "中",
        "基础档位": "生命C,伤害B,命中B,回避C,射速C,护甲D,移动C,穿甲B,暴击C,弹链B",
        "Boss标记": "否",
        "标签": "失控格里芬,伞病毒,残余单位,火力人形",
        "技能摘要": "残余感染火力单位，输出不稳定但仍有威胁。",
        "剧情定位": "溃败线中散落的伞病毒感染火力实体。",
    },
    "叶戈尔": {
        "阵营": "正规军",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避B,射速B,护甲A,移动C,穿甲A,暴击B,弹链B",
        "Boss标记": "是",
        "标签": "正规军,叶戈尔,指挥官,剧情Boss,装甲",
        "技能摘要": "以军方指挥链协调装甲列车、步兵中队和机甲推进，个人威胁主要来自战术指挥与机甲协同。",
        "剧情定位": "临界质量阶段的军方叛军指挥官，负责推进帕尔迪斯基控制室。",
    },
    "负罪者机甲": {
        "阵营": "正规军",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命S,伤害S,命中A,回避D,射速B,护甲S,移动D,穿甲S,暴击B,弹链B",
        "Boss标记": "是",
        "标签": "正规军,负罪者机甲,重装,装甲,高穿甲,最终战",
        "技能摘要": "重型装甲机体，具备高爆导弹、重型机枪和动力足踩踏，正面抗压与爆发火力极强。",
        "剧情定位": "叶戈尔驾驶的最终战重装机甲，是临界质量阶段最强物理敌人。",
    },
    "M16A1": {
        "阵营": "铁血工造",
        "敌人类型": "Boss",
        "威胁等级": "章节Boss",
        "基础档位": "生命A,伤害A,命中A,回避A,射速B,护甲C,移动A,穿甲A,暴击A,弹链B",
        "Boss标记": "是",
        "标签": "铁血工造,M16A1,AR小队,OGAS,剧情Boss,高闪避",
        "技能摘要": "铁血化后的高机动 Boss，具备OGAS强化、蓝色光芒攻击和极强的单兵判断能力。",
        "剧情定位": "逆向坍塌阶段基地底层的守护者，阻止M4A1接触海星。",
    },
    "喙": {
        "阵营": "铁血工造",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命B,伤害A,命中A,回避B,射速A,护甲C,移动A,穿甲B,暴击B,弹链D",
        "Boss标记": "否",
        "标签": "铁血工造,铁血头目,机车,高速巡逻,高命中",
        "技能摘要": "驾驶重型机车高速巡逻，依靠机动火力封锁通道，适合中层遭遇战。",
        "剧情定位": "帕尔迪斯基基地中层的铁血新型头目，负责阻止格里芬深入底层。",
    },
    "涅托残余指挥官": {
        "阵营": "帕拉蒂斯",
        "敌人类型": "精英",
        "威胁等级": "高",
        "基础档位": "生命A,伤害A,命中A,回避B,射速B,护甲C,移动B,穿甲A,暴击B,弹链D",
        "Boss标记": "否",
        "标签": "帕拉蒂斯,涅托,残余指挥官,力场盾,高命中",
        "技能摘要": "指挥残余涅托单位驻守实验区域，依靠力场盾和无信号特性拖延格里芬推进。",
        "剧情定位": "临界质量阶段驻守帕尔迪斯基实验区域的帕拉蒂斯残余指挥实体。",
    },
    "军方步兵人形": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命B,伤害B,命中B,回避C,射速B,护甲C,移动C,穿甲B,暴击C,弹链D",
        "Boss标记": "否",
        "标签": "正规军,步兵人形,装甲,高命中",
        "技能摘要": "标准军方步兵单位，适合数量压制和阵地推进。",
        "剧情定位": "叶戈尔装甲列车随行的步兵特混中队基础实体。",
    },
    "军方装甲列车护卫": {
        "阵营": "正规军",
        "敌人类型": "普通",
        "威胁等级": "中",
        "基础档位": "生命A,伤害B,命中B,回避D,射速B,护甲A,移动D,穿甲A,暴击C,弹链B",
        "Boss标记": "否",
        "标签": "正规军,装甲列车,护卫,重装,装甲",
        "技能摘要": "围绕装甲列车展开护卫和火力支援，移动迟缓但护甲与穿甲能力优秀。",
        "剧情定位": "帕尔迪斯基地面层装甲列车防线的护卫实体。",
    },
    "琥珀1号僚机": {
        "阵营": "正规军",
        "敌人类型": "剧情特殊",
        "威胁等级": "高",
        "基础档位": "生命A,伤害A,命中A,回避D,射速B,护甲A,移动C,穿甲A,暴击B,弹链B",
        "Boss标记": "否",
        "标签": "正规军,负罪者机甲僚机,琥珀1,重装,装甲",
        "技能摘要": "负罪者机甲僚机，负责侧翼火力、压制伏击点和保护主机推进。",
        "剧情定位": "叶戈尔机甲编队的第一台僚机，参与临界质量阶段第三电机房阻击战。",
    },
    "琥珀3号僚机": {
        "阵营": "正规军",
        "敌人类型": "剧情特殊",
        "威胁等级": "高",
        "基础档位": "生命A,伤害A,命中A,回避D,射速B,护甲A,移动C,穿甲A,暴击B,弹链B",
        "Boss标记": "否",
        "标签": "正规军,负罪者机甲僚机,琥珀3,重装,装甲",
        "技能摘要": "负罪者机甲僚机，负责交叉火力和侧翼掩护，火力弱于主机但仍具高威胁。",
        "剧情定位": "叶戈尔机甲编队的第三台僚机，参与临界质量阶段第三电机房阻击战。",
    },
}

DEFAULT_FALLBACK_TEMPLATES = {
    "sangvis_grunt": {
        "label": "铁血默认普通单位",
        "matchKeywords": ["铁血", "巡逻", "侦察", "突击", "机械", "人形"],
        "row": {
            "enemyName": "临时铁血单位",
            "faction": "铁血工造",
            "enemyType": "普通",
            "threatLevel": "中",
            "baseGrade": "生命C,伤害C,命中C,回避C,射速C,护甲D,移动C,穿甲D,暴击C,弹链D",
            "bossFlag": "否",
            "chapterBinding": "*",
            "tags": "铁血工造,容错模板,普通单位",
            "statTemplate": "",
            "skillSummary": "正文敌人名无法匹配时生成的铁血普通临时单位。",
            "storyRole": "用于兼容正文生成错误敌人名的战斗兜底单位。",
            "dataSource": "战斗前端容错模板",
        },
    },
    "sangvis_elite": {
        "label": "铁血默认精英单位",
        "matchKeywords": ["精英铁血", "铁血精英", "重装铁血", "铁血队长"],
        "row": {
            "enemyName": "临时铁血精英",
            "faction": "铁血工造",
            "enemyType": "精英",
            "threatLevel": "高",
            "baseGrade": "生命B,伤害B,命中B,回避B,射速B,护甲C,移动B,穿甲B,暴击C,弹链D",
            "bossFlag": "否",
            "chapterBinding": "*",
            "tags": "铁血工造,容错模板,精英单位",
            "statTemplate": "",
            "skillSummary": "正文敌人名无法匹配时生成的铁血精英临时单位。",
            "storyRole": "用于兼容正文生成错误精英敌人名的战斗兜底单位。",
            "dataSource": "战斗前端容错模板",
        },
    },
    "military": {
        "label": "军方默认单位",
        "matchKeywords": ["军方", "正规军", "叶戈尔", "封锁", "自律"],
        "row": {
            "enemyName": "临时军方单位",
            "faction": "正规军",
            "enemyType": "普通",
            "threatLevel": "中",
            "baseGrade": "生命B,伤害B,命中B,回避C,射速B,护甲C,移动C,穿甲B,暴击C,弹链D",
            "bossFlag": "否",
            "chapterBinding": "*",
            "tags": "正规军,容错模板,装甲,高命中",
            "statTemplate": "",
            "skillSummary": "正文敌人名无法匹配时生成的军方临时单位。",
            "storyRole": "用于兼容正文生成错误军方敌人名的战斗兜底单位。",
            "dataSource": "战斗前端容错模板",
        },
    },
    "paradeus": {
        "label": "帕拉蒂斯默认单位",
        "matchKeywords": ["涅托", "帕拉蒂斯", "白色", "威廉", "力场"],
        "row": {
            "enemyName": "临时帕拉蒂斯单位",
            "faction": "帕拉蒂斯",
            "enemyType": "普通",
            "threatLevel": "中",
            "baseGrade": "生命B,伤害B,命中B,回避B,射速B,护甲C,移动B,穿甲B,暴击C,弹链D",
            "bossFlag": "否",
            "chapterBinding": "*",
            "tags": "帕拉蒂斯,容错模板,白色势力",
            "statTemplate": "",
            "skillSummary": "正文敌人名无法匹配时生成的帕拉蒂斯临时单位。",
            "storyRole": "用于兼容正文生成错误帕拉蒂斯敌人名的战斗兜底单位。",
            "dataSource": "战斗前端容错模板",
        },
    },
    "infected": {
        "label": "感染格里芬默认单位",
        "matchKeywords": ["感染", "伞", "失控", "格里芬"],
        "row": {
            "enemyName": "临时感染格里芬单位",
            "faction": "失控格里芬",
            "enemyType": "剧情特殊",
            "threatLevel": "中",
            "baseGrade": "生命B,伤害B,命中B,回避B,射速B,护甲D,移动B,穿甲C,暴击C,弹链D",
            "bossFlag": "否",
            "chapterBinding": "*",
            "tags": "失控格里芬,容错模板,伞病毒",
            "statTemplate": "",
            "skillSummary": "正文敌人名无法匹配时生成的感染格里芬临时单位。",
            "storyRole": "用于兼容正文生成错误感染敌人名的战斗兜底单位。",
            "dataSource": "战斗前端容错模板",
        },
    },
    "unknown": {
        "label": "未知默认单位",
        "matchKeywords": [],
        "row": {
            "enemyName": "临时未知敌人",
            "faction": "未知势力",
            "enemyType": "普通",
            "threatLevel": "中",
            "baseGrade": "生命C,伤害C,命中C,回避C,射速C,护甲D,移动C,穿甲D,暴击C,弹链D",
            "bossFlag": "否",
            "chapterBinding": "*",
            "tags": "未知势力,容错模板",
            "statTemplate": "",
            "skillSummary": "正文敌人名无法匹配任何阵营时生成的临时单位。",
            "storyRole": "用于兼容正文生成错误敌人名的最终兜底单位。",
            "dataSource": "战斗前端容错模板",
        },
    },
}

ALIAS_MAP = {
    "刽子手": "刽子手",
    "铁血主脑": "铁血主脑·伊莱莎",
    "铁血主脑（傀儡）": "铁血主脑（傀儡）",
    "梦想家（傀儡）": "梦想家（傀儡）",
    "铁血主脑·伊莱莎": "铁血主脑·伊莱莎",
    "涅托 怒锤": "怒锤涅托",
    "涅托 鹰眼": "鹰眼涅托",
    "涅托 巡卫": "巡卫涅托",
    "涅托 辅翼": "辅翼涅托",
}


def split_enemy_list(text: str) -> List[str]:
    parts: List[str] = []
    buf: List[str] = []
    depth = 0
    for ch in text:
        if ch in "（(":
            depth += 1
            buf.append(ch)
        elif ch in "）)":
            depth = max(0, depth - 1)
            buf.append(ch)
        elif ch in "、，," and depth == 0:
            part = "".join(buf).strip()
            if part:
                parts.append(part)
            buf = []
        else:
            buf.append(ch)
    part = "".join(buf).strip()
    if part:
        parts.append(part)
    return parts


def normalize_enemy_name(raw: str) -> List[str]:
    text = raw.strip().strip(" -*\t\r\n")
    if not text:
        return []
    text = re.sub(r"^\*+|\*+$", "", text).strip()
    match = re.match(r"([^（(]+)[（(]([^）)]*)[）)]", text)
    if match:
        base = match.group(1).strip()
        note = match.group(2).strip()
        if base == "铁血散兵":
            return [item.strip() for item in split_enemy_list(note) if item.strip()]
        if base in {"梦想家", "铁血主脑"} and "傀儡" in note:
            return [f"{base}（傀儡）"]
        return [base]
    return [text]


def extract_chapter_enemy_pools() -> Dict[str, Dict[str, List[str]]]:
    pools: Dict[str, Dict[str, List[str]]] = {}
    enemy_pool_heading = re.compile(r"^\s*##\s*[一二三四五六七八九十百千万0-9]+[、.．]?敌人池\s*$", re.MULTILINE)
    for path in sorted((PROJECT_ROOT / "entries").glob("*战役-*.yaml")):
        text = path.read_text(encoding="utf-8")
        heading_match = enemy_pool_heading.search(text)
        if not heading_match:
            continue
        chapter_match = re.search(r"comment:\s*[\"']?([^（\"']+)", text)
        chapter_name = chapter_match.group(1).strip() if chapter_match else path.stem.split("-战役-", 1)[-1]
        section = text[heading_match.end():].split("</战役>", 1)[0]
        group_map: Dict[str, List[str]] = {}
        for line in section.splitlines():
            if "：" not in line:
                continue
            left, right = line.split("：", 1)
            group = re.sub(r"[^\u4e00-\u9fa5A-Za-z0-9]+", "", left) or "敌人"
            if "容错" in group:
                continue
            names: List[str] = []
            for part in split_enemy_list(right):
                names.extend(normalize_enemy_name(part))
            names = [name for name in names if name and name != "无" and "正文生成" not in name]
            if not names:
                continue
            bucket = group_map.setdefault(group, [])
            for name in names:
                if name and name not in bucket:
                    bucket.append(name)
        if group_map:
            pools[chapter_name] = group_map
    return pools


def base_rows_by_name() -> Dict[str, Dict[str, str]]:
    rows = [row for row in (row_from_file(path) for path in iter_enemy_json_files()) if row]
    rows = merge_manual(rows)
    out = {row["敌人名称"]: row for row in rows}
    for name, row in MANUAL_ENEMIES.items():
        full = {
            "敌人名称": name,
            "阵营": row["阵营"],
            "敌人类型": row["敌人类型"],
            "威胁等级": row["威胁等级"],
            "基础档位": row["基础档位"],
            "Boss标记": row["Boss标记"],
            "章节绑定": "",
            "标签": row["标签"],
            "属性模板": "",
            "技能摘要": row["技能摘要"],
            "剧情定位": row["剧情定位"],
            "数据来源": "战役世界书补全",
        }
        out[name] = full
    return out


def infer_missing_enemy(name: str, group: str) -> Dict[str, str]:
    if "军方" in name:
        faction = "正规军"
        base = "生命B,伤害B,命中B,回避C,射速B,护甲C,移动C,穿甲B,暴击C,弹链D"
        tags = "正规军,战役补全,高命中"
    elif "涅托" in name or "白色势力" in name:
        faction = "帕拉蒂斯"
        base = "生命B,伤害B,命中B,回避B,射速B,护甲C,移动B,穿甲B,暴击C,弹链D"
        tags = "帕拉蒂斯,战役补全,高命中"
    elif "感染" in name or "伞" in name:
        faction = "失控格里芬"
        base = "生命B,伤害B,命中B,回避B,射速B,护甲D,移动B,穿甲C,暴击C,弹链D"
        tags = "失控格里芬,战役补全,伞病毒"
    else:
        faction = "其他势力"
        base = "生命C,伤害C,命中C,回避C,射速C,护甲D,移动C,穿甲D,暴击C,弹链D"
        tags = "其他势力,战役补全"
    is_boss = "Boss" in group or "指挥官" in name
    return {
        "敌人名称": name,
        "阵营": faction,
        "敌人类型": "Boss" if is_boss else ("精英" if "精英" in group else "普通"),
        "威胁等级": "章节Boss" if is_boss else ("高" if "精英" in group else "中"),
        "基础档位": base,
        "Boss标记": "是" if is_boss else "否",
        "章节绑定": "",
        "标签": tags,
        "属性模板": "",
        "技能摘要": "根据战役世界书敌人池补全的战斗单位，属性按阵营定位和阶段威胁设计。",
        "剧情定位": f"{name}：来自战役世界书敌人池的补全单位。",
        "数据来源": "战役世界书推导",
    }


def project_row(row: Dict[str, str], chapter: str) -> Dict[str, str]:
    return {
        "enemyName": row.get("敌人名称", ""),
        "faction": row.get("阵营", ""),
        "enemyType": row.get("敌人类型", "普通"),
        "threatLevel": row.get("威胁等级", "中"),
        "baseGrade": row.get("基础档位", ""),
        "bossFlag": row.get("Boss标记", "否"),
        "chapterBinding": chapter,
        "tags": row.get("标签", ""),
        "statTemplate": row.get("属性模板", ""),
        "skillSummary": row.get("技能摘要", ""),
        "storyRole": row.get("剧情定位", ""),
        "dataSource": row.get("数据来源", ""),
    }


def build_catalog() -> Tuple[Dict[str, Dict[str, Dict[str, str]]], Dict[str, List[str]]]:
    pools = extract_chapter_enemy_pools()
    rows = base_rows_by_name()
    catalog: Dict[str, Dict[str, Dict[str, str]]] = {}
    missing: Dict[str, List[str]] = {}
    for chapter, groups in pools.items():
        chapter_catalog: Dict[str, Dict[str, str]] = {}
        for group, names in groups.items():
            for name in names:
                canonical_name = ALIAS_MAP.get(name, name)
                row = rows.get(canonical_name) or rows.get(name)
                if not row:
                    row = infer_missing_enemy(canonical_name, group)
                    rows[canonical_name] = row
                    missing.setdefault(chapter, []).append(canonical_name)
                chapter_catalog[canonical_name] = project_row(row, chapter)
        catalog[chapter] = chapter_catalog
    return catalog, missing


def render_payload(catalog: Dict[str, Dict[str, Dict[str, str]]], missing: Dict[str, List[str]]) -> Dict[str, object]:
    return {
        "version": "2026-06-02-static-campaign-enemies",
        "source": "entries/*战役-*.yaml enemy pools + gf_enemy_data + manual inferred enemies + fallback templates",
        "catalog": catalog,
        "fallbackTemplates": DEFAULT_FALLBACK_TEMPLATES,
        "inferredEnemies": missing,
    }


def render_js(catalog: Dict[str, Dict[str, Dict[str, str]]], missing: Dict[str, List[str]]) -> str:
    json_text = json.dumps(render_payload(catalog, missing), ensure_ascii=False, indent=2).replace("</script", "<\\/script")
    return """/* Generated by scripts/build_battle_enemy_catalog.py. Do not edit by hand. */
(function(){
  'use strict';
  window.GFLBattleEnemyCatalog = %s;
})();
""" % json_text


def main() -> None:
    catalog, missing = build_catalog()
    FRONTEND_OUT.write_text(render_js(catalog, missing), encoding="utf-8")
    RELEASE_OUT.write_text(json.dumps(render_payload(catalog, missing), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(len(v) for v in catalog.values())
    print(f"生成 {FRONTEND_OUT}，{len(catalog)} 个章节，{total} 条章节敌人绑定")
    if missing:
        print("补全缺失敌人：")
        for chapter, names in missing.items():
            print(f"- {chapter}: {'、'.join(names)}")


if __name__ == "__main__":
    main()
