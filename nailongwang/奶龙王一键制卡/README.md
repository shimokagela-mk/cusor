# 奶龙王一键制卡

AI 辅助角色卡项目级创作、修改与构建系统。

## 项目定位

本项目负责角色卡项目级流程：

1. **写卡**：从零开始制作新角色卡项目。
2. **改卡**：围绕整张角色卡进行拆包、整理、批量修改、构建与回包。
3. **发布准备**：生成 release 产物并进行本地校验。

单文件级维护不在本系统内处理，应使用同级目录 `../奶龙工具箱/`。

## 快速分流

- 写卡 → 读取 `prompts/0-总览与启动.md`
- 修改整张卡 / 解包 / 回包 / 构建 / 发布 → 读取 `prompts/9-修改卡启动.md`
- 本地测试 shujuku 数据库模板与填表效果 → 读取 `prompts/11-shujuku本地测试.md`
- 批量修改世界书、批量处理角色卡资产、整卡风格调整 → 使用本系统
- 只处理单个文件 → 使用 `../奶龙工具箱/`

奶龙工具箱负责的单文件范围包括：酒馆助手脚本、JS 源码、SillyTavern 资产 JSON、Quick Reply、世界书/单条条目、Regex、Completion Preset/破限、Theme、数据库模板、前端片段、STscript、Tavern Card v3 单文件识别、API Connections、MVU、Zod 与 API/格式知识库。

详细执行规则不写在 README 中，AI 执行时必须读取 `AGENTS.md` 和对应 `prompts/`。

## 目录结构

```text
奶龙王一键制卡/
├── README.md              项目入口说明
├── AGENTS.md              AI 执行硬约束
├── CHANGELOG.md           工具系统变更日志
├── package.json           npm 脚本
├── prompts/               制卡/改卡流程提示词
├── docs/                  知识资料
├── data/                  机器可读流程与能力索引
├── schemas/               格式校验 schema
├── templates/             空白模板
├── examples/              完整范例
├── projects/              真实卡项目
├── tools/                 构建、拆包、回包、校验工具
├── tests/                 最小测试入口
└── output/                临时产物
```

## 常用命令

```powershell
npm run new -- <卡名>       # 新建卡项目
npm run validate            # 校验项目结构与 JSON
npm run test                # 运行最小测试
npm run verify-workflow-clean # 扫描权威流程文件的过期链路与污染式提示词
npm run build -- <plan路径> # 根据 current-plan.yaml 构建角色卡
npm run verify-release -- --project <卡名> --json projects/<卡名>/release/<卡名>.json
npm run unpack-card -- <角色卡JSON路径>
npm run repack-card -- <解包目录>
npm run unpack-tables -- <tables目录路径>  # 将表格模板 JSON 拆分为 YAML
npm run shujuku:smoke       # 拉取/缓存 shujuku 并验证本地测试 bundle 可用
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both  # 本地运行数据库模板测试并生成可读报告
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --ai-config output/config/shujuku-ai.local.json
npm run shujuku:full:real-ai -- --project <卡名> --database-mode both --chat-file output/temp/chat.json --ai-config output/config/shujuku-ai.local.json --frontend-scenario all
```

`shujuku:test` 会在 `output/temp/shujuku-local/` 写入 JSON、Markdown 与 HTML 报告；Markdown/HTML 报告会展示“正文填表总结”、`api.callAI()` 生成的 AI 填表指令、填表前后差异和填表后的表格快照，便于直接查看填表效果。可用 `--story-text` / `--story-file` 注入一段正文，也可用 `--chat-file` 注入多轮聊天记录；验收模板时推荐 `--database-mode both` 同时跑 native 与 sqlite。

`shujuku:full:real-ai` 用于“真实语料 + 真实 AI 填表 + 前端预览”一体化验收。它先运行真实填表，随后把填表后的 `afterTables` 写成 `*-filled-frontend-mock.json`，再把这份数据注入 `shujuku:frontend`。用户打开组合报告和前端 HTML 预览时，看到的是同一轮真实语料生成的表格数据。

`--ai fake` 只用于无密钥 smoke；真实项目交付前默认要求跑 `shujuku:test:real-ai`。真实 AI 使用 OpenAI-compatible 配置。可通过 `--ai-config` 指向本地 JSON，格式见 `tools/shujuku-local/ai-config.example.json`；也可使用 `OPENAI_COMPAT_BASE_URL`、`OPENAI_COMPAT_API_KEY`、`OPENAI_COMPAT_MODEL` 环境变量。AI agent 必须主动提醒开发者配置 `output/config/shujuku-ai.local.json`；未配置时只能说明“fake smoke 已完成，real AI 填表未验收”。


## PNG / JSON 互转

已打包的 Tavern Card PNG 需要先提取为 JSON，再复用现有拆包流程：

```powershell
node tools/png-to-json.js <角色卡PNG路径> [输出JSON路径]
node tools/unpack-card.js output/latest/<角色卡名>.json
```

release JSON 通过资产核对后，才能封装为 Tavern Card PNG；PNG 生成后必须反解回 JSON 并复核：

```powershell
node tools/json-to-png.js <角色卡JSON路径> <封面PNG路径> [输出PNG路径]
node tools/png-to-json.js <角色卡PNG路径> output/temp/<角色卡名>-png-extract.json
node tools/verify-release-card.js --project <卡名> --json output/temp/<角色卡名>-png-extract.json --compare-json <角色卡JSON路径>
```

`json-to-png` 会读取角色卡 JSON 和封面 PNG，重写 Tavern Card 元数据并写入新的 `chara` 字段。默认临时产物仍放在 `output/latest/`。
## 卡项目结构

真实卡项目统一放在：

```text
projects/<卡名>/
├── README.md
├── current-plan.md 或 current-plan.yaml
├── build-config.json
├── source-card.json
├── entries/
│   ├── *.yaml              世界书条目（每条一个 YAML）
│   └── _build/             构建产物（自动生成）
│       └── worldbook.json
├── tables/
│   ├── 000-meta.yaml       表格元信息（YAML 拆分模式）
│   ├── 001-*.yaml          每张表一个 YAML
│   └── _build/             构建产物（自动生成）
│       └── table-template.json
├── frontend/
├── assets/
├── release/
└── notes/
```

表格模板支持两种源文件格式（二选一）：
- **YAML 拆分格式**（推荐）：每张表一个 YAML 文件，`000-meta.yaml` 存放元信息
- **JSON 单文件格式**：所有表写在一个 `table-template.json` 中

使用 `npm run unpack-tables -- <tables目录>` 可将 JSON 单文件格式拆分为 YAML。

修改已有卡的拆包目录使用：

```text
projects/<卡名>/unpacked/
```

## 前端与拆包资产分工

- `frontend/`：人工维护的前端源码区，放 HTML、剧情推进配置、手写正则配置。
- `unpacked/regex_scripts/`：拆包得到的正则脚本 JSON，回包时以这里为准。
- `unpacked/tavern_helper/scripts/`：拆包得到的酒馆助手脚本 JSON，回包时以这里为准。
- `unpacked/extracted/frontend/`：从拆包资产中提取的辅助前端素材，不等同于 `frontend/`。
- 修改已有卡并准备回包时，优先改 `unpacked/`；新制卡或重构源码时，才改 `frontend/`。

## 文件分工

| 目录 | 作用 |
| --- | --- |
| `prompts/` | 流程提示词 |
| `docs/` | 知识资料 |
| `data/` | 机器可读索引 |
| `schemas/` | 格式约束 |
| `templates/` | 空白骨架 |
| `examples/` | 完整范例 |
| `projects/` | 真实业务项目 |
| `output/` | 临时产物，可清理 |

## 执行原则

- 根目录不放业务 JSON。
- 范例不放 `output/`，统一放 `examples/`。
- 真实项目不放根目录，统一放 `projects/<卡名>/`。
- 本地工作区独立维护，不依赖远端托管；需要历史留存时使用 `release/`、`notes/` 或用户指定的备份方式。
- 交付前优先运行 `npm run validate` 和 `npm run test`。
- release JSON 交付前运行 `npm run verify-release`；PNG 交付前先 `json-to-png`，再 `png-to-json` 反解，并对反解 JSON 重跑同一套核对。
