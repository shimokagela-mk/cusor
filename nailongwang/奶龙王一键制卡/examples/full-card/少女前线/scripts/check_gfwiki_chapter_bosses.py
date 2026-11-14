#!/usr/bin/env python3
"""核对 gfwiki 章节页面中的 Boss 候选证据。"""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Iterable

API_URL = "https://gfwiki.org/api.php"


@dataclass(frozen=True)
class ChapterCheck:
    chapter: str
    page: str
    candidates: tuple[str, ...]


CHECKS: tuple[ChapterCheck, ...] = (
    ChapterCheck("一苏醒·零种子", "主线章节/第一战役：苏醒", ("稻草人", "代理人", "刽子手")),
    ChapterCheck("二回声", "主线章节/第二战役：回声", ("刽子手", "猎手")),
    ChapterCheck("三沉默", "主线章节/第三战役：沉默", ("猎手", "干扰者")),
    ChapterCheck("四苏醒", "主线章节/第四战役：风声", ("干扰者", "破坏者")),
    ChapterCheck("五火种", "主线章节/第五战役：火种", ("破坏者", "炼金术士")),
    ChapterCheck("魔方行动+", "魔方行动", ("衔尾蛇", "猎手", "刽子手")),
    ChapterCheck("六彗星", "主线章节/第六战役：彗星", ("炼金术士", "代理人")),
    ChapterCheck("七同伴", "主线章节/第七战役：同伴", ("梦想家", "代理人")),
    ChapterCheck("失温症", "失温症", ("梦想家", "破坏者", "木星炮")),
    ChapterCheck("八火花", "主线章节/第八战役：火花", ("法官", "代理人")),
    ChapterCheck("深层映射", "深层映射", ("盖亚", "建筑师", "计量官", "Gager")),
    ChapterCheck("九迷失", "主线章节/第九战役：迷失", ("代理人", "法官")),
    ChapterCheck("十炼狱", "主线章节/第十战役：炼狱", ("伊莱莎", "主脑", "代理人")),
    ChapterCheck("塌缩点", "塌缩点/关卡", ("伊莱莎", "主脑", "刽子手", "猎手", "衔尾蛇")),
    ChapterCheck("有序紊流", "有序紊流", ("白涅托", "涅托", "帕拉蒂斯")),
    ChapterCheck("十一狩猎", "主线章节/第十一战役：狩猎", ("阿瑞斯", "白色势力", "涅托")),
    ChapterCheck("异构体", "异构体", ("尼梅兰", "白涅托", "涅托")),
    ChapterCheck("裂变链接", "裂变链接/关卡", ("阿瑞斯", "白涅托", "帕拉蒂斯")),
    ChapterCheck("十二喘息", "主线章节/第十二战役：喘息", ("卡特", "叶戈尔", "军方")),
    ChapterCheck("偏振光", "偏振光/关卡", ("阿瑞斯", "卡特", "帕拉蒂斯")),
    ChapterCheck("十三归墟", "主线章节/第十三战役：归墟", ("耶戈尔", "叶戈尔", "M16A1", "军方")),
    ChapterCheck("双联乱数", "双联乱数/关卡", ("默莉朵", "娜希斯", "涅托")),
    ChapterCheck("镜像论", "镜像论", ("娜希斯", "默莉朵", "格雷", "涅托")),
    ChapterCheck("熵减焓增", "熵减焓增", ("格雷", "威廉", "帕拉蒂斯")),
    ChapterCheck("静风点", "静风点/关卡", ("格雷", "威廉", "帕拉蒂斯")),
    ChapterCheck("纵向应变", "纵向应变/关卡", ("苏珊娜", "玛赫莲", "帕拉蒂斯")),
    ChapterCheck("慢休克", "慢休克", ("罪人", "威廉", "帕拉蒂斯")),
)


def fetch_wikitext(page: str) -> str:
    query = urllib.parse.urlencode({
        "action": "parse",
        "format": "json",
        "prop": "wikitext",
        "page": page,
    })
    request = urllib.request.Request(
        API_URL + "?" + query,
        headers={"User-Agent": "nailongwang-gfl-boss-check/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("parse", {}).get("wikitext", {}).get("*", "")


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def count_candidates(text: str, candidates: Iterable[str]) -> dict[str, int]:
    return {candidate: len(re.findall(re.escape(candidate), text, re.IGNORECASE)) for candidate in candidates}


def evidence_lines(text: str, candidates: Iterable[str], limit: int = 3) -> list[str]:
    patterns = [r".{0,45}(击败|boss|BOSS|Boss).{0,90}"]
    patterns.extend(r".{0,45}" + re.escape(candidate) + r".{0,90}" for candidate in candidates)
    evidence: list[str] = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
            line = compact(match.group(0))
            if line and line not in evidence:
                evidence.append(line)
            if len(evidence) >= limit:
                return evidence
    return evidence


def main() -> int:
    for check in CHECKS:
        try:
            text = fetch_wikitext(check.page)
            counts = count_candidates(text, check.candidates)
            evidence = evidence_lines(text, check.candidates)
            print(f"{check.chapter}\t{check.page}\t{json.dumps(counts, ensure_ascii=False)}\t" + (" | ".join(evidence) if evidence else "NO_EVIDENCE"))
        except Exception as error:
            print(f"{check.chapter}\t{check.page}\tERROR\t{type(error).__name__}: {error}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
