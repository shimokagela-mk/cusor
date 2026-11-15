# examples 总览

本目录的样例只保留字段结构与最小入口逻辑，**不含正文/作品/真实密钥**。后续生成时直接复制结构、替换占位符。

| 子目录 | 模式 | 入口 | Schema | 生成器类型 |
| --- | --- | --- | --- | --- |
| [`js-slash-runner/`](./js-slash-runner/) | A | `window.TavernHelper` | `schemas/js-slash-runner-script.schema.json` | `js-script`、`js-script-buttons` |
| [`sillytavern-extension/`](./sillytavern-extension/) | C | `SillyTavern.getContext()` | （无单独 schema，使用内置入口检查） | `st-extension` |
| [`sillytavern-assets/`](./sillytavern-assets/) | F | SillyTavern 资产 JSON | `schemas/sillytavern-*.schema.json` | `quick-reply`、`worldbook`、`completion-preset`、`theme`、`regex` |
| [`worldbook-entry/`](./worldbook-entry/) | F | 单条世界书条目 | `schemas/worldbook-entry.schema.json` | `worldbook-entry` |
| [`frontend-snippets/`](./frontend-snippets/) | I | HTML/CSS snippet | `schemas/frontend-snippet.schema.json` | `frontend-snippet`、`regex-html-snippet` |
| [`stscript/`](./stscript/) | J | Slash Commands / Quick Reply message | `schemas/sillytavern-quick-reply.schema.json` | `stscript`、`stscript-quick-reply` |
| [`shujuku/`](./shujuku/) | D + E | `window.AutoCardUpdaterAPI` / 数据 JSON | `schemas/shujuku-*.schema.json` | `shujuku-template`、`shujuku-plot`、`shujuku-api-preset`、`shujuku-ui-theme`、`shujuku-body-replace`、`shujuku-ui` |
| [`mvu/`](./mvu/) | G | `window.Mvu` + JS-Slash-Runner | `schemas/mvu-initvar.schema.json`、`schemas/js-slash-runner-script.schema.json` | `mvu-initvar`、`mvu-script` |
| [`zod/`](./zod/) | H | 全局 `z` | （内置 z.object/safeParse 检查） | `zod-snippets` |

判定模式请先看：

- [`docs/TARGET_RUNTIME_MODES.md`](../docs/TARGET_RUNTIME_MODES.md)
- [`data/capabilities-index.json`](../data/capabilities-index.json)

每次生成后请运行：

```powershell
npm run validate
npm run check-refs
npm run test
```
