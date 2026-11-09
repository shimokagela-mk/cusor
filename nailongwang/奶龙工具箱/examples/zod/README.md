# Zod 样例

- 模式：H
- 入口：全局 `z`（JS-Slash-Runner / MVU 内置）
- 速查：`docs/ZOD_API.md`
- API 数据库：`data/zod-api.json`

## 文件

| 文件 | 用途 |
| --- | --- |
| `zod-schema-snippets.js` | 工具参数 / 章节摘要 / `stat_data` 子树 / 透传消息 / 严格设置等常见 schema |

## 生成

```powershell
npm run new -- zod-snippets 名称
```

## 注意

- 默认使用 `safeParse`，避免脚本崩溃。
- 不要用 zod 处理密钥/令牌等敏感数据。
- 与 MVU 配合时，先 `_.get(...)` 取子树再 `safeParse`。
