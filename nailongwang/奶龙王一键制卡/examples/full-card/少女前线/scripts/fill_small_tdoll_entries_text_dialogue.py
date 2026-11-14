#!/usr/bin/env python3
"""补全少女前线可疑小人形条目的文字剧情对话。

只处理 audit/small_tdoll_entries_text_dialogue_audit.json 中 has_text_dialogue=true 的条目。
只使用文字剧情/文字对话来源，不读取、不统计语音列表或语音文件。
默认 dry-run；传入 --apply 才会写入 entries。
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

CARD_ROOT = Path(__file__).resolve().parents[3]
PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENTRIES_DIR = PROJECT_ROOT / "entries"
AUDIT_INPUT = PROJECT_ROOT / "audit" / "small_tdoll_entries_text_dialogue_audit.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "audit" / "small_tdoll_entries_text_dialogue_fill_report.json"

TARGET_SECTION_MARKERS = (
    "## 履历",
    "## 声部一·社会",
    "## 声部二·内心",
    "## 声部三·他者",
    "## 声部四·作者",
)
SKIP_STORY_BASENAMES = {
    "all_characters_dialogue.json",
    "batch5_dialogue.json",
    "batch67_dialogue.json",
    "key_dialogue_condensed.json",
    "npc_dialogue.json",
    "剧情内容_完整.json",
    "剧情索引.json",
}

@dataclass(frozen=True)
class DialogueLine:
    source: str
    speaker: str
    text: str

@dataclass(frozen=True)
class FillRow:
    entry_file: str
    tdoll_name: str
    applied: bool
    own_dialogue_count: int
    own_dialogue_used: int
    other_mention_count: int
    other_mention_used: int
    source_count: int
    sources_used: list[str]
    skipped_reason: str


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_name(value: str) -> str:
    return re.sub(r"[\s_\-·.・,，.。'’\"“”()（）\[\]【】:：]+", "", value).lower()


def remove_timing_prefix(text: str) -> str:
    return re.sub(r"^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?)*:", "", text).strip()


def yaml_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def extract_keys_from_entry(text: str) -> list[str]:
    keys: list[str] = []
    in_keys = False
    for line in text.splitlines():
        if line.strip() == "keys:":
            in_keys = True
            continue
        if in_keys:
            if line.startswith("- "):
                keys.append(line[2:].strip().strip("'\""))
                continue
            if line and not line.startswith(" "):
                break
    return keys


def build_aliases(tdoll_name: str, entry_text: str) -> set[str]:
    aliases = {tdoll_name, normalize_name(tdoll_name)}
    for key in extract_keys_from_entry(entry_text):
        if key:
            aliases.add(key)
            aliases.add(normalize_name(key))
    aliases.add(tdoll_name.replace("-", ""))
    aliases.add(tdoll_name.replace(" ", ""))
    aliases.add(normalize_name(tdoll_name.replace("PP", "P")))
    if tdoll_name == "P2000":
        aliases.update({"PP2000", "PP-2000", "pp2000"})
    if tdoll_name == "特工416":
        aliases.update({"特工416", "HK416"})
    return {alias for alias in aliases if alias}


def speaker_matches(speaker: str, aliases: set[str]) -> bool:
    if not speaker:
        return False
    normalized_speaker = normalize_name(speaker)
    if normalized_speaker in aliases:
        return True
    normalized_aliases = {normalize_name(alias) for alias in aliases}
    return any(alias and (alias in normalized_speaker or normalized_speaker in alias) for alias in normalized_aliases)


def text_mentions_tdoll(text: str, aliases: set[str]) -> bool:
    normalized_text = normalize_name(text)
    normalized_aliases = {normalize_name(alias) for alias in aliases if len(normalize_name(alias)) >= 2}
    return any(alias in normalized_text for alias in normalized_aliases)


def flatten_dialogues(data: Any) -> list[dict[str, Any]]:
    dialogues: list[dict[str, Any]] = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                if "台词" in item:
                    dialogues.append(item)
                else:
                    dialogues.extend(flatten_dialogues(item))
        return dialogues
    if isinstance(data, dict):
        if isinstance(data.get("对话"), list):
            dialogues.extend(item for item in data["对话"] if isinstance(item, dict))
        for value in data.values():
            if isinstance(value, (dict, list)):
                dialogues.extend(flatten_dialogues(value))
    return dialogues


def source_is_leaf_story_json(relative_source: str) -> bool:
    path = Path(relative_source)
    if path.name in SKIP_STORY_BASENAMES:
        return False
    return path.suffix == ".json"


def collect_dialogue_from_json(relative_source: str, tdoll_name: str, aliases: set[str]) -> tuple[list[DialogueLine], list[DialogueLine]]:
    source_path = CARD_ROOT / relative_source
    if not source_path.exists() or source_path.suffix != ".json":
        return [], []
    try:
        data = read_json(source_path)
    except json.JSONDecodeError:
        return [], []
    own_lines: list[DialogueLine] = []
    mention_lines: list[DialogueLine] = []
    seen_own: set[tuple[str, str, str]] = set()
    seen_mentions: set[tuple[str, str, str]] = set()
    for item in flatten_dialogues(data):
        speaker = str(item.get("说话人", "")).strip()
        raw_text = str(item.get("台词", "")).strip()
        text = remove_timing_prefix(raw_text)
        if not text or text in {"……", "…………"}:
            continue
        own_key = (relative_source, speaker, text)
        if speaker_matches(speaker, aliases):
            if own_key not in seen_own:
                own_lines.append(DialogueLine(relative_source, speaker, text))
                seen_own.add(own_key)
            continue
        mention_key = (relative_source, speaker, text)
        if speaker and text_mentions_tdoll(text, aliases) and mention_key not in seen_mentions:
            mention_lines.append(DialogueLine(relative_source, speaker, text))
            seen_mentions.add(mention_key)
    return own_lines, mention_lines


def collect_entry_dialogues(row: dict[str, Any], entry_text: str) -> tuple[list[DialogueLine], list[DialogueLine], list[str]]:
    tdoll_name = row["tdoll_name"]
    aliases = build_aliases(tdoll_name, entry_text)
    source_candidates: list[str] = []
    for source in row.get("tdoll_text_dialogue_files", []):
        if source.endswith(".json"):
            source_candidates.append(source)
    for source in row.get("story_dialogue_matches", []):
        if source_is_leaf_story_json(source):
            source_candidates.append(source)

    own_lines: list[DialogueLine] = []
    mention_lines: list[DialogueLine] = []
    used_sources: list[str] = []
    seen_own_texts: set[tuple[str, str]] = set()
    seen_mention_texts: set[tuple[str, str, str]] = set()
    for source in source_candidates:
        source_own, source_mentions = collect_dialogue_from_json(source, tdoll_name, aliases)
        if source_own or source_mentions:
            used_sources.append(source)
        for line in source_own:
            key = (line.speaker, line.text)
            if key not in seen_own_texts:
                own_lines.append(line)
                seen_own_texts.add(key)
        for line in source_mentions:
            key = (line.source, line.speaker, line.text)
            if key not in seen_mention_texts:
                mention_lines.append(line)
                seen_mention_texts.add(key)
    return own_lines, mention_lines, used_sources


def format_dialogue_lines(lines: list[DialogueLine]) -> list[str]:
    output: list[str] = []
    for line in lines:
        output.append(f"  「{line.text}」（{line.speaker}）")
        output.append("")
    return output


def build_content_block(tdoll_name: str, old_text: str, own_lines: list[DialogueLine], mention_lines: list[DialogueLine], used_sources: list[str]) -> str:
    tag = tdoll_name
    first_line = f"\"{own_lines[0].text}\"" if own_lines else f"{tdoll_name}，格里芬战术人形。"

    lines: list[str] = [
        f"  <if db=\"db.出战配置表.where('人形名称','{tdoll_name}').exists()\">",
        f"  <{tag}>",
        "",
        "",
        "  ## 履历",
        "",
        f"  {first_line}",
        "",
        "",
        "  ## 声部一·社会",
        "",
    ]
    if own_lines:
        lines.extend(format_dialogue_lines(own_lines))
    else:
        lines.append("  [现有文字剧情来源中没有抽取到该角色作为说话人的台词。]")
        lines.append("")

    lines.extend([
        "",
        "  ## 声部二·内心",
        "",
    ])
    if own_lines:
        lines.append("  [当前补全来源为剧情对话，未包含可稳定区分的内心独白分类。]")
    else:
        lines.append("  [暂无可归类为内心独白的自身台词。]")
    lines.extend([
        "",
        "",
        "  ## 声部三·他者",
        "",
    ])
    if mention_lines:
        lines.extend(format_dialogue_lines(mention_lines))
    else:
        lines.append("  [现有文字剧情来源中没有抽取到明确他者提及。]")
        lines.append("")

    lines.extend([
        "",
        "  ## 声部四·作者",
        "",
        f"  **语言核心**：基于文字剧情台词补全，累计自身台词 {len(own_lines)} 条；他者提及 {len(mention_lines)} 条。",
        "",
        f"  {tdoll_name}的条目已按现有文字剧情来源补全。有效来源共 {len(used_sources)} 个；本次只使用文字剧情/文字对话，不使用语音列表、语音文件、图鉴、属性等普通资料。",
        "",
        "",
        f"  </{tag}>",
        "  </if>",
    ])
    return "content: |\n" + "\n".join(lines) + "\n"


def replace_content_block(entry_text: str, new_content_block: str) -> str:
    match = re.search(r"^content:\s*\|\n(?P<body>.*?)(?=^\S[^\n]*:\s*)", entry_text, re.MULTILINE | re.DOTALL)
    if not match:
        raise ValueError("无法定位 content: | 块")
    return entry_text[:match.start()] + new_content_block + entry_text[match.end():]


def validate_entry_structure(text: str, tdoll_name: str) -> None:
    for marker in TARGET_SECTION_MARKERS:
        if marker not in text:
            raise ValueError(f"缺少章节标记：{marker}")
    open_if = text.count("<if db=")
    close_if = text.count("</if>")
    if open_if != 1 or close_if != 1:
        raise ValueError(f"if 标签数量异常：open={open_if}, close={close_if}")
    if f"<{tdoll_name}>" not in text or f"</{tdoll_name}>" not in text:
        raise ValueError("角色标签缺失")


def build_report(apply: bool) -> dict[str, Any]:
    audit = read_json(AUDIT_INPUT)
    rows: list[FillRow] = []
    for row in audit["rows"]:
        if not row.get("has_text_dialogue"):
            continue
        entry_path = ENTRIES_DIR / row["entry_file"]
        old_text = entry_path.read_text(encoding="utf-8")
        own_lines, mention_lines, used_sources = collect_entry_dialogues(row, old_text)
        if not own_lines and not mention_lines:
            rows.append(
                FillRow(
                    entry_file=row["entry_file"],
                    tdoll_name=row["tdoll_name"],
                    applied=False,
                    own_dialogue_count=0,
                    own_dialogue_used=0,
                    other_mention_count=0,
                    other_mention_used=0,
                    source_count=0,
                    sources_used=[],
                    skipped_reason="有来源命中，但没有抽取到该角色自身台词或明确他者提及",
                )
            )
            continue
        new_content_block = build_content_block(row["tdoll_name"], old_text, own_lines, mention_lines, used_sources)
        new_text = replace_content_block(old_text, new_content_block)
        validate_entry_structure(new_text, row["tdoll_name"])
        changed = new_text != old_text
        if apply and changed:
            entry_path.write_text(new_text, encoding="utf-8")
        rows.append(
                FillRow(
                    entry_file=row["entry_file"],
                    tdoll_name=row["tdoll_name"],
                    applied=bool(apply and changed),
                    own_dialogue_count=len(own_lines),
                    own_dialogue_used=len(own_lines),
                    other_mention_count=len(mention_lines),
                    other_mention_used=len(mention_lines),
                    source_count=len(used_sources),
                    sources_used=used_sources,
                    skipped_reason="" if changed else "内容无变化",
                )
        )
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "mode": "apply" if apply else "dry-run",
        "rules": {
            "input_audit": str(AUDIT_INPUT),
            "entries_dir": str(ENTRIES_DIR),
            "write_rule": "写入全部抽取到的自身台词和明确他者提及，不做条数截断。",
            "source_rule": "只读取叶子文字剧情 JSON 与人形目录剧情 JSON；跳过 batch/all_characters/npc/key/索引/完整汇总；按说话人匹配抽取自身台词，按台词内容匹配抽取他者提及。",
        },
        "summary": {
            "candidate_entries": len([row for row in audit["rows"] if row.get("has_text_dialogue")]),
            "entries_with_extracted_dialogue": sum(1 for row in rows if row.own_dialogue_count or row.other_mention_count),
            "entries_applied": sum(1 for row in rows if row.applied),
            "entries_skipped_after_extraction": sum(1 for row in rows if row.skipped_reason),
            "total_own_dialogue_count": sum(row.own_dialogue_count for row in rows),
            "total_own_dialogue_used": sum(row.own_dialogue_used for row in rows),
            "total_other_mention_count": sum(row.other_mention_count for row in rows),
            "total_other_mention_used": sum(row.other_mention_used for row in rows),
        },
        "rows": [asdict(row) for row in rows],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="补全有文字来源的可疑小人形 entries。")
    parser.add_argument("--apply", action="store_true", help="实际写入 entries；默认只生成 dry-run 报告。")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="补全报告 JSON 输出路径。")
    args = parser.parse_args()

    report = build_report(args.apply)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = report["summary"]
    print(f"模式：{report['mode']}")
    print(f"输出报告：{args.output}")
    print(f"候选条目：{summary['candidate_entries']}")
    print(f"抽取到对话/提及：{summary['entries_with_extracted_dialogue']}")
    print(f"实际写入：{summary['entries_applied']}")
    print(f"自身台词：{summary['total_own_dialogue_count']}，写入：{summary['total_own_dialogue_used']}")
    print(f"他者提及：{summary['total_other_mention_count']}，写入：{summary['total_other_mention_used']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
