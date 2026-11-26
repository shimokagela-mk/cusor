# SillyTavern API Connections / 后端兼容速查

对应机器可检索数据库：`data/sillytavern-api-connections.json`

本文件用于审查 preset、prompt、function calling、stop strings、streaming 与模型后端的兼容性。

> 不记录真实 API key、cookie、代理 token 或私有 endpoint。

## 1. 常见连接类型

| 类型 | 说明 |
| --- | --- |
| OpenAI-compatible | OpenAI、自建兼容网关、本地 OpenAI Chat Completion-compatible 后端等 |
| Claude | Anthropic Claude 系列适配 |
| Gemini | Google AI Studio / Vertex 等适配 |
| OpenRouter | 多模型路由，能力随模型变化 |
| Kobold / Text Completion | 文本补全后端，更依赖 Advanced Formatting |

## 2. 能力差异

| 能力 | Chat Completion | Text Completion |
| --- | --- | --- |
| Role messages | 核心语义 | 通常拼接为纯文本 |
| Function Calling | 部分后端支持 | 通常不支持 |
| Interleaved Thinking | 少数支持 reasoning context 的后端/模型可用 | 通常不支持 |
| Streaming | 多数支持 | 依后端而定 |
| Stop strings | 字段和行为依供应商 | 常见但差异大 |
| 长上下文 | 取决于模型与网关 | 取决于后端 |

## 3. 与 preset 的关系

- `prompts` / `prompt_order` / `role` 对 Chat Completion 更直接。
- Text Completion 通常需要检查 Advanced Formatting。
- Claude/Gemini 可能通过适配层转换 system prompt 和消息 role。
- OpenRouter 同一 preset 在不同模型上能力不同。

## 4. Function Calling 注意

- 只在支持的 Chat Completion 源且启用时可用。
- Continue、Impersonate、Quiet/background prompts 通常不能触发工具调用。
- 工具参数 schema 应与后端支持能力匹配。
- 官方文档当前列出的支持源包括：Custom(OpenAI-compatible)、AI/ML API、AI21、Azure OpenAI、Chutes、Claude、Cloudflare Workers AI、Cohere、DeepSeek、Electron Hub、Fireworks、Google AI Studio、Google Vertex AI、Groq、MiniMax、MistralAI、Moonshot(Kimi)、NanoGPT、OpenAI、OpenRouter、Pollinations、SiliconFlow、xAI(Grok)、Z.AI(GLM)。
- 工具调用循环默认最多 5 轮；扩展或脚本应避免让工具结果再次无条件触发工具。
- OpenRouter、OpenAI-compatible 与本地后端的 reasoning / tool calling 支持随模型和网关实现变化，同一 preset 不应假定能力恒定。
- Interleaved Thinking / reasoning context 属于后端能力差异点，审查时要确认模型是否会返回推理签名或要求保留上下文签名。

## 5. 安全

- 示例 endpoint 用占位符。
- 分享 preset 前检查自定义 headers、组织 ID、日志 URL。
- 不把密钥写入 `data/`、`docs/`、`examples/` 或测试夹具。
