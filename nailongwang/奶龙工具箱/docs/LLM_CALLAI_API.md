# shujuku LLM 调用 API 速查

shujuku 将当前数据库插件里配置的 API 能力暴露为 `window.AutoCardUpdaterAPI.callAI()`。外部 UI、前端片段、酒馆助手脚本可以复用它，不必重复保存 API URL、模型和密钥。

## 可用性检查

```js
const api = window.AutoCardUpdaterAPI;

if (!api || typeof api.callAI !== 'function') {
  console.warn('shujuku callAI 不可用');
  return;
}
```

## callAI

签名：

```ts
callAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { max_tokens?: number | string; maxTokens?: number | string }
): Promise<string | null>
```

示例：

```js
const messages = [
  { role: 'system', content: '你是剧情分析助手。' },
  { role: 'user', content: '请总结当前场景的冲突点。' },
];

const text = await window.AutoCardUpdaterAPI.callAI(messages, { maxTokens: 2000 });

if (text) {
  console.log(text);
}
```

规则：

- 返回 `string | null`，失败时一般返回 `null`。
- `max_tokens` 和 `maxTokens` 都支持。
- `maxTokens` 可以传数字字符串，例如 `{ maxTokens: '2000' }`。
- 默认 token 使用数据库配置或 4096。

## API 模式

源码里 `callAI` 会复用数据库插件当前 API 配置：

- Tavern Profile 模式：使用 SillyTavern Connection Manager。
- Custom 模式：
  - `useMainApi` 开启时走酒馆主 API。
  - 否则走数据库插件独立 API 配置。

## getStoryContext

签名：

```ts
getStoryContext(maxTurns?: number): string
```

示例：

```js
const context = window.AutoCardUpdaterAPI.getStoryContext(5);

const analysis = await window.AutoCardUpdaterAPI.callAI([
  { role: 'system', content: '你是剧情分析助手。' },
  { role: 'user', content: `请分析以下剧情：\n\n${context}` },
], { maxTokens: 1200 });
```

规则：

- 从最近聊天记录向前取。
- 只取 AI 消息。
- 返回内容按时间顺序排列，消息间用空行分隔。
- 默认取 3 轮。

## 适用场景

- 前端按钮点击后让 AI 生成剧情摘要。
- 外部工具分析最近剧情。
- 根据表格数据构造 prompt，再复用数据库 API 调用模型。
- 做轻量的地图、任务、事件、状态栏文本生成。

## 不适用场景

- 不要把密钥硬编码进前端片段。
- 不要在循环里无节制调用，避免刷屏和高额消耗。
- 不要假设所有失败都会 throw；应处理 `null`。
- 不要把 callAI 当成 SillyTavern 原生 `generate()` 的完全替代，它使用的是 shujuku 的配置路径。
