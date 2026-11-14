#!/usr/bin/env python3
"""语料查询工具 - 从ref数据中提取角色语料

用法:
  python3 query.py "角色名"              # 查所有（自身对话摘要 + 他者提及）
  python3 query.py "角色名" self         # 查自身对话（按场景分组）
  python3 query.py "角色名" self full    # 查自身对话（完整文本）
  python3 query.py "角色名" other        # 查他者提及（按说话人分组）
  python3 query.py "角色名" stats        # 仅统计：各文件中该角色条目数

数据源: ref/gf_story_data/ 下所有JSON文件
"""

import json
import os
import sys
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ref', 'gf_story_data')

# 角色名常见别名映射
ALIAS_MAP = {
    'ST AR-15': ['ST AR-15', 'AR-15', 'AR15'],
    'M4 SOPMOD II': ['M4 SOPMOD II', 'M4 SOPMODII', 'SOP2', 'SOPII', 'SOPMOD II'],
    'RO635': ['RO635', 'RO 635', 'RO-635'],
    'UMP45': ['UMP45', 'UMP 45'],
    'UMP9': ['UMP9', 'UMP 9'],
    'M4A1': ['M4A1', 'M4 A1'],
    'M16A1': ['M16A1', 'M16 A1'],
    'AK-12': ['AK-12', 'AK12'],
    'AK-15': ['AK-15', 'AK15'],
    'AN-94': ['AN-94', 'AN94'],
    'RPK-16': ['RPK-16', 'RPK16'],
    'G11': ['G11'],
    'G36': ['G36'],
    'HK416': ['HK416', 'HK 416'],
    'UMP40': ['UMP40', 'UMP 40'],
}


def get_aliases(char_name):
    """获取角色名及其所有可能的别名/简称"""
    aliases = set()
    aliases.add(char_name)
    # 查映射表
    for key, vals in ALIAS_MAP.items():
        if key == char_name or char_name in vals:
            aliases.update(vals)
    # 自动生成常见变体
    no_dash = char_name.replace('-', '').replace(' ', '')
    aliases.add(no_dash)
    with_dash = char_name.replace(' ', '-').replace('--', '-')
    aliases.add(with_dash)
    return aliases


def load_all_data():
    """加载所有ref数据文件，返回 {filename: data} """
    all_data = {}
    for fname in sorted(os.listdir(DATA_DIR)):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(DATA_DIR, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                all_data[fname] = json.load(f)
        except Exception as e:
            print(f'[WARN] 加载 {fname} 失败: {e}', file=sys.stderr)
    return all_data


def extract_entries(data, char_name):
    """从单个数据文件提取角色的所有对话条目
    返回 [(category, scene, text), ...]
    """
    entries = []
    if not isinstance(data, dict):
        return entries
    
    aliases = get_aliases(char_name)
    
    for key, content in data.items():
        # key可能是角色名或分类名
        is_self = any(a == key for a in aliases)
        
        if isinstance(content, dict):
            # 嵌套结构: dict(分类 -> list[entries])
            for cat_key, items in content.items():
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict):
                            text = item.get('text', '')
                            scene = item.get('scene', '')
                            entries.append({
                                'speaker': key,
                                'category': cat_key,
                                'scene': scene,
                                'text': text,
                                'is_self': is_self
                            })
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    text = item.get('text', '')
                    scene = item.get('scene', '')
                    entries.append({
                        'speaker': key,
                        'category': '',
                        'scene': scene,
                        'text': text,
                        'is_self': is_self
                    })
    return entries


def find_other_mentions(all_entries, char_name):
    """找其他角色提及目标角色的对话"""
    aliases = get_aliases(char_name)
    mentions = []
    for e in all_entries:
        if e['is_self']:
            continue
        text = e['text']
        # 检查是否提及目标角色
        for alias in aliases:
            if alias in text:
                mentions.append(e)
                break
    return mentions


def cmd_self(char_name, all_data, full=False):
    """查询角色自身对话，按场景分组"""
    for fname, data in all_data.items():
        entries = extract_entries(data, char_name)
        self_entries = [e for e in entries if e['is_self']]
        if not self_entries:
            continue
        
        # 按场景分组
        by_scene = defaultdict(list)
        for e in self_entries:
            label = e.get('category', '') + '/' + e.get('scene', '')
            by_scene[label].append(e)
        
        print(f'=== {fname} ({len(self_entries)}条自身对话) ===')
        for scene_label, items in sorted(by_scene.items()):
            print(f'\n--- {scene_label} ({len(items)}条) ---')
            if full:
                for item in items:
                    print(f'  "{item["text"]}"')
            else:
                # 摘要模式：只显示前3条
                for item in items[:3]:
                    t = item['text']
                    if len(t) > 80:
                        t = t[:77] + '...'
                    print(f'  "{t}"')
                if len(items) > 3:
                    print(f'  ... 还有{len(items) - 3}条')
        print()


def cmd_other(char_name, all_data):
    """查询他者提及，按说话人分组"""
    all_entries = []
    for fname, data in all_data.items():
        entries = extract_entries(data, char_name)
        all_entries.extend(entries)
    
    mentions = find_other_mentions(all_entries, char_name)
    
    # 按说话人分组
    by_speaker = defaultdict(list)
    for m in mentions:
        by_speaker[m['speaker']].append(m)
    
    print(f'=== 他者提及 "{char_name}" 的对话 (共{len(mentions)}条, {len(by_speaker)}个说话人) ===')
    print()
    
    for speaker in sorted(by_speaker.keys()):
        items = by_speaker[speaker]
        print(f'【{speaker}】({len(items)}条)')
        for item in items:
            scene = item.get('scene', '')
            cat = item.get('category', '')
            label = f'{cat} | {scene}' if cat else scene
            t = item['text']
            if len(t) > 150:
                t = t[:147] + '...'
            print(f'  "{t}"')
            print(f'    （{label}）')
        print()


def cmd_stats(char_name, all_data):
    """仅统计信息"""
    aliases = get_aliases(char_name)
    print(f'角色: {char_name}')
    print(f'别名: {aliases}')
    print()
    
    for fname, data in all_data.items():
        entries = extract_entries(data, char_name)
        self_count = sum(1 for e in entries if e['is_self'])
        other_mentions = find_other_mentions(entries, char_name)
        other_count = len(other_mentions)
        if self_count > 0 or other_count > 0:
            print(f'{fname}: 自身{self_count}条, 他者提及{other_count}条')
    print()


def cmd_all(char_name, all_data):
    """查询所有信息（统计+他者提及）"""
    cmd_stats(char_name, all_data)
    print('=' * 60)
    print()
    cmd_other(char_name, all_data)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    char_name = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'all'
    
    all_data = load_all_data()
    print(f'已加载 {len(all_data)} 个数据文件\n')
    
    if mode == 'self':
        full = len(sys.argv) > 3 and sys.argv[3] == 'full'
        cmd_self(char_name, all_data, full=full)
    elif mode == 'other':
        cmd_other(char_name, all_data)
    elif mode == 'stats':
        cmd_stats(char_name, all_data)
    else:
        cmd_all(char_name, all_data)


if __name__ == '__main__':
    main()
