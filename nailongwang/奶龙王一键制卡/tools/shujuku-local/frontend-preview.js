'use strict';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    characterBookEntries: report.characterBookEntries || [],
    interactions: report.configuredInteractions || []
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>shujuku 前端本地预览 - ${escapeHtml(report.scenario)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #202124; background: #f6f8fa; }
    header { padding: 16px 20px; background: #fff; border-bottom: 1px solid #d0d7de; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0 0 10px; font-size: 15px; }
    main { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 12px; padding: 12px; }
    iframe { width: 100%; min-height: 680px; border: 1px solid #d0d7de; background: #fff; }
    aside { display: grid; gap: 12px; align-content: start; }
    section { background: #fff; border: 1px solid #d0d7de; padding: 12px; }
    pre { white-space: pre-wrap; overflow: auto; max-height: 260px; background: #f6f8fa; padding: 10px; margin: 0; }
    button { margin: 0 8px 8px 0; }
    .verdict { margin-top: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <h1>shujuku 前端本地预览</h1>
    <div>场景：${escapeHtml(report.scenario)} / ${escapeHtml(report.scenarioType)}</div>
    <div class="verdict">结论：${escapeHtml(report.usability && report.usability.summary)}</div>
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
    function normalizeTablesPayload(payload) {
      if (!payload || typeof payload !== 'object') return {};
      if (payload.seedTables || payload.tables) return normalizeTablesPayload(payload.seedTables || payload.tables);
      const tables = {};
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'mate') continue;
        if (Array.isArray(value)) tables[key] = value;
        else if (value && typeof value === 'object' && Array.isArray(value.content)) tables[value.name || key] = value.content;
      }
      return tables;
    }
    function replaceTables(nextTables) {
      for (const key of Object.keys(state.tables)) delete state.tables[key];
      Object.assign(state.tables, clone(nextTables || {}));
      renderDebug();
    }
    function makeApi() {
      function trace(name, args) { calls.push({ name, args: Array.from(args || []) }); renderDebug(); }
      return {
        exportTableAsJson() { trace('exportTableAsJson', arguments); return clone(state.tables); },
        getTableTemplate() { trace('getTableTemplate', arguments); return clone(state.tables); },
        importTemplateFromData(data, options) {
          trace('importTemplateFromData', arguments);
          const nextTables = normalizeTablesPayload(data);
          if (!options || options.merge !== true) replaceTables(nextTables);
          else { Object.assign(state.tables, clone(nextTables)); renderDebug(); }
          return { ok: true, importedTables: Object.keys(nextTables) };
        },
        initGameSession(config, options) {
          trace('initGameSession', arguments);
          const templateData = (options && options.templateData) || (config && config.templateData);
          const presetData = (options && options.presetData) || (config && config.presetData);
          const nextTables = normalizeTablesPayload(templateData);
          if (Object.keys(nextTables).length) {
            if (options && options.merge === true) { Object.assign(state.tables, clone(nextTables)); renderDebug(); }
            else replaceTables(nextTables);
          }
          return { ok: true, templateImported: Object.keys(nextTables).length > 0, presetImported: !!presetData, importedTables: Object.keys(nextTables) };
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
          if (!state.tables[table]) state.tables[table] = [['行号'].concat(Object.keys(rowData || {}))];
          const header = state.tables[table][0];
          state.tables[table].push(header.map((name, index) => index === 0 ? state.tables[table].length : ((rowData || {})[name] || '')));
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
      const bootstrap = '<script>window.AutoCardUpdaterAPI = parent.__makePreviewApi(); window.TavernHelper = { getChatMessages: async () => parent.shujukuFrontendPreviewState.chat, getLastMessageId: () => parent.shujukuFrontendPreviewState.chat.length - 1 }; window.SillyTavern = { chat: parent.shujukuFrontendPreviewState.chat, getContext: () => ({ chat: parent.shujukuFrontendPreviewState.chat, characterId: 0, characters: [{ name: "local-preview", data: { character_book: { entries: parent.shujukuFrontendPreviewState.characterBookEntries } }, character_book: { entries: parent.shujukuFrontendPreviewState.characterBookEntries } }] }) }; window.getContext = window.SillyTavern.getContext; window.toastr = { info(){}, success(){}, warning(){}, error(){} };<\\/script>';
      if (/<head[^>]*>/i.test(state.frontendHtml)) {
        return state.frontendHtml.replace(/<head[^>]*>/i, (match) => match + bootstrap);
      }
      return bootstrap + state.frontendHtml;
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
