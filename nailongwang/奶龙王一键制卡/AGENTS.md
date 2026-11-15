# 奶龙王一键制卡 AI 协作硬约束

> **分流说明**：本文件是奶龙王一键制卡的专项规则。任务分流判定规则位于上级目录 `../AGENTS.md`。如果当前任务是单文件级维护，应路由到 `../奶龙工具箱/`，而非本系统。

适用于本仓库内所有 AI 与人类协作者。

## 1. 项目定位

本项目是 AI 辅助角色卡项目级创作与修改系统。`prompts/` 负责制卡流程，`docs/` 负责知识资料，`projects/` 负责真实卡项目，`examples/` 负责范例，`templates/` 负责空白骨架，`output/` 只放临时产物。

奶龙王负责：

- 新建角色卡项目。
- 修改整张角色卡。
- 解包、回包、构建、发布。
- 角色卡项目内 shujuku 表格模板的本地运行测试、填表验收与可视化报告确认。
- 批量修改世界书或批量处理角色卡资产。
- 整卡风格、结构、发布内容的项目级调整。

以下任务交给 `../奶龙工具箱/`：酒馆助手脚本、JS 源码、SillyTavern 资产 JSON、Quick Reply、世界书/单条条目、Regex、Completion Preset/破限、Theme、数据库模板、前端片段、STscript、Tavern Card v3 单文件识别、API Connections、MVU、Zod 与 API/格式知识库。

## 2. 目录边界

- 根目录只允许放项目入口文件：`README.md`、`AGENTS.md`、`CHANGELOG.md`、`package.json` 等。
- 禁止把角色卡 JSON、临时表格、缓存文件、打包产物直接放在根目录。
- 真实卡项目必须放在 `projects/<卡名>/`。
- 范例必须放在 `examples/`。
- 空白模板必须放在 `templates/`。
- 临时构建产物必须放在 `output/latest/` 或 `output/temp/`。

## 3. 制卡流程

- 写新卡：先读 `prompts/0-总览与启动.md`，再按阶段读取对应提示词。
- 修改已有卡：先读 `prompts/9-修改卡启动.md`。
- shujuku 本地测试、数据库填表验收、查看填表效果：先读 `prompts/11-shujuku本地测试.md`。
- 进入任一阶段前，必须完成该阶段提示词与范例的前置阅读。
- 正式制作前必须先建立 todo list，并写明每一步的前置阅读文件。

### shujuku 本地测试 gate

只要本次任务新建或修改了 `tables/`、数据库模板、shujuku 更新规则，或用户要求查看“填表效果 / AI 填表 / 数据库本地测试”，AI agent 必须把 `prompts/11-shujuku本地测试.md` 加入当前 todo，并在回包或交付前执行本地测试，除非用户明确说跳过。

只要本次任务涉及 `frontend/`、状态栏、推进 UI、开场白 UI，除 shujuku 表格测试外，还必须运行：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both
```

如果用户要求“真实填表数据直接用于前端预览”“真实语料 + 真实 API + 前端效果一起看”，AI agent 应优先运行组合链路：

```powershell
npm.cmd run shujuku:full:real-ai -- --project <卡名> --database-mode both --chat-file <聊天记录json> --ai-config output/config/shujuku-ai.local.json --frontend-scenario all
```

该命令会先执行真实 AI 填表，把填表后的 `afterTables` 写成 `*-filled-frontend-mock.json`，再用同一份数据运行前端预览。交付时必须同时给出组合报告、填表报告、前端 HTML live preview 和生成的 mock 数据路径。

前端测试交付时必须优先给出 HTML live preview 路径，并自然语言说明：用户打开后能看到哪个前端、该前端是否连接 mock 数据库 API、是否读取表内容、是否调用 `exportTableAsJson` / `insertRow` / `updateCell` 等数据库 API、以及推进或刷新交互是否产生表格变化。

如果前端需要特定状态、纪要、任务、地图等表内容才能显示，AI agent 必须主动构造 mock 数据文件并通过 `--mock-data` 注入前端测试，不得只说“缺少数据所以看不到”。mock 数据优先写入 `output/temp/shujuku-local/<用途>-mock.json`，格式为 `{ "seedTables": { "表名": [[表头], [数据行]] } }`；示例见 `tools/shujuku-local/frontend-mock-data.example.json`。交付时说明 mock 数据路径、关键 mock 行，以及这些数据是否被前端实际读取和显示。

shujuku 验收分两级：

- `fake` 是无密钥结构 smoke，只验证 bundle、mock 宿主、模板导入、`api.callAI()` 调用链路和报告生成。
- `real` 是项目填表验收的默认目标。只要开发者准备交付真实表格模板，AI agent 必须主动检查并督促配置 OpenAI-compatible 参数；未配置时只能标记为“仅完成 fake smoke，真实 AI 填表未验收”。

默认先跑 fake smoke：

```powershell
npm.cmd run shujuku:test -- --project <卡名> --ai fake --database-mode both --story-text "正文：用于本轮填表验收的测试剧情。"
```

随后优先跑 real AI 验收：

```powershell
npm.cmd run shujuku:test:real-ai -- --project <卡名> --database-mode both --story-text "正文：用于本轮填表验收的测试剧情。" --ai-config output/config/shujuku-ai.local.json
```

如果用户提供多轮聊天记录，优先使用：

```powershell
npm.cmd run shujuku:test:real-ai -- --project <卡名> --database-mode both --chat-file <聊天记录json> --ai-config output/config/shujuku-ai.local.json
```

AI agent 不得自己编造或提交密钥。若 `output/config/shujuku-ai.local.json` 不存在，必须提醒开发者按 `tools/shujuku-local/ai-config.example.json` 创建本地配置，或提供 `OPENAI_COMPAT_BASE_URL`、`OPENAI_COMPAT_API_KEY`、`OPENAI_COMPAT_MODEL`。交付说明必须包含：报告路径、shujuku ref、AI 模式、数据库模式、`AI 指令: api.callAI 已生成` 是否出现、填表变化数，以及 HTML/Markdown 报告中能否直接看见填表后的表格快照。

## 4. 卡项目结构

每张卡使用以下结构：

```text
projects/<卡名>/
├── README.md
├── current-plan.md 或 current-plan.yaml
├── build-config.json
├── source-card.json
├── entries/
│   ├── *.yaml                  ← 世界书条目（每条一个 YAML）
│   └── _build/                 ← 构建产物（自动生成）
│       └── worldbook.json
├── tables/
│   ├── 000-meta.yaml           ← 表格元信息（YAML 拆分模式）
│   ├── 001-*.yaml              ← 每张表一个 YAML
│   ├── table-template.json     ← 或 JSON 单文件格式（二选一）
│   └── _build/                 ← 构建产物（自动生成）
│       └── table-template.json
├── frontend/
├── assets/
├── release/
└── notes/
```

发布调试用 PNG 角色卡采用以下约定：

- `projects/<卡名>/assets/cover.png`：发布用封面 PNG。
- `projects/<卡名>/release/<卡名>.json`：回包后的角色卡 JSON。
- `projects/<卡名>/release/<卡名>.png`：封装后的 Tavern Card PNG。
- `output/latest/<卡名>.png`：可选临时 PNG 产物。
- JSON 是内部维护与回包标准产物，PNG 是可选发布/调试封装产物。

### release 资产核对 gate

构建或回包产生 release JSON 后，必须先运行：

```powershell
npm.cmd run verify-release -- --project <卡名> --json projects/<卡名>/release/<卡名>.json
```

交付 PNG 时必须先完成 JSON gate，再封装 PNG、反解 PNG，并对反解 JSON 重跑同一套核对：

```powershell
npm.cmd run json-to-png -- projects/<卡名>/release/<卡名>.json projects/<卡名>/assets/cover.png projects/<卡名>/release/<卡名>.png
npm.cmd run png-to-json -- projects/<卡名>/release/<卡名>.png output/temp/<卡名>-png-extract.json
npm.cmd run verify-release -- --project <卡名> --json output/temp/<卡名>-png-extract.json --compare-json projects/<卡名>/release/<卡名>.json
```

如果某张卡有固定正则集合，还要在 `verify-release` 中传入 `--exact-regex`，确认世界书、表格模板、剧情推进预设与正则脚本没有遗漏。PNG 只有在反解 JSON 核对通过后才能作为最终 Tavern Card 产物交付。

## 5. 目录职责

- `frontend/`：人工维护的前端源码区，放 HTML、剧情推进配置、手写正则配置。
- `unpacked/regex_scripts/`：拆包得到的正则脚本 JSON，回包时以这里为准。
- `unpacked/tavern_helper/scripts/`：拆包得到的酒馆助手脚本 JSON，回包时以这里为准。
- `unpacked/extracted/frontend/`：从拆包资产中提取的辅助前端素材，不等同于 `frontend/`。
- 修改已有卡并准备回包时，优先改 `unpacked/` 下的文件；新制卡或重构源码时，才改 `frontend/`。

## 6. 修改记录

- 每次卡项目发生实质修改，应更新 `projects/<卡名>/README.md`。
- 修改过程中的执行计划与进度记录写入 `projects/<卡名>/current-plan.md`。
- 修改已有卡的拆包内容默认放在 `projects/<卡名>/unpacked/`。
- 文档、索引、规则类维护只保留当前有效规则，不强制生成额外过程记录。

## 7. 校验要求

交付前优先运行：

```powershell
npm run verify-workflow-clean
npm run validate
npm run test
```

如只调整文档或目录结构，也至少运行 `npm run validate` 检查根目录和关键目录约束。

如果本次涉及 `tables/` 或 shujuku 本地测试流程，还必须优先运行：

```powershell
npm.cmd run shujuku:test -- --project <卡名> --ai fake --database-mode both
npm.cmd run shujuku:test:real-ai -- --project <卡名> --database-mode both --ai-config output/config/shujuku-ai.local.json
```

没有具体项目时，可用 `--template <表格模板路径>` 验证模板文件。真实 AI 配置缺失时，必须在交付中明示“real AI 未验收，需要开发者配置 AI 参数后重跑”。测试报告写入 `output/temp/shujuku-local/`，交付时必须给出可读的 `.md` 或 `.html` 报告路径。

## 8. 记录分工

| 文件 | 作用 |
| --- | --- |
| `CHANGELOG.md` | 工具系统、结构、脚本、提示词的变更 |
| `projects/<卡名>/README.md` | 单张卡项目的版本与更新记录 |
| `projects/<卡名>/current-plan.md` | 当前卡项目执行计划与进度 |

严禁把角色卡项目级记录写入 `CHANGELOG.md`。例如：单张卡的新建、解包、修改、回包、构建、发布、世界书条目调整、表格模板修改、前端片段修改、项目 README/current-plan 更新等，只能写入对应 `projects/<卡名>/` 内的 README、current-plan 或项目内记录文件；`CHANGELOG.md` 只记录工具链、流程规则、提示词、Schema、CI 或系统结构等工程化变更。
