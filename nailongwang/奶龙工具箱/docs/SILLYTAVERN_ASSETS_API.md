# SillyTavern 资产格式知识库

对应机器可检索数据库：`data/sillytavern-assets-api.json`

本文件汇总奶龙工具箱可维护的 SillyTavern 单文件资产格式：Quick Reply、Worldbook、Completion Preset、Theme、Regex。

> 边界：本工具箱只做单文件识别、审查、生成骨架和小范围维护；不自动解包、回包、构建角色卡。

## 0. 常见存储位置

| 路径 | 资产 | 格式/说明 | 工具箱边界 |
| --- | --- | --- | --- |
| `data/[user]/characters/` | 角色卡 | 通常为 PNG，内嵌 Tavern Card 元数据 | 单文件识别/审查归工具箱；解包/回包/构建转奶龙王 |
| `data/[user]/chats/` | 聊天记录 | 通常为 JSONL，每行一条消息 | 不把真实聊天样本写入 examples/data/docs |
| `data/[user]/worlds/` | 世界书 | JSON，核心为 `entries` | 单文件/单条维护归工具箱；批量整卡改造按任务边界转奶龙王 |
| `data/[user]/extensions/` | 用户扩展 | 常含 `manifest.json`、`index.js`、`style.css` | 原生前端扩展归 C 模式 |
| `data/[user]/settings.json` | 用户设置 | JSON，可能含扩展设置 | 只记录字段风险，不复制真实设置全文 |
| `data/[user]/secrets.json` | API 密钥与敏感信息 | JSON | 禁止纳入样例、知识库正文或测试夹具 |

## 0.1 Data Bank / 附件资料

Data Bank / 附件资料可按三层理解：

| 层级 | 范围 | 常见用途 |
| --- | --- | --- |
| `global` | 所有角色和聊天可用 | 通用参考文档、常用资料 |
| `character` | 特定角色相关聊天可用 | 角色背景、设定资料 |
| `chat` | 当前聊天专用 | 临时资料、会话附件 |

注意：具体 Data Bank API、slash commands 与字段以当前 SillyTavern 版本为准。工具箱只记录分层概念、隐私风险和资料归属，不把未核对的端点当作稳定能力。

## 1. Quick Reply

常见字段：

| 字段 | 说明 |
| --- | --- |
| `name` | 快速回复集合名称 |
| `qrList` | 按钮数组 |
| `label` | 按钮显示文本 |
| `message` | 点击后执行的文本、slash command 或 STscript |
| `preventAutoExecute` | 是否阻止自动执行 |
| `isHidden` | 是否隐藏按钮 |

风险：`message` 可能执行 `/send`、`/setvar`、`/trigger` 等有副作用命令，导入前应审查。

示例：`examples/sillytavern-assets/quick-reply-format.json`

## 2. Worldbook

完整世界书导出通常包含：

```json
{
  "entries": {
    "0": {
      "key": ["keyword"],
      "keysecondary": [],
      "content": "Entry content placeholder."
    }
  }
}
```

重点字段：

| 字段 | 说明 |
| --- | --- |
| `entries` | 条目对象集合 |
| `key` | 主关键词数组 |
| `keysecondary` | 次级关键词数组 |
| `constant` | 常驻 |
| `selective` | 选择性触发 |
| `disable` | 禁用状态 |
| `position` / `depth` / `order` | 插入位置、深度与排序 |
| `group` / `useGroupScoring` / `groupWeight` | Inclusion Group 与分组评分 |
| `automationId` / `triggers` | 自动化 ID 与生成类型触发过滤 |
| `outletName` | Outlet 名称，需通过 `{{outlet::Name}}` 宏展开 |
| `vectorized` | Vector Storage Matching 标记 |
| `sticky` / `cooldown` / `delay` | Timed Effects：保持、冷却、延迟 |

单条维护格式见 `docs/WORLDBOOK_ENTRY_API.md`。

绑定边界：

- 完整世界书导出包含 `entries`；Character Lore、Persona Lore、Chat Lore 的绑定关系可能保存在角色、人格或聊天设置里。
- 只维护世界书 JSON 时，不要把角色/聊天绑定误写入通用世界书样例。
- Outlet 宏不能嵌套，也不能在 World Info 条目、角色卡字段或 Author's Note 中可靠展开。
- Vectorized 只是额外匹配标记；保留关键词时仍可被普通关键词触发。

## 3. Completion Preset

核心字段：

| 字段 | 说明 |
| --- | --- |
| `prompts` | 提示词块列表 |
| `prompt_order` | 启用状态与发送顺序 |
| `role` | system/user/assistant 等角色 |
| `marker` | 聊天历史、世界书、角色描述等内置占位 |
| `temperature` / `top_p` / `openai_max_context` | 采样与上下文设置 |

预设/破限专项见 `docs/SILLYTAVERN_PRESET_API.md`。

## 4. Theme

主题导出包含 `name` 与 UI 配置对象。维护时注意：

- 不把第三方长 CSS 放进 `examples/` 或 `data/`。
- scoped CSS 优先，避免全局覆盖。
- 移动端要避免固定大宽度和 `position: fixed` 滥用。

## 5. Regex

Regex 脚本核心字段：

| 字段 | 说明 |
| --- | --- |
| `scriptName` | 脚本名称 |
| `findRegex` | 查找表达式 |
| `replaceString` | 替换文本/HTML |
| `placement` | 作用来源/位置 |
| `disabled` | 禁用 |
| `markdownOnly` / `promptOnly` | 显示/提示词作用域 |
| `runOnEdit` | 编辑后运行 |

专项说明见 `docs/SILLYTAVERN_REGEX_API.md`。

## 兼容风险

- ST 版本升级可能新增字段；维护时保留未知字段。
- 外部资产 JSON 不等于整张角色卡。
- prompt、regex、HTML 片段效果会受后端、扩展和主题影响。
