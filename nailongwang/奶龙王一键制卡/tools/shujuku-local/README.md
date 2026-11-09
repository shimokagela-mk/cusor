# shujuku 本地测试工具

本工具用于在本地拉起 shujuku bundle，mock SillyTavern / TavernHelper 宿主环境，导入角色卡表格模板，并对正文执行 AI 填表总结。

## 默认一键测试

本工具把 shujuku 测试分成两层：

- `fake` smoke：无密钥，用确定性响应验证本地宿主、模板导入、`api.callAI()` 和报告链路。
- `real` AI：项目交付前默认应执行的真实填表验收，需要 OpenAI-compatible 配置。

```powershell
npm run shujuku:smoke
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --story-text "正文：角色在星辉港发现银钥匙，并把钥匙交给档案员记录。"
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --story-text "正文：角色在星辉港发现银钥匙，并把钥匙交给档案员记录。" --ai-config output/config/shujuku-ai.local.json
```

`--ai fake` 不联网，使用确定性 fake AI。报告里仍会展示 `api.callAI()` 生成的填表指令，用于验证链路。它不能替代真实模型填表验收；AI agent 交付时必须明确说明当前报告是 `fake` 还是 `real`。

## 前端本地测试

当项目包含 `frontend/`、状态栏、推进 UI 或开场白 UI 时，先运行表格填表测试，再运行前端测试：

```powershell
npm.cmd run shujuku:test:real-ai -- --project <卡名> --database-mode both --ai-config output/config/shujuku-ai.local.json
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both
npm.cmd run shujuku:full:real-ai -- --project <卡名> --database-mode both --chat-file output/temp/chat.json --ai-config output/config/shujuku-ai.local.json --frontend-scenario all
```

`shujuku:full:real-ai` 是推荐的一体化验收命令：它会先用真实语料和真实 OpenAI-compatible API 生成填表结果，再把填表后的 `afterTables` 写入 `*-filled-frontend-mock.json`，随后自动运行前端测试。这样前端预览看到的不是手写 mock，而是同一轮真实填表产物。

也可以只测一个前端文件：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-file frontend/opening.html --frontend-scenario opening --expect-text "开场"
```

如果前端需要特定表内容才能显示，agent 可以先写一份 mock 数据，再注入预览：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-file frontend/status.html --frontend-scenario status --mock-data output/temp/shujuku-local/status-mock.json --expect-text "星央市旧灯塔"
```

`--mock-data` 支持三种 JSON 形态：

```json
{
  "seedTables": {
    "主角状态表": [
      ["行号", "状态", "体力", "当前位置"],
      [1, "紧张", "80", "星央市旧灯塔"]
    ]
  }
}
```

也可以使用 `{ "tables": { ... } }`，或直接使用 `{ "表名": [[...], [...]] }`。示例见 `frontend-mock-data.example.json`。

前端测试会生成 `.html` live preview。用户直接打开 HTML 后，可以在左侧看到项目真实前端运行；该前端会连接页面内嵌的 mock `AutoCardUpdaterAPI` / `TavernHelper` 数据库 API。右侧会显示实时 API 调用轨迹和表格状态，配置过的推进/刷新交互也会变成可点击按钮。

前端报告会输出：

- 前端可用性自然语言结论。
- 用户可直接打开的 HTML 前端预览。
- 渲染文本。
- 读取/写入数据库 API 调用轨迹。
- 前端执行后的实时表格快照。

## 注入正文或聊天记录

纯正文：

```powershell
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --story-file output/temp/story.txt
```

多轮聊天记录：

```powershell
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --chat-file output/temp/chat.json
```

`--chat-file` 支持两种消息格式，也可以混用：

```json
[
  { "role": "user", "content": "玩家输入。" },
  { "role": "assistant", "content": "AI 正文：角色在星辉港发现银钥匙。" },
  { "is_user": true, "mes": "继续追问。" },
  { "is_user": false, "mes": "AI 正文：档案员确认银钥匙属于旧灯塔。" }
]
```

也支持外层对象：

```json
{
  "messages": [
    { "role": "user", "content": "玩家输入。" },
    { "role": "assistant", "content": "AI 正文。" }
  ]
}
```

填表正文默认取聊天记录中的非用户 AI 消息，并按时间顺序合并。格式示例见 `chat-fixture.example.json`。

## 真实 AI 配置

真实 AI 走 OpenAI-compatible `/chat/completions`，不绑定具体服务商。

项目交付前默认要求准备真实 AI 配置。AI agent 应主动检查 `output/config/shujuku-ai.local.json` 或 `OPENAI_COMPAT_*` 环境变量；缺失时提醒开发者配置，并把本轮结果标记为“仅完成 fake smoke，真实 AI 填表未验收”。

推荐用本地配置文件：

```powershell
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --story-text "正文..." --ai-config output/config/shujuku-ai.local.json
```

配置文件格式：

```json
{
  "baseUrl": "https://example.com/v1",
  "apiKey": "sk-your-api-key",
  "model": "your-model-name"
}
```

也可以直接使用环境变量：

```powershell
$env:OPENAI_COMPAT_BASE_URL="https://example.com/v1"
$env:OPENAI_COMPAT_API_KEY="sk-..."
$env:OPENAI_COMPAT_MODEL="model-name"
npm run shujuku:test:real-ai -- --project <卡名> --database-mode both --story-text "正文..."
```

## 报告判断

报告输出到 `output/temp/shujuku-local/`。

需要确认：

- `API 来源` 是 `shujuku bundle`。
- `AI 指令` 是 `api.callAI 已生成`。
- native 报告中有 `<tableEdit>insertRow(...)</tableEdit>`。
- sqlite 报告中有 `<tableEdit>INSERT INTO ...</tableEdit>`。
- `填表效果` 和 `填表后表格快照` 能看见正文关键词。
