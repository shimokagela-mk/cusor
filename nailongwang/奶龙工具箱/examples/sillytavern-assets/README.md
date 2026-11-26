# SillyTavern 资产格式样例

- 模式：F
- 入口：导入到 SillyTavern 的 JSON 资产
- 速查：`docs/SILLYTAVERN_ASSETS_API.md`
- 详细规则：`docs/TARGET_RUNTIME_MODES.md` § F

## 文件

| 文件 | 用途 | Schema | 专项文档 |
| --- | --- | --- | --- |
| `quick-reply-format.json` | 快速回复 | `schemas/sillytavern-quick-reply.schema.json` | `docs/SILLYTAVERN_ASSETS_API.md` |
| `worldbook-format.json` | 世界书 | `schemas/sillytavern-worldbook.schema.json` | `docs/WORLDBOOK_ENTRY_API.md` |
| `completion-preset-format.json` | 对话补全预设 | `schemas/sillytavern-completion-preset.schema.json` | `docs/SILLYTAVERN_PRESET_API.md` |
| `theme-ui-format.json` | 主题 UI | `schemas/sillytavern-theme.schema.json` | `docs/SILLYTAVERN_ASSETS_API.md` |
| `regex-format.json` | Regex 正则脚本 | `schemas/sillytavern-regex.schema.json` | `docs/SILLYTAVERN_REGEX_API.md` |

## 生成

```powershell
npm run new -- quick-reply 名称
npm run new -- worldbook 名称
npm run new -- completion-preset 名称
npm run new -- theme 名称
npm run new -- regex 名称
```

## 注意

- 禁止把第三方主题正文、角色卡正文或系统提示词复制进样例。
- Regex replaceString 插入 HTML 时参考 `docs/TAVERN_FRONTEND_SNIPPETS_API.md`。
- Regex 的 `minDepth` / `maxDepth` 无限默认值使用 `null` 或空白；`999` / `9999` 不是无限默认写法。
- 校验器会拦截作品专名残留。
