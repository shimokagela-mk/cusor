'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function normalizeScenario(raw = {}, index = 0) {
  const type = raw.type || 'custom';
  return {
    name: raw.name || `${type}-${index + 1}`,
    type,
    files: Array.isArray(raw.files) ? raw.files : (raw.file ? [raw.file] : []),
    seedTables: raw.seedTables || {},
    expectText: Array.isArray(raw.expectText) ? raw.expectText : [],
    expectApiCalls: Array.isArray(raw.expectApiCalls) ? raw.expectApiCalls : [],
    interactions: Array.isArray(raw.interactions) ? raw.interactions : [],
    chat: Array.isArray(raw.chat) ? raw.chat : undefined
  };
}

function loadFrontendFixture(filePath) {
  const payload = readJson(filePath);
  const list = Array.isArray(payload) ? payload : payload.scenarios;
  if (!Array.isArray(list)) throw new Error('frontend fixture 必须是数组，或包含 scenarios 数组');
  return { scenarios: list.map(normalizeScenario) };
}

function classifyFrontendFile(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  if (/opening-regex|开场.*正则|开场.*初始化/.test(normalized)) return 'opening';
  if (/^opening\.html$/.test(normalized) || /^开场白?\.html$/.test(normalized)) return 'custom';
  if (/opening|开场/.test(normalized)) return 'opening';
  if (/status|状态栏|状态/.test(normalized)) return 'status';
  if (/progress|advance|推进/.test(normalized)) return 'progression';
  return 'custom';
}

function defaultExpectApiCalls(type) {
  if (type === 'opening') return ['initGameSession'];
  if (type === 'status') return ['exportTableAsJson'];
  if (type === 'progression') return [];
  return [];
}

function defaultInteractions(type) {
  if (type !== 'opening') return [];
  return [{
    type: 'clickFirst',
    optional: true,
    selectors: ['.start-btn', '#startButton', '#start', '#importTemplate', 'button']
  }];
}

function defaultChatForFile(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  if (!/map|地图|standby|待机/.test(normalized)) return undefined;
  return [
    { message_id: 1, is_user: true, name: 'user', mes: '指挥官站在格里芬前哨基地地下二层训练场观察台，格琳娜正在介绍刚入场的 M4A1。' },
    { message_id: 2, is_user: false, name: 'assistant', mes: '地下二层训练场的灯带依次亮起，M4A1在靶道入口停下，M16A1、M4 SOPMODII、ST AR-15和RO635仍在编队整备室等待下一步命令。格琳娜站在观察台旁，把训练场布局投到资料板上。' }
  ];
}

function discoverFrontendScenarios(projectRoot) {
  const roots = [
    { dir: path.join(projectRoot, 'frontend'), prefix: 'frontend' },
    { dir: path.join(projectRoot, 'unpacked', 'extracted', 'frontend'), prefix: path.join('unpacked', 'extracted', 'frontend') }
  ];
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root.dir)) continue;
    for (const file of fs.readdirSync(root.dir).filter((item) => /\.html$/i.test(item)).sort()) {
      files.push({ file, relativePath: path.join(root.prefix, file) });
    }
  }
  return files.map((item, index) => {
      const file = item.file;
      const type = classifyFrontendFile(file);
      return normalizeScenario({
      name: path.basename(file, path.extname(file)),
      type,
      files: [item.relativePath],
      expectApiCalls: defaultExpectApiCalls(type),
      interactions: defaultInteractions(type),
      chat: defaultChatForFile(file)
    }, index);
    });
}

module.exports = {
  loadFrontendFixture,
  discoverFrontendScenarios,
  classifyFrontendFile,
  defaultExpectApiCalls,
  defaultInteractions,
  defaultChatForFile,
  normalizeScenario
};
