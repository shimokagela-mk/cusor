# MVU（MagVarUpdate）API 速查

来源：

- 仓库：<https://github.com/MagicalAstrogy/MagVarUpdate>
- 教程：<https://raw.githubusercontent.com/MagicalAstrogy/MagVarUpdate/beta/doc/tutorial.md>
- 脚本控制变量：<https://stagedog.github.io/绛绛/教程/手写mvu变量卡/脚本控制变量/>

对应机器可检索数据库：`data/mvu-api.json`

> MVU 是 JS-Slash-Runner 上层的变量框架脚本，依赖 `window.TavernHelper` 与 `lodash`。它不是 SillyTavern 原生扩展，也不是 shujuku；写代码前必须确认目标运行方式（见 `docs/TARGET_RUNTIME_MODES.md`）。

## 0. 安装与就绪

最小化安装路径（局部脚本）：

```js
import 'https://gcore.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@master/artifact/bundle.js'
```

调用任何 MVU API 前必须等 MVU 初始化：

```js
await waitGlobalInitialized('Mvu');
```

入口对象：

```js
window.Mvu
```

---

## 1. 数据结构

MVU 在每条 AI 消息上附带 `MvuData`，结构大致是：

```ts
type MvuData = {
  stat_data: Record<string, any>;
  display_data: Record<string, any>;
  delta_data: Record<string, any>;
  initialized_lorebooks: Record<string, string[]>;
};
```

叶子节点形态：

```ts
// 初始化阶段
"日期": ["03月15日", "今天的日期，格式为 mm月dd日"]

// 运行阶段（stat_data 内）
"日期": [当前值, "字段说明"]
```

`display_data` 中已更新字段会变成：

```text
"66->74(接受告白并确认关系，好感度大幅提升)"
```

变量命名前缀：

| 前缀 | 含义 |
| --- | --- |
| `_` | 私有变量，仅脚本可读写，AI 不能更新 |
| `$` | 对 AI 不可见，不会写入提示词 |

---

## 2. 事件

```js
const E = Mvu.events;
```

| 事件 | 触发时机 | 监听器签名 |
| --- | --- | --- |
| `VARIABLE_INIT_STARTED` | 变量初始化前 | `(variables) => void` |
| `VARIABLE_INITIALIZED` | 变量初始化完成（仅新聊天） | `(variables) => void` |
| `VARIABLE_UPDATE_STARTED` | 一条回复开始更新前 | `(variables, out_is_updated) => void` |
| `COMMAND_PARSED` | 命令解析完成、尚未执行 | `(commands) => void` |
| `SINGLE_VARIABLE_UPDATED` | 单条命令执行后 | `(stat_data, path, oldValue, newValue) => void` |
| `VARIABLE_UPDATE_ENDED` | 本回复全部更新结束 | `(new_variables, old_variables) => void` |
| `BEFORE_MESSAGE_UPDATE` | 即将写入楼层前 | `(variables, message_id) => void` |

旧名兼容：

```text
mag_variable_update_started   ≡ VARIABLE_UPDATE_STARTED
mag_variable_updated          ≡ SINGLE_VARIABLE_UPDATED
mag_variable_update_ended     ≡ VARIABLE_UPDATE_ENDED
```

监听用 JS-Slash-Runner 的 `eventOn`：

```js
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (next, prev) => {
  // ...
});
```

---

## 3. 命令格式

### `_.set` 风格更新

```text
_.set('path.to.var', oldValue, newValue);// reason
```

- `path` 不带 `stat_data` 前缀
- `oldValue` 仅作可读性
- `newValue` 支持任意类型
- `reason` 写入 `display_data`

### 包裹块

| 块 | 含义 |
| --- | --- |
| `<UpdateVariable>...</UpdateVariable>` | 默认更新指令块，里面写 `_.set(...)` |
| `<JSONPatch>...</JSONPatch>` | RFC 6902 JSON Patch；新版本支持 YAML / JSON5 / TOML |
| `<initvar>...</initvar>` | 在额外问候语 / 世界书条目里覆盖初始变量 |

### 初始化世界书

`[InitVar]` / `[initvar]` 名字的条目，内容为 JSON5：

```json5
{
  "日期": ["03月15日", "今天的日期，格式为 mm月dd日"],
  "user": {
    "身份": ["新来的牧师", "随故事进展改变"]
  }
}
```

---

## 4. 运行时 API

```ts
Mvu.getMvuData(option?: {
  type?: 'message' | 'chat' | 'character' | 'global' | 'script';
  message_id?: number | 'latest';
  script_id?: string;
}): MvuData;

Mvu.replaceMvuData(data: MvuData, option: {
  type?: 'message' | 'chat' | 'character' | 'global' | 'script';
  message_id?: number | 'latest';
  script_id?: string;
}): Promise<void>;

Mvu.parseMessage(message: string, old_data: MvuData): Promise<MvuData | undefined>;
Mvu.isDuringExtraAnalysis(): boolean;
```

常用读取：

```js
const variables = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
const variables = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });
```

写回当前楼层：

```js
const data = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });
_.set(data, 'stat_data.角色A.状态值', 50);
_.set(data, 'display_data.角色A.状态值', '旧值->50(示例状态变化)');
await Mvu.replaceMvuData(data, { type: 'message', message_id: getCurrentMessageId() });
```

主动解析消息文本：

```js
const old = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });
const message = await generate({ user_input: '你好' });
const data = await Mvu.parseMessage(message, old);
if (data) await createChatMessages([{ role: 'assistant', message, data }]);
```

推荐默认 API 面：

- `Mvu.getMvuData`：读变量表。
- `Mvu.replaceMvuData`：完整写回变量表。
- `Mvu.parseMessage`：主动解析一段消息中的变量更新命令。
- `Mvu.events`：在 MVU 流程内修改数据，通常比手动写回更稳。
- `Mvu.isDuringExtraAnalysis`：判断当前轮次是否为额外模型解析，避免重复执行用户可见副作用。

弃用兼容 API：

| API | 状态 | 推荐替代 |
| --- | --- | --- |
| `getCurrentMvuData()` | deprecated | `getMvuData({ type: 'message', message_id: getCurrentMessageId() })` |
| `replaceCurrentMvuData(data)` | deprecated | `replaceMvuData(data, { type: 'message', message_id: getCurrentMessageId() })` |
| `reloadInitVar(data)` | deprecated | 初始化世界书 + 事件流程 |
| `setMvuVariable(data, path, value, options)` | deprecated | 事件回调中 `_.set/_.update`，或 `parseMessage + replaceMvuData` |
| `getMvuVariable(data, path, options)` | deprecated | `_.get` + 显式处理 `[value, desc]` |
| `getRecordFromMvuData(data, category)` | deprecated | 直接读取 `data.stat_data/display_data/delta_data` |

标记为 `deprecated` 的接口仅用于识别既有脚本；新建默认骨架不要生成。

---

## 5. 常用脚本模式

### 5.1 数值范围限制

```js
await waitGlobalInitialized('Mvu');
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, vars => {
  _.update(vars, 'stat_data.角色A.状态值', v => _.clamp(v, 0, 100));
});
```

### 5.2 限制单轮变化幅度

```js
await waitGlobalInitialized('Mvu');
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (next, prev) => {
  const old = _.get(prev, 'stat_data.角色A.状态值');
  _.update(next, 'stat_data.角色A.状态值', v => _.clamp(v, old - 3, old + 3));
});
```

### 5.3 锁死字段不让 AI 改

```js
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (next, prev) => {
  _.set(next, 'stat_data.角色A.状态值', _.get(prev, 'stat_data.角色A.状态值'));
});
```

### 5.4 修复路径中的脏字符

```js
eventOn(Mvu.events.COMMAND_PARSED, commands => {
  commands.forEach(c => { c.args[0] = c.args[0].replaceAll('-', ''); });
});
```

### 5.5 用变量值激活绿灯

```js
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, vars => {
  const value = _.get(vars, 'stat_data.角色A.状态值');
  injectPrompts([{
    id: '激活-状态值',
    content: `状态值=${value}`,
    position: 'none',
    depth: 0,
    role: 'user',
    should_scan: true,
  }]);
});
```

### 5.6 阶段映射

```js
let stage = '一';
if (value >= 80) stage = '五';
else if (value >= 60) stage = '四';
else if (value >= 40) stage = '三';
else if (value >= 20) stage = '二';
injectPrompts([{ id: '激活-阶段', content: `角色A阶段${stage}`, role: 'user', position: 'none', depth: 0, should_scan: true }]);
```

### 5.7 条件触发立即事件

```js
injectPrompts([{
  id: '激活-依存度最低时立即事件',
  position: 'none',
  depth: 0,
  role: 'system',
  content: '【状态值触发时的示例事件】',
  filter: () => _.get(getAllVariables(), 'stat_data.角色A.状态值') === 0,
  should_scan: true,
}]);
```

---

## 6. 前端界面状态栏

```js
async function initDisplay() {
  const messages = await getChatMessages(getCurrentMessageId());
  const data = messages[0].data;
  const view = data.display_data || data.stat_data;
  // 渲染 view
}

document.addEventListener('DOMContentLoaded', initDisplay);
```

兼容字符串与 `[value, desc]` 数组的工具函数：

```js
function SafeGetValue(value, defaultValue = '') {
  if (value === undefined || value === null) return defaultValue;
  if (Array.isArray(value)) return value.length ? value[0] : defaultValue;
  return value;
}
```

---

## 7. 提示词模板（EJS）配合 stat_data

```ejs
<% if (_.has(getvar('stat_data'), '理.好感度.[0]')) { %>
  <% if (getvar('stat_data').理['好感度'][0] >= 0 && getvar('stat_data').理['好感度'][0] < 20) { %>
    理: 阶段一行为...
  <% } %>
<% } %>
```

要点：

- 第一层判断 `_.has(...)` 防止初始化未完成。
- 取值时记得加 `[0]` 取叶子的当前值，否则取到 `[value, desc]` 数组。

---

## 8. 集成约束

1. 必须 `await waitGlobalInitialized('Mvu')`。
2. MVU 是脚本，需要在 JS-Slash-Runner 环境运行，不能放进 SillyTavern 原生扩展或 shujuku UI。
3. 事件回调直接 mutate 入参对象即可，MVU 会按修改后的对象继续。
4. `parseMessage` 需要旧的 `MvuData`，不要传 `null`。
5. `replaceMvuData` 会触发楼层重新写入，写之前应确认楼层 id 正确。
6. 变量结构和脚本逻辑应分层：变量结构层只做 schema/范围/默认值/数量上限，复杂逻辑放脚本事件。
7. 标记为 `deprecated` 的接口仅用于识别既有脚本；新建默认骨架不要生成。
