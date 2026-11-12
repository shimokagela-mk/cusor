# SillyTavern 原生扩展样例

- 模式：C
- 入口：`SillyTavern.getContext()`
- 速查：`docs/SILLYTAVERN_EXTENSION_API.md`
- API 数据库：`data/sillytavern-extension-api.json`

## 文件

| 文件 | 用途 |
| --- | --- |
| `manifest.json` | 扩展元信息 |
| `index.js` | 入口脚本，演示 getContext / 事件 / 设置面板 |
| `style.css` | 带扩展前缀的 CSS，避免污染全局 |

## 生成

```powershell
npm run new -- st-extension my-extension
```
