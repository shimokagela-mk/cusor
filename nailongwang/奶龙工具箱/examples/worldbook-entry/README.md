# 世界书单条目样例

- 模式：F / 单条世界书资产
- 速查：`docs/WORLDBOOK_ENTRY_API.md`
- Schema：`schemas/worldbook-entry.schema.json`

## 文件

| 文件 | 用途 |
| --- | --- |
| `minimal-entry.json` | 工具箱单条维护格式，字段名偏人工友好 |
| `st-json-entry.json` | SillyTavern `entries` 中单个条目的导出形态 |

## 映射重点

- `keys` → `key`
- `secondary_keys` → `keysecondary`
- `enabled` → `disable` 取反
- `group_override` → `groupOverride`
- `group_weight` → `groupWeight`

样例只保留格式骨架，不放真实世界观正文。
