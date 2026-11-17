# shujuku（神·数据库 / SP·数据库 II）样例

- 模式：D（外部调用 UI）+ E（数据文件）
- 入口：`window.AutoCardUpdaterAPI` / JSON 数据
- 速查：`docs/SHUJUKU_API.md`
- API 数据库：`data/shujuku-api.json`

## 文件

| 文件 | 用途 | Schema |
| --- | --- | --- |
| `external-ui.js` | 外部调用 UI 样例（按钮：列预设、更新行、AI 分析） | （内置入口检查） |
| `minimal-template.json` | 最小数据库模板 | `schemas/shujuku-template.schema.json` |
| `full-template-format.json` | 完整数据库模板（含 mate / sourceData / exportConfig） | `schemas/shujuku-template.schema.json` |
| `plot-preset.json` | 最小剧情推进预设 | `schemas/shujuku-plot-preset.schema.json` |
| `plot-preset-full-format.json` | 完整剧情推进预设（含 plotTasks 等） | `schemas/shujuku-plot-preset.schema.json` |
| `api-preset.json` | API 预设 | `schemas/shujuku-api-preset.schema.json` |
| `database-ui-theme-format.json` | 数据库 UI 主题模板 | `schemas/shujuku-ui-theme.schema.json` |
| `body-replace-preset-format.json` | 正文替换预设 | `schemas/shujuku-body-replace-preset.schema.json` |

## 生成

```powershell
npm run new -- shujuku-ui ui名
npm run new -- shujuku-template 模板名
npm run new -- shujuku-plot 预设名
npm run new -- shujuku-api-preset 预设名
npm run new -- shujuku-ui-theme 主题名
npm run new -- shujuku-body-replace 预设名
```
