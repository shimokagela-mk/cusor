# 情话 6.4.3｜双人身体互动独立版 + WorldInfo v9.4.1

Adult Romance DirtyTalk 世界书与独立版 TavernHelper 脚本配套发布。

## 当前版本

| 组件 | 版本 | 文件 |
|---|---|---|
| WorldInfo | **v9.4.1** RoutedBody / SourceHygiene / HostCompat | `Adult_Romance_DirtyTalk_WorldInfo_v9_4_1_DyadicBody_RoutedBody_SourceHygiene_HostCompat.json` |
| 脚本 | **情话 6.4.3** 双人身体互动独立版 | `情话6.4.3_双人身体互动_独立版.json` |

- 世界书条目：**706**
- 脚本内嵌世界书与独立 WorldInfo **逐条一致**（已校验）
- 脚本 `worldbook_version` = `9.4.1`；required keys 含 `[DTX_BODY_CORE_V941]`

## 安装

### 1. 导入世界书（推荐先做）

1. SillyTavern → **World Info** → Import
2. 选择本目录中的 WorldInfo JSON
3. 确认书名接近：`Adult Romance DirtyTalk WorldInfo v9.4.1 RoutedBody SourceHygiene HostCompat`

脚本也会尝试自动发现 / 物理安装同名世界书；找不到时回退到内嵌 `EMBEDDED` 源。

### 2. 导入独立版脚本

1. 打开 **TavernHelper / JS-Slash-Runner**
2. Import 本目录中的 `情话6.4.3_双人身体互动_独立版.json`
3. 启用后应出现按钮：`💬情话6.4.3`

## 用途摘要

- **聊骚路由**：甜撩 / 甜虐 / 坏撩 / 强撩 / 高压 / 强羞辱 / 规训 / 沉浸
- **DTX641 双人身体互动**：场景路由、Body 因果权限、结构化自然语义
- **Source Hygiene**：清理模型可见源语料中的解释型对比句污染
- **独立浮动面板**：不依赖剑仙宿主（`standalone: true`，`jx_host_version: NONE`）

## 校验备忘

发布前本地已核对：

- 独立 WorldInfo ↔ 脚本 `LS625_BUNDLED_WB`：706 条目，内容零差异
- 脚本 `data.worldbook` / `worldbook_version` = `9.4.1`
- `LS624_REQUIRED_KEYS` 含 `[DTX_BODY_CORE_V941]`
