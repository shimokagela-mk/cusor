#!/usr/bin/env python3
"""给少女前线人形世界书条目加出战配置表 ORM 显示条件。

默认只预览不写入；传入 --apply 才会修改文件。
目标范围固定为 entries/100-*.yaml 到 entries/550-*.yaml，共 451 个人形条目。
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENTRIES_DIR = PROJECT_ROOT / "entries"
TARGET_UID_MIN = 100
TARGET_UID_MAX = 550
EXPECTED_TARGET_COUNT = 451
SMALL_FILE_SIZE_BYTES = 2048
SMALL_FILE_LINE_COUNT = 50

CONTENT_MARKER = "content: |\n"
SINGLE_QUOTED_CONTENT_MARKER = "content: '"
TOP_LEVEL_METADATA_RE = re.compile(
    r"\n(?=(?:position|enabled|constant|prevent_recursion|insertion_order|depth|role|keys|secondary_keys):)",
    re.MULTILINE,
)
IF_PREFIX = "  <if db=\""
IF_SUFFIX = "  </if>"


@dataclass(frozen=True)
class EntryPlan:
    path: Path
    uid: int
    tdoll_name: str
    condition: str
    already_wrapped: bool


@dataclass(frozen=True)
class Problem:
    path: Path
    reason: str


@dataclass(frozen=True)
class SmallFile:
    path: Path
    size_bytes: int
    line_count: int


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


def escape_orm_single_quoted_value(value: str) -> str:
    """转义 ORM 表达式里单引号字符串字面量。"""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def build_condition(tdoll_name: str) -> str:
    escaped_name = escape_orm_single_quoted_value(tdoll_name)
    return f"db.出战配置表.where('人形名称','{escaped_name}').exists()"


def find_content_end(text: str, search_from: int) -> int | None:
    match = TOP_LEVEL_METADATA_RE.search(text, search_from)
    if match is None:
        return None
    return match.start()


def indent_content_lines(content: str) -> str:
    lines = content.splitlines()
    return "\n".join(f"  {line}" if line else "" for line in lines)


def collect_targets() -> tuple[list[EntryPlan], list[Problem]]:
    plans: list[EntryPlan] = []
    problems: list[Problem] = []

    for path in sorted(ENTRIES_DIR.glob("*.yaml")):
        uid = parse_uid(path)
        if uid is None or not (TARGET_UID_MIN <= uid <= TARGET_UID_MAX):
            continue

        text = path.read_text(encoding="utf-8")
        comment = extract_comment(text)
        if comment is None:
            problems.append(Problem(path, "缺少 comment 字段"))
            continue

        tdoll_name = tdoll_name_from_comment(comment)
        if not tdoll_name:
            problems.append(Problem(path, "comment 无法解析出人形名称"))
            continue

        already_wrapped = "<if db=" in text
        plans.append(
            EntryPlan(
                path=path,
                uid=uid,
                tdoll_name=tdoll_name,
                condition=build_condition(tdoll_name),
                already_wrapped=already_wrapped,
            )
        )

    return plans, problems


def scan_small_files(plans: list[EntryPlan]) -> list[SmallFile]:
    small_files: list[SmallFile] = []
    for plan in plans:
        size_bytes = plan.path.stat().st_size
        with plan.path.open(encoding="utf-8") as file:
            line_count = sum(1 for _ in file)
        if size_bytes < SMALL_FILE_SIZE_BYTES or line_count < SMALL_FILE_LINE_COUNT:
            small_files.append(SmallFile(plan.path, size_bytes, line_count))
    return small_files


def wrap_entry(plan: EntryPlan, apply: bool) -> Problem | None:
    if plan.already_wrapped:
        return None

    text = plan.path.read_text(encoding="utf-8")
    content_index = text.find(CONTENT_MARKER)
    if_line = f"{IF_PREFIX}{plan.condition}\">\n"

    if content_index >= 0:
        insert_index = content_index + len(CONTENT_MARKER)
        content_end_index = find_content_end(text, insert_index)
        if content_end_index is None:
            return Problem(plan.path, "找不到 content 后的顶层元字段")
        if content_end_index <= insert_index:
            return Problem(plan.path, "content 内容区域为空或结构异常")
        new_text = (
            text[:insert_index]
            + if_line
            + text[insert_index:content_end_index]
            + f"\n{IF_SUFFIX}"
            + text[content_end_index:]
        )
    else:
        single_index = text.find(SINGLE_QUOTED_CONTENT_MARKER)
        if single_index < 0:
            return Problem(plan.path, "找不到 content: | 或 content: ' 标记")
        value_start = single_index + len(SINGLE_QUOTED_CONTENT_MARKER)
        value_end_marker = "'\n"
        value_end = text.find(value_end_marker, value_start)
        if value_end < 0:
            return Problem(plan.path, "旧式单引号 content 找不到结束引号")
        raw_content = text[value_start:value_end].replace("''", "'")
        indented_content = indent_content_lines(raw_content)
        new_content = f"content: |\n{if_line}{indented_content}\n{IF_SUFFIX}"
        new_text = text[:single_index] + new_content + text[value_end + 1 :]

    if apply:
        plan.path.write_text(new_text, encoding="utf-8")

    return None


def verify_after_apply(plans: list[EntryPlan]) -> list[Problem]:
    problems: list[Problem] = []
    for plan in plans:
        text = plan.path.read_text(encoding="utf-8")
        expected_open = f"{IF_PREFIX}{plan.condition}\">"
        if expected_open not in text:
            problems.append(Problem(plan.path, "未找到预期 ORM if 开始标签"))
        if IF_SUFFIX not in text:
            problems.append(Problem(plan.path, "未找到 </if> 结束标签"))
        if text.count("<if db=") != 1:
            problems.append(Problem(plan.path, f"<if db= 数量异常：{text.count('<if db=')}"))
        if text.count("</if>") != 1:
            problems.append(Problem(plan.path, f"</if> 数量异常：{text.count('</if>')}"))
    return problems


def print_problem_list(title: str, problems: list[Problem], limit: int = 30) -> None:
    if not problems:
        return
    print(title)
    for problem in problems[:limit]:
        print(f"  - {problem.path.name}: {problem.reason}")
    if len(problems) > limit:
        print(f"  ... 还有 {len(problems) - limit} 个问题未显示")


def print_small_file_report(small_files: list[SmallFile], limit: int = 200) -> None:
    if not small_files:
        print("小文件扫描：未发现可疑小文件。")
        return
    print(
        f"小文件扫描：发现 {len(small_files)} 个可疑文件"
        f"（小于 {SMALL_FILE_SIZE_BYTES} bytes 或小于 {SMALL_FILE_LINE_COUNT} 行）。"
    )
    for item in small_files[:limit]:
        print(f"  - {item.path.name}: {item.size_bytes} bytes, {item.line_count} lines")
    if len(small_files) > limit:
        print(f"  ... 还有 {len(small_files) - limit} 个可疑文件未显示")


def main() -> int:
    parser = argparse.ArgumentParser(description="给 451 个人形 entries 加 ORM 出战显示条件。")
    parser.add_argument("--apply", action="store_true", help="实际写入文件；不传则只 dry-run。")
    parser.add_argument(
        "--allow-small-files",
        action="store_true",
        help="允许在发现可疑小文件时继续写入；默认发现小文件会拒绝 --apply。",
    )
    args = parser.parse_args()

    plans, collect_problems = collect_targets()
    if len(plans) != EXPECTED_TARGET_COUNT:
        print(f"目标数量异常：期望 {EXPECTED_TARGET_COUNT}，实际 {len(plans)}。为避免误伤，停止。")
        print_problem_list("收集阶段问题：", collect_problems)
        return 1
    if collect_problems:
        print_problem_list("收集阶段存在问题，为避免误伤，停止：", collect_problems)
        return 1

    to_change = [plan for plan in plans if not plan.already_wrapped]
    already_wrapped = [plan for plan in plans if plan.already_wrapped]
    small_files = scan_small_files(plans)

    print(f"模式：{'apply 写入' if args.apply else 'dry-run 预览'}")
    print(f"目标条目：{len(plans)}")
    print(f"待处理：{len(to_change)}")
    print(f"已包裹跳过：{len(already_wrapped)}")
    print_small_file_report(small_files)
    if args.apply and small_files and not args.allow_small_files:
        print("发现可疑小文件，已拒绝写入。确认这些文件没问题后，再加 --allow-small-files。")
        return 1
    print("示例：")
    for plan in plans[:3] + plans[-3:]:
        print(f"  - {plan.path.name}: {plan.condition}")

    wrap_problems: list[Problem] = []
    for plan in to_change:
        problem = wrap_entry(plan, apply=args.apply)
        if problem is not None:
            wrap_problems.append(problem)

    if wrap_problems:
        print_problem_list("包裹阶段存在问题：", wrap_problems)
        return 1

    if args.apply:
        verify_problems = verify_after_apply(plans)
        if verify_problems:
            print_problem_list("写入后验证失败：", verify_problems)
            return 1
        print("写入完成，验证通过。")
    else:
        print("预览完成，未写入。确认无误后传 --apply 执行。")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())