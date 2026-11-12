# Changelog

## 2026-06-17

- 拆分人物设计 prompt：`4-人物设计.md` 改为入口路由，新增 `4-0-人物设计-拆分说明.md`、`4-1-人物设计-自述阶段.md`、`4-2-人物设计-语料阶段.md`。
- 更新新卡总览、需求分析与 prompts 索引，使人物角色卡流程按自述定稿后再进入四声部语料阶段推进。

## 2026-06-09

- 新增 `tools/verify-release-card.js` 与 `npm run verify-release`，用于核对 release JSON 的世界书、表格模板、剧情推进预设、正则集合，并支持 PNG 反解 JSON 与原 JSON 的一致性检查。
- 新增 `tools/verify-workflow-clean.js` 与 `npm run verify-workflow-clean`，扫描权威流程文件中的过期打包链路、历史版本标签和污染式纠偏段落；`npm run validate` 已接入该 gate。
- 打包确认、新卡入口、修改卡回包入口和 README 已更新为统一交付链路：生成 release JSON 后先核对；PNG 交付必须先封装、再反解、再对反解 JSON 复核。

## 2026-06-05

- `tools/build-card.js` 现在会在构建状态栏正则时自动内联卡项目自己的 `frontend/multiplayer-runtime.js`，并在检测到 `build-config.json.sourceCard` 时同步回写 `source-card.json`，避免 release 与项目源卡长期漂移。
- `tools/repack-card.js` 现在兼容中文正则脚本名“欢迎页面 / 状态栏”，并在 `unpacked/extracted/frontend/` 缺失时回退到项目 `frontend/`；回包状态栏正则时也会同步内联 `multiplayer-runtime.js`。
- `package.json` 补回 `npm run build:coc7th` 专属构建入口，方便 COC7th 项目按卡专属流程重建正式发布产物。

## 2026-05-25

- 新增 `tools/shujuku-local/` 本地测试基底，支持拉取 shujuku bundle、mock SillyTavern/TavernHelper 宿主、fake/real AI 双模式和场景报告。
- 强化 AI agent 入口规则：根 `AGENTS.md`、奶龙王 `AGENTS.md`、写卡/改卡/打包提示词已把 shujuku 本地填表验收设为表格模板相关任务的默认 gate。
- 强化 shujuku AI 配置要求：fake 模式只作为 smoke，项目验收默认要求 agent 督促开发者配置 OpenAI-compatible real AI，并在未配置时明确标记 real AI 未验收。
- 新增 `npm run shujuku:smoke`、`npm run shujuku:test`、`npm run shujuku:test:real-ai`。
- 新增 `prompts/11-shujuku本地测试.md`，并在 README 与 prompts 索引中加入本地测试入口。
- `shujuku:test` 会输出 JSON、Markdown、HTML 报告，展示填表变化、填表后表格快照与世界书快照，便于直接查看填表效果。
- `shujuku:test` 支持 `--database-mode native|sqlite|both`、`--story-text`、`--story-file`，并在报告中输出“正文填表总结”；sqlite 模式会为缺少 DDL 的测试模板临时补齐运行用 DDL，不改写源模板。
- 本地正文填表改为先通过 shujuku `AutoCardUpdaterAPI.callAI()` 生成 native `<tableEdit>` 或 sqlite `INSERT INTO` 指令，再解析并调用 shujuku 表格 API 执行写入。
- 新增 `--ai-config` 与 `tools/shujuku-local/ai-config.example.json`，让真实 AI 测试可通过本地 JSON 配置 OpenAI-compatible `baseUrl/apiKey/model`。
- 新增 `--chat-file` 与 `tools/shujuku-local/chat-fixture.example.json`，支持注入多轮聊天记录作为填表正文来源。

## 2026-05-23

- 新增 `tools/unpack-tables.js`，支持将表格模板 JSON 拆分为多个 YAML 文件（每张表一个），仿照世界书的拆分管理方式。
- `tools/build-card.js` 的 `loadTableTemplates()` 现在同时支持 JSON 和 YAML 两种源文件格式，包含 uid 冲突检测。
- 构建完成后自动导出独立资产到 `entries/_build/worldbook.json` 和 `tables/_build/table-template.json`。
- 新增 YAML 格式空白表模板：`templates/tables/000-meta.yaml`、`001-全局数据表.yaml`、`002-重要角色表.yaml`、`003-纪要表.yaml`。
- `prompts/6-表格模板讨论.md` 流程新增"步骤0：确认表格定义模式（DSL/SQL）与输出格式（YAML/JSON）"。
- `package.json` 新增 `unpack-tables` 脚本。
- 更新 AGENTS.md、README.md、table-format-spec.md 等文档以反映新的目录结构和工作流。

## 2026-05-07

- 新增 `tools/png-to-json.js`，支持从 SillyTavern / Tavern Card PNG 文本元数据中提取角色卡 JSON。
- 新增 `tools/json-to-png.js`，支持将角色卡 JSON 写入封面 PNG 的 `chara` tEXt 元数据字段。
- PNG 角色卡修改流程调整为：先提取 JSON，再复用现有 `unpack-card` / `repack-card` 流程；回包后的 JSON 可按需重新封装为 PNG。
## 2026-05-04

- 当前工作区采用 `projects/<卡名>/` 作为角色卡项目目录。
- `new-project`、`unpack-card`、`repack-card`、`validate-project` 使用本地项目路径约定。
- 拆包/回包支持正则脚本与酒馆助手脚本独立拆分。
- 校验器检查项目结构、JSON 可解析性、工具路径约定、skill 包结构与临时残留文件。
