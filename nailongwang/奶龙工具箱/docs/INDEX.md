# docs 索引

| 文件 | 用途 |
| --- | --- |
| [`TARGET_RUNTIME_MODES.md`](./TARGET_RUNTIME_MODES.md) | 写代码前的目标运行方式判定（A~L 十二种模式） |
| [`SCRIPT_VERSIONING.md`](./SCRIPT_VERSIONING.md) | `projects/<项目名>/` source-first 拆包、回包与版本发布流程 |
| [`JS_SLASH_RUNNER_API.md`](./JS_SLASH_RUNNER_API.md) | JS-Slash-Runner（酒馆助手）脚本 API 速查 |
| [`SILLYTAVERN_EXTENSION_API.md`](./SILLYTAVERN_EXTENSION_API.md) | SillyTavern 原生扩展开发 API 速查 |
| [`SILLYTAVERN_ASSETS_API.md`](./SILLYTAVERN_ASSETS_API.md) | Quick Reply、Worldbook、Preset、Theme、Regex 资产总览 |
| [`WORLDBOOK_ENTRY_API.md`](./WORLDBOOK_ENTRY_API.md) | 世界书单条目字段与 YAML/ST JSON 映射 |
| [`SILLYTAVERN_REGEX_API.md`](./SILLYTAVERN_REGEX_API.md) | SillyTavern Regex 字段、作用域与安全风险 |
| [`SILLYTAVERN_PRESET_API.md`](./SILLYTAVERN_PRESET_API.md) | 预设/破限 prompts、prompt_order 与后端差异 |
| [`TAVERN_FRONTEND_SNIPPETS_API.md`](./TAVERN_FRONTEND_SNIPPETS_API.md) | 消息 HTML、状态栏、Regex replaceString HTML 与 scoped CSS |
| [`SILLYTAVERN_STSCRIPT_API.md`](./SILLYTAVERN_STSCRIPT_API.md) | STscript / Slash Commands / Quick Reply 命令速查 |
| [`TAVERN_CARD_V3_FORMAT.md`](./TAVERN_CARD_V3_FORMAT.md) | Tavern Card v3 单文件识别与工具箱/奶龙王边界 |
| [`SILLYTAVERN_API_CONNECTIONS.md`](./SILLYTAVERN_API_CONNECTIONS.md) | API Connections、后端能力与 preset 兼容性 |
| [`SHUJUKU_API.md`](./SHUJUKU_API.md) | shujuku（神·数据库 / SP·数据库 III）外部调用接口 |
| [`SQL_TEMPLATE_SYNTAX.md`](./SQL_TEMPLATE_SYNTAX.md) | shujuku SQL / ORM 模板语法，含 `{[db...]}`、`{[sql ...]}`、`$v:` |
| [`TEMPLATE_VARIABLES_AND_IF.md`](./TEMPLATE_VARIABLES_AND_IF.md) | shujuku 模板变量、`<random>`、`<calc>`、`<if>` 与执行顺序 |
| [`LLM_CALLAI_API.md`](./LLM_CALLAI_API.md) | shujuku `callAI()` 与 `getStoryContext()` 调用 AI 速查 |
| [`CROSSFIRE_VECTOR_INDEX.md`](./CROSSFIRE_VECTOR_INDEX.md) | shujuku 交火模式、纪要向量索引与排错边界 |
| [`SHUJUKU_COOKBOOK.md`](./SHUJUKU_COOKBOOK.md) | shujuku 常见需求速查菜谱，适合直接复制改名 |
| [`MVU_API.md`](./MVU_API.md) | MVU 变量框架脚本 API 速查 |
| [`ZOD_API.md`](./ZOD_API.md) | Zod 语法 / 校验速查 |

## 推荐阅读顺序

1. 看 `TARGET_RUNTIME_MODES.md` 确定目标模式（A/B/C/D/E/F/G/H/I/J/K/L）。
2. 看对应模式的 docs/*.md 速查文档；shujuku 模板写法优先看 `SHUJUKU_COOKBOOK.md`，再按需查 SQL、变量/if、LLM、交火专题。
3. 用 `npm run new -- <type> <name>` 从 `examples/` 生成骨架。
4. 用 `npm run validate` + `npm run check-refs` + `npm run test` 校验。

## 与 data/、examples/、schemas/ 的关系

| 层 | 说明 |
| --- | --- |
| `data/*.json` | 给检索/AI 使用的结构化 API/格式数据库 |
| `data/capabilities-index.json` | A~L 十二模式机读能力清单 |
| `docs/*.md` | 给人阅读的速查文档 |
| `examples/*` | 可直接复制的最小样例（不含正文） |
| `schemas/*.schema.json` | 用于 `npm run validate` 的格式校验规则 |
| `tests/*` | 反向样例与工具脚本闭环测试 |
| `scripts/*.js` | 转换、生成、校验、交叉引用、CLI、测试入口 |
