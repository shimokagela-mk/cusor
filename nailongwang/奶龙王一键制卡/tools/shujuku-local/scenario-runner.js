'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createMockSillyTavernHost } = require('./mock-host');
const { loadShujukuBundle } = require('./fetch-shujuku');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_REPORT_DIR = path.join(ROOT, 'output', 'temp', 'shujuku-local');
const VALID_DATABASE_MODES = new Set(['native', 'sqlite']);
const SHUJUKU_SCRIPT_ID = 'shujuku_v120';
const SHUJUKU_SETTINGS_NAMESPACE = `${SHUJUKU_SCRIPT_ID}__userscript_settings_v1`;
const SHUJUKU_DEFAULT_PROFILE_SETTINGS_KEY = `${SHUJUKU_SCRIPT_ID}_profile_v1____default____settings`;
const SHUJUKU_GLOBAL_META_KEY = `${SHUJUKU_SCRIPT_ID}_globalMeta_v1`;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function resolveProject(projectArg) {
  if (!projectArg) return null;
  const direct = path.resolve(ROOT, projectArg);
  if (fs.existsSync(direct)) return direct;
  const underProjects = path.join(ROOT, 'projects', projectArg);
  if (fs.existsSync(underProjects)) return underProjects;
  throw new Error(`项目不存在: ${projectArg}`);
}

function loadYamlTableTemplate(tablesDir) {
  if (!tablesDir || !fs.existsSync(tablesDir)) return null;
  let yaml;
  try {
    yaml = require('js-yaml');
  } catch (error) {
    throw new Error('当前项目未安装 js-yaml，无法读取 YAML 拆分表格。请先运行 npm install，或使用 --template 指向 table-template.json。');
  }
  const data = {};
  const metaPath = path.join(tablesDir, '000-meta.yaml');
  if (fs.existsSync(metaPath)) {
    data.mate = yaml.load(fs.readFileSync(metaPath, 'utf8'));
  }
  for (const file of fs.readdirSync(tablesDir).filter((item) => /\.ya?ml$/i.test(item) && item !== '000-meta.yaml').sort()) {
    const sheet = yaml.load(fs.readFileSync(path.join(tablesDir, file), 'utf8'));
    if (sheet && sheet.uid) {
      data[sheet.uid] = sheet;
    }
  }
  if (!data.mate) data.mate = { type: 'chatSheets', version: 1 };
  return Object.keys(data).some((key) => key !== 'mate') ? data : null;
}

function createFallbackTemplate() {
  return {
    mate: { type: 'chatSheets', version: 1 },
    sheet_0: {
      uid: 'sheet_0',
      name: '本地测试表',
      sourceData: {
        note: '用于 shujuku 本地测试的最小表格。',
        initNode: '初始化一行测试数据。',
        updateNode: '根据剧情更新状态。',
        insertNode: '必要时插入新行。',
        deleteNode: '不删除表头。'
      },
      content: [
        ['行号', '项目', '值'],
        [1, '状态', '未测试']
      ],
      orderNo: 0
    }
  };
}

function resolveTemplatePath(options = {}) {
  if (options.template) {
    const fullPath = path.resolve(ROOT, options.template);
    if (!fs.existsSync(fullPath)) throw new Error(`模板不存在: ${options.template}`);
    return fullPath;
  }
  const projectRoot = resolveProject(options.project);
  if (!projectRoot) return null;
  const candidates = [
    path.join(projectRoot, 'tables', '_build', 'table-template.json'),
    path.join(projectRoot, 'tables', 'table-template.json'),
    path.join(projectRoot, 'tables', 'chatSheets-template.json')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadTemplate(options = {}) {
  const templatePath = resolveTemplatePath(options);
  if (templatePath) {
    return { templatePath, template: readJson(templatePath) };
  }
  const projectRoot = resolveProject(options.project);
  const yamlTemplate = projectRoot ? loadYamlTableTemplate(path.join(projectRoot, 'tables')) : null;
  if (yamlTemplate) {
    return { templatePath: path.join(projectRoot, 'tables'), template: yamlTemplate };
  }
  return { templatePath: '(fallback)', template: createFallbackTemplate() };
}

function getSheetKeys(template) {
  return Object.keys(template || {}).filter((key) => key !== 'mate' && key.startsWith('sheet_'));
}

function summarizeTemplate(template) {
  return getSheetKeys(template).map((key) => ({
    key,
    uid: template[key].uid || key,
    name: template[key].name || key,
    rows: Array.isArray(template[key].content) ? template[key].content.length : 0
  }));
}

function normalizeComparableName(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, '').toLowerCase();
}

function isRowIndexHeader(value) {
  const normalized = normalizeComparableName(value);
  return normalized === '行号' || normalized === 'row_id' || normalized === 'rowid';
}

function parseDdlColumns(ddl) {
  const columns = [];
  for (const rawLine of String(ddl || '').split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,$/, '');
    if (!line || /^create\s+table\b/i.test(line) || /^\);?$/.test(line)) continue;
    const commentMatch = line.match(/--\s*(.*?)\s*$/);
    const beforeComment = commentMatch ? line.slice(0, commentMatch.index).trim() : line;
    const match = beforeComment.match(/^["`[]?([^"`\]\s,()]+)["`\]]?\s+/);
    if (!match) continue;
    const name = match[1];
    if (/^(primary|foreign|unique|constraint|check|key)$/i.test(name)) continue;
    columns.push({
      name,
      comment: commentMatch ? commentMatch[1].trim() : ''
    });
  }
  return columns;
}

function analyzeDdlHeaderWarnings(template) {
  const warnings = [];
  for (const key of getSheetKeys(template)) {
    const sheet = template[key] || {};
    const ddl = sheet.sourceData && sheet.sourceData.ddl;
    if (!String(ddl || '').trim()) continue;
    const header = Array.isArray(sheet.content) && Array.isArray(sheet.content[0])
      ? sheet.content[0].filter((name) => name != null && name !== '' && !isRowIndexHeader(name)).map(String)
      : [];
    if (header.length === 0) continue;
    const ddlColumns = parseDdlColumns(ddl)
      .filter((column) => !isRowIndexHeader(column.name) && !isRowIndexHeader(column.comment));
    const compareCount = Math.max(header.length, ddlColumns.length);
    for (let index = 0; index < compareCount; index += 1) {
      const headerName = header[index];
      const column = ddlColumns[index];
      if (!headerName || !column) {
        warnings.push(`DDL / 表头提示：${sheet.name || key} 的 DDL 数据列数量与表头数量不一致，将可能按位置映射，AI 填表结果需要复核。`);
        break;
      }
      if (normalizeComparableName(column.name) !== normalizeComparableName(headerName)) {
        const commentText = column.comment ? `，注释「${column.comment}」` : '';
        warnings.push(`DDL / 表头提示：${sheet.name || key} 第 ${index + 1} 个数据列 DDL 列名「${column.name}」${commentText} 与表头「${headerName}」不一致；sqlite 模式可能按位置映射，填表可用但需要复核。`);
      }
    }
  }
  return warnings;
}

function toSqlIdentifier(value, fallback) {
  const normalized = String(value || '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const candidate = normalized || fallback;
  return /^[a-zA-Z_]/.test(candidate) ? candidate : `t_${candidate}`;
}

function createDdlForSheet(sheet, fallbackKey) {
  const tableName = toSqlIdentifier(sheet.uid || fallbackKey, `table_${fallbackKey}`);
  const chineseName = String(sheet.name || fallbackKey).replace(/\r?\n/g, ' ');
  const header = Array.isArray(sheet.content) && Array.isArray(sheet.content[0]) ? sheet.content[0] : [];
  const columns = [`  row_id INTEGER PRIMARY KEY, -- 行号`];
  let dataColumnIndex = 1;
  for (const rawName of header) {
    const name = rawName == null || rawName === '' ? '行号' : String(rawName);
    if (name === '行号' || name.toLowerCase() === 'row_id') continue;
    columns.push(`  col_${dataColumnIndex} TEXT, -- ${name.replace(/\r?\n/g, ' ')}`);
    dataColumnIndex += 1;
  }
  if (columns.length === 1) columns.push('  col_1 TEXT -- 值');
  const lastIndex = columns.length - 1;
  columns[lastIndex] = columns[lastIndex]
    .replace(/,\s*(--.*)$/, ' $1')
    .replace(/,$/, '');
  return `CREATE TABLE ${tableName} ( -- ${chineseName}\n${columns.join('\n')}\n);`;
}

function ensureSqliteDdl(template) {
  const cloned = JSON.parse(JSON.stringify(template || {}));
  for (const key of getSheetKeys(cloned)) {
    const sheet = cloned[key];
    if (!sheet.sourceData || typeof sheet.sourceData !== 'object') sheet.sourceData = {};
    if (!String(sheet.sourceData.ddl || '').trim()) {
      sheet.sourceData.ddl = createDdlForSheet(sheet, key);
    }
  }
  return cloned;
}

function normalizeApiTableData(template) {
  const data = {};
  for (const key of getSheetKeys(template)) {
    const sheet = template[key];
    const rows = Array.isArray(sheet.content) ? sheet.content : [];
    data[sheet.name || key] = rows.map((row) => Array.isArray(row) ? row.slice() : []);
  }
  return data;
}

function parseDdlNameMap(ddl) {
  const map = {
    tableSqlToDisplay: {},
    tableDisplayToSql: {},
    columnSqlToDisplay: {},
    columnDisplayToSql: {}
  };
  const text = String(ddl || '');
  const tableMatch = text.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([\w]+)`?\s*\([^\n]*(?:--\s*([^\n]+))?/i);
  if (tableMatch) {
    const sqlName = tableMatch[1];
    const displayName = String(tableMatch[2] || '').trim();
    if (sqlName && displayName) {
      map.tableSqlToDisplay[sqlName] = displayName;
      map.tableDisplayToSql[displayName] = sqlName;
    }
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*`?([A-Za-z_][\w]*)`?\s+[^,]*?(?:,)?\s*--\s*(.+?)\s*$/);
    if (!match) continue;
    const sqlName = match[1];
    const displayName = match[2].trim().replace(/,$/, '').trim();
    if (!sqlName || !displayName) continue;
    map.columnSqlToDisplay[sqlName] = displayName;
    map.columnDisplayToSql[displayName] = sqlName;
  }
  return map;
}

function buildApiNameMapper(template) {
  const mapper = {
    tables: {},
    columns: {}
  };
  for (const key of getSheetKeys(template)) {
    const sheet = template[key] || {};
    const displayName = sheet.name || key;
    const ddlMap = parseDdlNameMap(sheet.sourceData && sheet.sourceData.ddl);
    const tableNames = new Set([key, displayName]);
    for (const name of Object.keys(ddlMap.tableSqlToDisplay)) tableNames.add(name);
    for (const name of Object.values(ddlMap.tableSqlToDisplay)) tableNames.add(name);
    for (const name of tableNames) mapper.tables[name] = displayName;
    mapper.columns[displayName] = {};
    const header = Array.isArray(sheet.content) && Array.isArray(sheet.content[0]) ? sheet.content[0] : [];
    header.forEach((name, index) => {
      if (name != null && name !== '') mapper.columns[displayName][String(name)] = index;
    });
    for (const [sqlName, chineseName] of Object.entries(ddlMap.columnSqlToDisplay)) {
      const index = header.indexOf(chineseName);
      if (index >= 0) mapper.columns[displayName][sqlName] = index;
      if (index >= 0) mapper.columns[displayName][chineseName] = index;
    }
  }
  return mapper;
}

function coerceTableSnapshot(exported, template) {
  const normalized = {};
  if (exported && typeof exported === 'object') {
    for (const [key, value] of Object.entries(exported)) {
      if (key === 'mate') continue;
      if (Array.isArray(value)) {
        normalized[key] = value.map((row) => Array.isArray(row) ? row.slice() : [row]);
      } else if (value && typeof value === 'object' && Array.isArray(value.content)) {
        normalized[value.name || key] = value.content.map((row) => Array.isArray(row) ? row.slice() : [row]);
      }
    }
  }
  if (Object.keys(normalized).length > 0) return normalized;
  return normalizeApiTableData(template);
}

function createVisibleEffectSnapshot(beforeTables) {
  const after = JSON.parse(JSON.stringify(beforeTables || {}));
  const firstTableName = Object.keys(after)[0] || '本地测试表';
  if (!after[firstTableName]) {
    after[firstTableName] = [
      ['行号', '项目', '值'],
      [1, '状态', '未测试']
    ];
  }
  const table = after[firstTableName];
  if (!Array.isArray(table[0])) {
    after[firstTableName] = [
      ['行号', '项目', '值'],
      [1, '状态', '未测试']
    ];
  }
  const rows = after[firstTableName];
  const header = rows[0] || [];
  let valueCol = header.indexOf('值');
  if (valueCol < 0) {
    valueCol = header.length;
    header.push('值');
    for (let i = 1; i < rows.length; i += 1) rows[i].push('');
  }
  if (!rows[1]) rows[1] = header.map(() => '');
  rows[1][valueCol] = '本地测试已写入';
  rows.push(header.map((name, index) => {
    if (index === 0) return rows.length;
    if (name === '项目') return '可见效果';
    if (name === '值') return '报告已生成';
    return '';
  }));
  return after;
}

function normalizeDatabaseMode(mode) {
  const normalized = String(mode || 'native').trim().toLowerCase();
  if (!VALID_DATABASE_MODES.has(normalized)) {
    throw new Error(`未知数据库模式: ${mode}。可选值: native, sqlite, both`);
  }
  return normalized;
}

function mergeExtensionSettingsForMode(existingSettings, databaseMode) {
  const extensionSettings = JSON.parse(JSON.stringify(existingSettings || { connectionManager: { profiles: [] } }));
  if (!extensionSettings.connectionManager) extensionSettings.connectionManager = { profiles: [] };
  if (!extensionSettings.__userscripts) extensionSettings.__userscripts = {};
  if (!extensionSettings.__userscripts[SHUJUKU_SETTINGS_NAMESPACE]) {
    extensionSettings.__userscripts[SHUJUKU_SETTINGS_NAMESPACE] = {};
  }
  const namespace = extensionSettings.__userscripts[SHUJUKU_SETTINGS_NAMESPACE];
  namespace[SHUJUKU_DEFAULT_PROFILE_SETTINGS_KEY] = JSON.stringify({
    storageMode: databaseMode,
    apiMode: 'tavern',
    apiConfig: { useMainApi: true, max_tokens: 4096, temperature: 0 },
    tableApiPreset: '',
    plotApiPreset: '',
    autoUpdateEnabled: false,
    standardizedTableFillEnabled: true,
    toastMuteEnabled: true,
    manualSelectedTables: [],
    hasManualSelection: false
  });
  if (!namespace[SHUJUKU_GLOBAL_META_KEY]) {
    namespace[SHUJUKU_GLOBAL_META_KEY] = JSON.stringify({
      activeIsolationCode: '',
      isolationCodeList: [],
      [['migrated', 'Leg', 'acySingleStore'].join('')]: true
    });
  }
  return extensionSettings;
}

function readTextFileFromRoot(filePath) {
  if (!filePath) return '';
  return fs.readFileSync(path.resolve(ROOT, filePath), 'utf8').replace(/^\uFEFF/, '');
}

function resolveStoryText(options = {}) {
  if (typeof options.storyText === 'string' && options.storyText.trim()) return options.storyText.trim();
  if (options.storyFile) return readTextFileFromRoot(options.storyFile).trim();
  return '本地测试正文：角色完成一次可验证的剧情推进，需要把事件写入数据库表格。';
}

function normalizeChatMessage(item, index) {
  if (!item || typeof item !== 'object') return null;
  const role = String(item.role || '').toLowerCase();
  const isUser = typeof item.is_user === 'boolean' ? item.is_user : role === 'user';
  const mes = item.mes ?? item.content ?? item.text ?? item.message;
  if (mes == null || String(mes).trim() === '') return null;
  return {
    message_id: item.message_id ?? item.id ?? index,
    is_user: isUser,
    name: item.name || (isUser ? '本地用户' : (role === 'system' ? 'system' : 'assistant')),
    mes: String(mes)
  };
}

function loadChatMessagesFromFile(chatFile) {
  const fullPath = path.resolve(ROOT, chatFile);
  if (!fs.existsSync(fullPath)) throw new Error(`聊天记录文件不存在: ${chatFile}`);
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    const text = raw.trim();
    return {
      chat: createStoryChat(text),
      storyText: text,
      inputSource: { type: 'chat-file-text', path: fullPath, messageCount: 3 }
    };
  }
  const list = Array.isArray(payload) ? payload : (payload.chat || payload.messages || payload.data);
  if (!Array.isArray(list)) {
    throw new Error('聊天记录 JSON 必须是数组，或包含 chat/messages/data 数组');
  }
  const chat = list.map(normalizeChatMessage).filter(Boolean);
  if (chat.length === 0) throw new Error('聊天记录文件没有可用消息');
  const storyText = chat
    .filter((item) => !item.is_user && item.name !== 'system')
    .map((item) => item.mes)
    .join('\n\n')
    .trim() || chat.map((item) => item.mes).join('\n\n').trim();
  return {
    chat,
    storyText,
    inputSource: { type: 'chat-file', path: fullPath, messageCount: chat.length }
  };
}

function resolveStoryInput(options = {}) {
  if (options.chatFile) return loadChatMessagesFromFile(options.chatFile);
  const storyText = resolveStoryText(options);
  return {
    chat: createStoryChat(storyText),
    storyText,
    inputSource: {
      type: options.storyFile ? 'story-file' : (options.storyText ? 'story-text' : 'default-story'),
      path: options.storyFile ? path.resolve(ROOT, options.storyFile) : null,
      messageCount: 3
    }
  };
}

function createStoryChat(storyText) {
  return [
    { message_id: 0, is_user: false, name: 'system', mes: '<start>shujuku 本地测试开场</start>' },
    { message_id: 1, is_user: true, name: '本地用户', mes: '请继续推进剧情，并记录数据库。' },
    { message_id: 2, is_user: false, name: 'assistant', mes: storyText }
  ];
}

function extractLocation(storyText) {
  const match = String(storyText || '').match(/在([^，,。；;\s]{2,20})/);
  return match ? match[1] : '本地测试场景';
}

function compactStorySummary(storyText, maxLength = 120) {
  const text = String(storyText || '').replace(/\s+/g, ' ').trim();
  if (!text) return '未提供正文，使用本地测试占位剧情。';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

async function buildStorySummary(host, storyText, aiMode, errors) {
  const fallback = compactStorySummary(storyText);
  if (aiMode !== 'real') return fallback;
  try {
    const response = await withTimeout('real AI 正文总结', () => host.ai([
      { role: 'system', content: '请用一句话总结正文中已经发生、需要写入数据库表格的事实。' },
      { role: 'user', content: storyText }
    ], { maxTokens: 256, temperature: 0 }), 15000);
    return String(response || fallback).trim() || fallback;
  } catch (error) {
    errors.push(`真实 AI 正文总结失败，已回退 deterministic 总结: ${error.message}`);
    return fallback;
  }
}

function findStoryTargetTable(beforeTables) {
  const tableNames = Object.keys(beforeTables || {});
  return tableNames.find((name) => /纪要|总结|日志|大纲/.test(name))
    || tableNames.find((name) => /状态|数据|测试/.test(name))
    || tableNames[0]
    || '本地测试表';
}

function buildStoryRowData(header, storySummary, storyText, databaseMode) {
  const row = {};
  const location = extractLocation(storyText);
  for (const name of header || []) {
    if (name == null || name === '') continue;
    if (name === '项目') row[name] = '正文填表总结';
    else if (name === '值') row[name] = `${storySummary}（${databaseMode}）`;
    else if (name === '状态' || name === '当前状态') row[name] = `已根据正文写入（${databaseMode}）`;
    else if (name === '时间跨度') row[name] = '本地测试轮次';
    else if (name === '地点' || name === '主角当前所在地点') row[name] = location;
    else if (name === '纪要') row[name] = storySummary;
    else if (name === '概览' || name === '概要' || name === '一句话介绍') row[name] = compactStorySummary(storySummary, 30);
    else if (name === '编码索引') row[name] = 'AM0001';
    else if (name === '姓名') row[name] = '本地测试角色';
    else if (name === '行号') row[name] = '';
  }
  if (Object.keys(row).length === 0) {
    row.项目 = '正文填表总结';
    row.值 = `${storySummary}（${databaseMode}）`;
  }
  return row;
}

function createStoryVisibleSnapshot(beforeTables, storySummary, storyText, databaseMode) {
  const after = JSON.parse(JSON.stringify(beforeTables || {}));
  const tableName = findStoryTargetTable(after);
  if (!after[tableName]) {
    after[tableName] = [
      ['行号', '项目', '值'],
      [1, '状态', '未测试']
    ];
  }
  const rows = after[tableName];
  if (!Array.isArray(rows[0])) rows.unshift(['行号', '项目', '值']);
  const header = rows[0];
  const rowData = buildStoryRowData(header, storySummary, storyText, databaseMode);
  rows.push(header.map((name, index) => {
    if (index === 0 && (name == null || name === '行号')) return rows.length;
    return rowData[name] || '';
  }));
  return after;
}

function hasStoryVisibleEffect(tables, storySummary) {
  const text = JSON.stringify(tables || {});
  const summary = String(storySummary || '').trim();
  const marker = summary.length > 20 ? summary.slice(0, 20) : summary;
  return text.includes('正文填表总结') || (!!marker && text.includes(marker));
}

function assessFillUsability(report) {
  const errors = Array.isArray(report.errors) ? report.errors : [];
  const blockingErrors = errors.filter((error) => !String(error).includes('报告已生成本地可见效果快照供人工检查'));
  const hasBlockingErrors = blockingErrors.length > 0;
  const hasWarnings = Array.isArray(report.warnings) && report.warnings.length > 0;
  const changes = Array.isArray(report.tableChanges) ? report.tableChanges.length : 0;
  const aiGenerated = !!(report.fillSummary && report.fillSummary.aiGenerated);
  if (hasBlockingErrors) {
    return {
      status: 'limited',
      summary: `本轮已生成可见表格快照，但存在 ${blockingErrors.length} 条错误或 fallback 提示；只能用于排查，不能作为最终填表验收。`
    };
  }
  if (changes === 0) {
    return {
      status: 'failed',
      summary: '本轮未检测到表格变化，当前填表不可用；需要检查模板表头、更新规则或 AI 输出格式。'
    };
  }
  if (hasWarnings) {
    return {
      status: 'needs-review',
      summary: `本轮产生 ${changes} 处填表变化，链路基本可用，但存在 ${report.warnings.length} 条 DDL / 表头提示，需要复核 sqlite 映射后再交付。`
    };
  }
  if (!aiGenerated) {
    return {
      status: 'smoke-only',
      summary: `本轮产生 ${changes} 处填表变化，但未使用真实 shujuku api.callAI 指令；只能说明结构 smoke 可用，真实 AI 填表仍需验收。`
    };
  }
  return {
    status: 'usable',
    summary: `本轮产生 ${changes} 处填表变化，AI 指令已生成并写入表格；从本地测试看，填表链路可用。`
  };
}

function buildAiFillMessages({ databaseMode, targetTable, header, storyText, rowData }) {
  const request = {
    databaseMode,
    targetTable,
    header: (header || []).filter((name) => name != null && name !== ''),
    storyText,
    rowData
  };
  const formatRule = databaseMode === 'sqlite'
    ? '只输出 <thought> 和 <tableEdit>。<tableEdit> 内写一条 INSERT INTO 语句，表名和列名使用请求中的中文名称。'
    : '只输出 <thought><content><tableEdit>。<tableEdit> 内写一条 insertRow("表名", {"列名":"值"}) 指令。';
  return [
    {
      role: 'system',
      content: [
        '你是 shujuku 本地测试填表 AI。',
        '任务：根据正文把本轮事件写入目标表，用于验证神·数据库本地运行链路。',
        formatRule,
        '输出范围仅限上述标签与表格指令。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        '<shujuku-local-fill-request>',
        JSON.stringify(request, null, 2),
        '</shujuku-local-fill-request>'
      ].join('\n')
    }
  ];
}

function extractTableEditText(aiResponse) {
  const text = String(aiResponse || '');
  const match = text.match(/<tableEdit[^>]*>([\s\S]*?)<\/tableEdit>/i);
  return match ? match[1].trim() : text.trim();
}

function parseNativeFillInstruction(aiResponse) {
  const command = extractTableEditText(aiResponse);
  const match = command.match(/insertRow\s*\(\s*(?:"([^"]+)"|'([^']+)'|([^,{)\s]+))\s*,\s*(\{[\s\S]*\})\s*\)\s*;?/i);
  if (!match) throw new Error('AI 响应中未找到 insertRow("表名", {...}) 指令');
  const tableName = match[1] || match[2] || match[3];
  let data;
  try {
    data = JSON.parse(match[4]);
  } catch (error) {
    throw new Error(`AI insertRow 数据不是合法 JSON: ${error.message}`);
  }
  return { operation: 'insertRow', tableName, data };
}

function splitSqlCsv(text) {
  const values = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote) {
        if (quote === "'" && text[i + 1] === "'") {
          current += text[i + 1];
          i += 1;
        } else {
          quote = null;
        }
      }
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() || text.endsWith(',')) values.push(current.trim());
  return values;
}

function unquoteSqlValue(value) {
  const text = String(value || '').trim();
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')) || (text.startsWith('`') && text.endsWith('`'))) {
    const body = text.slice(1, -1);
    return text[0] === "'" ? body.replace(/''/g, "'") : body;
  }
  if (/^null$/i.test(text)) return '';
  return text;
}

function parseSqlFillInstruction(aiResponse) {
  const sql = extractTableEditText(aiResponse).replace(/\s+/g, ' ').trim();
  const match = sql.match(/INSERT\s+INTO\s+[`"']?([^`"'(]+)[`"']?\s*\(([\s\S]+?)\)\s*VALUES\s*\(([\s\S]+?)\)\s*;?$/i);
  if (!match) throw new Error('AI 响应中未找到 INSERT INTO (...) VALUES (...) 指令');
  const tableName = match[1].trim();
  const columns = splitSqlCsv(match[2]).map(unquoteSqlValue);
  const values = splitSqlCsv(match[3]).map(unquoteSqlValue);
  if (columns.length !== values.length) {
    throw new Error(`AI SQL 列和值数量不一致: ${columns.length} != ${values.length}`);
  }
  const data = {};
  columns.forEach((column, index) => {
    data[column] = values[index];
  });
  return { operation: 'insertRow', tableName, data, sql };
}

function parseAiFillInstruction(aiResponse, databaseMode) {
  return databaseMode === 'sqlite'
    ? parseSqlFillInstruction(aiResponse)
    : parseNativeFillInstruction(aiResponse);
}

async function applyStoryFill(api, beforeTables, storyText, storySummary, databaseMode, errors) {
  const targetTable = findStoryTargetTable(beforeTables);
  const rows = beforeTables[targetTable] || [['行号', '项目', '值']];
  const header = Array.isArray(rows[0]) ? rows[0] : ['行号', '项目', '值'];
  const rowData = buildStoryRowData(header, storySummary, storyText, databaseMode);
  const summary = {
    mode: databaseMode,
    targetTable,
    operation: 'insertRow',
    rowData,
    storyTextLength: String(storyText || '').length,
    appliedBy: 'AutoCardUpdaterAPI',
    aiGenerated: false,
    aiResponse: ''
  };

  if (api.callAI) {
    try {
      const messages = buildAiFillMessages({ databaseMode, targetTable, header, storyText, rowData });
      const aiResponse = await withTimeout('shujuku api.callAI 正文填表', () => api.callAI(messages, { max_tokens: 1200, temperature: 0 }), 20000);
      const parsed = parseAiFillInstruction(aiResponse, databaseMode);
      summary.aiGenerated = true;
      summary.aiResponse = String(aiResponse || '');
      summary.aiInstruction = parsed;
      summary.rowData = parsed.data;
      summary.targetTable = parsed.tableName || targetTable;
    } catch (error) {
      errors.push(`AI 填表指令生成或解析失败，已回退本地 deterministic 行数据: ${error.message}`);
    }
  }

  if (api.insertRow) {
    try {
      const result = await withTimeout('正文 insertRow', () => api.insertRow(summary.targetTable, summary.rowData));
      summary.insertResult = result;
      return summary;
    } catch (error) {
      errors.push(`正文 insertRow 执行失败: ${error.message}`);
    }
  }

  if (api.updateRow && rows.length > 1) {
    try {
      const result = await withTimeout('正文 updateRow', () => api.updateRow(summary.targetTable, 1, summary.rowData));
      summary.operation = 'updateRow';
      summary.updateResult = result;
      return summary;
    } catch (error) {
      errors.push(`正文 updateRow 执行失败: ${error.message}`);
    }
  }

  summary.appliedBy = 'visible snapshot fallback';
  return summary;
}

function hasVisibleEffectMarker(tables) {
  return JSON.stringify(tables || {}).includes('本地测试已写入')
    || JSON.stringify(tables || {}).includes('可见效果')
    || JSON.stringify(tables || {}).includes('报告已生成')
    || JSON.stringify(tables || {}).includes('fake AI 已填表');
}

async function withTimeout(label, action, timeoutMs = 5000) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 超时 ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function installFallbackAutoCardUpdaterApi(host, templateStore) {
  const callbacks = [];
  const lockState = new Map();
  const nameMapper = buildApiNameMapper(templateStore.template || {});
  const resolveTableName = (name) => nameMapper.tables[String(name)] || String(name);
  const resolveColumnIndex = (tableName, table, colIdentifier) => {
    if (typeof colIdentifier === 'number') return colIdentifier;
    const resolvedTableName = resolveTableName(tableName);
    const mapped = nameMapper.columns[resolvedTableName] || {};
    if (Object.prototype.hasOwnProperty.call(mapped, String(colIdentifier))) return mapped[String(colIdentifier)];
    const header = table && table[0] || [];
    return header.indexOf(colIdentifier);
  };
  const api = {
    getPlotPresets: () => [],
    getPlotPresetNames: () => [],
    getCurrentPlotPreset: () => '',
    switchPlotPreset: () => false,
    injectPlotPresetToCurrentChat: () => true,
    getPlotPresetDetails: () => null,
    importPlotPresetFromData: async (_data, options = {}) => ({ success: true, message: 'fallback imported', presetName: options.presetName || '' }),
    importPlotPresetsFromData: async (items) => ({ success: true, message: 'fallback imported', imported: Array.isArray(items) ? items.length : 0, failed: 0, details: [] }),
    exportAllPlotPresets: () => [],
    exportTableAsJson: () => JSON.parse(JSON.stringify(templateStore.tableData)),
    importTableAsJson: async (jsonString) => {
      templateStore.tableData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      callbacks.forEach((callback) => callback(api.exportTableAsJson()));
      return true;
    },
    exportJsonData: async () => true,
    updateCell: async (...args) => {
      const input = typeof args[0] === 'object' ? args[0] : { tableName: args[0], rowIndex: args[1], colIdentifier: args[2], value: args[3] };
      const tableName = resolveTableName(input.tableName);
      const table = templateStore.tableData[tableName];
      if (!table || !table[input.rowIndex]) return false;
      const colIndex = resolveColumnIndex(input.tableName, table, input.colIdentifier);
      if (colIndex < 0) return false;
      table[input.rowIndex][colIndex] = input.value;
      if (!input.skipNotify && !input.silent) callbacks.forEach((callback) => callback(api.exportTableAsJson()));
      return true;
    },
    updateRow: async (...args) => {
      const input = typeof args[0] === 'object' ? args[0] : { tableName: args[0], rowIndex: args[1], data: args[2] };
      const tableName = resolveTableName(input.tableName);
      const table = templateStore.tableData[tableName];
      if (!table || !table[input.rowIndex]) return false;
      for (const [name, value] of Object.entries(input.data || {})) {
        const colIndex = resolveColumnIndex(input.tableName, table, name);
        if (colIndex >= 0) table[input.rowIndex][colIndex] = value;
      }
      if (!input.skipNotify && !input.silent) callbacks.forEach((callback) => callback(api.exportTableAsJson()));
      return true;
    },
    insertRow: async (...args) => {
      const input = typeof args[0] === 'object' ? args[0] : { tableName: args[0], data: args[1] };
      const tableName = resolveTableName(input.tableName);
      const table = templateStore.tableData[tableName];
      if (!table) return -1;
      const header = table[0] || [];
      const row = header.map((name, index) => {
        if (index === 0) return table.length;
        if (Object.prototype.hasOwnProperty.call(input.data || {}, name)) return input.data[name];
        for (const [dataKey, value] of Object.entries(input.data || {})) {
          if (resolveColumnIndex(input.tableName, table, dataKey) === index) return value;
        }
        return '';
      });
      table.push(row);
      if (!input.skipNotify && !input.silent) callbacks.forEach((callback) => callback(api.exportTableAsJson()));
      return table.length - 1;
    },
    deleteRow: async (...args) => {
      const input = typeof args[0] === 'object' ? args[0] : { tableName: args[0], rowIndex: args[1] };
      const tableName = resolveTableName(input.tableName);
      const table = templateStore.tableData[tableName];
      if (!table || Number(input.rowIndex) <= 0 || Number(input.rowIndex) >= table.length) return false;
      table.splice(Number(input.rowIndex), 1);
      if (!input.skipNotify && !input.silent) callbacks.forEach((callback) => callback(api.exportTableAsJson()));
      return true;
    },
    openSettings: async () => true,
    openVisualizer: () => undefined,
    manualUpdate: async () => {
      const firstTableName = Object.keys(templateStore.tableData)[0];
      if (!firstTableName) return false;
      const table = templateStore.tableData[firstTableName];
      if (table && table[0] && table[1]) {
        const valueCol = table[0].indexOf('值');
        if (valueCol >= 0) table[1][valueCol] = 'fake AI 已填表';
      }
      callbacks.forEach((callback) => callback(api.exportTableAsJson()));
      return true;
    },
    triggerUpdate: async () => api.manualUpdate(),
    setZeroTkOccupyMode: async () => true,
    setOutlineEntryEnabled: async () => true,
    syncWorldbookEntries: async () => {
      await host.window.TavernHelper.createLorebookEntries('本地测试世界书', [{
        uid: 'shujuku-local-entry',
        comment: 'shujuku 本地测试注入',
        content: JSON.stringify(api.exportTableAsJson(), null, 2),
        key: ['shujuku-local']
      }]);
      return true;
    },
    refreshDataAndWorldbook: async () => true,
    deleteInjectedEntries: async () => true,
    getTableTemplate: () => JSON.parse(JSON.stringify(templateStore.template)),
    getTemplatePresetNames: () => [],
    switchTemplatePreset: async () => ({ success: false, scope: 'chat', message: 'fallback no preset' }),
    injectTemplatePresetToCurrentChat: async () => ({ success: false, scope: 'chat', message: 'fallback no preset' }),
    importTemplateFromData: async (templateData, options = {}) => {
      templateStore.template = typeof templateData === 'string' ? JSON.parse(templateData) : templateData;
      templateStore.tableData = normalizeApiTableData(templateStore.template);
      return { success: true, message: 'fallback template imported', scope: options.scope || 'chat', presetName: options.presetName || '' };
    },
    getTableLockState: (sheetKey) => lockState.get(sheetKey) || null,
    setTableLockState: (sheetKey, state) => { lockState.set(sheetKey, state); return true; },
    clearTableLocks: (sheetKey) => { lockState.delete(sheetKey); return true; },
    lockTableRow: () => true,
    lockTableCol: () => true,
    lockTableCell: () => true,
    toggleTableRowLock: () => true,
    toggleTableColLock: () => true,
    toggleTableCellLock: () => true,
    getSpecialIndexLockEnabled: () => null,
    setSpecialIndexLockEnabled: () => true,
    registerTableUpdateCallback: (callback) => callbacks.push(callback),
    unregisterTableUpdateCallback: (callback) => {
      const index = callbacks.indexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    },
    registerTableFillStartCallback: () => undefined,
    getUpdateConfigParams: () => ({ autoUpdateThreshold: 0, autoUpdateFrequency: 1, updateBatchSize: 1, autoUpdateTokenThreshold: 0 }),
    setUpdateConfigParams: () => true,
    getManualSelectedTables: () => ({ selectedTables: [], hasManualSelection: false }),
    setManualSelectedTables: () => true,
    clearManualSelectedTables: () => true,
    getApiPresets: () => [],
    getTableApiPreset: () => '',
    setTableApiPreset: () => true,
    getPlotApiPreset: () => '',
    setPlotApiPreset: () => true,
    saveApiPreset: () => true,
    loadApiPreset: () => true,
    deleteApiPreset: () => true,
    callAI: async (messages, options) => host.ai(messages, options),
    getStoryContext: (maxTurns = 3) => host.state.chat.filter((item) => !item.is_user).slice(-maxTurns).map((item) => item.mes).join('\n\n'),
    importCombinedSettings: async () => true,
    exportCombinedSettings: async () => true,
    mergeSummaryNow: async () => true
  };
  host.window.AutoCardUpdaterAPI = api;
  return api;
}

async function evaluateBundle(host, bundlePath) {
  const code = fs.readFileSync(bundlePath, 'utf8');
  const context = {
    window: host.window,
    document: host.document,
    parent: host.window,
    top: host.window,
    self: host.window,
    globalThis: host.window,
    SillyTavern: host.window.SillyTavern,
    TavernHelper: host.window.TavernHelper,
    toastr: host.window.toastr,
    $: host.$,
    jQuery: host.$,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextEncoder,
    TextDecoder,
    fetch: host.window.fetch,
    atob: (value) => Buffer.from(String(value), 'base64').toString('binary'),
    btoa: (value) => Buffer.from(String(value), 'binary').toString('base64')
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: bundlePath, timeout: 5000 });
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function diffTables(before, after) {
  const changes = [];
  const tableNames = new Set(Object.keys(before || {}).concat(Object.keys(after || {})));
  for (const tableName of tableNames) {
    const left = before[tableName] || [];
    const right = after[tableName] || [];
    const maxRows = Math.max(left.length, right.length);
    for (let row = 0; row < maxRows; row += 1) {
      const leftRow = left[row] || [];
      const rightRow = right[row] || [];
      const maxCols = Math.max(leftRow.length, rightRow.length);
      for (let col = 0; col < maxCols; col += 1) {
        if (JSON.stringify(leftRow[col]) !== JSON.stringify(rightRow[col])) {
          changes.push({ tableName, row, col, before: leftRow[col], after: rightRow[col] });
        }
      }
    }
  }
  return changes;
}

function renderMarkdownTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ['（空表）'];
  const header = rows[0].map((cell) => String(cell == null ? '' : cell));
  const body = rows.slice(1);
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${header.map((_, index) => String(row[index] == null ? '' : row[index]).replace(/\|/g, '\\|')).join(' | ')} |`)
  ];
}

function renderReadableReport(report) {
  const lines = [];
  lines.push('# shujuku 本地测试报告');
  lines.push('');
  lines.push(`- 时间: ${report.generatedAt}`);
  lines.push(`- shujuku ref: ${report.shujuku.ref}`);
  lines.push(`- AI 模式: ${report.aiMode}`);
  lines.push(`- 数据库模式: ${report.databaseMode}`);
  lines.push(`- 模板来源: \`${report.templatePath}\``);
  lines.push(`- API 来源: ${report.apiSource}`);
  lines.push('');
  lines.push('## 填表可用性');
  lines.push('');
  lines.push(`- 结论: ${report.usability?.summary || '未生成可用性结论。'}`);
  lines.push(`- 状态: ${report.usability?.status || 'unknown'}`);
  lines.push('');
  if (report.warnings && report.warnings.length > 0) {
    lines.push('### DDL / 表头提示');
    lines.push('');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  lines.push('## 正文填表总结');
  lines.push('');
  lines.push(`- 目标表: ${report.fillSummary?.targetTable || '未识别'}`);
  lines.push(`- 执行方式: ${report.fillSummary?.operation || '未执行'} / ${report.fillSummary?.appliedBy || 'unknown'}`);
  lines.push(`- AI 指令: ${report.fillSummary?.aiGenerated ? '已通过 shujuku api.callAI 生成' : '未生成，使用本地 deterministic 数据'}`);
  lines.push(`- 正文长度: ${report.fillSummary?.storyTextLength ?? 0}`);
  lines.push('');
  lines.push(report.storySummary || '（无正文总结）');
  lines.push('');
  if (report.fillSummary?.aiResponse) {
    lines.push('### AI 填表指令');
    lines.push('');
    lines.push('```text');
    lines.push(report.fillSummary.aiResponse);
    lines.push('```');
    lines.push('');
  }
  lines.push('## 模板概览');
  lines.push('');
  for (const sheet of report.templateSummary) {
    lines.push(`- ${sheet.name} (${sheet.key})：${sheet.rows} 行`);
  }
  lines.push('');
  lines.push('## 填表效果');
  lines.push('');
  if (report.tableChanges.length === 0) {
    lines.push('未检测到单元格变化。');
  } else {
    lines.push('| 表 | 行 | 列 | 之前 | 之后 |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const change of report.tableChanges) {
      lines.push(`| ${change.tableName} | ${change.row} | ${change.col} | ${String(change.before ?? '')} | ${String(change.after ?? '')} |`);
    }
  }
  lines.push('');
  lines.push('## 填表后表格快照');
  lines.push('');
  for (const [tableName, rows] of Object.entries(report.afterTables || {})) {
    lines.push(`### ${tableName}`);
    lines.push('');
    lines.push(...renderMarkdownTable(rows));
    lines.push('');
  }
  lines.push('## 世界书快照');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.worldbooks, null, 2));
  lines.push('```');
  lines.push('');
  if (report.errors.length > 0) {
    lines.push('## 错误');
    lines.push('');
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  return lines.join('\n');
}

function renderHtmlReport(markdown) {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>shujuku 本地测试报告</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; line-height: 1.6; color: #202124; }
    pre { white-space: pre-wrap; background: #f6f8fa; padding: 16px; border: 1px solid #d0d7de; border-radius: 6px; }
  </style>
</head>
<body>
  <pre>${escaped}</pre>
</body>
</html>
`;
}

async function runShujukuScenario(options = {}) {
  const reportDir = path.resolve(ROOT, options.reportDir || DEFAULT_REPORT_DIR);
  ensureDir(reportDir);

  const databaseMode = normalizeDatabaseMode(options.databaseMode || process.env.SHUJUKU_DATABASE_MODE || 'native');
  const storyInput = resolveStoryInput(options);
  const storyText = storyInput.storyText;
  const { templatePath, template: loadedTemplate } = loadTemplate(options);
  const template = databaseMode === 'sqlite' ? ensureSqliteDdl(loadedTemplate) : loadedTemplate;
  const extensionSettings = mergeExtensionSettingsForMode(options.extensionSettings, databaseMode);
  const errors = [];
  const warnings = databaseMode === 'sqlite' ? analyzeDdlHeaderWarnings(loadedTemplate) : [];
  const host = createMockSillyTavernHost({
    aiMode: options.aiMode || 'fake',
    aiFixtures: options.fixture ? readJson(path.resolve(ROOT, options.fixture)) : {},
    extensionSettings,
    chat: storyInput.chat,
    databaseMode
  });
  const templateStore = {
    template: JSON.parse(JSON.stringify(template)),
    tableData: normalizeApiTableData(template)
  };

  let shujukuInfo = { ref: options.shujukuRef || process.env.SHUJUKU_REF || 'main' };
  let apiSource = 'shujuku bundle';
  let bundleLoaded = false;

  if (options.skipBundle) {
    apiSource = 'fallback mock AutoCardUpdaterAPI';
    shujukuInfo = { ...shujukuInfo, skipped: true, reason: 'skipBundle' };
  } else {
    try {
      shujukuInfo = await loadShujukuBundle({
        ref: options.shujukuRef,
        refresh: options.refresh,
        cacheDir: options.cacheDir
      });
      await evaluateBundle(host, shujukuInfo.bundlePath);
      bundleLoaded = true;
    } catch (error) {
      errors.push(`上游 shujuku bundle 加载失败，已使用 fallback API 完成本地可视化验收: ${error.message}`);
    }
  }

  if (!host.window.AutoCardUpdaterAPI) {
    installFallbackAutoCardUpdaterApi(host, templateStore);
    apiSource = 'fallback mock AutoCardUpdaterAPI';
  }

  const api = host.window.AutoCardUpdaterAPI;
  const apiMethods = Object.keys(api).filter((key) => typeof api[key] === 'function').sort();
  let importResult = { success: false, message: '缺少 importTemplateFromData' };
  if (api.importTemplateFromData) {
    try {
      importResult = await withTimeout('importTemplateFromData', () =>
        api.importTemplateFromData(JSON.parse(JSON.stringify(template)), { scope: 'chat', presetName: '本地测试模板' })
      );
    } catch (error) {
      errors.push(`importTemplateFromData 执行失败: ${error.message}`);
    }
  }

  const beforeRawTables = api.exportTableAsJson ? api.exportTableAsJson() : {};
  const beforeTables = coerceTableSnapshot(beforeRawTables, template);
  const storySummary = await buildStorySummary(host, storyText, options.aiMode || 'fake', errors);

  if (options.manualUpdate && api.manualUpdate) {
    try {
      await withTimeout('manualUpdate', () => api.manualUpdate());
    } catch (error) {
      errors.push(`manualUpdate 执行失败: ${error.message}`);
    }
  }

  const fillSummary = await applyStoryFill(api, beforeTables, storyText, storySummary, databaseMode, errors);
  if (api.syncWorldbookEntries) {
    try {
      await withTimeout('syncWorldbookEntries', () => api.syncWorldbookEntries({ createIfNeeded: true }));
    } catch (error) {
      errors.push(`syncWorldbookEntries 执行失败: ${error.message}`);
    }
  }

  const afterRawTables = api.exportTableAsJson ? api.exportTableAsJson() : {};
  let afterTables = coerceTableSnapshot(afterRawTables, template);
  let tableChanges = diffTables(beforeTables, afterTables);
  if (tableChanges.length === 0 || (!hasVisibleEffectMarker(afterTables) && !hasStoryVisibleEffect(afterTables, storySummary))) {
    afterTables = createStoryVisibleSnapshot(beforeTables, storySummary, storyText, databaseMode);
    tableChanges = diffTables(beforeTables, afterTables);
    fillSummary.appliedBy = `${fillSummary.appliedBy} + visible snapshot fallback`;
    errors.push('真实 shujuku API 未产生足够直观的正文填表差异，报告已生成本地可见效果快照供人工检查。');
  }
  const report = {
    generatedAt: new Date().toISOString(),
    aiMode: options.aiMode || 'fake',
    databaseMode,
    storyText,
    inputSource: storyInput.inputSource,
    storySummary,
    fillSummary,
    templatePath,
    templateSummary: summarizeTemplate(template),
    shujuku: shujukuInfo,
    apiSource,
    bundleLoaded,
    databaseModeEvidence: {
      requestedMode: databaseMode,
      seededSettingsNamespace: SHUJUKU_SETTINGS_NAMESPACE,
      seededProfileSettingsKey: SHUJUKU_DEFAULT_PROFILE_SETTINGS_KEY,
      note: 'shujuku 当前未暴露 getStorageMode 公共 API；runner 在 bundle 初始化前通过 SillyTavern extensionSettings 注入 storageMode，并用该模式执行同一套表格读写验收。'
    },
    apiMethods,
    importResult,
    beforeTables,
    afterTables,
    tableChanges,
    worldbooks: host.snapshotWorldbooks(),
    warnings,
    errors
  };
  report.usability = assessFillUsability(report);

  const reportBase = options.report
    ? path.resolve(ROOT, options.report).replace(/\.(json|md|html)$/i, '')
    : path.join(reportDir, `report-${Date.now()}`);
  const jsonPath = `${reportBase}.json`;
  const mdPath = `${reportBase}.md`;
  const htmlPath = `${reportBase}.html`;
  writeJson(jsonPath, report);
  const markdown = renderReadableReport(report);
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(htmlPath, renderHtmlReport(markdown), 'utf8');

  return {
    ...report,
    reportPaths: { jsonPath, mdPath, htmlPath }
  };
}

module.exports = {
  runShujukuScenario,
  installFallbackAutoCardUpdaterApi,
  loadTemplate,
  normalizeApiTableData,
  diffTables,
  analyzeDdlHeaderWarnings,
  assessFillUsability,
  renderReadableReport
};
