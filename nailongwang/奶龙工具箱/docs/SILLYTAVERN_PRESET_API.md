# SillyTavern 预设 / 破限格式速查

对应机器可检索数据库：`data/sillytavern-preset-api.json`

本文件记录 Completion Preset 的字段、Prompt Manager 结构、破限/NSFW/继续/代发/静默提示的维护边界。

> 样例只允许 placeholder，不收录真实长 prompt、破限正文或 NSFW 正文。

## 1. 核心结构

```json
{
  "prompts": [
    {
      "identifier": "main",
      "name": "Main Prompt",
      "role": "system",
      "content": "Main prompt placeholder."
    }
  ],
  "prompt_order": [
    {
      "character_id": 100000,
      "order": [
        { "identifier": "main", "enabled": true }
      ]
    }
  ]
}
```

## 2. 字段说明

| 字段 | 说明 |
| --- | --- |
| `prompts` | 提示词块列表 |
| `prompt_order` | 启用状态与发送顺序 |
| `identifier` | 稳定 ID，被 `prompt_order` 引用 |
| `name` | UI 显示名 |
| `role` | system/user/assistant |
| `content` | 提示词正文 |
| `marker` | 内置占位，如聊天历史、世界书、角色描述 |
| `system_prompt` | 系统提示类标记 |
| `position` / `depth` / `order` | Prompt Manager 插入控制 |

## 3. 常见 prompt 类型

| identifier | 用途 |
| --- | --- |
| `main` | Main Prompt |
| `nsfw` | Auxiliary / NSFW Prompt |
| `jailbreak` | Post-History Instructions / 破限常用位置 |
| `chatHistory` | 聊天历史 marker |
| `dialogueExamples` | 示例对话 marker |
| `worldInfoBefore` / `worldInfoAfter` | 世界书 marker |

## 4. 后端差异

| 后端 | 注意 |
| --- | --- |
| OpenAI-compatible | 通常支持 role；工具调用、stop、stream 取决于供应商 |
| Claude | system 与 messages 可能被适配层合并/转换 |
| Gemini | role、安全设置、函数能力依 ST 当前适配 |
| Text Completion / Kobold | 不完整使用 Chat Completion Prompt Manager 语义，更依赖 Advanced Formatting |

## 5. 与角色卡边界

- 外部 preset 控制请求构造。
- 角色卡内 `description`、`scenario`、`character_book`、`creator_notes` 属于角色卡数据。
- 两者叠加时，应检查重复指令和冲突指令。
- 奶龙工具箱不自动把 preset 写入角色卡。

## 6. 风险

- `prompt_order` 引用不存在的 `identifier` 会导致提示缺失。
- 预设名与角色卡同名可能触发自动切换。
- 破限/NSFW prompt 改变模型行为，分享前应明确适用范围。
