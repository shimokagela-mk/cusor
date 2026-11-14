# SillyTavern 扩展开发 API 速查

来源：

- <https://docs.sillytavern.app/for-contributors/writing-extensions/>
- <https://docs.sillytavern.app/for-contributors/function-calling/>
- <https://docs.sillytavern.app/usage/user-settings/uicustomization/>
- <https://docs.sillytavern.app/usage/prompts/prompt-manager/>
- <https://docs.sillytavern.app/extensions/regex/>

本文件记录 **SillyTavern 前端/扩展开发可调用接口**，用于：

- 写 SillyTavern 原生 UI 扩展
- 替换/注入 UI 主题与 CSS
- 操作对话补全预设 / Prompt Manager
- 使用/设计 Regex 脚本
- 注册 Function Calling 工具

> 不要与 `JS-Slash-Runner（酒馆助手）API` 混淆。JS-Slash-Runner 是脚本运行扩展；SillyTavern Extension API 是 ST 原生前端扩展接口。

对应机器可检索数据库：`data/sillytavern-extension-api.json`

---

## 1. 扩展运行环境

SillyTavern UI extensions 运行在浏览器上下文中，可以 hook 事件与 API，权限很高。

核心入口：

```js
const context = SillyTavern.getContext();
```

常见解构：

```js
const { eventSource, event_types } = SillyTavern.getContext();
const { Popup } = SillyTavern.getContext();
const { generateRaw } = SillyTavern.getContext();
const { macros } = SillyTavern.getContext();
```

常用核心能力：

| API | 用途 |
| --- | --- |
| `SlashCommandParser.addCommandObject` | 注册 slash/STscript 命令对象 |
| `messageFormatter` | 复用 ST 消息格式化链路 |
| `loader` | 使用 ST 加载遮罩/加载状态工具 |
| `registerDataBankScraper` | 注册 Data Bank / 附件资料抓取器 |
| `registerDebugFunction` | 注册调试函数，便于开发者面板调用 |

安全建议：

- 扩展能操作 DOM、设置、事件、生成、工具调用；只安装可信扩展。
- 插入模型/用户生成 HTML 前，用 `DOMPurify` 清理。
- 不要把 API key、聊天记录、用户数据泄露到全局变量或第三方请求。

```js
const { DOMPurify } = SillyTavern.libs;
const safe = DOMPurify.sanitize(unsafeHtml);
```

---

## 2. 扩展结构 `manifest.json`

第三方扩展必须包含 `manifest.json`：

```json
{
  "display_name": "My Extension",
  "loading_order": 1,
  "requires": [],
  "optional": [],
  "dependencies": [],
  "js": "index.js",
  "css": "style.css",
  "author": "Your name",
  "version": "1.0.0",
  "homePage": "https://github.com/your/extension",
  "auto_update": true,
  "minimum_client_version": "1.0.0",
  "i18n": {
    "de-de": "i18n/de-de.json"
  },
  "hooks": {
    "install": "onInstall",
    "update": "onUpdate",
    "delete": "onDelete",
    "enable": "onEnable",
    "disable": "onDisable",
    "activate": "onActivate"
  }
}
```

关键字段：

| 字段 | 用途 |
| --- | --- |
| `display_name` | 扩展显示名 |
| `loading_order` | 加载顺序 |
| `requires` / `optional` | 扩展依赖 |
| `js` | 入口 JS |
| `css` | 扩展样式 |
| `version` | 扩展版本 |
| `homePage` | 项目主页 |
| `minimum_client_version` | 最低 ST 客户端版本 |
| `hooks` | install/update/delete/enable/disable/activate 生命周期 |

典型加载流程：

1. 扫描扩展目录并读取 `manifest.json`。
2. 按 `loading_order` 等规则决定加载顺序。
3. 检查 `requires` / `optional` 等依赖声明。
4. 加载 `css` 和 `js` 入口文件。
5. 扩展入口通过 `SillyTavern.getContext()` 接入事件、设置、生成、弹窗等能力。

常见位置：

| 类型 | 路径 | 说明 |
| --- | --- | --- |
| 用户扩展 | `data/[user]/extensions/` | 用户级扩展目录 |
| 全局第三方扩展 | `public/scripts/extensions/third-party/` | 全局第三方前端扩展位置，具体部署方式以当前 ST 版本为准 |
| 内置扩展 | `public/scripts/extensions/` | 内置扩展与前端扩展系统相关文件 |

注意：`loading_order` 只能解决加载顺序，不等同于依赖可用性保证；硬依赖应写入 `requires`。

---

## 3. 事件 API

```js
const { eventSource, event_types } = SillyTavern.getContext();
```

监听事件：

```js
eventSource.on(event_types.MESSAGE_RECEIVED, handleIncomingMessage);
eventSource.on(event_types.CHAT_CHANGED, () => reloadMyExtension());
```

常见事件：

| 事件 | 说明 |
| --- | --- |
| `APP_INITIALIZED` | 应用初始化 |
| `APP_READY` | 应用就绪 |
| `MESSAGE_SENT` | 用户消息发送 |
| `MESSAGE_RECEIVED` | AI 消息接收 |
| `CHAT_CHANGED` | 聊天切换 |

---

## 4. UI / 设置面板 / DOM

### 扩展设置面板 DOM 挂载

```js
const PLUGIN_ID = 'example-extension';
const PANEL_ID = `${PLUGIN_ID}-settings`;

function getHostWindow() {
  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      return window.parent;
    }
  } catch (_) {}
  return window;
}

const hostWindow = getHostWindow();
const hostDocument = hostWindow.document || document;
const state = { settingsRetryTimer: null };

function findSettingsMount() {
  const selectors = [
    '#extensions_settings2',
    '#extensions_settings',
    '#third_party_extension_settings',
    '.extensions_settings',
    '#rm_extensions_block .inline-drawer-content',
  ];
  for (const selector of selectors) {
    const node = hostDocument.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function renderSettingsPanel(panel) {
  panel.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>示例扩展</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <label><input type="checkbox" data-setting="enabled"> 启用</label>
      </div>
    </div>
  `;
}

function bindSettingsPanel(panel) {
  panel.querySelector('[data-setting="enabled"]')?.addEventListener('change', event => {
    console.log('enabled:', event.target.checked);
  });
}

function ensureSettingsPanel() {
  const mount = findSettingsMount();
  if (!mount) {
    hostWindow.clearTimeout(state.settingsRetryTimer);
    state.settingsRetryTimer = hostWindow.setTimeout(ensureSettingsPanel, 1800);
    return;
  }

  let panel = hostDocument.getElementById(PANEL_ID);
  if (!panel) {
    panel = hostDocument.createElement('section');
    panel.id = PANEL_ID;
    panel.className = `${PLUGIN_ID}-settings`;
    renderSettingsPanel(panel);
    mount.appendChild(panel);
  }
  bindSettingsPanel(panel);
}

ensureSettingsPanel();
```

### Popup

```js
const { Popup } = SillyTavern.getContext();
```

用于确认框、输入框、扩展设置弹窗等。

### DOMPurify

```js
const { DOMPurify } = SillyTavern.libs;
const html = DOMPurify.sanitize(modelOutput);
```

任何来自用户、模型、网络的 HTML 插入 DOM 前都应清理。

---

## 4.1 原生按钮与菜单入口

当用户笼统要求“给扩展加按钮、注册到菜单、放到原生入口”时，默认选择 **快速回复**。当用户明确要求放到魔法棒时，必须使用魔法棒列表 DOM 锚点接入。

| 入口 id | 正式命名 | 别名 | 方法 |
| --- | --- | --- | --- |
| `quick_reply` | 快速回复（Quick Reply） | QR、qr、快速回复按钮入口 | `globalThis.quickReplyApi` |
| `extensions_panel` | 扩展面板（Extensions panel） | 扩展程序、扩展按钮、扩展菜单 | 设置面板 DOM 挂载 |
| `chat_options_menu` | 聊天选项菜单 / 聊天选项按钮（Chat options menu/button） | 菜单、三条杠图标、左下菜单 | UI 位置命名 |
| `extras_wand` | 魔法棒图标按钮 / 扩展菜单按钮（Extensions menu button） | 魔法棒、Extensions menu | 魔法棒列表 DOM 锚点接入 |

入口选择规则：

1. 短命令、脚本触发、用户可见按钮、上下文按钮优先使用 Quick Reply。
2. 扩展设置、配置项、管理界面使用设置面板 DOM 挂载流程。
3. 魔法棒入口使用魔法棒列表 DOM 锚点接入。

### 魔法棒 DOM 锚点接入

魔法棒按钮列表由 `#extensionsMenu` 承载。接入时在主页面 document 中查找魔法棒列表锚点，移除同 id 旧菜单项，创建 `a.list-group-item` 菜单项，再追加到列表末尾。

```js
function getMainDocument() {
  const candidates = [];
  try { if (window.top?.document) candidates.push(window.top.document); } catch (_) {}
  try { if (window.parent?.document && window.parent.document !== document) candidates.push(window.parent.document); } catch (_) {}
  candidates.push(document);
  return candidates.find(doc =>
    doc.getElementById('extensionsMenu')
    || doc.getElementById('extensions_menu')
    || doc.querySelector('.extensions_block .list-group')
  ) || document;
}

function getWandMenu(doc) {
  return doc.getElementById('extensionsMenu')
    || doc.getElementById('extensions_menu')
    || doc.querySelector('.extensions_block .list-group');
}

function registerWandMenuItem({ id, label, iconClass, onClick }) {
  const doc = getMainDocument();
  const menu = getWandMenu(doc);

  if (!menu) {
    setTimeout(() => registerWandMenuItem({ id, label, iconClass, onClick }), 1000);
    return;
  }

  doc.getElementById(id)?.remove();

  const item = doc.createElement('a');
  item.id = id;
  item.className = 'list-group-item';
  item.href = 'javascript:void(0)';

  const icon = doc.createElement('span');
  icon.classList.add('fa-solid', iconClass);
  item.append(icon, ` ${label}`);
  item.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  menu.appendChild(item);
}

registerWandMenuItem({
  id: 'example-wand-menu-item',
  label: '示例工具',
  iconClass: 'fa-comments',
  onClick: () => openExamplePanel(),
});
```

### Quick Reply API

SillyTavern 内置 Quick Reply 扩展会暴露 `globalThis.quickReplyApi`。该接口可维护 Quick Reply 集合、按钮、执行和上下文菜单，适合作为默认按钮入口。

```js
const qr = globalThis.quickReplyApi;

await qr.createSet('My Tools');
qr.createQuickReply('My Tools', '设置', {
  icon: 'fa-gear',
  showLabel: true,
  message: '/echo 打开设置',
  title: '打开设置面板',
});
qr.addGlobalSet('My Tools', true);
```

常用接口：

| API | 用途 |
| --- | --- |
| `createSet(name, props?)` / `updateSet(name, props?)` / `deleteSet(name)` | 创建、更新、删除快速回复集合 |
| `createQuickReply(setName, label, props?)` | 创建按钮；`props.message` 可写普通文本、slash command 或 STscript |
| `updateQuickReply(setName, label, props?)` / `deleteQuickReply(setName, label)` | 更新或删除已有按钮 |
| `executeQuickReply(setName, label, args?, options?)` / `executeQuickReplyByIndex(idx)` | 执行快速回复 |
| `addGlobalSet(name, isVisible?)` / `removeGlobalSet(name)` | 启用或移除全局快速回复集合 |
| `addChatSet(name, isVisible?)` / `removeChatSet(name)` | 启用或移除当前聊天快速回复集合 |
| `createContextItem(setName, label, contextSetName, isChained?)` | 把一个快速回复集合挂为按钮上下文菜单 |
| `deleteContextItem(setName, label, contextSetName)` / `clearContextMenu(setName, label)` | 移除上下文菜单项或清空上下文菜单 |

注意：

- `globalThis.quickReplyApi` 依赖 Quick Reply 扩展已加载；使用前应做存在性判断。
- 创建或更新 QR 会修改用户/聊天的 Quick Reply 资产，需明确作用范围。
- Quick Reply API 是 ST 原生内置扩展接口；`window.TavernHelper` 的酒馆助手脚本按钮 API 属于脚本按钮入口。

### 原生 UI surface 识别

原生 UI surface 知识用于识别、隐藏、排序或管理 SillyTavern 已有界面元素。新增可见按钮入口仍按上方入口选择规则处理。

| surface id | 中文命名 | 入口/容器 selector | 识别方式 |
| --- | --- | --- | --- |
| `chat_options_menu` | 左下菜单 / 聊天选项菜单 | `#options_button` | 常见项为 `#option_toggle_AN`、`#option_toggle_CFG`、`#option_new_bookmark`、`#option_start_new_chat`、`#option_delete_mes`、`#option_regenerate`、`#option_continue` |
| `extras_wand` | 魔法棒 | `#extensionsMenuButton` / `#extensionsMenu` | 菜单项通常是 `.list-group-item`，文本标签常在 `span` 内 |
| `extensions_panel` | 扩展菜单 / 扩展面板 | `#extensions-settings-button` / `#extensions_settings` / `#extensions_settings2` | 设置项通常有 `.inline-drawer-header`，标题优先读取 `b, [data-i18n]` |
| `top_navigation` | 顶部导航栏 | 顶部按钮集合 | 常见按钮包括 `#ai-config-button`、`#sys-settings-button`、`#advanced-formatting-button`、`#WI-SP-button`、`#user-settings-button`、`#backgrounds-button`、`#extensions-settings-button`、`#persona-management-button`、`#rightNavHolder` |
| `preset_panel` | 预设菜单 | `#range_block_openai` / `#openai_settings` | 按上下文长度、可调参数、提示词格式、复选框和预设条目等结构分组识别 |

### 菜单发现与重排模式

动态发现已有菜单项时，按目标 surface 的容器扫描直接子元素；缺少 `id` 的运行期节点可补临时 id；扩展设置项优先从 `.inline-drawer-header` 提取标题，并展开 `extension_container` 包装层下的独立抽屉。发现结果可维护为 `discoveryCache`，用于后续隐藏、排序或恢复。

重排已有 DOM 时，优先选择可见节点；遇到重复 id 时选择当前可见副本；先找到所有目标节点的共同父容器，再移动该容器下的顶层 unit。移动 DOM 期间设置 `suppressObserver`，重渲染或停用自定义面板前把已搬运节点放回 `#extensions_settings` / `#extensions_settings2` 等原生容器。

刷新触发可组合使用：

```js
eventSource.on(event_types.CHAT_CHANGED, scheduleAutoRescan);

const observer = new MutationObserver(() => scheduleAutoRescan());
observer.observe(document.querySelector('#extensions_settings'), { childList: true, subtree: false });
observer.observe(document.querySelector('#extensions_settings2'), { childList: true, subtree: false });

setTimeout(refreshDiscoveryCache, 3000);
```

### 扩展菜单高级接管

需要接管扩展菜单时，可拦截 `#extensions-settings-button > .drawer-toggle` 的捕获阶段点击，创建自定义面板容器，再把 `#extensions_settings` 与 `#extensions_settings2` 中的原生设置项搬入自定义列。面板展示时同步原生抽屉的 `z-index` 来源，例如 `#extensions-settings-button > .drawer-content`、`#rm_extensions_block`、`#extensions_settings`。

该模式适合菜单管理、隐藏、排序和重新分栏；普通扩展配置入口仍使用“扩展设置面板 DOM 挂载”。

---

## 4.2 扩展数据持久化

常见持久化位置：

| 位置 | 范围 | 常见用途 | 风险 |
| --- | --- | --- | --- |
| `extension_settings` | 用户/全局扩展设置 | 扩展开关、UI 偏好、默认参数 | 可能跨角色和聊天生效，不应保存密钥或私密正文 |
| `character.data.extensions` | 角色级扩展数据 | 角色专属配置、角色附加状态 | 可能随角色卡导出或迁移，写入前确认命名空间 |
| `chat_metadata.extensions` | 聊天级扩展数据 | 当前聊天状态、临时索引、会话标记 | 会影响当前聊天文件，导出/分享前应审查隐私内容 |

建议：

1. 为扩展数据使用稳定命名空间，例如 `extension_settings.my_extension`。
2. 保存用户或模型生成内容前先确认是否需要脱敏。
3. 角色级数据可能进入角色卡资产，聊天级数据可能进入聊天导出。
4. 复杂结构化状态优先集中在 JS 扩展中维护，不要散落在 STscript 变量和多个资产文件里。

---

## 5. UI 主题 / CSS

SillyTavern UI Customization 支持：

- 导入/导出主题文件
- 保存当前主题或另存为新主题
- 主题颜色：文本、引用、背景、UI、边框、用户消息、AI 消息等
- 布局：Chat Width、Font Scale、Blur Strength、Shadow Width
- 显示开关：Reduced Motion、No Blur、Message IDs、Token Count、Chat Timestamps 等
- Custom CSS

聊天样式 slash command：

| 样式 | 命令 |
| --- | --- |
| Flat | `/flat` / `/default` |
| Bubbles | `/bubble` / `/bubbles` |
| Document | `/single` / `/story` |

扩展写 CSS 时建议：

1. 在 `manifest.json` 声明 `css: "style.css"`。
2. 使用足够窄的选择器，避免污染全局。
3. 若要隐藏工具调用消息：

```css
.mes.toolCall {
  display: none;
}
```

4. 若要改聊天消息外观，优先挂在 ST 已有 class 上，不要依赖易变 DOM 层级。
5. 大量跨主题 CSS 可考虑 CSS Snippets 扩展。

---

## 6. Prompt Manager / 对话补全预设

Prompt Manager 控制 **Chat Completion APIs** 的 prompt-building 策略。Text Completion 对应设置在 Advanced Formatting。

重点规则：

- 如果预设名与角色卡同名，打开该角色聊天时会自动选择该预设；预设名应保持唯一。
- Prompt Manager 位于 AI Response Configuration 面板。
- 默认 pinned prompts 不能删除，但可以关闭。
- Prompts List 越靠上越早发送，底部最后发送。

Prompt 编辑字段：

| 字段 | 说明 |
| --- | --- |
| Name | Prompt 名称，仅供管理，不发送给模型 |
| Role | System / AI Assistant / User |
| Triggers | Normal / Continue / Impersonate / Swipe / Regenerate / Quiet |
| Position | Relative 或 In-Chat |
| Depth | In-Chat 插入深度，0 表示最后一条之后 |
| Order | 同 Role/Depth 内的排序 |

扩展相关接口线索：

```js
const pm = getPresetManager();
const value = pm.readPresetExtensionField({ path: 'hello' });
```

用于读取预设扩展字段。完整写入接口需以当前 ST 源码/类型定义为准。

---

## 7. Regex 扩展

Regex 是 SillyTavern 内置扩展，用于检测特定文本序列并替换、删除或插入样式。

常见用途：

- 查找/替换聊天文本
- 给特定句式加 Markdown / HTML 样式
- 删除不想展示或不想发送的内容
- 配合 Quick Replies / STscript 做逻辑判断

脚本类型：

| 类型 | 保存位置 | 范围 |
| --- | --- | --- |
| Global | `settings.json` | 全局角色 |
| Scoped | 角色卡数据 | 当前角色 |

Regex Editor 字段：

| 字段 | 说明 |
| --- | --- |
| Name | 脚本名，也是 slash command / STscript 触发目标 |
| Find Regex | 查找正则，可选择是否替换宏 |
| Replace With | 替换文本，支持 `{{match}}`、`$1`、`$2` 捕获组 |
| Trim Out | 替换前从匹配文本中移除指定片段 |
| Affects | User Input / AI Response / Slash Commands / World Info / Reasoning |
| Disabled | 禁用脚本 |
| Run on Edit | 编辑消息后也运行 |
| Macros in Find Regex | Don't Substitute / Raw / Escaped |

正则 flags：

| flag | 说明 |
| --- | --- |
| `i` | 忽略大小写 |
| `g` | 全局匹配 |
| `s` | dotAll，`.` 匹配换行 |
| `m` | 多行模式，`^` / `$` 匹配每行 |
| `u` | Unicode |

格式：

```text
/yourpattern/flags
```

Ephemerality：

- 默认：直接修改聊天 JSONL，显示和发送给模型的内容一致，但不可逆。
- 只影响显示或只影响 outgoing prompt：不写入聊天文件，但用户看到的和模型看到的可能不同。
- 两个 ephemerality 都选：正常运行但不写入聊天文件。

---

## 8. Function Calling

Function Calling 允许扩展注册工具，让 LLM 用结构化参数调用扩展功能。

限制：

- 仅部分 Chat Completion 源支持。官方文档当前列出的支持源包括：Custom(OpenAI-compatible)、AI/ML API、AI21、Azure OpenAI、Chutes、Claude、Cloudflare Workers AI、Cohere、DeepSeek、Electron Hub、Fireworks、Google AI Studio、Google Vertex AI、Groq、MiniMax、MistralAI、Moonshot(Kimi)、NanoGPT、OpenAI、OpenRouter、Pollinations、SiliconFlow、xAI(Grok)、Z.AI(GLM)。
- Text Completion 不支持 function calls。
- 用户必须在 AI Response Configuration 启用 **Enable function calling**。
- Continue / Impersonate / Quiet/background prompts 不允许触发工具调用。
- 工具调用循环默认最多 5 轮，避免无限递归。
- Interleaved Thinking / reasoning context 只在部分后端与模型上可用；扩展不要假定所有工具调用都会带推理签名。

检查支持：

```js
const { isToolCallingSupported, canPerformToolCalls } = SillyTavern.getContext();

if (isToolCallingSupported()) {
  console.log('Function tool calling is supported');
}

if (canPerformToolCalls('normal')) {
  console.log('Can perform tool calls for normal generation');
}
```

注册工具：

```js
const { registerFunctionTool } = SillyTavern.getContext();

registerFunctionTool({
  name: 'get_weather',
  displayName: 'Get Weather',
  description: 'Get the current weather for a given location',
  parameters: {
    $schema: 'http://json-schema.org/draft-04/schema#',
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city name, e.g. "London"',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature unit',
      },
    },
    required: ['location'],
  },
  action: async ({ location, unit }) => {
    const data = await fetchWeatherData(location, unit);
    return JSON.stringify(data);
  },
  formatMessage: ({ location }) => `Checking weather for ${location}...`,
  shouldRegister: () => true,
  stealth: false,
});
```

注销工具：

```js
const { unregisterFunctionTool } = SillyTavern.getContext();
unregisterFunctionTool('get_weather');
```

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 工具唯一标识 |
| `displayName` | 否 | UI 显示名 |
| `description` | 是 | 发给 LLM 的工具说明 |
| `parameters` | 是 | JSON Schema 参数定义 |
| `action` | 是 | 工具执行函数，可 async |
| `formatMessage` | 否 | 工具执行 toast；返回空字符串可隐藏 |
| `shouldRegister` | 否 | 返回 false 时本次请求不注册该工具 |
| `stealth` | 否 | true 时工具结果不记录到可见聊天历史且不触发跟进生成 |

---

## 9. 和其他入口的边界

JS-Slash-Runner 脚本资产不是 SillyTavern 原生扩展。两者入口、目录结构和按钮机制不同。

服务端插件与前端扩展边界：

| 类型 | 运行位置 | 能力 | 工具箱默认边界 |
| --- | --- | --- | --- |
| 前端扩展 | 浏览器上下文 | UI、事件、设置、生成、前端状态 | 工具箱 C 模式支持 |
| 服务端插件 | Node/Express 侧 | 注册 API 路由、访问服务端文件系统和用户目录 | 不默认生成或维护，需用户明确要求 |

用户明确要求服务端插件、Express router、`plugins/` 目录或 Node 侧文件访问时，应先确认是否扩大到服务端插件开发；否则默认按前端扩展/单文件资产处理。

如果用户明确要求把脚本资产改造成 SillyTavern 原生扩展：

1. 新增 `manifest.json`。
2. 拆出 `index.js` 作为入口。
3. 拆出 `style.css` 管理 UI 主题。
4. 通过 `SillyTavern.getContext()` 接入 `eventSource/event_types`、`Popup`、`renderExtensionTemplateAsync`。
5. 如果要管理 Prompt Manager 预设，围绕 `getPresetManager()` 与预设扩展字段设计。
6. 如果要和 Regex 联动，明确区分：ST Regex 扩展配置 ≠ 脚本内部业务正则。
