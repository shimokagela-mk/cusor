# JS-Slash-Runner 脚本样例

- 模式：A（详见 `docs/TARGET_RUNTIME_MODES.md`）
- 入口：`window.TavernHelper`
- Schema：`schemas/js-slash-runner-script.schema.json`
- API 速查：`docs/JS_SLASH_RUNNER_API.md`
- API 数据库：`data/js-slash-runner-api.json`

## 文件

| 文件 | 用途 |
| --- | --- |
| `minimal-script.json` | 最小可导入脚本（检查 TavernHelper、读取消息、toastr 提示） |
| `multi-button-script.json` | 多按钮脚本，包含 `button.buttons[]` 与 `window` 暴露 |

## 生成

```powershell
npm run new -- js-script 我的脚本
npm run new -- js-script-buttons 我的多按钮脚本
```
