# 脚本资产 Source-First 版本管理规范

适用范围：仓库 `projects/<项目名>/` 下的酒馆助手脚本、Regex、原生扩展、前端片段、ST 资产与相关发布产物。

本规范是 AI 与人类的硬约束。项目采用 **Source-First + Tavern 资产分层** 架构：先按 Tavern 资产类型分目录，再在每个产物目录下维护 `src/`。`latest/` 是由工具生成的当前发布产物，`archive/` 是只读历史发布产物。

## 1. 标准目录结构

```text
projects/<项目名>/
├── project.json          项目构建清单：项目名、版本、outputs
├── README.md             项目级说明与更新日志
├── tavern helper/        酒馆助手脚本、TavernHelper、plain JS
│   └── <artifact-id>/
│       ├── src/
│       │   └── index.js
│       └── meta.json
├── regex/                SillyTavern Regex
│   └── <artifact-id>/
│       ├── src/
│       │   ├── findRegex.txt
│       │   └── replace.html
│       └── meta.json
├── extensions/           SillyTavern 原生扩展
│   └── <artifact-id>/
│       ├── src/
│       └── meta.json
├── assets/               其它 ST 资产 JSON
├── snippets/             前端片段
├── stscript/             STscript / Quick Reply 脚本
├── latest/               当前可导入发布产物，由 pack-project 生成
└── archive/              历史发布产物，只读
```

约束：

- 禁止把 `latest/` 当作主要编辑区。
- 禁止直接重命名或手改 `latest/` 中的 JS/JSON 来发布版本。
- 禁止使用根级旧协议 `src/main.js` 或 `src/metadata/` 作为项目主结构。
- `archive/v<X>/` 必须按语义版本命名，且只保存历史发布产物。
- `projects/<项目名>/README.md` 是项目级更新日志唯一位置。
- `convert.js` 是底层单文件工具，不作为项目维护主流程。

## 2. 资产类型映射

所有项目统一拆到以下资产根目录，不再区分小型/大型项目：

| 产物类型 | 源码目录 |
| --- | --- |
| `plain-js` / `js-slash-runner` | `tavern helper/<artifact-id>/src/index.js` |
| `sillytavern-regex` | `regex/<artifact-id>/src/findRegex.txt` + `regex/<artifact-id>/src/replace.html` |
| `sillytavern-extension` | `extensions/<artifact-id>/src/` |
| 其它 ST 资产 JSON | `assets/<type>/<artifact-id>/src/source.json` |
| 前端片段 | `snippets/<artifact-id>/src/` |
| STscript | `stscript/<artifact-id>/src/` |

`project.json.outputs[].root` 必须指向上述资产根目录之一，路径允许空格，例如 `tavern helper/main`。

## 3. 标准修改流程

```text
① 读取 projects/<项目名>/project.json。
② 若没有 project.json，先运行或规划：
   npm run unpack-project -- "projects/<项目名>"
③ 只修改对应资产目录下的 src/ 与 meta.json。
④ 更新 projects/<项目名>/README.md 的当前版本与更新日志。
⑤ 运行：
   npm run pack-project -- "projects/<项目名>" -- --version v<新版本>
⑥ 运行：
   npm run verify-project -- "projects/<项目名>"
   npm run validate
   npm run check-refs
   npm run test
```

`pack-project` 会在目标版本不同于当前 `latest/` 版本时，把上一版 `latest/` 复制到 `archive/v<上一版本>/`。

## 4. 版本号规则

| 改动性质 | 版本号变化 | 示例 |
| --- | --- | --- |
| 新增小功能、向后兼容修复、工具链结构升级 | 次版本 +0.1 | v6.0 → v6.1 |
| 仅修微小 bug、文案、样式 | 末位 +0.0.1 | v6.0 → v6.0.1 |
| 大量重构、行为不兼容、新模块 | 主版本 +1.0 | v6.0 → v7.0 |

禁止跳号、重复版本号、长期使用非语义后缀。

## 5. 工具分工

| 工具 | 用途 |
| --- | --- |
| `npm run unpack-project -- "projects/<项目名>"` | 从 `latest/` 拆出 `project.json` 和 Tavern 资产类型目录 |
| `npm run pack-project -- "projects/<项目名>" -- --version vX.Y` | 从资产目录源码生成 `latest/`，必要时归档上一版 |
| `npm run verify-project -- "projects/<项目名>"` | 校验 `project.json`、资产源码、`latest/`、`archive/` 一致 |
| `npm run convert` | 底层 JS-Slash-Runner JSON ↔ JS 单文件互转 |
| `npm run expand-js-strings` | 底层 JS 字符串字面量换行展开 |

## 6. 例外

只有以下情况允许直接读取或临时处理 `latest/`：

- 一次性迁移到 source-first 架构。
- 故障诊断、历史对比、导入文件核查。
- 修复 `pack-project` 生成结果本身。

即使在例外场景，也不得把 `latest/` 作为长期编辑源。

## 7. 强制校验

完成任何项目级脚本改动后必须通过：

```powershell
npm run verify-project -- "projects/<项目名>"
npm run validate
npm run check-refs
npm run test
```

未通过则禁止视为完成。
