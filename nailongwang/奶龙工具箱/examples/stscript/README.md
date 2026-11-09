# STscript / Slash Commands 样例

- 模式：J
- 入口：SillyTavern slash command / Quick Reply message
- 速查：`docs/SILLYTAVERN_STSCRIPT_API.md`

## 文件

| 文件 | 用途 |
| --- | --- |
| `quick-reply-command.json` | Quick Reply 中嵌入 STscript/slash command 的格式骨架 |
| `basic-flow.stscript` | 独立 STscript 文本骨架 |

## 注意

- 会发送消息、改变量或触发生成的命令必须标注副作用。
- 复杂异步逻辑应改用 JS-Slash-Runner 或 SillyTavern 原生扩展。
- 样例不放长 prompt、不放真实密钥。
