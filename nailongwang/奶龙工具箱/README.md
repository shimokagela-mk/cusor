# 奶龙工具箱

单文件级酒馆生态维护工具箱，负责酒馆助手脚本、SillyTavern Regex 与资产、预设/破限、数据库模板、世界书单条目、前端片段、STscript、Tavern Card v3 单文件识别和 API 知识库的生成、校验与维护。

脚本项目采用 **source-first + Tavern 资产分层** 架构：项目下先按资产类型分为 `tavern helper/`、`regex/`、`extensions/` 等目录，每个产物目录里再放 `src/` 和 `meta.json`。资产目录下的 `src/` 是唯一主要编辑区，`latest/` 是由工具生成的当前发布产物，`archive/` 是历史发布产物。

## 目录结构

```text
奶龙工具箱/
├── scripts/
│   ├── unpack-project.js          项目级拆包：latest → project.json + 资产类型目录
│   ├── pack-project.js            项目级回包：资产 src → latest，并归档旧版
│   ├── verify-project.js          校验 project.json / 资产 src / latest / archive 一致
│   ├── convert.js                 底层 JSON ↔ JS 单文件转换
│   ├── expand-js-string-literals.js
│   ├── new.js
│   ├── cli.js
│   └── lib/
├── tests/
├── examples/
├── schemas/
├── data/
├── docs/
└── projects/
    └── <项目名>/
        ├── project.json
        ├── README.md
        ├── tavern helper/
        │   └── <artifact-id>/
        │       ├── src/
        │       └── meta.json
        ├── regex/
        │   └── <artifact-id>/
        │       ├── src/
        │       └── meta.json
        ├── extensions/
        ├── latest/
        └── archive/
```

## 项目维护流程

首次迁移或从发布产物恢复源码：

```powershell
npm run unpack-project -- "projects/<项目名>"
```

`unpack-project` 不再区分小型/大型项目。所有项目统一按 Tavern 资产类型分层：

- `plain-js` / `js-slash-runner` → `tavern helper/<artifact-id>/`
- `sillytavern-regex` → `regex/<artifact-id>/`
- `sillytavern-extension` → `extensions/<artifact-id>/`
- 其它 ST 资产 → `assets/<type>/<artifact-id>/`
- 前端片段 → `snippets/<artifact-id>/`
- STscript → `stscript/<artifact-id>/`

日常修改：

```powershell
# 1. 只修改对应资产目录下的 src/ 与 meta.json
# 2. 更新 projects/<项目名>/README.md
npm run pack-project -- "projects/<项目名>" -- --version vX.Y
npm run verify-project -- "projects/<项目名>"
npm run validate
npm run check-refs
npm run test
```

禁止把 `latest/` 当作主要编辑区。`latest/` 只放当前可导入发布文件；`archive/` 只放历史发布文件。

## 一页命令

```powershell
npm run cli
npm run new -- --help
npm run unpack-project -- "projects/<项目名>"
npm run pack-project -- "projects/<项目名>" -- --version vX.Y
npm run verify-project -- "projects/<项目名>"
npm run validate
npm run check-refs
npm run test
npm run convert
npm run expand-js-strings
npm run help
```

## 项目级工具

### `unpack-project`

```powershell
npm run unpack-project -- "projects/<项目名>"
```

行为：

- 扫描 `latest/`。
- 识别 `plain-js`、`js-slash-runner`、`sillytavern-regex`、`st-asset-json`。
- 写入只包含项目、版本和 `outputs` 的 `project.json`。
- 生成 `tavern helper/`、`regex/`、`extensions/`、`assets/`、`snippets/` 或 `stscript/` 下的产物源码目录。
- 不修改 `latest/` 和 `archive/`。

### `pack-project`

```powershell
npm run pack-project -- "projects/<项目名>" -- --version vX.Y
```

行为：

- 读取 `project.json.outputs[].root` 与对应资产目录下的源码。
- 按 outputs 生成 `latest/`。
- 当目标版本不同于当前 `latest/` 版本时，先把旧 `latest/` 复制到 `archive/v<旧版本>/`。
- 不重新猜测目录结构；以 `project.json.outputs[].root` 和相对路径为准。

### `verify-project`

```powershell
npm run verify-project -- "projects/<项目名>"
```

校验：

- `latest/` 只有一个当前版本。
- `archive/vX/` 目录名与内部文件版本一致。
- 每个 output 必须声明合法 `root`：`tavern helper`、`regex`、`extensions`、`assets`、`snippets` 或 `stscript`。
- 拒绝根级旧协议 `src/main.js` / `src/metadata`。
- 从资产目录源码重新生成的产物与 `latest/` 等价。

## 底层转换工具

`convert.js` 仍保留，用于临时单文件互转、故障诊断和底层工具测试；它不再是项目维护主流程。

```powershell
npm run convert -- "projects/<项目名>/latest/酒馆助手脚本-xxx v1.0.json"
npm run convert -- "projects/<项目名>/latest/xxx v1.0.js"
npm run expand-js-strings -- "projects/<项目名>/latest/xxx v1.0.js"
```

语义：

- JSON → JS：`JSON.parse(json).content` 原样写出。
- JS → JSON：读取 `.js` 全文写回 JSON `content`。
- `archive/` 输入必须显式指定 `--out`，避免改写历史留存。

## 模板生成器

```powershell
npm run new -- --help
npm run new -- js-script 我的脚本
npm run new -- st-extension my-extension
npm run new -- shujuku-template 战斗模板
npm run new -- regex 清理标签
npm run new -- worldbook-entry 设定条目
npm run new -- frontend-snippet 状态面板
npm run new -- stscript-quick-reply 快捷命令
```

默认输出到 `generated/`，可用 `--out <dir>` 指定目录，用 `--force` 覆盖已有文件。

## 知识库与模式

- `docs/TARGET_RUNTIME_MODES.md`：A~L 目标运行方式判定。
- `data/capabilities-index.json`：机读能力清单。
- `examples/`：格式骨架样例。
- `schemas/`：样例和数据格式校验。
- `docs/*_API.md` 与 `data/*-api.json`：酒馆生态 API / 格式知识库。

写代码前必须先判定目标模式，避免混用 JS-Slash-Runner、SillyTavern 原生扩展、Regex、shujuku、MVU、Zod、STscript 或整卡流程。

## 格式校验

```powershell
npm run validate
npm run check-refs
npm run test
```

校验内容包括 JSON/schema/data 可解析性、examples 格式、API 引用、负例测试、转换工具闭环、项目级 source-first 拆包/回包/校验。

## 行尾约定

所有 `.js` / `.json` / `.md` 输出统一使用 UTF-8 与 LF。Windows 上只临时切换编辑器显示，不直接改写行尾。
