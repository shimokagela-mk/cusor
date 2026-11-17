# 世界书单条目 API / 格式速查

对应机器可检索数据库：`data/worldbook-entry-api.json`

本文件描述单条世界书条目的人工维护格式，以及它与 SillyTavern 世界书 JSON `entries` 项之间的映射。

> 边界：单条维护属于奶龙工具箱；批量修改整本世界书、整卡风格、解包/回包属于奶龙王一键制卡流程。

## 1. 单条 JSON/YAML 推荐字段

| 字段 | 说明 |
| --- | --- |
| `keys` | 主关键词数组，至少一个 |
| `secondary_keys` | 次级关键词数组 |
| `content` | 触发后插入内容 |
| `comment` | 条目备注/显示名 |
| `constant` | 常驻条目 |
| `selective` | 选择性触发 |
| `enabled` | 工具箱单条格式启用状态 |
| `position` | 插入位置枚举，保留导出原值 |
| `depth` | 插入深度 |
| `order` | 排序权重 |
| `insertion_order` | 显示/维护顺序 |
| `probability` | 触发概率 |
| `use_regex` | 关键词按正则解释 |
| `group` / `group_override` / `group_weight` | 分组相关字段 |
| `group_scoring` / `prioritize_inclusion` | 分组评分与优先纳入；映射到 ST `useGroupScoring` / `groupOverride` |
| `automation_id` / `triggers` | 自动化 ID 与生成类型触发过滤 |
| `outlet` | Outlet 名称；通过 `{{outlet::Name}}` 宏在 prompt 字段展开 |
| `vectorized` | Vector Storage Matching 标记 |
| `sticky` / `cooldown` / `delay` | 保持、冷却、延迟触发 |

示例：`examples/worldbook-entry/minimal-entry.json`

## 2. 与 ST JSON 映射

| 单条格式 | ST 世界书条目 | 说明 |
| --- | --- | --- |
| `keys` | `key` | 数组直传 |
| `secondary_keys` | `keysecondary` | 数组直传 |
| `enabled` | `disable` | 取反 |
| `group_override` | `groupOverride` | camelCase |
| `group_weight` | `groupWeight` | camelCase |
| `group_scoring` | `useGroupScoring` | null/缺省表示使用全局设置 |
| `prioritize_inclusion` | `groupOverride` | 语义别名 |
| `automation_id` | `automationId` | 自动化 ID |
| `triggers` | `triggers` | 空数组表示不额外限制生成类型 |
| `outlet` | `outletName` | 宏名区分大小写 |
| `vectorized` | `vectorized` | 向量匹配标记 |
| `scan_depth` | `scanDepth` | null 表示默认 |
| `case_sensitive` | `caseSensitive` | null 表示默认 |
| `match_whole_words` | `matchWholeWords` | null 表示默认 |
| `insertion_order` | `displayIndex` | 用于显示顺序 |

ST 条目形态示例：`examples/worldbook-entry/st-json-entry.json`

## 3. YAML 单条示例

```yaml
keys:
  - keyword
secondary_keys: []
content: Entry content placeholder.
comment: Entry Name
constant: false
selective: false
enabled: true
position: 0
depth: 4
order: 100
probability: 100
use_regex: false
group: ""
group_override: false
group_weight: 100
group_scoring: null
automation_id: ""
triggers: []
outlet: ""
vectorized: false
sticky: 0
cooldown: 0
delay: 0
```

## 4. 风险

- `use_regex: true` 会改变关键词匹配语义，必须审查正则复杂度。
- `constant: true` 与高优先级 `order` 可能长期占用上下文。
- `position` 数值含义随 ST 版本可能变化；不要凭经验重写导出值。
- Character Lore、Persona Lore、Chat Lore 和全局 World Info 会按当前 ST 插入策略合并；单条审查不要假设只有全局世界书参与。
- Outlet 宏不能放在世界书条目内部递归展开；角色卡字段和 Author's Note 也不一定能解析 outlet。
- Vectorized 只是额外匹配标记；保留关键词时仍可能被普通关键词激活。
- Timed Effects 具有状态性，`sticky`、`cooldown`、`delay` 会让不同楼层的激活结果不同。
- 保留未知字段，避免新版本字段丢失。
