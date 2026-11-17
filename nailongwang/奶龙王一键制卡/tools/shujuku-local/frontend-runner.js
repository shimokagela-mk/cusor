'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const yaml = require('js-yaml');
const { createMockSillyTavernHost } = require('./mock-host');
const { writeFrontendReport } = require('./frontend-report');
const { loadFrontendFixture, discoverFrontendScenarios, normalizeScenario, defaultExpectApiCalls, defaultInteractions } = require('./frontend-fixture');
const { loadTemplate, normalizeApiTableData } = require('./scenario-runner');

const ROOT = path.resolve(__dirname, '..', '..');

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function resolveProject(projectArg) {
  if (!projectArg) return null;
  const direct = path.resolve(ROOT, projectArg);
  if (fs.existsSync(direct)) return direct;
  const underProjects = path.join(ROOT, 'projects', projectArg);
  if (fs.existsSync(underProjects)) return underProjects;
  throw new Error(`项目不存在: ${projectArg}`);
}

function seedAutoCardUpdaterApi(host, seedTables) {
  const state = clone(seedTables || {});
  const calls = [];
  const tableUpdateCallbacks = [];
  const tableFillEndCallbacks = [];
  function trace(name, args) {
    calls.push({
      name,
      args: Array.from(args || []).map((item) => clone(item))
    });
  }
  function shouldNotify(args) {
    const first = args && args[0];
    if (first && typeof first === 'object' && (first.skipNotify || first.silent)) return false;
    return true;
  }
  function notifyTableUpdate(args) {
    if (!shouldNotify(args)) return;
    for (const callback of tableUpdateCallbacks.slice()) {
      try { callback(); } catch (_error) {}
    }
  }
  function notifyTableFillEnd() {
    for (const callback of tableFillEndCallbacks.slice()) {
      try { callback(); } catch (_error) {}
    }
  }
  function replaceState(nextTables) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, clone(nextTables || {}));
  }
  function mergeState(nextTables) {
    Object.assign(state, clone(nextTables || {}));
  }
  function normalizeTablesPayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    if (payload.seedTables || payload.tables) return normalizeTablesPayload(payload.seedTables || payload.tables);
    const looksLikeTemplate = Object.values(payload).some((item) => item && typeof item === 'object' && Array.isArray(item.content));
    if (looksLikeTemplate) return normalizeApiTableData(payload);
    const tables = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'mate') continue;
      if (Array.isArray(value)) tables[key] = value.map((row) => Array.isArray(row) ? row.slice() : [row]);
      else if (value && typeof value === 'object' && Array.isArray(value.content)) {
        tables[value.name || key] = value.content.map((row) => Array.isArray(row) ? row.slice() : [row]);
      }
    }
    return tables;
  }
  const api = {
    exportTableAsJson() {
      trace('exportTableAsJson', arguments);
      return clone(state);
    },
    getTableTemplate() {
      trace('getTableTemplate', arguments);
      return clone(state);
    },
    importTemplateFromData(data, options) {
      trace('importTemplateFromData', arguments);
      const nextTables = normalizeTablesPayload(data);
      if (options && options.merge === true) mergeState(nextTables);
      else replaceState(nextTables);
      notifyTableUpdate(arguments);
      return { ok: true, importedTables: Object.keys(nextTables) };
    },
    initGameSession(config, options) {
      trace('initGameSession', arguments);
      const templateData = (options && options.templateData) || (config && config.templateData);
      const presetData = (options && options.presetData) || (config && config.presetData);
      const nextTables = normalizeTablesPayload(templateData);
      if (Object.keys(nextTables).length > 0) {
        if (options && options.merge === true) mergeState(nextTables);
        else replaceState(nextTables);
      }
      notifyTableUpdate(arguments);
      return {
        ok: true,
        templateImported: Object.keys(nextTables).length > 0,
        presetImported: !!presetData,
        importedTables: Object.keys(nextTables)
      };
    },
    importPlotPresetFromData(preset, options) {
      trace('importPlotPresetFromData', arguments);
      return { ok: true, importedPresets: preset ? 1 : 0, options: clone(options || {}) };
    },
    importPlotPresetsFromData(presets, options) {
      trace('importPlotPresetsFromData', arguments);
      return { ok: true, importedPresets: Array.isArray(presets) ? presets.length : 0, options: clone(options || {}) };
    },
    insertRow(tableName, data) {
      trace('insertRow', arguments);
      let table = tableName;
      let rowData = data;
      if (tableName && typeof tableName === 'object') {
        table = tableName.tableName || tableName.name || tableName.table;
        rowData = tableName.data || tableName.row || {};
      }
      table = String(table || '');
      if (!state[table]) state[table] = [['行号'].concat(Object.keys(rowData || {}))];
      const header = state[table][0] || ['行号'];
      state[table].push(header.map((name, index) => index === 0 ? state[table].length : (rowData && rowData[name]) || ''));
      notifyTableUpdate(arguments);
      return true;
    },
    updateCell(tableName, row, col, value) {
      trace('updateCell', arguments);
      if (state[tableName] && state[tableName][row]) state[tableName][row][col] = value;
      return true;
    },
    updateRow(tableName, rowIndex, data) {
      trace('updateRow', arguments);
      let table = tableName;
      let row = rowIndex;
      let rowData = data;
      if (tableName && typeof tableName === 'object') {
        table = tableName.tableName || tableName.name || tableName.table;
        row = tableName.rowIndex || tableName.row || tableName.index;
        rowData = tableName.data || tableName.patch || {};
      }
      table = String(table || '');
      row = Number(row);
      const rows = state[table];
      if (!rows || !rows[row]) return false;
      const header = rows[0] || [];
      rows[row] = header.map((name, index) => index === 0 ? rows[row][index] : (rowData && rowData[name]) || rows[row][index] || '');
      notifyTableUpdate(arguments);
      return true;
    },
    deleteRow(tableName, rowIndex) {
      trace('deleteRow', arguments);
      let table = tableName;
      let row = rowIndex;
      if (tableName && typeof tableName === 'object') {
        table = tableName.tableName || tableName.name || tableName.table;
        row = tableName.rowIndex || tableName.row || tableName.index;
      }
      table = String(table || '');
      row = Number(row);
      const rows = state[table];
      if (!rows || !rows[row] || row <= 0) return false;
      rows.splice(row, 1);
      for (let index = 1; index < rows.length; index += 1) {
        rows[index][0] = index;
      }
      notifyTableUpdate(arguments);
      return true;
    },
    registerTableUpdateCallback(callback) {
      trace('registerTableUpdateCallback', arguments);
      if (typeof callback === 'function') tableUpdateCallbacks.push(callback);
      return true;
    },
    registerTableFillEndCallback(callback) {
      trace('registerTableFillEndCallback', arguments);
      if (typeof callback === 'function') tableFillEndCallbacks.push(callback);
      return true;
    },
    __triggerTableFillEnd() {
      trace('__triggerTableFillEnd', arguments);
      notifyTableFillEnd();
      return true;
    },
    getStoryContext() {
      trace('getStoryContext', arguments);
      return host.state.chat.filter((item) => !item.is_user).map((item) => item.mes).join('\n\n');
    },
    callAI(messages, options) {
      trace('callAI', arguments);
      return host.ai(messages, options);
    }
  };
  host.window.AutoCardUpdaterAPI = api;
  return { api, calls, state };
}

function registerHtmlElements(host, html) {
  const bodyHtml = String(html || '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  host.document.body.innerHTML = host.document.body.innerHTML + bodyHtml;
}

function getAttributeValue(attrs, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = String(attrs || '').match(pattern);
  return match ? (match[1] || match[2] || match[3] || '') : '';
}

function extractScripts(html, filename) {
  const scripts = [];
  const baseDir = filename ? path.dirname(filename) : ROOT;
  String(html || '').replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attrs, code) => {
    const src = getAttributeValue(attrs, 'src');
    if (src) {
      if (/^(?:https?:)?\/\//i.test(src) || /^data:/i.test(src)) {
        throw new Error(`本地前端测试不支持远程 script src: ${src}`);
      }
      const scriptPath = path.resolve(baseDir, src);
      if (!fs.existsSync(scriptPath)) throw new Error(`外部脚本不存在: ${src}`);
      scripts.push({ code: fs.readFileSync(scriptPath, 'utf8'), filename: scriptPath });
    } else {
      scripts.push({ code, filename });
    }
    return '';
  });
  return scripts;
}

function inlineLocalScripts(html, filename) {
  const baseDir = filename ? path.dirname(filename) : ROOT;
  return String(html || '').replace(/<script\b([^>]*)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>\s*<\/script>/gi, (match, beforeAttrs, doubleQuoted, singleQuoted, bare, afterAttrs) => {
    const src = doubleQuoted || singleQuoted || bare || '';
    if (/^(?:https?:)?\/\//i.test(src) || /^data:/i.test(src)) return match;
    const scriptPath = path.resolve(baseDir, src);
    if (!fs.existsSync(scriptPath)) throw new Error(`外部脚本不存在: ${src}`);
    return `<script${beforeAttrs || ''}${afterAttrs || ''}>\n${fs.readFileSync(scriptPath, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
}

function runInlineScripts(host, html, filename) {
  registerHtmlElements(host, html);
  host.window.getContext = host.getContext;
  const context = {
    window: host.window,
    document: host.document,
    parent: host.window.parent,
    top: host.window.top,
    self: host.window.self,
    AutoCardUpdaterAPI: host.window.AutoCardUpdaterAPI,
    TavernHelper: host.window.TavernHelper,
    SillyTavern: host.window.SillyTavern,
    toastr: host.window.toastr,
    getContext: host.getContext,
    localStorage: host.window.localStorage,
    sessionStorage: host.window.sessionStorage,
    indexedDB: host.window.indexedDB,
    fetch: host.window.fetch,
    Blob: host.window.Blob,
    FileReader: host.window.FileReader,
    URL: host.window.URL,
    ArrayBuffer,
    Uint8Array,
    DataView,
    atob: host.window.atob,
    btoa: host.window.btoa,
    TextEncoder,
    TextDecoder,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: host.window.requestAnimationFrame,
    cancelAnimationFrame: host.window.cancelAnimationFrame,
    Event: function Event(type) { this.type = type; },
    Promise
  };
  vm.createContext(context);
  host.__vmContext = context;
  extractScripts(html, filename).forEach((script, index) => {
    vm.runInContext(script.code, context, { filename: `${script.filename || filename}#script-${index}`, timeout: 5000 });
  });
  const results = host.document.dispatchEvent({ type: 'DOMContentLoaded', target: host.document }) || [];
  return Promise.all(results.filter((item) => item && typeof item.then === 'function'));
}

function collectText(host) {
  const texts = [];
  function walk(element) {
    if (!element) return;
    if (element.textContent) texts.push(element.textContent);
    if (element.innerHTML) texts.push(element.innerHTML.replace(/<[^>]+>/g, ' '));
    for (const child of element.children || []) walk(child);
  }
  walk(host.document.body);
  for (const element of host.document.__allElements || []) {
    if (element.innerHTML) texts.push(element.innerHTML.replace(/<[^>]+>/g, ' '));
    if (element.value) texts.push(element.value);
  }
  if (host.document.body.innerHTML) texts.push(host.document.body.innerHTML.replace(/<[^>]+>/g, ' '));
  return texts.join('\n');
}

async function flushFrontendTasks(cycles = 3) {
  for (let index = 0; index < cycles; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function runInteractions(host, interactions, errors) {
  for (const interaction of interactions || []) {
    try {
      const selectors = Array.isArray(interaction.selectors) ? interaction.selectors : [interaction.selector];
      const element = selectors.map((selector) => selector && host.document.querySelector(selector)).find(Boolean);
      if (!element) {
        if (interaction.optional) continue;
        throw new Error(`找不到元素 ${selectors.filter(Boolean).join(' 或 ')}`);
      }
      if (interaction.type === 'click' || interaction.type === 'clickFirst') {
        element.click();
        const inlineClick = element.getAttribute && element.getAttribute('onclick');
        if (inlineClick && host.__vmContext) {
          const result = vm.runInContext(String(inlineClick), host.__vmContext, {
            filename: `interaction:${selectors.filter(Boolean).join('|')}:onclick`,
            timeout: 5000
          });
          if (result && typeof result.then === 'function') await result;
        }
      }
      else throw new Error(`不支持的交互类型 ${interaction.type}`);
    } catch (error) {
      errors.push(`interaction ${interaction.selector}: ${error.message}`);
    }
  }
}

function apiCallMatches(callName, expectedName) {
  if (callName === expectedName) return true;
  if (expectedName === 'initGameSession') {
    return callName === 'importTemplateFromData' || callName === 'importTableAsJson';
  }
  return false;
}

function hasExpectedApiCall(apiCalls, expectedName) {
  return apiCalls.some((call) => apiCallMatches(call.name, expectedName));
}

function assessFrontend({ renderedText, expectedText, apiCalls, expectedApiCalls, errors }) {
  if (errors.length > 0) return { status: 'failed', summary: `前端执行出现 ${errors.length} 个错误，不能验收。` };
  const missingText = expectedText.filter((text) => !renderedText.includes(text));
  const missingCalls = expectedApiCalls.filter((name) => !hasExpectedApiCall(apiCalls, name));
  if (missingText.length || missingCalls.length) {
    return {
      status: 'needs-review',
      summary: `前端已渲染，但缺少预期文本或 API 调用：文本 ${missingText.join(', ') || '无'}；API ${missingCalls.join(', ') || '无'}。`
    };
  }
  return { status: 'usable', summary: '前端能读取 mock 数据库 API 并展示或更新预期表内容。' };
}

function parseInteraction(text) {
  if (typeof text === 'object' && text) return text;
  const value = String(text || '');
  const index = value.lastIndexOf(':');
  if (index <= 0) return { selector: value, type: 'click' };
  return { selector: value.slice(0, index), type: value.slice(index + 1) || 'click' };
}

function withReportScenarioSuffix(reportBase, scenarioName) {
  if (!reportBase) return undefined;
  return String(reportBase).replace(/\.(json|md|html)$/i, '') + `-${String(scenarioName || 'frontend').replace(/[\\/:*?"<>|\s]+/g, '-')}`;
}

function buildCliScenarios(options, projectRoot) {
  if (options.frontendFixture) {
    return loadFrontendFixture(path.resolve(ROOT, options.frontendFixture)).scenarios;
  }
  if (options.frontendFile) {
    return [normalizeScenario({
      name: path.basename(options.frontendFile, path.extname(options.frontendFile)),
      type: options.frontendScenario || 'custom',
      files: [options.frontendFile],
      expectText: options.expectText || [],
      expectApiCalls: defaultExpectApiCalls(options.frontendScenario || 'custom'),
      interactions: options.interactions
        ? options.interactions.map(parseInteraction)
        : defaultInteractions(options.frontendScenario || 'custom')
    })];
  }
  let scenarios = discoverFrontendScenarios(projectRoot);
  if (options.frontendScenario && options.frontendScenario !== 'all') {
    scenarios = scenarios.filter((scenario) => scenario.type === options.frontendScenario || scenario.name === options.frontendScenario);
  }
  if (options.expectText || options.interactions) {
    scenarios = scenarios.map((scenario) => ({
      ...scenario,
      expectText: options.expectText || scenario.expectText || [],
      interactions: options.interactions ? options.interactions.map(parseInteraction) : scenario.interactions || []
    }));
  }
  return scenarios;
}

function loadDefaultSeedTables(options) {
  try {
    const { template } = loadTemplate(options);
    return normalizeApiTableData(template);
  } catch (_error) {
    return {};
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function encodeEmbeddedJson(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

function loadPlotPreset(projectRoot) {
  const frontendDir = path.join(projectRoot, 'frontend');
  const candidates = ['剧情推进.json', 'plot-preset.json', 'preset.json'];
  for (const file of candidates) {
    const fullPath = path.join(frontendDir, file);
    if (fs.existsSync(fullPath)) {
      return { path: fullPath, data: readJson(fullPath) };
    }
  }
  return null;
}

function loadEmbeddedAssets(projectRoot, options = {}) {
  const assets = {
    templateBase64: '',
    templatePath: null,
    presetBase64: '',
    presetPath: null
  };
  try {
    const { templatePath, template } = loadTemplate({ ...options, project: projectRoot });
    assets.templateBase64 = encodeEmbeddedJson(template);
    assets.templatePath = templatePath;
  } catch (_error) {
    // Frontend preview can still run as a read-only status test without template embedding.
  }
  const preset = loadPlotPreset(projectRoot);
  if (preset) {
    assets.presetBase64 = encodeEmbeddedJson(preset.data);
    assets.presetPath = preset.path;
  }
  return assets;
}

function injectFrontendEmbeddedAssets(html, assets = {}) {
  let next = String(html || '');
  if (assets.templateBase64) next = next.split('{{TEMPLATE_BASE64}}').join(assets.templateBase64);
  if (assets.presetBase64) next = next.split('{{PRESET_BASE64}}').join(assets.presetBase64);
  return next;
}

function loadProjectWorldbookEntries(projectRoot) {
  const entryDirs = [
    path.join(projectRoot, 'entries'),
    path.join(projectRoot, 'unpacked', 'entries')
  ];
  const entries = [];
  const seen = new Set();
  for (const entriesDir of entryDirs) {
    if (!fs.existsSync(entriesDir)) continue;
    for (const file of fs.readdirSync(entriesDir).filter((item) => /\.ya?ml$/i.test(item)).sort()) {
      const fullPath = path.join(entriesDir, file);
      if (seen.has(fullPath)) continue;
      seen.add(fullPath);
      try {
        const data = yaml.load(fs.readFileSync(fullPath, 'utf8')) || {};
        entries.push({
          uid: data.id || data.uid || file,
          key: Array.isArray(data.keys) ? data.keys[0] : data.key,
          keys: Array.isArray(data.keys) ? data.keys : (data.key ? [data.key] : []),
          comment: data.comment || path.basename(file),
          content: data.content || data.entry || ''
        });
      } catch (_error) {
        // Ignore malformed worldbook entries in frontend preview setup; normal validation reports them separately.
      }
    }
  }
  return entries;
}

function loadMockSeedTables(mockDataPath) {
  if (!mockDataPath) return null;
  const fullPath = path.resolve(ROOT, mockDataPath);
  if (!fs.existsSync(fullPath)) throw new Error(`前端 mock 数据文件不存在: ${mockDataPath}`);
  const payload = readJson(fullPath);
  const seedTables = payload.seedTables || payload.tables || payload;
  if (!seedTables || typeof seedTables !== 'object' || Array.isArray(seedTables)) {
    throw new Error('前端 mock 数据必须是表名到二维数组的映射，或包含 seedTables/tables 字段');
  }
  return seedTables;
}

function normalizeChatMessages(payload) {
  const list = Array.isArray(payload) ? payload : (payload && (payload.messages || payload.chat || payload.data));
  if (!Array.isArray(list)) return null;
  return list.map((item, index) => {
    if (Object.prototype.hasOwnProperty.call(item || {}, 'mes') || Object.prototype.hasOwnProperty.call(item || {}, 'is_user')) {
      return {
        message_id: item.message_id == null ? index : item.message_id,
        name: item.name || (item.is_user ? '本地用户' : 'assistant'),
        is_user: !!item.is_user,
        mes: String(item.mes == null ? '' : item.mes)
      };
    }
    const role = String(item && item.role || 'assistant');
    return {
      message_id: !item || item.message_id == null ? index : item.message_id,
      name: item && item.name || (role === 'user' ? '本地用户' : role),
      is_user: role === 'user',
      mes: String(!item || item.content == null ? '' : item.content)
    };
  });
}

function loadFrontendChat(options, mockDataPath) {
  if (options.chat) return options.chat;
  if (options.chatFile) {
    const fullPath = path.resolve(ROOT, options.chatFile);
    if (!fs.existsSync(fullPath)) throw new Error(`前端聊天记录文件不存在: ${options.chatFile}`);
    return normalizeChatMessages(readJson(fullPath));
  }
  if (mockDataPath) {
    const payload = readJson(path.resolve(ROOT, mockDataPath));
    return normalizeChatMessages(payload.chat || payload.messages);
  }
  return null;
}

async function runFrontendCli(options = {}) {
  const projectRoot = resolveProject(options.project) || ROOT;
  const defaultSeedTables = loadDefaultSeedTables(options);
  const mockSeedTables = loadMockSeedTables(options.mockData);
  const frontendChat = loadFrontendChat(options, options.mockData);
  const scenarios = buildCliScenarios(options, projectRoot).map((scenario) => ({
    ...scenario,
    seedTables: mockSeedTables || (Object.keys(scenario.seedTables || {}).length > 0 ? scenario.seedTables : defaultSeedTables)
  }));
  if (scenarios.length === 0) throw new Error('没有找到可测试的 frontend HTML。请使用 --frontend-file 或 --frontend-fixture 指定。');
  const reports = [];
  for (const scenario of scenarios) {
    reports.push(await runShujukuFrontendScenario({
      ...options,
      projectRoot,
      scenario,
      chat: scenario.chat || frontendChat || options.chat || [],
      report: withReportScenarioSuffix(options.report, scenario.name)
    }));
  }
  return reports;
}

async function runShujukuFrontendScenario(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || resolveProject(options.project) || ROOT);
  const scenario = options.scenario;
  if (!scenario) throw new Error('缺少 frontend scenario');
  const characterBookEntries = loadProjectWorldbookEntries(projectRoot);
  const host = createMockSillyTavernHost({
    chat: options.chat || [],
    characters: [{
      name: path.basename(projectRoot),
      description: 'shujuku frontend local preview character',
      data: { character_book: { entries: characterBookEntries } },
      character_book: { entries: characterBookEntries }
    }]
  });
  const seeded = seedAutoCardUpdaterApi(host, scenario.seedTables || {});
  const errors = [];
  const frontendHtmlParts = [];
  const embeddedAssets = loadEmbeddedAssets(projectRoot, options);

  for (const file of scenario.files || []) {
    const fullPath = path.resolve(projectRoot, file);
    try {
      const html = injectFrontendEmbeddedAssets(fs.readFileSync(fullPath, 'utf8'), embeddedAssets);
      const previewHtml = inlineLocalScripts(html, fullPath);
      frontendHtmlParts.push(`<!-- ${file} -->\n${previewHtml}`);
      await runInlineScripts(host, html, fullPath);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  await runInteractions(host, scenario.interactions || [], errors);
  await flushFrontendTasks();
  const renderedText = collectText(host);
  const report = {
    generatedAt: new Date().toISOString(),
    scenario: scenario.name,
    scenarioType: scenario.type,
    files: scenario.files || [],
    frontendHtml: frontendHtmlParts.join('\n'),
    configuredInteractions: scenario.interactions || [],
    chat: options.chat || [],
    mockDataPath: options.mockData || null,
    characterBookEntries,
    renderedText,
    beforeTables: clone(scenario.seedTables || {}),
    afterTables: seeded.state,
    apiCalls: seeded.calls,
    embeddedAssets: {
      templatePath: embeddedAssets.templatePath,
      presetPath: embeddedAssets.presetPath,
      templateInjected: Boolean(embeddedAssets.templateBase64),
      presetInjected: Boolean(embeddedAssets.presetBase64)
    },
    errors
  };
  report.usability = assessFrontend({
    renderedText,
    expectedText: scenario.expectText || [],
    apiCalls: seeded.calls,
    expectedApiCalls: scenario.expectApiCalls || [],
    errors
  });
  report.reportPaths = writeFrontendReport(report, options.report);
  return report;
}

module.exports = {
  runShujukuFrontendScenario,
  seedAutoCardUpdaterApi,
  runInlineScripts,
  runInteractions,
  assessFrontend,
  resolveProject,
  parseInteraction,
  buildCliScenarios,
  loadMockSeedTables,
  runFrontendCli,
  injectFrontendEmbeddedAssets,
  inlineLocalScripts,
  loadEmbeddedAssets
};
