'use strict';

const assert = require('assert');
const fs = require('fs');
const { createMockSillyTavernHost } = require('../tools/shujuku-local/mock-host');
const { createFakeAiResponder } = require('../tools/shujuku-local/fake-ai');
const { installFallbackAutoCardUpdaterApi, diffTables, runShujukuScenario, loadTemplate } = require('../tools/shujuku-local/scenario-runner');
const { parseArgs, applyAiConfig } = require('../tools/shujuku-local/cli');

async function testEventSourceOrder() {
  const host = createMockSillyTavernHost();
  const calls = [];
  host.eventSource.on('X', () => calls.push('first'));
  host.eventSource.makeLast('X', () => calls.push('last'));
  host.eventSource.on('X', () => calls.push('middle'));
  await host.eventSource.emit('X');
  assert.deepStrictEqual(calls, ['first', 'last', 'middle']);
}

async function testChatMutation() {
  const host = createMockSillyTavernHost();
  const ctx = host.getContext();
  await ctx.setChatMessages([{ message_id: 1, mes: '已修改' }], { refresh: 'affected' });
  assert.strictEqual(host.state.chat.find((item) => item.message_id === 1).mes, '已修改');
  const before = host.state.chat.length;
  await ctx.deleteLastMessage();
  assert.strictEqual(host.state.chat.length, before - 1);
  await ctx.saveChat();
  assert.strictEqual(host.state.savedChats, 1);
}

async function testWorldbookCrud() {
  const host = createMockSillyTavernHost();
  await host.window.TavernHelper.createLorebookEntries('本地测试世界书', [{ uid: 100, content: 'A' }]);
  let entries = await host.window.TavernHelper.getLorebookEntries('本地测试世界书');
  assert.ok(entries.some((item) => item.uid === 100));
  await host.window.TavernHelper.setLorebookEntries('本地测试世界书', [{ uid: 101, content: 'B' }]);
  entries = await host.window.TavernHelper.getLorebookEntries('本地测试世界书');
  assert.deepStrictEqual(entries.map((item) => item.uid), [101]);
  await host.window.TavernHelper.deleteLorebookEntries('本地测试世界书', [101]);
  entries = await host.window.TavernHelper.getLorebookEntries('本地测试世界书');
  assert.strictEqual(entries.length, 0);
}

async function testFakeAiRules() {
  const ai = createFakeAiResponder({
    rules: [{ includes: ['状态'], response: '命中规则' }],
    defaultText: '默认响应'
  });
  assert.strictEqual(await ai([{ role: 'user', content: '请更新状态' }]), '命中规则');
  assert.strictEqual(await ai([{ role: 'user', content: '其他' }]), '默认响应');
}

async function testFallbackApiVisibleTableChanges() {
  const host = createMockSillyTavernHost();
  const templateStore = {
    template: {
      mate: { type: 'chatSheets', version: 1 },
      sheet_0: {
        uid: 'sheet_0',
        name: '测试表',
        content: [
          ['行号', '项目', '值'],
          [1, '状态', '未测试']
        ],
        sourceData: {}
      }
    },
    tableData: {
      测试表: [
        ['行号', '项目', '值'],
        [1, '状态', '未测试']
      ]
    }
  };
  const api = installFallbackAutoCardUpdaterApi(host, templateStore);
  const before = api.exportTableAsJson();
  await api.manualUpdate();
  await api.insertRow('测试表', { 项目: '可见效果', 值: '报告已生成' });
  const after = api.exportTableAsJson();
  const changes = diffTables(before, after);
  assert.ok(changes.length >= 1, '应当产生可见填表差异');
}

async function testScenarioWritesStorySummaryForMode(databaseMode) {
  const storyText = '正文测试：角色在星辉港发现银钥匙，并把钥匙交给档案员记录。';
  const report = await runShujukuScenario({
    skipBundle: true,
    databaseMode,
    storyText,
    aiMode: 'fake',
    report: `output/temp/shujuku-local/unit-story-${databaseMode}`
  });

  const afterText = JSON.stringify(report.afterTables);
  assert.strictEqual(report.databaseMode, databaseMode);
  assert.ok(report.storySummary.includes('星辉港'), '正文总结应包含正文地点关键词');
  assert.ok(report.storySummary.includes('银钥匙'), '正文总结应包含正文物品关键词');
  assert.ok(afterText.includes('星辉港'), '填表快照应展示正文关键词');
  assert.ok(afterText.includes('银钥匙'), '填表快照应展示正文关键词');
  assert.ok(report.fillSummary && report.fillSummary.mode === databaseMode, '报告应记录填表模式摘要');
  assert.strictEqual(report.fillSummary.aiGenerated, true, '应通过 shujuku api.callAI 生成填表指令');
  if (databaseMode === 'sqlite') {
    assert.ok(report.fillSummary.aiResponse.includes('INSERT INTO'), 'sqlite 模式应生成 SQL 填表指令');
  } else {
    assert.ok(report.fillSummary.aiResponse.includes('<tableEdit>'), 'native 模式应生成 tableEdit 填表指令');
  }
  assert.ok(fs.existsSync(report.reportPaths.htmlPath), '应生成可视 HTML 报告');
  const html = fs.readFileSync(report.reportPaths.htmlPath, 'utf8');
  assert.ok(html.includes('正文填表总结'), 'HTML 报告应展示正文填表总结区块');
  assert.ok(html.includes('星辉港'), 'HTML 报告应可见填表效果关键词');
}

async function testScenarioAcceptsChatFile() {
  const chatPath = 'output/temp/shujuku-local/unit-chat.json';
  fs.mkdirSync('output/temp/shujuku-local', { recursive: true });
  fs.writeFileSync(chatPath, JSON.stringify([
    { role: 'system', content: '开场设定。' },
    { role: 'user', content: '调查码头。' },
    { role: 'assistant', content: '角色在星辉港发现银钥匙，并交给档案员记录。' },
    { is_user: true, mes: '继续追问线索。' },
    { is_user: false, mes: '档案员确认银钥匙属于旧灯塔，需要写入纪要。' }
  ]), 'utf8');

  const report = await runShujukuScenario({
    skipBundle: true,
    databaseMode: 'native',
    chatFile: chatPath,
    aiMode: 'fake',
    report: 'output/temp/shujuku-local/unit-chat-report'
  });

  assert.strictEqual(report.inputSource.type, 'chat-file');
  assert.strictEqual(report.inputSource.messageCount, 5);
  assert.ok(report.storyText.includes('星辉港'), '应从聊天记录 AI 正文中提取填表正文');
  assert.ok(report.storyText.includes('旧灯塔'), '应保留多条 AI 正文');
  assert.ok(JSON.stringify(report.afterTables).includes('银钥匙'), '聊天记录关键词应写入表格快照');
}

async function testCliAiConfig() {
  const configPath = 'output/temp/shujuku-local/unit-ai-config.json';
  fs.mkdirSync('output/temp/shujuku-local', { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    baseUrl: 'https://unit.example/v1',
    apiKey: 'sk-unit',
    model: 'unit-model'
  }), 'utf8');
  const parsed = parseArgs(['--ai', 'real', '--ai-config', configPath]);
  assert.strictEqual(parsed.aiMode, 'real');
  assert.strictEqual(parsed.aiConfig, configPath);
  const oldBase = process.env.OPENAI_COMPAT_BASE_URL;
  const oldKey = process.env.OPENAI_COMPAT_API_KEY;
  const oldModel = process.env.OPENAI_COMPAT_MODEL;
  try {
    applyAiConfig(configPath);
    assert.strictEqual(process.env.OPENAI_COMPAT_BASE_URL, 'https://unit.example/v1');
    assert.strictEqual(process.env.OPENAI_COMPAT_API_KEY, 'sk-unit');
    assert.strictEqual(process.env.OPENAI_COMPAT_MODEL, 'unit-model');
  } finally {
    if (oldBase === undefined) delete process.env.OPENAI_COMPAT_BASE_URL; else process.env.OPENAI_COMPAT_BASE_URL = oldBase;
    if (oldKey === undefined) delete process.env.OPENAI_COMPAT_API_KEY; else process.env.OPENAI_COMPAT_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENAI_COMPAT_MODEL; else process.env.OPENAI_COMPAT_MODEL = oldModel;
  }
}

async function testLoadTemplateDiscoversChatSheetsTemplate() {
  const projectRoot = 'output/temp/shujuku-local/unit-chat-sheets-template-project';
  fs.mkdirSync(`${projectRoot}/tables`, { recursive: true });
  fs.writeFileSync(`${projectRoot}/tables/chatSheets-template.json`, JSON.stringify({
    mate: { type: 'chatSheets', version: 1 },
    sheet_0: {
      uid: 'sheet_0',
      name: 'global',
      content: [['row_id', 'location'], [1, 'castle']]
    }
  }), 'utf8');

  const result = loadTemplate({ project: projectRoot });

  assert.ok(result.templatePath.endsWith('chatSheets-template.json'));
  assert.strictEqual(result.template.sheet_0.name, 'global');
}

async function testScenarioReportsDdlMismatchUsability() {
  const templatePath = 'output/temp/shujuku-local/unit-ddl-mismatch-template.json';
  fs.mkdirSync('output/temp/shujuku-local', { recursive: true });
  fs.writeFileSync(templatePath, JSON.stringify({
    mate: { type: 'chatSheets', version: 1 },
    sheet_0: {
      uid: 'sheet_0',
      name: '检定记录表',
      sourceData: {
        ddl: [
          'CREATE TABLE sheet_0 ( -- 检定记录表',
          '  row_id INTEGER PRIMARY KEY, -- 行号',
          '  difficulty TEXT, -- DC',
          '  result TEXT -- 结果',
          ');'
        ].join('\n')
      },
      content: [
        ['行号', 'DC', '结果'],
        [1, '12', '待定']
      ]
    }
  }), 'utf8');

  const report = await runShujukuScenario({
    skipBundle: true,
    databaseMode: 'sqlite',
    template: templatePath,
    aiMode: 'fake',
    report: 'output/temp/shujuku-local/unit-ddl-mismatch-report'
  });

  assert.ok(report.warnings.some((warning) => warning.includes('DDL') && warning.includes('检定记录表')));
  assert.ok(report.usability && report.usability.status === 'needs-review');
  assert.ok(report.usability.summary.includes('需要复核'));
  const markdown = fs.readFileSync(report.reportPaths.mdPath, 'utf8');
  assert.ok(markdown.includes('## 填表可用性'));
  assert.ok(markdown.includes('需要复核'));
  assert.ok(markdown.includes('DDL / 表头提示'));
}

async function runShujukuLocalTests() {
  await testEventSourceOrder();
  await testChatMutation();
  await testWorldbookCrud();
  await testFakeAiRules();
  await testFallbackApiVisibleTableChanges();
  await testScenarioWritesStorySummaryForMode('native');
  await testScenarioWritesStorySummaryForMode('sqlite');
  await testScenarioAcceptsChatFile();
  await testCliAiConfig();
  await testLoadTemplateDiscoversChatSheetsTemplate();
  await testScenarioReportsDdlMismatchUsability();
}

if (require.main === module) {
  runShujukuLocalTests()
    .then(() => console.log('[通过] shujuku-local 单元测试'))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  runShujukuLocalTests
};
