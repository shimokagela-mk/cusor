# 奶龙工具箱 AI 协作硬约束（AGENTS.md）

> **分流说明**：本文件是奶龙工具箱的专项规则。任务分流判定规则位于上级目录 `../AGENTS.md`。如果当前任务是角色卡项目级流程（解包、回包、构建、批量修改世界书、发布角色卡），应路由到 `奶龙王一键制卡/`，而非本系统。

适用对象：所有在本仓库执行修改的 AI（Kilo/Codex/Cline/Claude/...）与人类协作者。

## 0. 全局原则

- 所有可见输出必须使用简体中文。
- 写代码前必须查 `docs/TARGET_RUNTIME_MODES.md` 与 `data/capabilities-index.json` 判定目标模式（A~L）。
- 不允许把项目里 `examples/` 当作业务正文来源；`examples/` 永远只放格式骨架。
- 不允许把脚本类正文（如长 prompt、第三方主题 CSS）写入 `data/`、`schemas/`、`examples/`。

## 1. 修改 `projects/<项目名>/` 下任何脚本时的强制流程

必须严格按照 `docs/SCRIPT_VERSIONING.md` 的 source-first + Tavern 资产分层流程执行。对应资产目录下的 `src/` 是唯一主要编辑区，`latest/` 是打包产物，`archive/` 是只读历史发布产物。

```text
① 读取 project.json
② 若没有 project.json，先运行/规划 npm run unpack-project -- "projects/<项目名>"
③ 只修改 tavern helper/、regex/、extensions/、assets/、snippets/、stscript/ 下对应产物的 src/ 与 meta.json
④ 更新 projects/<项目名>/README.md：当前版本 + 追加更新日志
⑤ 运行 npm run pack-project -- "projects/<项目名>" -- --version v<新版本>
⑥ 运行 npm run verify-project -- "projects/<项目名>"
⑦ 运行 npm run validate / check-refs / test
```

任何一步缺失都视为本次修改未完成，必须补齐后才能交付。

## 2. 严禁

- 把 `latest/` 当作主要编辑区。
- 直接覆盖当前发布目录而不通过 `pack-project` 保留上一版文件。
- 改写已留存版本的文件（版本留存目录只读）。
- 跳号（v6.0 直接发 v6.3）或重复版本号。
- 把多个版本同时放在 `latest/`（latest 永远只有一个版本）。
- 用 `sed -i` / `perl -pi -e` / `awk -i` 等 shell 命令修改源代码——必须使用编辑工具（`Edit` / `replace_in_file` / `multi_replace`）。
- 把工具脚本（`scripts/*.js`）的产物写进脚本发布目录。

## 3. 必须

- 每次改 `projects/<项目名>/` 都必须更新对应 `projects/<项目名>/README.md` 的「更新日志」。
- 每次新增 API/格式知识库都同步：`data/*-api.json` 或 `data/*-format.json` + 对应 schema + `docs/*.md` + 必要 examples + `schemas/*.schema.json` + `data/capabilities-index.json` + `scripts/new.js` + `scripts/validate-examples.js` + `scripts/check-api-references.js` + `tests/fixtures/invalid/` + `tests/negative.test.js`。
- 每轮回复涉及代码改动，最终必须能通过：

```powershell
npm run validate
npm run check-refs
npm run test
```

## 4. 记录责任划分

| 文件                         | 写谁    | 写什么                         |
| -------------------------- | ----- | --------------------------- |
| `projects/<项目名>/README.md` | 用户视角  | 脚本本体每次更新的功能/修复条目            |
| `CHANGELOG.md`             | 贡献者视角 | 仓库工程化变更（脚本/工具/CI/Schema 更新） |

脚本本体更新时必须维护脚本级 README；工具链或知识库结构更新时维护 CHANGELOG。

严禁把脚本项目级记录写入 `CHANGELOG.md`。例如：单个脚本的新建、解包、回包、版本升级、字段维护、按钮调整、脚本 README 更新日志等，只能写入 `projects/<项目名>/README.md`；`CHANGELOG.md` 只记录工具链、流程规则、知识库、Schema、CI 或系统结构等工程化变更。

## 5. 输入歧义时的判定优先级

```
用户原话 > docs/TARGET_RUNTIME_MODES.md > data/capabilities-index.json > examples/ 现有结构 > 通用经验
```

不允许凭通用经验覆盖项目内已有约定。

## 6. 一旦本次任务涉及脚本修改，必须以这句话开头

```
本次涉及脚本修改，按 docs/SCRIPT_VERSIONING.md 流程执行。
```

并在结尾汇总：

- 原版本 → 新版本
- 新版本所在路径
- projects/<项目名>/README.md 更新日志摘要
- npm 三件套校验结果
