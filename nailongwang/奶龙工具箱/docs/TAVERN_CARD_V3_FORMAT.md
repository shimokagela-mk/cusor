# Tavern Card v3 单文件格式速查

对应机器可检索数据库：`data/tavern-card-v3-format.json`

本文件用于奶龙工具箱识别和审查 Tavern Card v3 单文件结构。

> 边界：工具箱只做单文件识别/审查/小范围维护；解包、回包、构建、发布角色卡属于奶龙王一键制卡。
>
> 来源迁移：旧 `malfoyslastname/character-card-spec-v3` 已不可访问，本次核对改用 `kwaroran/character-card-spec-v3` 与仓库内 `SPEC_V3.md`。

## 1. 顶层字段

| 字段 | 说明 |
| --- | --- |
| `spec` | 规范标识，v3 常见为 `chara_card_v3` |
| `spec_version` | 规范版本 |
| `data` | 角色卡主体数据 |

## 2. 常见 `data` 字段

| 字段 | 说明 |
| --- | --- |
| `name` | 角色名 |
| `description` | 角色描述 |
| `personality` | 性格 |
| `scenario` | 场景 |
| `first_mes` | 默认开场白 |
| `mes_example` | 示例对话 |
| `alternate_greetings` | 额外开场白数组 |
| `group_only_greetings` | 群聊专用开场白数组 |
| `creator_notes` | 作者说明 |
| `creator_notes_multilingual` | 多语言作者说明 |
| `tags` | 标签数组 |
| `creator` | 作者 |
| `character_version` | 角色卡版本 |
| `source` | 原始来源/派生来源列表或字符串 |
| `character_book` | 内置世界书 |
| `assets` | 角色卡资源清单 |
| `extensions` | 扩展字段容器 |

## 3. 内嵌资产字段

| 字段 | 可能位置 | 说明 |
| --- | --- | --- |
| `character_book` | `data.character_book` | 内置世界书 |
| `regex_scripts` | `data.extensions` 或 ST 私有字段 | 角色卡内 Regex |
| `tavern_helper` | `data.extensions` | 酒馆助手脚本或相关元数据 |
| `alternate_greetings` | `data` | 多开场白 |
| `group_only_greetings` | `data` | 群聊专用开场白 |
| `creator_notes` | `data` | 作者说明，不等同系统 prompt |
| `assets` | `data.assets` 或 `data.extensions.assets` | 资源可指向 HTTPS、base64 data URL、`embeded://path`、`ccdefault:` 等 URI |

## 4. 嵌入与资源规则

Tavern Card v3 可作为纯 JSON，也可嵌入 PNG/APNG 或 CHARX：

| 形式 | 说明 |
| --- | --- |
| JSON | 直接保存 `spec: chara_card_v3` 的 JSON |
| PNG/APNG | 角色卡元数据嵌入图片文本块 |
| CHARX | ZIP/容器式角色卡资源包 |

资产 URI 审查规则：

- `https://...`：外部资源，检查是否仍可访问，不把私有 token 写进 URL。
- `data:*;base64,...`：内联资源，体积可能很大；工具箱样例不放真实大资源。
- `embeded://path`：随卡/容器携带的嵌入资源，往返维护时必须保留路径。
- `ccdefault:`：默认资产引用，保留原值。

## 5. Asset preservation

审查或小改时：

- 保留未知 `extensions` 字段。
- 不因当前 schema 未列出就删除资产字段。
- 保留 `source`、`assets`、未知顶层/扩展字段，避免往返编辑造成来源和资源丢失。
- 不把 `examples/` 占位内容当作真实角色卡正文。
- 不自动移动 `_inbox` 文件，不自动解包。

## 6. 与奶龙王流程边界

| 用户目标 | 路由 |
| --- | --- |
| 判断一个 JSON 是否像角色卡 | 奶龙工具箱 |
| 审查单个字段/单条 Regex/单条世界书 | 奶龙工具箱 |
| 解包角色卡 | 奶龙王一键制卡 |
| 回包/构建/发布 | 奶龙王一键制卡 |
| 批量修改世界书或整卡风格 | 奶龙王一键制卡 |
