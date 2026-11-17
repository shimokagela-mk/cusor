# shujuku（神·数据库 / SP·数据库 III）API 调用接口速查

来源：

- 仓库：<https://github.com/AlbusKen/shujuku>
- API 文档：<https://raw.githubusercontent.com/AlbusKen/shujuku/main/API_DOCUMENTATION.md>
- manifest：<https://raw.githubusercontent.com/AlbusKen/shujuku/main/manifest.json>

对应机器可检索数据库：`data/shujuku-api.json`

> 本文件只记录 shujuku 对外暴露的 `window.AutoCardUpdaterAPI` 调用接口。不要与 JS-Slash-Runner API 或 SillyTavern 原生扩展 API 混放。
>
> 如果问题是提示词里的 SQL/变量/条件模板语法，不要只看本 API 文件，优先查：
> - `SHUJUKU_COOKBOOK.md`：常见写法速查菜谱。
> - `SQL_TEMPLATE_SYNTAX.md`：`{[db...]}` / `{[sql ...]}` / `$v:`。
> - `TEMPLATE_VARIABLES_AND_IF.md`：`<random>` / `<calc>` / `<if>` / 执行顺序。
> - `LLM_CALLAI_API.md`：`callAI()` 与 `getStoryContext()`。
> - `CROSSFIRE_VECTOR_INDEX.md`：交火模式与纪要向量索引排错。

---

## 0. 基本信息

manifest：

```json
{
  "display_name": "SP·数据库 III",
  "loading_order": 200,
  "js": "index.js",
  "css": "",
  "author": "Cline (AI Assisted)",
  "version": "2.0.0",
  "auto_update": false
}
```

全局 API 对象：

```js
window.AutoCardUpdaterAPI
```

调用前必须检查：

```js
if (!window.AutoCardUpdaterAPI) {
  console.warn('shujuku / AutoCardUpdaterAPI 不可用');
  return;
}

const api = window.AutoCardUpdaterAPI;
```

---

## 1. 剧情推进预设管理 API

### `getPlotPresets()`

```ts
getPlotPresets(): PlotPreset[]
```

获取所有剧情预设完整数据，返回深拷贝。

```js
const presets = window.AutoCardUpdaterAPI.getPlotPresets();
```

### `getPlotPresetNames()`

```ts
getPlotPresetNames(): string[]
```

获取预设名称列表。

```js
const names = window.AutoCardUpdaterAPI.getPlotPresetNames();
```

### `getCurrentPlotPreset()`

```ts
getCurrentPlotPreset(): string
```

获取当前使用的剧情推进预设名称；未选择时返回空字符串。

### `switchPlotPreset(presetName)`

```ts
switchPlotPreset(presetName: string): boolean
```

切换到指定预设。成功后保存设置，并在设置面板打开时同步 UI。

重要特性：切换后，剧情推进功能 `$6` 占位符只回溯读取带有当前预设名称标签的历史数据，实现不同预设之间的剧情规划隔离。

```js
const ok = api.switchPlotPreset('战斗场景');
```

### `injectPlotPresetToCurrentChat(presetName)`

```ts
injectPlotPresetToCurrentChat(presetName: string): boolean
```

仅将指定剧情推进预设注入当前聊天，不修改全局当前剧情预设。传空字符串表示当前聊天跟随全局剧情预设；传入不存在的预设名称时返回 `false`。

```js
const ok = api.injectPlotPresetToCurrentChat('战斗场景');
```

### `getPlotPresetDetails(presetName)`

```ts
getPlotPresetDetails(presetName: string): PlotPreset | null
```

获取指定预设详情，未找到返回 `null`。

`PlotPreset` 常见结构：

```ts
type PlotPreset = {
  name: string;
  promptGroup: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    enabled?: boolean;
    mainSlot?: string;
  }>;
  finalSystemDirective: string;
  rateMain: number;
  ratePersonal: number;
  rateErotic: number;
  rateCuckold: number;
  extractTags: string;
  minLength: number;
  contextTurnCount: number;
  loopSettings: {
    quickReplyContent: string;
    loopTags: string;
    loopDelay: number;
    loopTotalDuration: number;
    maxRetries: number;
  };
};
```

### 前端直接导入/导出剧情预设

```ts
importPlotPresetFromData(
  presetData: object | string,
  options?: { overwrite?: boolean; switchTo?: boolean }
): Promise<{ success: boolean; message: string; presetName?: string }>;

importPlotPresetsFromData(
  presetsArray: object[],
  options?: { overwrite?: boolean }
): Promise<{ success: boolean; message: string; imported: number; failed: number; details: any[] }>;

exportAllPlotPresets(): PlotPreset[];
```

示例：

```js
const result = await api.importPlotPresetFromData({
  name: '战斗场景预设',
  promptGroup: [{ role: 'system', content: '你是战斗场景规划师...', enabled: true }],
  rateMain: 1.2,
  ratePersonal: 0.8,
  rateErotic: 0,
  rateCuckold: 0,
}, { overwrite: false, switchTo: true });
```

---

## 2. 表格数据导入导出与操作 API

### `exportTableAsJson()`

```ts
exportTableAsJson(): object
```

导出当前合并后的表格数据对象。

### `importTableAsJson(jsonString)`

```ts
importTableAsJson(jsonString: string): Promise<boolean>
```

导入并覆盖当前表格数据。

### `exportJsonData()`

```ts
exportJsonData(): Promise<boolean>
```

导出当前 JSON 数据到文件，会弹出保存对话框。

### `updateCell(tableName, rowIndex, colIdentifier, value)`

```ts
updateCell(
  tableName: string,
  rowIndex: number,
  colIdentifier: string | number,
  value: any
): Promise<boolean>
```

也支持对象参数形式：updateCell({ tableName, rowIndex, colIdentifier, value, skipNotify })；skipNotify: true 或 silent: true 会跳过外部表格更新回调通知，适合批量写入。

更新单个单元格。`colIdentifier` 可为列名或列索引。

```js
await api.updateCell('主角信息', 1, '自由点数', 5);
await api.updateCell('主角信息', 1, 3, 5);
```

### `updateRow(tableName, rowIndex, data)`

```ts
updateRow(tableName: string, rowIndex: number, data: Record<string, any>): Promise<boolean>
```

也支持对象参数形式：updateRow({ tableName, rowIndex, data, skipNotify })；skipNotify: true 或 silent: true 会跳过外部表格更新回调通知。data.isImportMode: true 或对象参数 isImportMode: true 会跳过聊天保存和纪要向量同步。

按列名-值映射更新整行。只更新 `data` 指定列，其他列保持不变。

说明：

- 更新后自动查找该表数据最后一次出现的楼层并保存。
- 找不到该表楼层时，保存到最新 AI 楼层。
- 保存后自动触发世界书重新写入。

```js
await api.updateRow('主角信息', 1, {
  力量: 15,
  敏捷: 12,
  自由点数: 2,
});
```

### `insertRow(tableName, data)`

```ts
insertRow(tableName: string, data: Record<string, any>): Promise<number>
```

也支持对象参数形式：insertRow({ tableName, data, skipNotify })；skipNotify: true 或 silent: true 会跳过外部表格更新回调通知。

在表尾插入新行。成功返回新行索引，失败返回 `-1`。

### `deleteRow(tableName, rowIndex)`

```ts
deleteRow(tableName: string, rowIndex: number): Promise<boolean>
```

也支持对象参数形式：deleteRow({ tableName, rowIndex, skipNotify })；skipNotify: true 或 silent: true 会跳过外部表格更新回调通知。

删除指定行。不能删除表头 `rowIndex = 0`。

---

## 3. SQL 外部 API

新版 shujuku 暴露了 SQL 读写入口。只读查询与写入提交是分开的：查询类 API 不允许执行写入语句；写入类 API 会进入 shujuku 表格提交链路，外部 UI 不应绕过这些 API 直接改 runtime 表。

```ts
executeSqlQuery(sqlOrOptions, params?, options?): SqlQueryResult | null;
querySql(sqlOrOptions, params?, options?): SqlQueryResult | null;
queryTableRows(tableNameOrOptions, options?): SqlQueryResult | null;

executeSqlMutation(sqlOrOptions, params?, options?): SqlMutationResult | null;
executeSqlBatch(statementsOrOptions, options?): SqlMutationResult | null;
executeSql(sqlOrOptions, params?, options?): SqlQueryResult | SqlMutationResult | null;
```

常用约束：

- `executeSqlQuery` / `querySql` 只读，适合 `SELECT` / `WITH`。
- `queryTableRows` 按表名读取行，适合外部 UI 分页或筛选。
- `executeSqlMutation` / `executeSqlBatch` / `executeSql` 用于写入时应确认表名、sheetKey 与 DDL 映射。
- CRUD 静默选项兼容 `skipNotify`、`silent`、`isSilent`、`suppressNotify`。
- `isImportMode` 可跳过聊天保存和纪要向量同步，适合导入/批量链路，不适合普通交互按钮默认开启。

返回结构：

```ts
type SqlQueryResult = {
  success: boolean;
  columns?: string[];
  rows?: Array<Record<string, any>>;
  rowCount?: number;
  message?: string;
};

type SqlMutationResult = {
  success: boolean;
  affectedRows?: number;
  insertedRowIds?: Array<number | string>;
  message?: string;
};
```

---

## 4. 设置、更新与世界书 API

```ts
openSettings(): Promise<boolean>;
openVisualizer(): void;
manualUpdate(): Promise<boolean>;
triggerUpdate(): Promise<boolean>;
setZeroTkOccupyMode(modeEnabled: boolean): Promise<boolean>;
setOutlineEntryEnabled(enabled: boolean): Promise<boolean>;
syncWorldbookEntries(options?: { createIfNeeded?: boolean }): Promise<boolean>;
refreshDataAndWorldbook(): Promise<boolean>;
deleteInjectedEntries(): Promise<boolean>;
```

重点：

- `openSettings()`：打开设置面板。
- `openVisualizer()`：打开可视化编辑器。
- `manualUpdate()`：等价于点击立即手动更新。
- `triggerUpdate()`：外部触发增量更新。
- `setZeroTkOccupyMode(true)`：世界书条目禁用；`false`：启用。
- `syncWorldbookEntries({ createIfNeeded: true })`：同步世界书注入条目。
- `refreshDataAndWorldbook()`：重新加载聊天表格、合并独立表、更新世界书、通知 UI 刷新。

示例：

```js
await api.updateRow('主角信息', 1, { 力量: 15 });
await api.refreshDataAndWorldbook();
```

---

## 5. TXT 导入链路 API

```ts
importTxtAndSplit(): Promise<void>;
injectImportedSelected(): Promise<void>;
injectImportedStandard(): Promise<void>;
injectImportedSummary(): Promise<void>;
injectImportedFull(): Promise<void>;
deleteImportedEntries(): Promise<void>;
clearImportedEntries(clearAll?: boolean): Promise<void>;
clearImportCache(clearAll?: boolean): Promise<void>;
```

用途：

- 导入 TXT 并分割
- 注入选中内容
- 标准 / 总结 / 完整方式注入
- 删除导入条目
- 清理导入缓存或 localStorage 缓存

---

## 6. 模板管理 API

### 文件/默认模板操作

```ts
importTemplate(options?: { scope?: 'global' | 'chat' }): Promise<void>;
exportTemplate(options?: { scope?: 'global' | 'chat' }): Promise<void>;
resetTemplate(options?: { scope?: 'global' | 'chat' }): Promise<void>;
resetAllDefaults(): Promise<void>;
overrideWithTemplate(): Promise<void>;
```

`scope`：

- `global`：当前 profile 的全局模板
- `chat`：当前聊天模板快照，不改动全局模板库

### 查询/切换模板预设

```ts
getTableTemplate(): object | null;
getTemplatePresetNames(): string[];
switchTemplatePreset(
  presetName: string,
  options?: { scope?: 'global' | 'chat' }
): Promise<{ success: boolean; scope: string; message: string }>;

injectTemplatePresetToCurrentChat(
  presetName: string
): Promise<{ success: boolean; scope: string; message: string }>;
```

### 直接导入模板数据

```ts
importTemplateFromData(
  templateData: object | string,
  options?: { scope?: 'global' | 'chat'; presetName?: string }
): Promise<{ success: boolean; message: string; scope?: string; presetName?: string }>;
```

模板要求：

- 必须包含 `mate` 对象。
- `mate.type` 必须为 `"chatSheets"`。
- 必须至少包含一个 `sheet_*` 键。
- 每个 sheet 必须包含 `name`、`content`、`sourceData` 字段。

示例：

```js
const template = {
  mate: { type: 'chatSheets', version: 1 },
  sheet_0: {
    name: '角色状态',
    content: [['属性', '值'], ['生命值', '100']],
    sourceData: { headers: ['属性', '值'] },
  },
};

await api.importTemplateFromData(template, {
  scope: 'chat',
  presetName: '任务专用模板',
});
```

---

## 7. 表格锁定 API

锁定数据按“当前聊天 + 数据隔离标识”分槽存储，外部调用等价于 UI 锁定/解锁行为。

```ts
getTableLockState(sheetKey: string): { rows: number[]; cols: number[]; cells: string[] } | null;
setTableLockState(
  sheetKey: string,
  lockState: { rows: number[]; cols: number[]; cells: Array<string | [number, number]> },
  options?: { merge?: boolean }
): boolean;
clearTableLocks(sheetKey: string): boolean;
lockTableRow(sheetKey: string, rowIndex: number, locked: boolean): boolean;
lockTableCol(sheetKey: string, colIndex: number, locked: boolean): boolean;
lockTableCell(sheetKey: string, rowIndex: number, colIndex: number, locked: boolean): boolean;
toggleTableRowLock(sheetKey: string, rowIndex: number): boolean;
toggleTableColLock(sheetKey: string, colIndex: number): boolean;
toggleTableCellLock(sheetKey: string, rowIndex: number, colIndex: number): boolean;
getSpecialIndexLockEnabled(sheetKey: string): boolean | null;
setSpecialIndexLockEnabled(sheetKey: string, enabled: boolean): boolean;
```

`cells` 支持：

```js
{ cells: ['1:2', [3, 4]] }
```

---

## 8. 回调注册 API

### `registerTableUpdateCallback(callback)`

```ts
registerTableUpdateCallback(callback: (tableData: object) => void): void;
unregisterTableUpdateCallback(callback: Function): void;
```

表格数据更新时回调：

```js
function onTableUpdate(tableData) {
  console.log('表格已更新:', tableData);
}

api.registerTableUpdateCallback(onTableUpdate);
// api.unregisterTableUpdateCallback(onTableUpdate);
```

### `registerTableFillStartCallback(callback)`

```ts
registerTableFillStartCallback(callback: () => void): void;
```

填表开始时回调：

```js
api.registerTableFillStartCallback(() => {
  console.log('开始填表...');
});
```

---

## 9. 更新配置与手动更新表选择 API

### 更新配置

```ts
getUpdateConfigParams(): {
  autoUpdateThreshold: number;
  autoUpdateFrequency: number;
  updateBatchSize: number;
  autoUpdateTokenThreshold: number;
};

setUpdateConfigParams(params: {
  autoUpdateThreshold?: number;
  autoUpdateFrequency?: number;
  updateBatchSize?: number;
  autoUpdateTokenThreshold?: number;
}): boolean;
```

说明：

- `autoUpdateThreshold`：自动更新阈值，≥ 0。
- `autoUpdateFrequency`：自动更新频率，≥ 1。
- `updateBatchSize`：批处理大小，≥ 1。
- `autoUpdateTokenThreshold`：Token 阈值，≥ 0；0 表示不限制。

### 手动更新表选择

```ts
getManualSelectedTables(): { selectedTables: string[]; hasManualSelection: boolean };
setManualSelectedTables(sheetKeys: string[]): boolean;
clearManualSelectedTables(): boolean;
```

`setManualSelectedTables` 会自动过滤无效表 key，并把 `hasManualSelection` 标记为 `true`。

---

## 10. API 预设管理 API

```ts
getApiPresets(): ApiPreset[];
getTableApiPreset(): string;
setTableApiPreset(presetName: string): boolean;
getPlotApiPreset(): string;
setPlotApiPreset(presetName: string): boolean;
saveApiPreset(presetData: ApiPreset): boolean;
loadApiPreset(presetName: string): boolean;
deleteApiPreset(presetName: string): boolean;
```

`ApiPreset` 结构：

```ts
type ApiPreset = {
  name: string;
  apiMode?: string;       // 如 'custom' / 'proxy' / 'tavern'
  apiConfig?: object;
  tavernProfile?: string;
};
```

示例：

```js
api.saveApiPreset({
  name: '测试预设',
  apiMode: 'custom',
  apiConfig: {
    customApiUrl: 'https://api.example.com/v1',
    customApiKey: 'sk-xxx',
    customApiModel: 'gpt-4o',
  },
  tavernProfile: '',
});

api.setTableApiPreset('测试预设');
api.setPlotApiPreset('测试预设');
```

注意：删除正在被填表或剧情推进使用的 API 预设时，相关引用会自动清除。

---

## 11. AI 调用 API

### `callAI(messages, options)`

```ts
callAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { max_tokens?: number | string; maxTokens?: number | string }
): Promise<string | null>;
```

使用 shujuku 当前配置的 API 调用 AI。

支持模式：

- `apiMode === 'tavern'`：使用酒馆 Connection Manager。
- `apiMode === 'custom'`：
  - 如果启用 `useMainApi`，使用酒馆主 API（`TavernHelper.generateRaw`）。
  - 否则使用独立配置的 API（流式传输）。

示例：

```js
const messages = [
  { role: 'system', content: '你是一个有帮助的助手。' },
  { role: 'user', content: '请生成一个奇幻场景的描述。' },
];

const response = await api.callAI(messages, { max_tokens: 2000 });

if (response) {
  console.log('AI 响应:', response);
} else {
  console.error('AI 调用失败');
}
```

### `getStoryContext(maxTurns)`

```ts
getStoryContext(maxTurns?: number): string;
```

获取最近剧情上下文：

- 从最新聊天记录向前遍历。
- 只取 AI 回复消息（`is_user === false`）。
- 返回时按时间顺序排列，旧消息在前。
- 多条消息用 `\n\n` 分隔。
- 默认 `maxTurns = 3`。

示例：

```js
const context = api.getStoryContext(5);
const analysis = await api.callAI([
  { role: 'system', content: '你是剧情分析助手。' },
  { role: 'user', content: `请分析以下剧情的发展趋势：\n\n${context}` },
]);
```

---

## 12. 其他功能 API

```ts
importCombinedSettings(): Promise<void>;
exportCombinedSettings(): Promise<void>;
mergeSummaryNow(): Promise<void>;
```

- `importCombinedSettings()`：导入组合设置，会弹出文件选择对话框。
- `exportCombinedSettings()`：导出组合设置到文件。
- `mergeSummaryNow()`：立即执行合并总结操作。

---

## 13. 完整调用示例

### 列出并切换剧情推进预设

```js
const api = window.AutoCardUpdaterAPI;

const presetNames = api.getPlotPresetNames();
const currentPreset = api.getCurrentPlotPreset();

console.log('可用预设:', presetNames);
console.log('当前预设:', currentPreset);

if (presetNames.includes('战斗场景')) {
  const success = api.switchPlotPreset('战斗场景');
  console.log('切换结果:', success ? '成功' : '失败');
}
```

### 监听表格更新

```js
const callback = data => {
  console.log('表格已更新:', data);
};

api.registerTableUpdateCallback(callback);
// api.unregisterTableUpdateCallback(callback);
```

### 从外部导入模板和预设

```js
const templateData = await (await fetch('/api/template.json')).json();
await api.importTemplateFromData(templateData, {
  scope: 'chat',
  presetName: '服务器下发模板',
});

const presetsData = await (await fetch('/api/presets.json')).json();
const result = await api.importPlotPresetsFromData(presetsData, { overwrite: false });
console.log(`预设导入：成功 ${result.imported} 个，失败 ${result.failed} 个`);
```

---

## 14. 注意事项

1. 调用前检查 `window.AutoCardUpdaterAPI` 是否存在。
2. 大多数方法返回 `Promise`，使用 `async/await`。
3. 多数失败路径返回 `false`、`null`、`-1` 或 `{ success:false, message }`，通常不抛异常。
4. `getPlotPresets()`、`getPlotPresetDetails()`、`exportAllPlotPresets()`、`getApiPresets()` 返回深拷贝，改返回值不会影响原数据。
5. `switchPlotPreset()` 与 `switchTemplatePreset()` 会自动同步已打开的设置面板 UI。
6. `importTemplateFromData()` 和 `importPlotPresetFromData()` 返回 `{ success, message }`，适合前端展示结果。
7. 模板 `scope` 分为 `global` 和 `chat`：`global` 写当前 profile 全局模板，`chat` 只写当前聊天模板快照。
8. `callAI()` 可统一使用数据库插件里的 API 配置，避免外部前端重复配置密钥和模型。

## 条件渲染边界

shujuku 的表格模板 JSON 和 `window.AutoCardUpdaterAPI` 只负责表格数据、模板预设、剧情预设和外部读写 API，本身不是 EJS 执行器。不要期望在数据库表格模板字段里直接写 `<% if (...) { %>` 后由数据库执行。

但 shujuku 当前提示词模板链路支持自己的条件模板语法，详见 `TEMPLATE_VARIABLES_AND_IF.md`：

```html
<if seed="战斗">战斗内容</if>
<if cell="背包物品表/铁剑/数量 >= 3">铁剑充足<else>铁剑不足</if>
<if db="db.背包物品表.count() > 2">物品超过 2 种</if>
<if sql="SELECT COUNT(*) FROM 重要角色表 WHERE 是否离场='否'">有人在场</if>
<if cond="seed:战斗 & cell:背包物品表/铁剑/数量 >= 3">战斗且铁剑充足</if>
```

如果想做条件效果，应按目标层选择实现位置：

- shujuku 提示词内容按数据库/变量条件显示：用 shujuku `<if seed/cell/db/sql/cond>`，不要写 EJS。
- SillyTavern/MVU 提示词模板条件：用对应环境的 EJS / 模板变量，例如 `getvar('stat_data')`、`_.has()`、`if/else`。
- 前端 UI 按数据库表格值显示：在酒馆助手脚本或前端片段 JS 中读取 `AutoCardUpdaterAPI.exportTableAsJson()`，再用普通 JavaScript `if/else` 渲染 DOM。
- 数据库数据本身的批量改写：用 `updateCell` / `updateRow` / `insertRow` / `deleteRow`，逻辑判断放在调用这些 API 的 JS 代码里。

因此，“不用 if/else”只适用于“不要把 EJS if/else 塞进 shujuku 并期待数据库执行”；不等于 shujuku 没有条件模板，也不适用于 MVU/SillyTavern 提示词模板或外部 JS。

## 15. 本地 mock 宿主依赖面

本仓的 `奶龙王一键制卡/tools/shujuku-local/` 提供本地测试基底，用于在不启动完整 SillyTavern 的情况下加载 shujuku bundle 并验证模板导入、表格读写、世界书同步和填表效果。

第一版 mock 的宿主 API 面：

- `SillyTavern.getContext()`：`chatId`、`chat`、`eventSource`、`eventTypes`、`saveChat`、`setChatMessages`、`stopGeneration`、`deleteLastMessage`、`getWorldBooks`、`extensionSettings`、`saveSettingsDebounced`、`getRequestHeaders`、`ConnectionManagerRequestService.sendRequest`。
- `TavernHelper`：`getChatMessages`、`getLastMessageId`、`getCharData`、`getCharLorebooks`、`getCurrentCharPrimaryLorebook`、`getLorebooks`、`getLorebookEntries`、`setLorebookEntries`、`createLorebookEntries`、`deleteLorebookEntries`、`triggerSlash`、`generateRaw`、`generate`。
- 基础 DOM：`#send_but`、`#send_textarea`、`#extensionsMenu`、`#extensionsMenuButton`、`#extensions_settings2`。
- HTTP：`/api/backends/chat-completions/status` 与 `/api/backends/chat-completions/generate` 的 fake / real AI 双模式。

默认 AI 模式为 deterministic fake；只有显式提供 OpenAI-compatible 环境变量时才走真实模型。

测试报告会输出 JSON、Markdown 和 HTML。Markdown/HTML 必须展示填表变化和填表后表格快照，确保用户能直接看见填表效果，而不是只看机器 JSON。

本地 runner 还支持数据库模式矩阵：

```powershell
npm run shujuku:test -- --project <卡名> --ai fake --database-mode both --story-text "正文：角色在星辉港发现银钥匙。"
```

- `native`：按 shujuku 原生聊天数据存储路径导入模板并执行 `AutoCardUpdaterAPI.insertRow/updateRow`。
- `sqlite`：在 bundle 初始化前通过 `SillyTavern.getContext().extensionSettings.__userscripts.shujuku_v120__userscript_settings_v1` 注入 `storageMode: "sqlite"`，再执行同一套读写验收。
- `both`：分别输出 native/sqlite 两份报告。
- 若被测模板缺少 `sourceData.ddl`，runner 会给运行时模板临时补齐测试用 DDL，使 sqlite 模式可以建表；这不会改写源模板。真实 SQL 模式模板仍建议维护明确 DDL。
- 报告的“正文填表总结”区块必须展示正文摘要、目标表、执行方式、前后差异和填表后快照。
- 本地正文填表必须先调用 `window.AutoCardUpdaterAPI.callAI()`：native 模式要求 AI 生成 `<tableEdit>insertRow(...)</tableEdit>`，sqlite 模式要求 AI 生成 `<tableEdit>INSERT INTO ...</tableEdit>`；runner 解析指令后再用 shujuku 表格 API 写表。
