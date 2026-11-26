# JS-Slash-Runner（酒馆助手）API 速查

来源：

- 仓库：<https://github.com/N0VI028/JS-Slash-Runner>
- 文档：<https://n0vi028.github.io/JS-Slash-Runner-Doc/>
- 机器可检索数据库：`data/js-slash-runner-api.json`

> 安全提示：酒馆助手允许执行自定义 JavaScript。脚本可访问聊天记录、API 密钥、SillyTavern 设置与网络请求能力；只运行可信脚本。

## 0. 常见调用场景

只读读取聊天与跳转楼层的常见组合：

```js
window.TavernHelper.getLastMessageId();
window.TavernHelper.getChatMessages(`0-${lastId}`, { include_swipes: false });
window.TavernHelper.triggerSlash(`/chat-jump ${id}`);
```

建议所有调用前做防御判断：

```js
if (typeof window.TavernHelper === 'undefined') {
    toastr?.warning?.('未检测到 JS-Slash-Runner / TavernHelper');
    return [];
}
```

常用 SillyTavern 原生对象：

| API | 用途 |
| --- | --- |
| `SillyTavern.getCurrentChatId()` | 当前聊天文件 id；常用于按聊天隔离状态 |
| `SillyTavern.chat` | 当前聊天原始消息数组；常用于只读分析或导出 |
| `SillyTavern.name1` / `SillyTavern.name2` | 玩家名 / 角色名；常用于 `{{user}}` / `{{char}}` 宏替换 |
| `SillyTavern.chatMetadata` | 当前聊天 metadata；常用于读取聊天级配置 |
| `SillyTavern.characters` / `SillyTavern.characterId` | 当前角色信息；常用于读取角色名或角色级设置 |

### 父页面 DOM 访问与桥接

酒馆助手脚本可能运行在 iframe 内。需要操作 SillyTavern 主页面 UI 时，先取得主页面 `document/window`：

```js
const doc = window.frameElement ? window.parent.document : document;
const win = window.frameElement ? window.parent : window;
```

适用场景包括：读取或移动原生菜单 DOM、注入 scoped style、监听父页面事件、访问父页面 `localStorage`。此类脚本应把所有 DOM 查询、`MutationObserver`、`eventSource` 和 `toastr` 调用都落在 `doc/win` 上，避免只操作 iframe 自身文档。

脚本需要在主页面注册既有 slash command 时，可向 `doc.head` 注入 `type="module"` 脚本并导入 `/scripts/slash-commands.js`：

```js
const bridge = doc.createElement('script');
bridge.type = 'module';
bridge.textContent = `
  import { registerSlashCommand } from '/scripts/slash-commands.js';
  registerSlashCommand('example-command', function () {
    return '';
  }, [], '示例命令');
`;
doc.head.appendChild(bridge);
```

面向 SillyTavern 原生扩展的新命令注册优先参考 `SlashCommandParser.addCommandObject`。

---

## 1. 消息 API

### `getChatMessages`

```ts
function getChatMessages(
  range: string | number,
  option?: {
    role?: 'all' | 'system' | 'assistant' | 'user';
    hide_state?: 'all' | 'hidden' | 'unhidden';
    include_swipes?: boolean;
  }
): ChatMessage[] | ChatMessageSwiped[];
```

获取聊天消息。`range` 可传楼层号、范围字符串、宏范围或负数：

```js
const latest = getChatMessages(-1)[0];
const all = getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
const allSwipes = getChatMessages('0-{{lastMessageId}}', { include_swipes: true });
```

`include_swipes: false` 返回：

```ts
 type ChatMessage = {
   message_id: number;
   name: string;
   role: 'system' | 'assistant' | 'user';
   is_hidden: boolean;
   message: string;
   data: Record<string, any>;
   extra: Record<string, any>;
 }
```

`include_swipes: true` 返回：

```ts
 type ChatMessageSwiped = {
   message_id: number;
   name: string;
   role: 'system' | 'assistant' | 'user';
   is_hidden: boolean;
   swipe_id: number;
   swipes: string[];
   swipes_data: Record<string, any>[];
   swipes_info: Record<string, any>[];
 }
```

### `setChatMessages`

```ts
function setChatMessages(
  chat_messages: Array<{ message_id: number } & (Partial<ChatMessage> | Partial<ChatMessageSwiped>)>,
  option?: { refresh?: 'none' | 'affected' | 'all' }
): Promise<void>;
```

修改楼层数据：

```js
await setChatMessages([{ message_id: 10, message: '新的消息' }]);
await setChatMessages([{ message_id: 4 }]); // 仅重新渲染第 4 楼
await setChatMessages([{ message_id: 0, swipe_id: 2 }]);
```

刷新策略：

- `none`：不刷新页面显示
- `affected`：刷新受影响楼层，默认值
- `all`：重新载入整个聊天，会触发 `CHAT_CHANGED`

### `createChatMessages`

```ts
function createChatMessages(
  chat_messages: Array<{
    name?: string;
    role: 'system' | 'assistant' | 'user';
    is_hidden?: boolean;
    message: string;
    data?: Record<string, any>;
  }>,
  option?: { insert_before?: number | 'end'; refresh?: 'none' | 'affected' | 'all' }
): Promise<void>;
```

```js
await createChatMessages([{ role: 'user', message: '你好' }]);
await createChatMessages(
  [{ role: 'system', message: '系统通知', data: { 阶段: '示例阶段' } }],
  { insert_before: 10 }
);
```

### `deleteChatMessages`

```ts
function deleteChatMessages(
  message_ids: number[],
  option?: { refresh?: 'none' | 'affected' | 'all' }
): Promise<void>;
```

```js
await deleteChatMessages([10, 15, -2, getLastMessageId()]);
```

> 危险：删除不可逆。导出工具中原则上不要默认启用删除类操作。

### `rotateChatMessages`

```ts
function rotateChatMessages(
  begin: number,
  middle: number,
  end: number,
  option?: { refresh?: 'none' | 'affected' | 'all' }
): Promise<void>;
```

把 `[begin, middle) [middle, end)` 旋转为 `[middle, end) [begin, middle)`：

```js
await rotateChatMessages(5, getLastMessageId(), getLastMessageId() + 1);
await rotateChatMessages(0, 3, getLastMessageId() + 1);
```

---

## 2. /STScript API

### `triggerSlash`

```ts
function triggerSlash(command: string): Promise<string>;
```

运行 SillyTavern `/STScript` 命令：

```js
await triggerSlash('/echo severity=success 运行成功!');
await triggerSlash('/chat-jump 10');
await triggerSlash('/trigger');
```

注意：

- Slash 命令出错会抛出错误。
- 如果执行 `/abort` 或命令出错，可能返回 `undefined`。
- 弹窗提示优先用 `toastr.success/error/info`。
- 获取最新楼层优先用 `getLastMessageId()`。

原生函数：

```ts
function SillyTavern.executeSlashCommandsWithOptions(command: string, options?: any): Promise<{
  interrupt: boolean;
  pipe: string;
  isBreak: boolean;
  isAborted: boolean;
  isQuietlyAborted: boolean;
  abortReason: string;
  isError: boolean;
  errorMessage: string;
}>;
```

---

## 3. 事件 API

事件类型包括：

- `iframe_events`：iframe/生成过程事件
- `tavern_events`：SillyTavern 事件，如 `MESSAGE_RECEIVED`、`MESSAGE_UPDATED`、`CHAT_CHANGED`
- 自定义字符串事件

### 监听

```ts
function eventOn<T extends EventType>(event_type: T, listener: ListenerType[T]): void;
function eventMakeLast<T extends EventType>(event_type: T, listener: ListenerType[T]): void;
function eventMakeFirst<T extends EventType>(event_type: T, listener: ListenerType[T]): void;
function eventOnce<T extends EventType>(event_type: T, listener: ListenerType[T]): void;
```

```js
eventOn(tavern_events.MESSAGE_RECEIVED, () => toastr.info('收到消息'));
eventOn(tavern_events.MESSAGE_UPDATED, id => console.info('更新楼层', id));
```

### 发送

```ts
function eventEmit<T extends EventType>(event_type: T, ...data: Parameters<ListenerType[T]>): Promise<void>;
function eventEmitAndWait<T extends EventType>(event_type: T, ...data: Parameters<ListenerType[T]>): void;
```

```js
await eventEmit('存档', { reason: 'manual' });
```

### 清理

```ts
function eventRemoveListener<T extends EventType>(event_type: T, listener: ListenerType[T]): void;
function eventClearEvent(event_type: EventType): void;
function eventClearListener(listener: Function): void;
function eventClearAll(): void;
```

通常无需手动清理：前端界面/脚本关闭时会自动卸载监听。

---

## 4. 生成 API

### `generate`

```ts
function generate(config: GenerateConfig): Promise<string | GenerateToolCallResult>;
```

使用当前 SillyTavern 预设生成文本。关键参数：

| 参数 | 说明 |
| --- | --- |
| `generation_id?: string` | 生成请求唯一 id，可用于停止指定生成 |
| `user_input?: string` | 用户输入 |
| `image?: File|string|(File|string)[]` | 图片输入 |
| `should_stream?: boolean` | 是否流式输出 |
| `should_silence?: boolean` | 是否静默生成 |
| `overrides?: Overrides` | 覆盖角色描述、世界书、聊天历史等内置提示词 |
| `injects?: Omit<InjectionPrompt,'id'>[]` | 额外注入提示词 |
| `max_chat_history?: 'all'|number` | 最多使用多少条聊天历史 |
| `custom_api?: CustomApiConfig` | 自定义 API / 代理预设 |
| `tools?: ToolDefinition[]` | OpenAI 风格工具定义 |
| `tool_choice?: ToolChoice` | 工具调用策略 |
| `json_schema?: JsonSchema` | 结构化 JSON 输出约束 |

```js
const result = await generate({ user_input: '你好' });

const streamed = await generate({
  user_input: '你好',
  should_stream: true,
});

const custom = await generate({
  user_input: '你好',
  custom_api: {
    proxy_preset: '示例代理预设',
    model: 'gpt-4',
  },
});
```

流式事件：

```js
eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, (text, generation_id) => {
  console.info('完整流式文本', generation_id, text);
});

eventOn(iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY, (text, generation_id) => {
  console.info('增量文本', generation_id, text);
});
```

### `generateRaw`

```ts
function generateRaw(config: GenerateRawConfig): Promise<string | GenerateToolCallResult>;
```

不使用当前预设，按 `ordered_prompts` 自定义提示词顺序。新版类型同样支持 `json_schema`，可配合 zod/JSON Schema 做结构化输出校验：

```js
const result = await generateRaw({
  user_input: '你好',
  ordered_prompts: [
    'char_description',
    { role: 'system', content: '系统提示' },
    'chat_history',
    'user_input',
  ],
});
```

工具调用返回值可能不是纯文本：

```ts
type GenerateToolCallResult = {
  type: 'tool_calls';
  tool_calls: Array<{
    id?: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  thought_signature?: string;
  reasoning_signature?: string;
};
```

`thought_signature` / `reasoning_signature` 属于模型/后端推理上下文签名，脚本应原样保留或忽略，不要把它们当成可展示正文。

### 其他生成工具

```ts
function getModelList(custom_api: { apiurl: string; key?: string }): Promise<string[]>;
function stopGenerationById(generationId: string): boolean;
function stopAllGeneration(): boolean;
```

---

## 5. 变量 API

变量作用域：

```ts
type VariableOption = {
  type: 'global' | 'preset' | 'character' | 'chat' | 'message' | 'script';
  message_id?: number;
  script_id?: string;
}
```

### 获取变量

```ts
function getVariables(option: VariableOption): Record<string, any>;
```

```js
const chatVars = getVariables({ type: 'chat' });
const messageVars = getVariables({ type: 'message', message_id: -2 });
const scriptVars = getVariables({ type: 'script', script_id: getScriptId() });
```

提示词中也可用宏：

| 作用域 | 宏 |
| --- | --- |
| 全局 | `{{get_global_variable::path}}` / `{{format_global_variable::path}}` |
| 预设 | `{{get_preset_variable::path}}` / `{{format_preset_variable::path}}` |
| 角色卡 | `{{get_character_variable::path}}` / `{{format_character_variable::path}}` |
| 聊天 | `{{get_chat_variable::path}}` / `{{format_chat_variable::path}}` |
| 最新消息楼层 | `{{get_message_variable::path}}` / `{{format_message_variable::path}}` |

优先使用 `format_xxx_variable`，AI 更容易理解 YAML 格式。以 `$` 开头的键会被变量宏忽略，适合存储不发给 AI 的元数据。

### 修改变量

```ts
function replaceVariables(variables: Record<string, any>, option: VariableOption): Record<string, any>;
function updateVariablesWith(
  updater: (variables: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>,
  option: VariableOption
): Record<string, any> | Promise<Record<string, any>>;
function insertOrAssignVariables(variables: Record<string, any>, option: VariableOption): Record<string, any>;
function insertVariables(variables: Record<string, any>, option: VariableOption): Record<string, any>;
function deleteVariable(variable_path: string, option: VariableOption): { variables: Record<string, any>; delete_occurred: boolean };
```

建议：

- 只改局部变量时优先 `updateVariablesWith`。
- 避免随意 `replaceVariables`，它会替换整个变量表。

```js
updateVariablesWith(vars => {
  _.update(vars, '角色A.状态值', value => value ? value * 2 : 0);
  return vars;
}, { type: 'chat' });
```

---

## 6. 工具函数

```ts
function reloadIframe(): void;
function substitudeMacros(text: string): string;
function getLastMessageId(): number;
function errorCatched<T extends any[], U>(fn: (...args: T) => U): (...args: T) => U;
function getIframeName(): string;
function getMessageId(iframe_name: string): number;
function getCurrentMessageId(): number;
function getScriptId(): string;
```

说明：

| API | 用途 |
| --- | --- |
| `reloadIframe()` | 重新加载当前前端/脚本，会让分享到全局的接口失效 |
| `substitudeMacros(text)` | 替换 SillyTavern 宏；官方拼写是 `substitude` |
| `getLastMessageId()` | 获取最新楼层号 |
| `errorCatched(fn)` | 包装函数，捕获报错并用酒馆通知显示 |
| `getIframeName()` | 获取 iframe 标识名称 |
| `getMessageId(iframe_name)` | 从楼层 iframe 名称解析楼层号 |
| `getCurrentMessageId()` | 当前前端界面所在楼层号，只能在前端界面中使用 |
| `getScriptId()` | 当前脚本 id，只能在脚本库中使用 |

---

## 7. 内置库

| 名称 | 用途 |
| --- | --- |
| `toastr` | 酒馆通知：`toastr.success/info/warning/error(message, title?)` |
| `_` | Lodash：常用 `_.get` / `_.set` / `_.update` / `_.unset` / `_.range` |
| `$` | jQuery：常用于 DOM 查询、事件绑定和界面更新 |
| `z` | zod：校验 AI 输出、配置对象、外部输入 |

---

## 8. 生成与维护建议

1. 只读工具默认应保持只读：优先使用 `getChatMessages`、`getLastMessageId`、`triggerSlash('/chat-jump')`。
2. 批量删除、修改、创建消息属于危险写操作，除非新增明确的用户确认 UI，否则不要默认启用。
3. 写入酒馆变量时优先 `updateVariablesWith`，避免 `replaceVariables` 覆盖整张变量表。
4. 所有 API 调用都应考虑酒馆助手未安装/未启用的降级路径。
5. 需要静默生成、摘要或章节名等辅助文本时，可用 `generate` 的静默生成与 `generation_id`，并监听生成事件显示进度。

### `getProxyPresetNames()`

```ts
getProxyPresetNames(): string[]
```

获取可用于 `custom_api.proxy_preset` 的代理预设名称列表。

### 酒馆助手脚本库函数

```ts
getScriptTrees(option?: { type?: 'global' | 'character' | 'preset' }): ScriptTree[]
replaceScriptTrees(script_trees: ScriptTree[], option?: { type?: 'global' | 'character' | 'preset' }): Promise<void>
updateScriptTreesWith(updater: (script_trees: ScriptTree[]) => ScriptTree[] | Promise<ScriptTree[]>, option?: { type?: 'global' | 'character' | 'preset' }): Promise<ScriptTree[]>
getScriptName(): string
getScriptInfo(): string
replaceScriptInfo(info: string): void
```

这些接口用于读取或维护酒馆助手脚本库、当前脚本名称与作者备注。`replaceScriptTrees` 会覆盖脚本库结构，使用前应确认作用范围。

### 酒馆助手脚本按钮 API

酒馆助手脚本按钮由 JS-Slash-Runner 渲染到 Quick Reply 按钮栏附近，用于脚本内部交互。它不等同于 SillyTavern 原生 `quickReplyApi`，也不是注册到聊天选项菜单、魔法棒或扩展面板的稳定接口。

```ts
getButtonEvent(button_name: string): string
getScriptButtons(): ScriptButton[]
replaceScriptButtons(buttons: ScriptButton[]): void
updateScriptButtonsWith(updater: (buttons: ScriptButton[]) => ScriptButton[] | Promise<ScriptButton[]>): ScriptButton[] | Promise<ScriptButton[]>
appendInexistentScriptButtons(buttons: ScriptButton[]): void
```

```js
eventOn(getButtonEvent('设置'), () => {
  toastr.info('打开设置');
});

appendInexistentScriptButtons([
  { name: '设置', visible: true },
]);
```

建议：

- 监听按钮点击优先用 `eventOn(getButtonEvent('按钮名'), handler)`；旧的 `eventOnButton` 已不推荐。
- 动态切换按钮组时用 `replaceScriptButtons`，追加默认按钮时用 `appendInexistentScriptButtons`。
- 只在脚本运行上下文中使用这些接口；前端片段、STscript、原生扩展不应假设它们存在。

### 其他新增/补充函数

```ts
getCurrentCharacterName(): string
refreshOneMessage(message_id: number, displayed_message_id?: number): Promise<void>
builtin.copyText(text: string): Promise<void>
```
