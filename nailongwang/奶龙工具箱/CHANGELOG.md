# 项目级 CHANGELOG

记录本工具箱当前工程能力；具体脚本的版本日志保留在 `projects/<脚本名>/README.md` 的“更新日志”里。

## 当前能力

- 2026-06-09：补齐原生 UI 菜单管理知识库：新增左下菜单、魔法棒、扩展菜单、顶部导航、预设菜单 selector atlas，并记录动态发现、DOM 重排、扩展菜单接管、JS-Slash-Runner 父页面 DOM 访问与 slash command 桥接模式。
- 2026-06-09：补充原生按钮与菜单入口别名：`chat_options_menu` 增加“左下菜单”，`extensions_panel` 增加“扩展菜单”，`quick_reply` 增加小写 `qr`。
- 2026-06-08：收敛扩展设置面板入口知识库：统一使用设置面板 DOM 挂载流程，按固定 selector 顺序查找挂载点、创建 `section#<plugin-id>-settings`、渲染 `inline-drawer` 并在未找到挂载点时 1800ms 后重试；同步扩展示例骨架与生成器占位。
- 2026-06-08：收敛魔法棒入口知识库：明确魔法棒入口统一使用魔法棒列表 DOM 锚点接入，按 `#extensionsMenu` / `#extensions_menu` / `.extensions_block .list-group` 查找并追加 `a.list-group-item` 菜单项。
- 2026-06-08：补齐 Regex 编辑器字段知识库：逐项说明测试模式、脚本名称、查找/替换、trimStrings、placement、runOnEdit、substituteRegex、markdownOnly/promptOnly、minDepth/maxDepth 等控件用途与默认写法；同步清洗 API 文档和机器数据中的单项目硬编码、旧样例路径和角色私名示例。
- 2026-06-08：补齐 SillyTavern 按钮入口知识库：新增聊天选项菜单、Extras 魔法棒、扩展面板、Quick Reply 四类入口命名与默认 Quick Reply 选择规则；同步 `globalThis.quickReplyApi` 原生快速回复 API，并补充 JS-Slash-Runner 脚本按钮 API 边界。
- 2026-06-08：全量刷新 A~L API/格式知识库与人类速查文档：同步 JS-Slash-Runner、shujuku SP·数据库 III / SQL 外部 API、MVU、Zod 4、SillyTavern Extension/API Connections、STscript、Worldbook/Assets、Tavern Card v3；迁移失效 Card v3 来源到 `kwaroran/character-card-spec-v3`，扩展世界书 schema/examples，并同步 `.kilo/skills/nailong-toolbox-skill/` 镜像索引。
- 2026-06-04：强化酒馆助手脚本转换流程：`scripts/convert.js` 自动输出与 metadata 查找改为同项目上下文，阻止默认写回 `archive` 历史目录；新增 `scripts/verify-project.js` 与 `npm run verify-project`，校验 latest 版本与 JSON/JS 配对，并检查 archive 目录和文件版本一致性。
- 2026-06-07：引入 source-first 项目架构与智能拆包流程，新增 `scripts/unpack-project.js`、`scripts/pack-project.js` 和 `scripts/lib/project-io.js`；`verify-project` 升级为校验 `project.json`、`src/`、`latest/`、`archive/` 一致，并同步 README、AGENTS、版本规范、目标模式和工具测试。
- 2026-06-07：取消 source-first 的 small/large 判型，统一改为 Tavern 资产类型分层：`tavern helper/`、`regex/`、`extensions/`、`assets/`、`snippets/`、`stscript/`；`project.json` 不再写入 `profile` / `profile_reason`，`pack-project` 与 `verify-project` 改为按 `outputs[].root` 回包和校验。
- 2026-06-04：新增 `scripts/expand-js-string-literals.js` 与 `npm run expand-js-strings`，通过 Babel AST 定位 JS 字符串字面量，将语义上真实的换行展开为模板字符串中的真实换行；同步 README、目标模式、版本规范与工具测试。
- 2026-06-04：明确酒馆助手脚本 JSON 解包术语：`JSON.parse` 后对 `content` 字段进行反序列化/反转义，并将得到的 JavaScript 字符串原样写入同版本 `.js`；同步更新转换工具日志、README、目标模式、版本规范与测试。
- 2026-05-25：补充 shujuku 本地 mock 宿主依赖面，记录 `SillyTavern.getContext()`、`TavernHelper`、世界书 CRUD、后端 fetch、native/sqlite 模式注入、通过 `AutoCardUpdaterAPI.callAI()` 生成正文填表指令与可视化测试报告要求，并同步 `docs/SHUJUKU_API.md` 与 `data/shujuku-api.json`。
- 2026-05-22：发布 `奶龙王v4.8.8` 工具箱资料更新，补充 shujuku SQL/ORM 模板、变量/条件模板、`callAI()` / `getStoryContext()`、交火模式与纪要向量索引排查，并把 `SHUJUKU_COOKBOOK.md` 做成速查菜谱。涉及文件位置：`奶龙工具箱/docs/SQL_TEMPLATE_SYNTAX.md`、`奶龙工具箱/docs/TEMPLATE_VARIABLES_AND_IF.md`、`奶龙工具箱/docs/LLM_CALLAI_API.md`、`奶龙工具箱/docs/CROSSFIRE_VECTOR_INDEX.md`、`奶龙工具箱/docs/SHUJUKU_COOKBOOK.md`、`奶龙工具箱/docs/INDEX.md`、`奶龙工具箱/docs/SHUJUKU_API.md`、`奶龙工具箱/data/shujuku-api.json`、`奶龙工具箱/README.md`、`奶龙工具箱/CHANGELOG.md`、`奶龙王一键制卡/.kilo/skills/nailong-toolbox-skill/`。
- 2026-05-08：从 `sillyTavern酒馆项目架构详细说明.md` 抽取低风险内容，补充 SillyTavern 资产存储位置、Data Bank 三层概念、扩展加载流程、扩展持久化位置，以及服务端插件/前端扩展边界，并同步 assets/extension 文档。
- 2026-05-08：清洗 `STscript语言参考.txt`，补充 `data/sillytavern-stscript-api.json` 的命令分类、闭包/解析器语法、变量结构、世界书字段、Quick Reply 管理命令与副作用等级，并同步 `docs/SILLYTAVERN_STSCRIPT_API.md`。
- A~L 十二模式能力索引：JS-Slash-Runner、SillyTavern Extension、shujuku、SillyTavern 资产、MVU、Zod、前端片段、STscript、Tavern Card v3 单文件识别、API Connections。
- 结构化知识库：`data/*-api.json`、`data/*-format.json` 与对应 schema。
- 人类速查文档：`docs/*_API.md`、`docs/*_FORMAT.md`、`docs/TARGET_RUNTIME_MODES.md`。
- 格式骨架样例：`examples/` 下各模式样例。
- 格式校验：`schemas/`、`scripts/validate-examples.js`、`tests/fixtures/invalid/`、`tests/negative.test.js`。
- 生成器：`scripts/new.js` 与 `scripts/cli.js`。
- 交叉引用检查：`scripts/check-api-references.js`。
- JSON ↔ JS 转换：`scripts/convert.js`。

## 当前约束

- `examples/` 只放格式骨架，不放业务正文、真实密钥、第三方长 CSS 或真实角色卡内容。
- 新增 API/格式知识库时，同步 data、schema、docs、examples、capabilities、生成器、校验器和测试负例。
- 修改 `projects/<项目名>/` 下脚本本体时，按 `docs/SCRIPT_VERSIONING.md` 执行 source-first + Tavern 资产分层流程，只修改对应资产目录下的 `src/` 与 `meta.json`，通过 `pack-project` 生成 `latest/`。
- 每轮涉及代码或知识库结构变更后，运行：

```powershell
npm run validate
npm run check-refs
npm run test
```
