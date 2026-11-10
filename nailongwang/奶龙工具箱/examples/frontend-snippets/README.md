# 前端片段样例

- 模式：I
- 入口：消息/状态栏/开场白/Regex replaceString 中的 HTML/CSS 片段
- 速查：`docs/TAVERN_FRONTEND_SNIPPETS_API.md`
- Schema：`schemas/frontend-snippet.schema.json`

## 文件

| 文件 | 用途 |
| --- | --- |
| `status-panel.json` | scoped 状态面板骨架 |
| `regex-replace-html.json` | Regex `replaceString` HTML 包装骨架 |

## 注意

- CSS 必须 scoped，不写全局主题长 CSS。
- 插入真实 DOM 前使用 `DOMPurify.sanitize`。
- 不写真实正文、密钥、外链追踪或脚本标签。
