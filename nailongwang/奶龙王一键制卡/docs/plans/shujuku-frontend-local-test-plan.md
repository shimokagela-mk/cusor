# shujuku Frontend Local Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `tools/shujuku-local` so agents can locally test role-card frontends that read or mutate shujuku tables, including status bars, progression UI, and opening-scene UI.

**Architecture:** Reuse the existing mock SillyTavern + shujuku host as the data layer, then add a frontend sandbox layer that loads project HTML assets with injected `AutoCardUpdaterAPI`, `TavernHelper`, chat data, and table templates. The runner produces machine-readable assertions plus an interactive browser-readable preview: when the user opens the generated HTML file, the real project frontend runs inside an iframe/sandbox and talks to the same embedded mock database API, so the user can directly see the frontend reading or mutating table state.

**Tech Stack:** Node.js CommonJS, existing `mock-host.js`, existing `scenario-runner.js`, built-in `vm`, generated standalone HTML with embedded browser-side mock shujuku API. Do not add browser dependencies in the first pass; add Playwright only in a later visual-regression phase if the interactive preview is not enough.

---

## File Structure

- Create: `tools/shujuku-local/frontend-fixture.js`
  - Parse frontend scenario config.
  - Discover project frontend files.
  - Normalize scenario types: `opening`, `status`, `progression`, `custom`.
  - Provide default expectations when no fixture exists.

- Create: `tools/shujuku-local/frontend-runner.js`
  - Create a mock host.
  - Import shujuku table template and seed table data.
  - Load one or more frontend HTML files.
  - Inject database APIs and capture calls.
  - Execute configured interactions.
  - Return assertions, DOM snapshots, API call traces, table changes, and usability summary.

- Create: `tools/shujuku-local/frontend-report.js`
  - Render Markdown/HTML reports.
  - Render side-by-side panes: interactive frontend preview, seeded table snapshot, live after table snapshot, API call trace.
  - Add natural-language frontend usability status.

- Create: `tools/shujuku-local/frontend-preview.js`
  - Build the standalone browser preview document.
  - Embed frontend HTML/CSS/JS assets.
  - Install browser-side `window.AutoCardUpdaterAPI`, `window.TavernHelper`, `window.SillyTavern`, `toastr`, and `fetch` mocks before the frontend scripts execute.
  - Expose live debug panels for API calls and table state.
  - Support user interactions after opening the report, not only during Node-side test execution.

- Modify: `tools/shujuku-local/mock-host.js`
  - Add optional API call tracing for `TavernHelper`, `AutoCardUpdaterAPI`, `fetch`, `toastr`, and DOM events.
  - Add DOM helpers required by project frontends: `classList`, `dataset`, `closest`, `matches`, basic `querySelectorAll` for class/tag selectors, and `DOMContentLoaded` dispatch.

- Modify: `tools/shujuku-local/scenario-runner.js`
  - Export reusable helpers needed by frontend runner: template loading, DDL checks, table snapshot coercion, story input resolution, and host setup where practical.
  - Keep existing table test behavior unchanged.

- Modify: `tools/shujuku-local/cli.js`
  - Add `--frontend`, `--frontend-scenario`, `--frontend-file`, `--frontend-fixture`, `--expect-text`, `--interaction`.
  - Route frontend runs to `runShujukuFrontendScenario`.

- Modify: `package.json`
  - Add `npm run shujuku:frontend`.
  - Keep `npm run test` network-free.

- Create: `tests/shujuku-frontend.test.js`
  - Unit and integration tests for fixture loading, API trace capture, static rendering, table reads, table writes, and report output.

- Modify: `tests/run.js`
  - Add `node tests/shujuku-frontend.test.js`.

- Create: `tools/shujuku-local/frontend-fixture.example.json`
  - Document scenario input for status/opening/progression frontend tests.

- Modify: `tools/shujuku-local/README.md`
  - Add frontend test commands and report interpretation.

- Modify: `prompts/11-shujuku本地测试.md`
  - Add frontend validation gate for tasks involving `frontend/`, opening UI, status bars, or progression UI.

---

## Public CLI

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both --story-text "正文..."
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-file frontend/opening.html --frontend-scenario opening
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-fixture projects/<卡名>/frontend-test.json
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-file frontend/status.html --frontend-scenario status --mock-data output/temp/shujuku-local/status-mock.json --expect-text "星央市旧灯塔"
```

Supported options:

- `--frontend`: enables frontend mode when using `node tools/shujuku-local/cli.js` directly.
- `--frontend-scenario opening|status|progression|all|custom`: chooses frontend category.
- `--frontend-file <path>`: tests one HTML file.
- `--frontend-fixture <path>`: loads scenario config.
- `--mock-data <path>`: injects agent-authored table rows into the embedded mock database. Accepts `{ "seedTables": { ... } }`, `{ "tables": { ... } }`, or a direct table-name map.
- `--expect-text <text>`: requires rendered frontend preview to include this text.
- `--interaction <selector>:click`: simple interaction instruction for progression UI.
- Existing shujuku options remain valid: `--project`, `--template`, `--story-text`, `--story-file`, `--chat-file`, `--database-mode`, `--ai`, `--ai-config`, `--report`.

---

## User-Facing Result

The primary deliverable for frontend tests is the generated `.html` report. It must be directly openable by a non-agent user and must show the actual project frontend connected to an embedded mock database.

The HTML report should contain:

- **Live Preview**: an iframe/sandbox that runs the project frontend HTML with injected database APIs.
- **Seeded Database**: the table snapshot used before the frontend loads.
- **Live Database After Interaction**: updated table state after the frontend reads/writes data.
- **API Call Trace**: every `AutoCardUpdaterAPI` / `TavernHelper` call made by the frontend.
- **Scenario Controls**: buttons to replay configured interactions such as status refresh or progression click.
- **Natural-Language Verdict**: `usable`, `needs-review`, or `failed`, with a sentence explaining whether the frontend is actually connected to the database.

The Markdown report can summarize the same result, but it is secondary. Agents must give users the HTML path first when the request is “看前端效果”.

If the frontend needs data to show meaningful state, the agent should create a mock data file under `output/temp/shujuku-local/` and pass it with `--mock-data`. Do not stop at “no data to display”; seed plausible status, summary, task, map, or inventory rows that match the project table headers, then verify whether the frontend reads and displays those rows through the database API.

## Known Issues

- No active known compatibility gaps after the 2026-05-26 runner fixes below. New project-specific failures should be categorized as either missing mock data, unsupported browser API, unsupported shujuku API shape, or project build/asset embedding defect before marking the card frontend unusable.

## Resolved Compatibility Gaps

- 2026-05-26: Added Element-scoped `querySelector` / `querySelectorAll` and nested HTML registration to the mock DOM. Kingdom `status-bar.html` can now validate nested DOM reads.
- 2026-05-26: Added inline `onclick` execution during configured click interactions. Opening/progression frontends that use inline handlers can now be exercised by the CLI runner.
- 2026-05-26: Added default browser-like `indexedDB` global with async success events and basic objectStore `get` / `put` / `add` / `delete` / `openCursor` methods. Kingdom `status-bar.html` can now run its portrait-cache code in local tests.
- 2026-05-26: Added `tables/chatSheets-template.json` to project template auto-discovery. Europe card frontend tests now use the project table template without requiring agents to pass `--template` manually.
- 2026-05-26: Added local injection for `{{TEMPLATE_BASE64}}` and `{{PRESET_BASE64}}` before executing frontend source HTML. Kingdom opening source can now be tested without first building/repacking the card.
- 2026-05-26: Opening frontend validation now treats `initGameSession`, `importTemplateFromData`, and `importTableAsJson` as equivalent successful startup/database injection APIs.
- 2026-05-26: Auto-discovered opening scenarios now try common start-button selectors (`.start-btn`, `#startButton`, `#start`, `#importTemplate`, `button`) when no explicit interaction is configured, so `--frontend-scenario all` can exercise opening-page injection by default.

---

## Fixture Format

Create this example at `tools/shujuku-local/frontend-fixture.example.json`:

```json
{
  "scenarios": [
    {
      "name": "opening",
      "type": "opening",
      "files": ["frontend/opening.html"],
      "seedTables": {
        "纪要表": [
          ["行号", "纪要"],
          [1, "星辉港发现银钥匙"]
        ]
      },
      "expectText": ["星辉港", "银钥匙"],
      "expectApiCalls": ["exportTableAsJson"],
      "interactions": []
    },
    {
      "name": "status",
      "type": "status",
      "files": ["frontend/status.html"],
      "seedTables": {
        "主角状态表": [
          ["行号", "状态", "体力"],
          [1, "紧张", "80"]
        ]
      },
      "expectText": ["紧张", "80"],
      "expectApiCalls": ["exportTableAsJson"],
      "interactions": []
    },
    {
      "name": "progression",
      "type": "progression",
      "files": ["frontend/progression.html"],
      "seedTables": {
        "任务表": [
          ["行号", "任务", "状态"],
          [1, "调查旧灯塔", "进行中"]
        ]
      },
      "expectText": ["调查旧灯塔"],
      "expectApiCalls": ["exportTableAsJson", "insertRow"],
      "interactions": [
        { "selector": "[data-test='advance']", "type": "click" }
      ]
    }
  ]
}
```

If a project has no fixture, the runner should auto-discover:

- `frontend/opening.html`, `frontend/opening-regex.html`, or filename containing `opening` / `开场` as `opening`.
- filenames containing `status` / `状态栏` / `状态` as `status`.
- filenames containing `progress` / `advance` / `推进` as `progression`.
- other `.html` files as `custom`, smoke-render only.

---

## Task 1: Frontend Fixture Loader

**Files:**
- Create: `tools/shujuku-local/frontend-fixture.js`
- Test: `tests/shujuku-frontend.test.js`

- [ ] **Step 1: Write failing tests for fixture loading**

Add this to `tests/shujuku-frontend.test.js`:

```js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFrontendFixture, discoverFrontendScenarios } = require('../tools/shujuku-local/frontend-fixture');

async function testLoadFrontendFixture() {
  const fixturePath = 'output/temp/shujuku-local/unit-frontend-fixture.json';
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, JSON.stringify({
    scenarios: [{
      name: 'opening',
      type: 'opening',
      files: ['frontend/opening.html'],
      seedTables: { '纪要表': [['行号', '纪要'], [1, '星辉港']] },
      expectText: ['星辉港'],
      expectApiCalls: ['exportTableAsJson'],
      interactions: []
    }]
  }), 'utf8');

  const fixture = loadFrontendFixture(fixturePath);
  assert.strictEqual(fixture.scenarios.length, 1);
  assert.strictEqual(fixture.scenarios[0].type, 'opening');
  assert.deepStrictEqual(fixture.scenarios[0].expectText, ['星辉港']);
}

async function testDiscoverFrontendScenarios() {
  const root = 'output/temp/shujuku-local/unit-frontend-project';
  fs.mkdirSync(path.join(root, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(root, 'frontend', 'opening.html'), '<div>开场</div>', 'utf8');
  fs.writeFileSync(path.join(root, 'frontend', 'status.html'), '<div>状态</div>', 'utf8');
  fs.writeFileSync(path.join(root, 'frontend', 'progression.html'), '<button>推进</button>', 'utf8');

  const scenarios = discoverFrontendScenarios(root);
  assert.ok(scenarios.some((item) => item.type === 'opening'));
  assert.ok(scenarios.some((item) => item.type === 'status'));
  assert.ok(scenarios.some((item) => item.type === 'progression'));
}

async function runShujukuFrontendTests() {
  await testLoadFrontendFixture();
  await testDiscoverFrontendScenarios();
}

if (require.main === module) {
  runShujukuFrontendTests()
    .then(() => console.log('[通过] shujuku-frontend 单元测试'))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runShujukuFrontendTests };
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm.cmd run test
```

Expected: fail because `tools/shujuku-local/frontend-fixture.js` does not exist.

- [ ] **Step 3: Implement minimal fixture loader**

Create `tools/shujuku-local/frontend-fixture.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function normalizeScenario(raw, index = 0) {
  const type = raw.type || 'custom';
  return {
    name: raw.name || `${type}-${index + 1}`,
    type,
    files: Array.isArray(raw.files) ? raw.files : (raw.file ? [raw.file] : []),
    seedTables: raw.seedTables || {},
    expectText: Array.isArray(raw.expectText) ? raw.expectText : [],
    expectApiCalls: Array.isArray(raw.expectApiCalls) ? raw.expectApiCalls : [],
    interactions: Array.isArray(raw.interactions) ? raw.interactions : []
  };
}

function loadFrontendFixture(filePath) {
  const payload = readJson(filePath);
  const list = Array.isArray(payload) ? payload : payload.scenarios;
  if (!Array.isArray(list)) throw new Error('frontend fixture 必须是数组，或包含 scenarios 数组');
  return { scenarios: list.map(normalizeScenario) };
}

function classifyFrontendFile(fileName) {
  const normalized = fileName.toLowerCase();
  if (/opening|开场/.test(normalized)) return 'opening';
  if (/status|状态栏|状态/.test(normalized)) return 'status';
  if (/progress|advance|推进/.test(normalized)) return 'progression';
  return 'custom';
}

function discoverFrontendScenarios(projectRoot) {
  const frontendDir = path.join(projectRoot, 'frontend');
  if (!fs.existsSync(frontendDir)) return [];
  return fs.readdirSync(frontendDir)
    .filter((file) => /\.html$/i.test(file))
    .sort()
    .map((file, index) => normalizeScenario({
      name: path.basename(file, path.extname(file)),
      type: classifyFrontendFile(file),
      files: [path.join('frontend', file)]
    }, index));
}

module.exports = {
  loadFrontendFixture,
  discoverFrontendScenarios,
  classifyFrontendFile
};
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm.cmd run test
```

Expected: frontend test passes after adding it to `tests/run.js` in Task 6.

---

## Task 2: Frontend Runner and API Trace

**Files:**
- Create: `tools/shujuku-local/frontend-runner.js`
- Modify: `tools/shujuku-local/mock-host.js`
- Test: `tests/shujuku-frontend.test.js`

- [ ] **Step 1: Add failing test for rendering and API read**

Append to `tests/shujuku-frontend.test.js`:

```js
const { runShujukuFrontendScenario } = require('../tools/shujuku-local/frontend-runner');

async function testFrontendReadsTableData() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-read';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'status.html'), `
    <section id="status"></section>
    <script>
      const tables = window.AutoCardUpdaterAPI.exportTableAsJson();
      document.getElementById('status').textContent = tables["主角状态表"][1][1] + ":" + tables["主角状态表"][1][2];
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'status',
      type: 'status',
      files: ['frontend/status.html'],
      seedTables: { '主角状态表': [['行号', '状态', '体力'], [1, '紧张', '80']] },
      expectText: ['紧张', '80'],
      expectApiCalls: ['exportTableAsJson'],
      interactions: []
    },
    report: 'output/temp/shujuku-local/unit-frontend-read-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(report.renderedText.includes('紧张:80'));
  assert.ok(report.apiCalls.some((call) => call.name === 'exportTableAsJson'));
}
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
node tests/shujuku-frontend.test.js
```

Expected: fail because `frontend-runner.js` does not exist.

- [ ] **Step 3: Implement frontend runner**

Create `tools/shujuku-local/frontend-runner.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createMockSillyTavernHost } = require('./mock-host');

function seedAutoCardUpdaterApi(host, seedTables) {
  const state = JSON.parse(JSON.stringify(seedTables || {}));
  const calls = [];
  function trace(name, args) {
    calls.push({ name, args: Array.from(args || []).map((item) => JSON.parse(JSON.stringify(item))) });
  }
  const api = {
    exportTableAsJson() {
      trace('exportTableAsJson', arguments);
      return JSON.parse(JSON.stringify(state));
    },
    getTableTemplate() {
      trace('getTableTemplate', arguments);
      return JSON.parse(JSON.stringify(state));
    },
    insertRow(tableName, data) {
      trace('insertRow', arguments);
      if (!state[tableName]) state[tableName] = [['行号', ...Object.keys(data || {})]];
      const header = state[tableName][0];
      state[tableName].push(header.map((name, index) => index === 0 ? state[tableName].length : (data && data[name]) || ''));
      return true;
    },
    updateCell(tableName, row, col, value) {
      trace('updateCell', arguments);
      if (state[tableName] && state[tableName][row]) state[tableName][row][col] = value;
      return true;
    },
    getStoryContext() {
      trace('getStoryContext', arguments);
      return host.state.chat.filter((item) => !item.is_user).map((item) => item.mes).join('\n\n');
    },
    callAI: async (messages, options) => {
      trace('callAI', arguments);
      return host.ai(messages, options);
    }
  };
  host.window.AutoCardUpdaterAPI = api;
  return { api, calls, state };
}

function runInlineScripts(host, html, filename) {
  const scripts = [];
  const bodyHtml = String(html || '').replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_match, code) => {
    scripts.push(code);
    return '';
  });
  host.document.body.innerHTML += bodyHtml;
  const context = {
    window: host.window,
    document: host.document,
    AutoCardUpdaterAPI: host.window.AutoCardUpdaterAPI,
    TavernHelper: host.window.TavernHelper,
    console,
    setTimeout,
    clearTimeout,
    Promise
  };
  vm.createContext(context);
  scripts.forEach((code, index) => vm.runInContext(code, context, { filename: `${filename}#script-${index}`, timeout: 5000 }));
}

function collectText(host) {
  return [
    host.document.body.textContent,
    host.document.body.innerHTML
  ].join('\n');
}

function assessFrontend({ renderedText, expectedText, apiCalls, expectedApiCalls, errors }) {
  if (errors.length > 0) return { status: 'failed', summary: `前端执行出现 ${errors.length} 个错误，不能验收。` };
  const missingText = expectedText.filter((text) => !renderedText.includes(text));
  const missingCalls = expectedApiCalls.filter((name) => !apiCalls.some((call) => call.name === name));
  if (missingText.length || missingCalls.length) {
    return { status: 'needs-review', summary: `前端已渲染，但缺少预期文本或 API 调用：文本 ${missingText.join(', ') || '无'}；API ${missingCalls.join(', ') || '无'}。` };
  }
  return { status: 'usable', summary: '前端能读取 mock 数据库 API 并展示预期表内容。' };
}

async function runShujukuFrontendScenario(options) {
  const projectRoot = path.resolve(options.projectRoot || '.');
  const scenario = options.scenario;
  const host = createMockSillyTavernHost({ chat: options.chat || [] });
  const seeded = seedAutoCardUpdaterApi(host, scenario.seedTables || {});
  const errors = [];
  for (const file of scenario.files || []) {
    const fullPath = path.resolve(projectRoot, file);
    try {
      runInlineScripts(host, fs.readFileSync(fullPath, 'utf8'), fullPath);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  const renderedText = collectText(host);
  const report = {
    generatedAt: new Date().toISOString(),
    scenario: scenario.name,
    scenarioType: scenario.type,
    files: scenario.files,
    renderedText,
    beforeTables: scenario.seedTables || {},
    afterTables: seeded.state,
    apiCalls: seeded.calls,
    errors
  };
  report.usability = assessFrontend({
    renderedText,
    expectedText: scenario.expectText || [],
    apiCalls: seeded.calls,
    expectedApiCalls: scenario.expectApiCalls || [],
    errors
  });
  return report;
}

module.exports = {
  runShujukuFrontendScenario,
  seedAutoCardUpdaterApi,
  assessFrontend
};
```

- [ ] **Step 4: Improve mock DOM only as tests require**

If the test fails because `document.getElementById('status')` cannot find HTML-created nodes, update `mock-host.js` with a minimal HTML registration helper, or in `runInlineScripts` create a container and register IDs found in the body HTML. Keep the implementation narrow: support `id`, `class`, button clicks, and text assignment before adding broader DOM behavior.

- [ ] **Step 5: Run frontend tests**

Run:

```powershell
node tests/shujuku-frontend.test.js
```

Expected: all frontend fixture and runner tests pass.

---

## Task 3: Frontend Report and User-Visible Preview

**Files:**
- Create: `tools/shujuku-local/frontend-report.js`
- Create: `tools/shujuku-local/frontend-preview.js`
- Modify: `tools/shujuku-local/frontend-runner.js`
- Test: `tests/shujuku-frontend.test.js`

- [ ] **Step 1: Add failing test for report files**

Append:

```js
async function testFrontendWritesReadableReport() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-report';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'opening.html'), `
    <main id="opening"></main>
    <script>
      const tables = window.AutoCardUpdaterAPI.exportTableAsJson();
      document.getElementById('opening').textContent = tables["纪要表"][1][1];
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'opening',
      type: 'opening',
      files: ['frontend/opening.html'],
      seedTables: { '纪要表': [['行号', '纪要'], [1, '星辉港发现银钥匙']] },
      expectText: ['星辉港'],
      expectApiCalls: ['exportTableAsJson'],
      interactions: []
    },
    report: 'output/temp/shujuku-local/unit-frontend-report-output'
  });

  assert.ok(fs.existsSync(report.reportPaths.mdPath));
  assert.ok(fs.existsSync(report.reportPaths.htmlPath));
  const markdown = fs.readFileSync(report.reportPaths.mdPath, 'utf8');
  const html = fs.readFileSync(report.reportPaths.htmlPath, 'utf8');
  assert.ok(markdown.includes('前端可用性'));
  assert.ok(markdown.includes('星辉港'));
  assert.ok(html.includes('shujukuFrontendPreviewState'));
  assert.ok(html.includes('AutoCardUpdaterAPI'));
  assert.ok(html.includes('Live Preview'));
}
```

- [ ] **Step 2: Implement standalone live preview builder**

Create `tools/shujuku-local/frontend-preview.js`:

```js
'use strict';

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildPreviewHtml(report) {
  const state = {
    scenario: report.scenario,
    scenarioType: report.scenarioType,
    frontendHtml: report.frontendHtml || '',
    tables: report.beforeTables || {},
    chat: report.chat || [],
    interactions: report.configuredInteractions || []
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>shujuku 前端本地预览 - ${report.scenario}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #202124; background: #f6f8fa; }
    header { padding: 16px 20px; background: #fff; border-bottom: 1px solid #d0d7de; }
    main { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 12px; padding: 12px; }
    iframe { width: 100%; min-height: 680px; border: 1px solid #d0d7de; background: #fff; }
    aside { display: grid; gap: 12px; align-content: start; }
    section { background: #fff; border: 1px solid #d0d7de; padding: 12px; }
    pre { white-space: pre-wrap; overflow: auto; max-height: 260px; background: #f6f8fa; padding: 10px; }
    button { margin: 0 8px 8px 0; }
  </style>
</head>
<body>
  <header>
    <h1>shujuku 前端本地预览</h1>
    <div>场景：${report.scenario} / ${report.scenarioType}</div>
    <strong>结论：${report.usability.summary}</strong>
  </header>
  <main>
    <div>
      <h2>Live Preview</h2>
      <iframe id="preview"></iframe>
    </div>
    <aside>
      <section><h2>Scenario Controls</h2><div id="controls"></div></section>
      <section><h2>API Call Trace</h2><pre id="calls"></pre></section>
      <section><h2>Live Database</h2><pre id="tables"></pre></section>
    </aside>
  </main>
  <script>
    window.shujukuFrontendPreviewState = ${escapeScriptJson(state)};
    const state = window.shujukuFrontendPreviewState;
    const calls = [];
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function renderDebug() {
      document.getElementById('calls').textContent = JSON.stringify(calls, null, 2);
      document.getElementById('tables').textContent = JSON.stringify(state.tables, null, 2);
    }
    function makeApi() {
      function trace(name, args) { calls.push({ name, args: Array.from(args || []) }); renderDebug(); }
      return {
        exportTableAsJson() { trace('exportTableAsJson', arguments); return clone(state.tables); },
        getTableTemplate() { trace('getTableTemplate', arguments); return clone(state.tables); },
        insertRow(tableName, data) {
          trace('insertRow', arguments);
          if (!state.tables[tableName]) state.tables[tableName] = [['行号'].concat(Object.keys(data || {}))];
          const header = state.tables[tableName][0];
          state.tables[tableName].push(header.map((name, index) => index === 0 ? state.tables[tableName].length : ((data || {})[name] || '')));
          renderDebug();
          return true;
        },
        updateCell(tableName, row, col, value) {
          trace('updateCell', arguments);
          if (state.tables[tableName] && state.tables[tableName][row]) state.tables[tableName][row][col] = value;
          renderDebug();
          return true;
        },
        getStoryContext() {
          trace('getStoryContext', arguments);
          return state.chat.filter((item) => !item.is_user).map((item) => item.mes || item.content || '').join('\\n\\n');
        },
        callAI() { trace('callAI', arguments); return Promise.resolve('shujuku frontend preview fake AI response'); }
      };
    }
    function buildSrcdoc() {
      const bootstrap = '<script>window.AutoCardUpdaterAPI = parent.__makePreviewApi(); window.TavernHelper = { getChatMessages: async () => parent.shujukuFrontendPreviewState.chat, getLastMessageId: () => parent.shujukuFrontendPreviewState.chat.length - 1 }; window.SillyTavern = { getContext: () => ({ chat: parent.shujukuFrontendPreviewState.chat }) }; window.toastr = { info(){}, success(){}, warning(){}, error(){} };<\\/script>';
      return state.frontendHtml.replace(/<head[^>]*>/i, (match) => match + bootstrap) || bootstrap + state.frontendHtml;
    }
    window.__makePreviewApi = makeApi;
    document.getElementById('preview').srcdoc = buildSrcdoc();
    for (const interaction of state.interactions) {
      const button = document.createElement('button');
      button.textContent = interaction.label || interaction.selector + ':' + interaction.type;
      button.onclick = () => {
        const frame = document.getElementById('preview');
        const target = frame.contentDocument && frame.contentDocument.querySelector(interaction.selector);
        if (target && interaction.type === 'click') target.click();
        renderDebug();
      };
      document.getElementById('controls').appendChild(button);
    }
    renderDebug();
  </script>
</body>
</html>`;
}

module.exports = { buildPreviewHtml };
```

- [ ] **Step 3: Implement report renderer**

Create `tools/shujuku-local/frontend-report.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { buildPreviewHtml } = require('./frontend-preview');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function renderFrontendMarkdown(report) {
  return [
    '# shujuku 前端本地测试报告',
    '',
    `- 时间: ${report.generatedAt}`,
    `- 场景: ${report.scenario} / ${report.scenarioType}`,
    `- 结论: ${report.usability.summary}`,
    '',
    '## 前端可用性',
    '',
    `- 状态: ${report.usability.status}`,
    `- API 调用数: ${report.apiCalls.length}`,
    `- 错误数: ${report.errors.length}`,
    '',
    '## 渲染文本',
    '',
    '```text',
    report.renderedText || '（空）',
    '```',
    '',
    '## API 调用',
    '',
    '```json',
    JSON.stringify(report.apiCalls, null, 2),
    '```',
    '',
    '## 表格快照',
    '',
    '```json',
    JSON.stringify(report.afterTables, null, 2),
    '```',
    ''
  ].join('\n');
}

function writeFrontendReport(report, reportBase) {
  const base = reportBase || `output/temp/shujuku-local/frontend-${Date.now()}`;
  const jsonPath = `${base}.json`;
  const mdPath = `${base}.md`;
  const htmlPath = `${base}.html`;
  ensureDir(path.dirname(jsonPath));
  const markdown = renderFrontendMarkdown(report);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(htmlPath, buildPreviewHtml(report), 'utf8');
  return { jsonPath, mdPath, htmlPath };
}

module.exports = {
  renderFrontendMarkdown,
  writeFrontendReport
};
```

- [ ] **Step 4: Pass frontend source and interactions into the report**

In `frontend-runner.js`, collect the loaded frontend HTML before executing scripts:

```js
const frontendHtmlParts = [];
for (const file of scenario.files || []) {
  const fullPath = path.resolve(projectRoot, file);
  const html = fs.readFileSync(fullPath, 'utf8');
  frontendHtmlParts.push(`<!-- ${file} -->\n${html}`);
  runInlineScripts(host, html, fullPath);
}
```

Add these fields to the report:

```js
frontendHtml: frontendHtmlParts.join('\n'),
configuredInteractions: scenario.interactions || [],
chat: options.chat || []
```

- [ ] **Step 5: Call report writer from runner**

In `frontend-runner.js`, import `writeFrontendReport` and, when `options.report` is present, set:

```js
const { writeFrontendReport } = require('./frontend-report');
// after report.usability:
report.reportPaths = writeFrontendReport(report, options.report);
```

When `options.report` is missing, use `output/temp/shujuku-local/frontend-${Date.now()}`.

- [ ] **Step 6: Run frontend tests**

Run:

```powershell
node tests/shujuku-frontend.test.js
```

Expected: reports are written, include natural-language frontend usability, and the generated HTML contains a live preview with an embedded `AutoCardUpdaterAPI`.

---

## Task 4: CLI and npm Script

**Files:**
- Modify: `tools/shujuku-local/cli.js`
- Modify: `package.json`
- Test: `tests/shujuku-frontend.test.js`

- [ ] **Step 1: Add CLI parser tests**

Add:

```js
const { parseArgs } = require('../tools/shujuku-local/cli');

async function testFrontendCliArgs() {
  const parsed = parseArgs([
    '--frontend',
    '--project', '测试卡',
    '--frontend-scenario', 'status',
    '--frontend-file', 'frontend/status.html',
    '--expect-text', '紧张'
  ]);
  assert.strictEqual(parsed.frontend, true);
  assert.strictEqual(parsed.frontendScenario, 'status');
  assert.strictEqual(parsed.frontendFile, 'frontend/status.html');
  assert.deepStrictEqual(parsed.expectText, ['紧张']);
}
```

- [ ] **Step 2: Update `parseArgs`**

Add cases:

```js
else if (arg === '--frontend') options.frontend = true;
else if (arg === '--frontend-scenario') options.frontendScenario = argv[++i];
else if (arg === '--frontend-file') options.frontendFile = argv[++i];
else if (arg === '--frontend-fixture') options.frontendFixture = argv[++i];
else if (arg === '--expect-text') {
  if (!options.expectText) options.expectText = [];
  options.expectText.push(argv[++i]);
}
else if (arg === '--interaction') {
  if (!options.interactions) options.interactions = [];
  options.interactions.push(argv[++i]);
}
```

- [ ] **Step 3: Route frontend mode in `main()`**

Add:

```js
if (options.frontend) {
  const { runFrontendCli } = require('./frontend-runner');
  const reports = await runFrontendCli(options);
  for (const report of reports) {
    console.log('shujuku 前端本地测试完成。');
    console.log(`  场景: ${report.scenario} / ${report.scenarioType}`);
    console.log(`  前端可用性: ${report.usability.summary}`);
    console.log(`  可读报告: ${report.reportPaths.mdPath}`);
    console.log(`  HTML 报告: ${report.reportPaths.htmlPath}`);
  }
  return;
}
```

- [ ] **Step 4: Add npm script**

In `package.json`:

```json
"shujuku:frontend": "node tools/shujuku-local/cli.js --frontend"
```

- [ ] **Step 5: Run command smoke**

Run:

```powershell
npm.cmd run shujuku:frontend -- --project "魔法少年什么的，我才不要当！" --frontend-scenario all --report output/temp/shujuku-local/magic-boy-frontend
```

Expected: one report per discovered scenario, with natural-language frontend usability.

---

## Task 5: Frontend Interactions and Table Mutation

**Files:**
- Modify: `tools/shujuku-local/frontend-runner.js`
- Modify: `tools/shujuku-local/mock-host.js`
- Test: `tests/shujuku-frontend.test.js`

- [ ] **Step 1: Add failing progression interaction test**

Add:

```js
async function testFrontendProgressionWritesTable() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-write';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'progression.html'), `
    <button id="advance" data-test="advance">推进</button>
    <script>
      document.getElementById('advance').addEventListener('click', () => {
        window.AutoCardUpdaterAPI.insertRow("任务表", {"任务":"调查旧灯塔", "状态":"已推进"});
      });
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'progression',
      type: 'progression',
      files: ['frontend/progression.html'],
      seedTables: { '任务表': [['行号', '任务', '状态'], [1, '调查旧灯塔', '进行中']] },
      expectText: ['推进'],
      expectApiCalls: ['insertRow'],
      interactions: [{ selector: '#advance', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-frontend-write-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(JSON.stringify(report.afterTables).includes('已推进'));
  assert.ok(report.apiCalls.some((call) => call.name === 'insertRow'));
}
```

- [ ] **Step 2: Implement interactions**

In `frontend-runner.js`, add:

```js
function runInteractions(host, interactions, errors) {
  for (const interaction of interactions || []) {
    try {
      const element = host.document.querySelector(interaction.selector);
      if (!element) throw new Error(`找不到元素 ${interaction.selector}`);
      if (interaction.type === 'click') element.click();
      else throw new Error(`不支持的交互类型 ${interaction.type}`);
    } catch (error) {
      errors.push(`interaction ${interaction.selector}: ${error.message}`);
    }
  }
}
```

Call it after all frontend files are loaded:

```js
runInteractions(host, scenario.interactions || [], errors);
```

- [ ] **Step 3: Expand selector support**

If `mock-host.js` only supports ID selectors, add class/tag/data-test selector support in `querySelector` and `querySelectorAll`. Keep this scoped to:

```text
#id
.class
tag
[data-test="value"]
```

- [ ] **Step 4: Run frontend tests**

Run:

```powershell
node tests/shujuku-frontend.test.js
```

Expected: progression write test passes and after-table snapshot includes the inserted row.

---

## Task 6: Validation Integration

**Files:**
- Modify: `tests/run.js`
- Test: `npm.cmd run test`

- [ ] **Step 1: Add frontend tests to test runner**

Modify `tests/run.js`:

```js
run('shujuku-frontend', 'node', ['tests/shujuku-frontend.test.js']);
```

Place it after `shujuku-local`.

- [ ] **Step 2: Run full test suite**

Run:

```powershell
npm.cmd run test
```

Expected:

```text
✓ validate-project
✓ shujuku-local
✓ shujuku-frontend
全部测试通过
```

---

## Task 7: Documentation and Agent Gate

**Files:**
- Modify: `tools/shujuku-local/README.md`
- Modify: `prompts/11-shujuku本地测试.md`
- Modify: `prompts/INDEX.md`
- Optional Modify: `AGENTS.md` and `奶龙王一键制卡/AGENTS.md`

- [ ] **Step 1: Update shujuku-local README**

Add a section:

```markdown
## 前端本地测试

当项目包含 `frontend/`、状态栏、推进 UI 或开场白 UI 时，先运行表格填表测试，再运行前端测试：

```powershell
npm.cmd run shujuku:test:real-ai -- --project <卡名> --database-mode both --ai-config output/config/shujuku-ai.local.json
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both
```

前端报告会输出：

- 前端可用性自然语言结论。
- 用户可直接打开的 HTML 前端预览，预览中的前端会连接页面内 mock 数据库 API。
- 预览页内的交互按钮，能触发推进、刷新状态或其他 fixture 配置动作。
- 渲染文本。
- 读取/写入数据库 API 调用轨迹。
- 前端执行后的实时表格快照。
- HTML 可读报告路径应优先提供给用户。
```

- [ ] **Step 2: Update prompt 11**

Add:

```markdown
如果任务修改或新增 `frontend/`、状态栏前端、推进前端、开场白前端，AI agent 必须额外运行：

```powershell
npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both
```

交付时必须优先给出 HTML 报告路径，并说明用户打开后能直接看到哪个前端、该前端是否连接了 mock 数据库 API、是否能读取表内容、是否调用数据库 API、是否产生表格变化。不能只说“报告已生成”。
```

- [ ] **Step 3: Update agent gate**

In `奶龙王一键制卡/AGENTS.md`, extend the shujuku gate:

```markdown
只要本次任务涉及 `frontend/`、状态栏、推进 UI、开场白 UI，除 shujuku 表格测试外，还必须运行 `npm.cmd run shujuku:frontend -- --project <卡名> --frontend-scenario all --database-mode both`，并自然语言说明前端可用性。
```

- [ ] **Step 4: Run validation**

Run:

```powershell
npm.cmd run validate
```

Expected: validation passes.

---

## Acceptance Criteria

- `npm.cmd run test` passes.
- `npm.cmd run shujuku:frontend -- --project <测试项目> --frontend-scenario all` creates `.json`, `.md`, `.html` reports under `output/temp/shujuku-local/`.
- Reports include:
  - `前端可用性` natural-language conclusion.
  - A directly openable interactive HTML preview where the project frontend runs in an iframe/sandbox.
  - Browser-side `AutoCardUpdaterAPI` / `TavernHelper` mocks connected to the same embedded table state shown in the report.
  - Rendered text snapshot.
  - API call list.
  - Before/after table snapshots, with the HTML preview updating the live table panel after user interactions.
  - Errors and warnings.
- Status bar frontend can read seeded table content and show expected state.
- Opening frontend can read seeded table/chat content and show expected opening text.
- Progression frontend can trigger a configured interaction and mutate a mock table via `insertRow` or `updateCell`.
- Agent-facing prompts require frontend tests whenever frontend assets are modified.

---

## Open Decisions Before Implementation

1. Whether project-specific frontend fixtures should live at `projects/<卡名>/frontend-test.json` or `projects/<卡名>/tests/frontend.json`. Recommended: `projects/<卡名>/frontend-test.json` because it is easy for agents to find beside `frontend/`.
2. Whether first-pass visual verification is “interactive HTML preview is visible and connected to mock DB” or requires real browser screenshot comparison. Recommended: first-pass interactive standalone HTML preview, then add Playwright only if users need pixel-level regression.
3. Whether frontend tests should be part of default `npm run test`. Recommended: unit-level `tests/shujuku-frontend.test.js` yes; project-level `npm run shujuku:frontend -- --project ...` remains explicit because it depends on project assets.
