#!/usr/bin/env python3
"""审计少女前线可疑小人形 entries 是否有对应文字对话来源。

本脚本只读取数据并生成 JSON 留痕，不修改 entries 正文。
可疑标准固定为：当前文件小于 2048 bytes，或小于 50 行。
有效来源口径固定为：只统计文字剧情/文字对话，不统计语音列表、语音文件、图鉴、属性等普通资料。
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

CARD_ROOT = Path(__file__).resolve().parents[3]
PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENTRIES_DIR = PROJECT_ROOT / "entries"
TDOLL_DATA_DIR = CARD_ROOT / "ref" / "gf_tdoll_data"
STORY_DATA_DIR = CARD_ROOT / "ref" / "gf_story_data"
DEFAULT_OUTPUT = PROJECT_ROOT / "audit" / "small_tdoll_entries_text_dialogue_audit.json"

TARGET_UID_MIN = 100
TARGET_UID_MAX = 550
EXPECTED_TARGET_COUNT = 451
SMALL_FILE_SIZE_BYTES = 2048
SMALL_FILE_LINE_COUNT = 50
MAX_MATCH_FILES = 50

TEXT_DIALOGUE_FILENAMES = {
    "10_剧情整理.json",
    "10_剧情整理_完整.json",
}
TEXT_DIALOGUE_DIRNAME = "10_剧情内容"
IGNORED_NON_TEXT_DIALOGUE_PREFIXES = (
    "09_语音列表",
    "09_语音文件",
)

@dataclass(frozen=True)
class EntryInfo:
    uid: int
    entry_file: str
    tdoll_name: str
    size_bytes: int
    line_count: int
    is_small: bool

@dataclass(frozen=True)
class TdollTextDialogueInfo:
    tdoll_data_match_count: int
    tdoll_data_matches: list[str]
    tdoll_text_dialogue_files: list[str]
    tdoll_text_dialogue_file_count: int
    tdoll_text_dialogue_has_content: bool

@dataclass(frozen=True)
class AuditRow:
    uid: int
    entry_file: str
    tdoll_name: str
    size_bytes: int
    line_count: int
    small_reasons: list[str]
    tdoll_data_match_count: int
    tdoll_data_matches: list[str]
    tdoll_text_dialogue_files: list[str]
    tdoll_text_dialogue_file_count: int
    tdoll_text_dialogue_has_content: bool
    story_dialogue_match_count: int
    story_dialogue_matches: list[str]
    has_text_dialogue: bool

def parse_uid(path: Path) -> int | None:
    match = re.match(r"^(\d+)-", path.name)
    if not match:
        return None
    return int(match.group(1))

def extract_comment(text: str) -> str | None:
    match = re.search(r"^comment:\s*(.+)$", text, re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip()

def tdoll_name_from_comment(comment: str) -> str:
    return re.split(r"[（(]", comment, maxsplit=1)[0].strip()

def collect_entries() -> list[EntryInfo]:
    entries: list[EntryInfo] = []
    for path in sorted(ENTRIES_DIR.glob("*.yaml")):
        uid = parse_uid(path)
        if uid is None or not (TARGET_UID_MIN <= uid <= TARGET_UID_MAX):
            continue
        text = path.read_text(encoding="utf-8")
        comment = extract_comment(text)
        if comment is None:
            raise ValueError(f"{path} 缺少 comment 字段")
        tdoll_name = tdoll_name_from_comment(comment)
        if not tdoll_name:
            raise ValueError(f"{path} 无法从 comment 解析人形名称")
        size_bytes = path.stat().st_size
        line_count = text.count("\n") + (0 if text.endswith("\n") else 1)
        is_small = size_bytes < SMALL_FILE_SIZE_BYTES or line_count < SMALL_FILE_LINE_COUNT
        entries.append(
            EntryInfo(
                uid=uid,
                entry_file=path.name,
                tdoll_name=tdoll_name,
                size_bytes=size_bytes,
                line_count=line_count,
                is_small=is_small,
            )
        )
    if len(entries) != EXPECTED_TARGET_COUNT:
        raise ValueError(f"目标条目数量异常：期望 {EXPECTED_TARGET_COUNT}，实际 {len(entries)}")
    return entries

def normalize_name(value: str) -> str:
    return re.sub(r"[\s_\-·.]+", "", value).lower()

def build_tdoll_data_index() -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    if not TDOLL_DATA_DIR.exists():
        return index
    for path in TDOLL_DATA_DIR.rglob("*"):
        if not path.is_dir() or path == TDOLL_DATA_DIR:
            continue
        base_name = path.name.split("_★", maxsplit=1)[0]
        if base_name == path.name:
            continue
        for key in {base_name, normalize_name(base_name)}:
            index.setdefault(key, []).append(str(path.relative_to(CARD_ROOT)))
    return index

def find_tdoll_data_matches(index: dict[str, list[str]], tdoll_name: str) -> list[str]:
    candidates = [tdoll_name, normalize_name(tdoll_name)]
    matches: list[str] = []
    for candidate in candidates:
        for item in index.get(candidate, []):
            if item not in matches:
                matches.append(item)
    return matches[:MAX_MATCH_FILES]

def json_has_real_content(path: Path) -> bool:
    raw_text = path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return False
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        return True
    if isinstance(data, dict):
        if data.get("备注") == "该页面无剧情整理数据":
            return False
        return bool(data)
    if isinstance(data, list):
        return bool(data)
    return data is not None

def text_file_has_real_content(path: Path) -> bool:
    return bool(path.read_text(encoding="utf-8").strip())

def is_text_dialogue_file(path: Path, tdoll_root: Path) -> bool:
    if path.name in TEXT_DIALOGUE_FILENAMES:
        return True
    try:
        relative_parts = path.relative_to(tdoll_root).parts
    except ValueError:
        return False
    return len(relative_parts) >= 2 and relative_parts[0] == TEXT_DIALOGUE_DIRNAME and path.suffix in {".json", ".txt"}

def dialogue_file_has_real_content(path: Path) -> bool:
    if path.suffix == ".json":
        return json_has_real_content(path)
    if path.suffix == ".txt":
        return text_file_has_real_content(path)
    return False

def collect_tdoll_text_dialogue(tdoll_data_matches: list[str]) -> TdollTextDialogueInfo:
    dialogue_files: list[str] = []
    has_content = False
    for relative_dir in tdoll_data_matches:
        tdoll_root = CARD_ROOT / relative_dir
        if not tdoll_root.exists():
            continue
        for path in sorted(tdoll_root.rglob("*")):
            if not path.is_file():
                continue
            if path.name.startswith(IGNORED_NON_TEXT_DIALOGUE_PREFIXES):
                continue
            if not is_text_dialogue_file(path, tdoll_root):
                continue
            dialogue_files.append(str(path.relative_to(CARD_ROOT)))
            if dialogue_file_has_real_content(path):
                has_content = True
    return TdollTextDialogueInfo(
        tdoll_data_match_count=len(tdoll_data_matches),
        tdoll_data_matches=tdoll_data_matches,
        tdoll_text_dialogue_files=dialogue_files[:MAX_MATCH_FILES],
        tdoll_text_dialogue_file_count=len(dialogue_files),
        tdoll_text_dialogue_has_content=has_content,
    )

def story_json_files() -> list[Path]:
    if not STORY_DATA_DIR.exists():
        return []
    return sorted(path for path in STORY_DATA_DIR.rglob("*.json") if path.is_file())

def find_story_matches(files: list[Path], tdoll_name: str) -> list[str]:
    matches: list[str] = []
    needle = tdoll_name
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="utf-8-sig")
        if needle in text:
            matches.append(str(path.relative_to(CARD_ROOT)))
            if len(matches) >= MAX_MATCH_FILES:
                break
    return matches

def small_reasons(entry: EntryInfo) -> list[str]:
    reasons: list[str] = []
    if entry.size_bytes < SMALL_FILE_SIZE_BYTES:
        reasons.append(f"size<{SMALL_FILE_SIZE_BYTES}")
    if entry.line_count < SMALL_FILE_LINE_COUNT:
        reasons.append(f"lines<{SMALL_FILE_LINE_COUNT}")
    return reasons

def build_audit() -> dict[str, object]:
    entries = collect_entries()
    small_entries = [entry for entry in entries if entry.is_small]
    tdoll_index = build_tdoll_data_index()
    story_files = story_json_files()

    rows: list[AuditRow] = []
    for entry in small_entries:
        tdoll_matches = find_tdoll_data_matches(tdoll_index, entry.tdoll_name)
        tdoll_dialogue = collect_tdoll_text_dialogue(tdoll_matches)
        story_matches = find_story_matches(story_files, entry.tdoll_name)
        has_text_dialogue = tdoll_dialogue.tdoll_text_dialogue_has_content or bool(story_matches)
        rows.append(
            AuditRow(
                uid=entry.uid,
                entry_file=entry.entry_file,
                tdoll_name=entry.tdoll_name,
                size_bytes=entry.size_bytes,
                line_count=entry.line_count,
                small_reasons=small_reasons(entry),
                tdoll_data_match_count=tdoll_dialogue.tdoll_data_match_count,
                tdoll_data_matches=tdoll_dialogue.tdoll_data_matches,
                tdoll_text_dialogue_files=tdoll_dialogue.tdoll_text_dialogue_files,
                tdoll_text_dialogue_file_count=tdoll_dialogue.tdoll_text_dialogue_file_count,
                tdoll_text_dialogue_has_content=tdoll_dialogue.tdoll_text_dialogue_has_content,
                story_dialogue_match_count=len(story_matches),
                story_dialogue_matches=story_matches,
                has_text_dialogue=has_text_dialogue,
            )
        )

    missing_text_dialogue = [row for row in rows if not row.has_text_dialogue]
    with_text_dialogue = [row for row in rows if row.has_text_dialogue]

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scope": {
            "entries_dir": str(ENTRIES_DIR),
            "tdoll_data_dir": str(TDOLL_DATA_DIR),
            "story_data_dir": str(STORY_DATA_DIR),
            "target_uid_min": TARGET_UID_MIN,
            "target_uid_max": TARGET_UID_MAX,
            "expected_target_count": EXPECTED_TARGET_COUNT,
            "small_file_size_bytes": SMALL_FILE_SIZE_BYTES,
            "small_file_line_count": SMALL_FILE_LINE_COUNT,
            "valid_source_rule": "只统计文字剧情/文字对话：人形目录 10_剧情内容、10_剧情整理.json、10_剧情整理_完整.json，以及 gf_story_data 中命中人形名的剧情 JSON；不统计 09_语音列表、09_语音文件、图鉴、属性等普通资料。",
        },
        "summary": {
            "target_entries": len(entries),
            "small_entries": len(rows),
            "small_entries_with_text_dialogue": len(with_text_dialogue),
            "small_entries_missing_text_dialogue": len(missing_text_dialogue),
            "small_entries_with_tdoll_text_dialogue": sum(1 for row in rows if row.tdoll_text_dialogue_has_content),
            "small_entries_with_story_dialogue": sum(1 for row in rows if row.story_dialogue_match_count > 0),
            "story_json_files_scanned": len(story_files),
        },
        "rows": [asdict(row) for row in rows],
    }

def write_audit(output_path: Path) -> dict[str, object]:
    audit = build_audit()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return audit

def main() -> int:
    parser = argparse.ArgumentParser(description="审计可疑小人形 entries 的文字对话来源命中情况。")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="审计 JSON 输出路径。")
    args = parser.parse_args()

    audit = write_audit(args.output)
    summary = audit["summary"]
    print(f"输出文件：{args.output}")
    print(f"目标条目：{summary['target_entries']}")
    print(f"可疑小文件：{summary['small_entries']}")
    print(f"有文字对话：{summary['small_entries_with_text_dialogue']}")
    print(f"缺文字对话：{summary['small_entries_missing_text_dialogue']}")
    print(f"有人形目录文字剧情：{summary['small_entries_with_tdoll_text_dialogue']}")
    print(f"有 gf_story_data 对话命中：{summary['small_entries_with_story_dialogue']}")
    print(f"扫描剧情 JSON：{summary['story_json_files_scanned']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())