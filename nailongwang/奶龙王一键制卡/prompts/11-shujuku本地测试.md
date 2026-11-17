# 11-shujuku 本地测试

本提示词用于在本地验证角色卡项目的 shujuku 表格模板、表格读写、世界书注入和可选 AI 填表链路。它不替代 SillyTavern 真机测试，但应在打包导入 SillyTavern 前优先执行。

## 何时执行

- 新建或大改 `tables/` 后。
- 调整 shujuku 模板、剧情推进预设或表格更新规则后。
- 修改或新增 `frontend/`、状态栏前端、推进前端、开场白前端后。
- 回包前需要确认数据库模板能被 shujuku 导入时。
- 用户明确要求“本地测试数据库 / 填表效果 / shujuku 测试 / 看前端效果”时。

## 执行命令

默认验收分两级执行：

- `fake` smoke：无密钥，先确认 shujuku bundle、mock 宿主、模板导入和报告生成链路可用。
- `real` AI：项目交付前的默认目标，用真实 OpenAI-compatible 模型验证正文能否被实际填入表格。

```powershell
npm run shujuku:smoke
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --ai-config output/config/shujuku-ai.local.json
npm run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both
```

如果需要指定模板文件：

```powershell
npm run shujuku:test -- --template projects/<卡名>/tables/_build/table-template.json --ai fake --database-mode both
```

如果需要指定本轮正文，让用户能直接看到填表效果：

```powershell
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --story-text "正文：角色在星辉港发现银钥匙，并把钥匙交给档案员记录。"
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --story-file output/temp/story.txt
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --chat-file output/temp/chat.json
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --chat-file output/temp/chat.json --ai-config output/config/shujuku-ai.local.json
```

如果本轮还需要给用户看前端效果，并且用户希望前端使用真实填表产物而不是手写 mock，优先运行组合命令：

```powershell
npm run shujuku:full:real-ai -- --project <卡名> --database-mode both --chat-file output/temp/chat.json --ai-config output/config/shujuku-ai.local.json --frontend-scenario all
```

组合命令会生成：
- `*-fill-native.*` / `*-fill-sqlite.*`：真实填表报告。
- `*-filled-frontend-mock.json`：由填表后 `afterTables` 自动写出的前端数据。
- `*-frontend-*.html`：使用上述数据运行的前端 live preview。
- `*.html` / `*.md`：组合索引报告。

交付时必须说明前端预览是否实际读取了这份 `*-filled-frontend-mock.json`，不要再把手写 mock 当作真实填表效果。

输入格式：

- `--story-text`：直接传入一段正文。
- `--story-file`：UTF-8 纯文本文件，全文作为本轮正文。
- `--chat-file`：JSON 聊天记录。支持数组，或 `{ "messages": [...] }` / `{ "chat": [...] }` / `{ "data": [...] }`。消息可使用 `{ "role": "user"|"assistant"|"system", "content": "..." }`，也可使用 SillyTavern 风格 `{ "is_user": true|false, "mes": "..." }`。填表正文默认取非用户 AI 消息并按时间顺序合并。
- 示例见 `tools/shujuku-local/chat-fixture.example.json`。

AI 填表链路要求：

- runner 必须通过 `window.AutoCardUpdaterAPI.callAI()` 生成填表指令。
- native 模式的 AI 输出应包含 `<tableEdit>` 与 `insertRow("表名", {...})`。
- sqlite 模式的 AI 输出应包含 `<tableEdit>` 与 `INSERT INTO ... VALUES ...`。
- runner 解析 AI 指令后，再调用 shujuku 暴露的 `insertRow` 执行写表；报告中 `AI 指令` 必须显示为 `api.callAI 已生成`。

## AI 配置要求

真实 AI 填表是项目验收的默认目标。AI agent 必须在表格测试前检查是否存在 `output/config/shujuku-ai.local.json`，或是否已设置 `OPENAI_COMPAT_BASE_URL`、`OPENAI_COMPAT_API_KEY`、`OPENAI_COMPAT_MODEL`。

如果缺少配置，AI agent 必须提醒开发者：

1. 从 `tools/shujuku-local/ai-config.example.json` 复制一份到 `output/config/shujuku-ai.local.json`。
2. 填入 OpenAI-compatible `baseUrl`、`apiKey`、`model`。
3. 重新运行 `npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --ai-config output/config/shujuku-ai.local.json`。

缺少真实 AI 配置时，允许先跑 `--ai fake`，但交付中必须明确写出：“仅完成 fake smoke，真实 AI 填表未验收”。不得把 fake 报告描述为真实模型填表效果。

真实模型调用可使用环境变量：

```powershell
$env:OPENAI_COMPAT_BASE_URL="https://example.com/v1"
$env:OPENAI_COMPAT_API_KEY="sk-..."
$env:OPENAI_COMPAT_MODEL="model-name"
npm run shujuku:test:real-ai -- --project <卡名>
```

推荐使用本地 JSON 配置文件，避免每次查环境变量写法：

```powershell
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --story-text "正文..." --ai-config output/config/shujuku-ai.local.json
```

配置格式参考 `tools/shujuku-local/ai-config.example.json`：

```json
{
  "baseUrl": "https://example.com/v1",
  "apiKey": "sk-your-api-key",
  "model": "your-model-name"
}
```

可选参数：

- `--database-mode native|sqlite|both`：默认 `native`；验收项目模板时推荐 `both`。
- `--ai-config <路径>`：读取 OpenAI-compatible 配置文件，字段为 `baseUrl`、`apiKey`、`model`；只在 `--ai real` 时需要。
- `--story-text <正文>` / `--story-file <路径>`：注入一段正文并生成“正文填表总结”，报告会展示正文关键词写入后的表格快照。
- `--chat-file <路径>`：注入多轮聊天记录；优先级高于 `--story-text` / `--story-file`。
- `--manual-update`：额外触发 shujuku 的 `manualUpdate()`；默认不启用，避免 mock 环境等待完整自动填表链路。

## 前端测试

如果任务修改或新增 `frontend/`、状态栏前端、推进前端、开场白前端，AI agent 必须额外运行：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both
```

也可以指定单个文件或 fixture：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-file frontend/opening.html --frontend-scenario opening --expect-text "开场"
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-fixture projects/<卡名>/frontend-test.json
```

如果前端需要特定状态、纪要、任务、地图等表内容才能显示，AI agent 应主动构造 mock 数据，而不是让用户手填。优先写入 `output/temp/shujuku-local/<用途>-mock.json`，再用 `--mock-data` 注入：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-file frontend/status.html --frontend-scenario status --mock-data output/temp/shujuku-local/status-mock.json --expect-text "星央市旧灯塔"
```

mock 数据格式：

```json
{
  "seedTables": {
    "主角状态表": [
      ["行号", "状态", "体力", "当前位置"],
      [1, "紧张", "80", "星央市旧灯塔"]
    ],
    "任务表": [
      ["行号", "任务", "状态"],
      [1, "调查旧灯塔", "进行中"]
    ]
  }
}
```

也支持 `{ "tables": { ... } }` 或直接 `{ "表名": [[...], [...]] }`。示例见 `tools/shujuku-local/frontend-mock-data.example.json`。

前端测试的 `.html` 报告是主要交付物。用户打开后应能直接看到项目真实前端运行在 `Live Preview` 区域；预览页会在前端脚本执行前注入 mock `AutoCardUpdaterAPI`、`TavernHelper`、`SillyTavern`，并让前端连接页面内嵌的同一份 mock 表格数据库。

### 单文件 HTML 本地连调

如果用户明确要求“本地打开页面连调”“先不要打成酒馆正则”“给我两个单文件 HTML”，AI agent 必须优先生成可直接用浏览器打开的 `.local.html`，不要把正则 JSON 当成本地测试交付物。正则 JSON 是最终导入 SillyTavern 的包装格式，不是当前连调入口。

以 `projects/少女前线` 为例，执行：

```powershell
node projects/少女前线/scripts/build_single_html.js
```

生成产物：

```text
projects/少女前线/release/少女前线-待机界面.local.html
projects/少女前线/release/少女前线-战斗界面.local.html
```

交付时优先给出这两个 `.local.html` 路径，并说明：

- 这两个文件用于当前本地连调测试，可直接用浏览器打开。
- 构建脚本会内联入口 HTML 中的本地 `<script src>` 依赖。
- 构建脚本会把 CSS 中可解析的本地静态资源 `url(...)` 转成 `data:` URI。
- 运行时由数据库表或用户数据提供的动态图片路径不属于静态单文件内联范围；如果页面测试依赖这些路径，必须补 mock 数据或改为可访问路径后再验收。
- 本地连调通过后，才进入最终酒馆正则打包；不要把两个阶段混在一起糊弄用户。

本地单文件 HTML 的最低验收：文件存在、包含完整 `<!DOCTYPE html>`、无本地 `<script src>` 残留、关键全局对象已内联、静态背景等可解析本地资源已内联或明确说明边界。

交付时必须优先给出 HTML 报告路径，并说明：

- 用户打开后能直接看到哪个前端。
- 前端是否连接了 mock 数据库 API。
- 前端是否读取了表内容。
- 前端是否调用了 `exportTableAsJson`、`insertRow`、`updateCell` 等数据库 API。
- 推进或刷新交互是否产生表格变化。
- 如果状态是 `needs-review` 或 `failed`，还要说明缺少的文本、API 调用或错误。

## 输出检查

测试报告输出到：

```text
output/temp/shujuku-local/
```

必须查看可读报告：

- `*.md`：直接展示模板概览、填表变化、填表后表格快照、世界书快照。
- `*.html`：同样内容的浏览器可读版本。
- `*.json`：机器可读报告，用于排错。

前端测试报告也输出到同一目录。前端 `.html` 是可交互 live preview，不是纯文本报告；用户应优先打开它查看真实前端与 mock 数据库 API 的连接效果。

报告必须包含“正文填表总结”区块，并在 `填表效果` 与 `填表后表格快照` 中看见本轮正文的关键词。native 与 sqlite 双模式测试会分别生成带模式后缀的报告。
报告还必须展示 `AI 填表指令`，用于确认本轮不是 runner 直接拼行数据，而是先由 shujuku 的 `api.callAI()` 生成 native/sqlite 对应指令。
报告还必须包含“填表可用性”区块。AI agent 交付时不能只贴报告路径，必须用自然语言告诉用户本轮结果属于哪一种：

- `usable`：AI 指令已生成，表格有变化，本地填表链路可用。
- `needs-review`：表格有变化，但存在 DDL / 表头不一致、列数不一致等提示；可以看效果，但交付前要复核 sqlite 映射。
- `limited`：报告里出现 fallback 或错误，只能用于排查，不能当最终验收。
- `failed`：未检测到表格变化，填表不可用。
- `smoke-only`：只有 fake 或本地 deterministic 链路可用，真实 AI 未验收。

如果报告出现 `DDL / 表头提示`，必须明确点名受影响的表，并说明“填表效果可看，但 sqlite 模式可能按位置映射，建议修正 `sourceData.ddl` 的列名/注释/顺序后重跑”。

交付时应向用户说明：

- shujuku ref。
- AI 模式是 `fake` 还是 `real`。
- 如果 AI 模式不是 `real`，必须说明真实 AI 配置缺失或用户明确跳过。
- 数据库模式是 `native`、`sqlite` 还是双模式。
- 可读报告路径。
- 如果跑了前端测试，必须给出 HTML live preview 路径。
- 填表变化数。
- 填表可用性自然语言结论，不能只输出机器报告。
- DDL / 表头提示、warning 或 fallback 情况；存在时要说明是否影响验收。
- 是否存在 fallback mock API 提示或上游加载错误。

## 失败处理

- `shujuku:smoke` 下载失败：检查网络、`SHUJUKU_REF` 或缓存；不要改动角色卡内容。
- 模板导入失败：先修 `tables/` 的 JSON/YAML 格式，再重新构建或重新测试。
- 填表无变化：检查表头、更新规则、fake AI fixture 和测试命令是否指向正确项目。
- sqlite 模式失败：检查模板 `sourceData.ddl`。本地 runner 会为缺少 DDL 的模板临时生成测试用 DDL；如果真实模板依赖 SQL 模式，仍建议在源模板中维护明确 DDL。
- sqlite 模式出现 DDL / 表头提示：优先检查 `sourceData.ddl` 的数据列名、注释和顺序是否与 `content[0]` 表头一致。列名不一致时 shujuku 可能按位置映射继续加载，表格看起来能填，但 AI agent 必须提示用户“需要复核”，不能描述为完全通过。
- 真实 AI 配置缺失：提醒开发者创建 `output/config/shujuku-ai.local.json` 或设置 `OPENAI_COMPAT_*`，并把当前状态标记为“real AI 未验收”。
- 真实 AI 失败：确认环境变量、模型、API 地址和余额；可回到 `--ai fake` 验证结构链路，但不得把 fake 结果当作真实 AI 验收。

## 边界

- 本流程只负责本地 shujuku 运行基底和模板验收。
- 不自动解包、回包或发布角色卡。
- 不把 shujuku 上游源码复制进仓库；运行时拉取并缓存到 `output/cache/shujuku/`。
