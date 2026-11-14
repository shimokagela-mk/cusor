'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadFrontendFixture, discoverFrontendScenarios } = require('../tools/shujuku-local/frontend-fixture');
const { runShujukuFrontendScenario, buildCliScenarios, runFrontendCli } = require('../tools/shujuku-local/frontend-runner');
const { parseArgs } = require('../tools/shujuku-local/cli');

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
  assert.ok(scenarios.find((item) => item.type === 'status').expectApiCalls.includes('exportTableAsJson'));
}

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
      interactions: [{ selector: '[data-test="advance"]', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-frontend-write-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(JSON.stringify(report.afterTables).includes('已推进'));
  assert.ok(report.apiCalls.some((call) => call.name === 'insertRow'));
}

async function testFrontendElementQuerySelectorReadsNestedData() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-element-query';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'status.html'), `
    <section id="panel">
      <span class="value"></span>
    </section>
    <script>
      const root = document.getElementById('panel');
      const tables = window.AutoCardUpdaterAPI.exportTableAsJson();
      root.querySelector('.value').textContent = tables.global[1][1];
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'status',
      type: 'status',
      files: ['frontend/status.html'],
      seedTables: { global: [['row_id', 'location'], [1, 'castle']] },
      expectText: ['castle'],
      expectApiCalls: ['exportTableAsJson'],
      interactions: []
    },
    report: 'output/temp/shujuku-local/unit-frontend-element-query-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(report.renderedText.includes('castle'));
  assert.deepStrictEqual(report.errors, []);
}

async function testFrontendInlineOnclickExecutesDuringInteraction() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-inline-onclick';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'opening.html'), `
    <button id="start" onclick="startGame()">start</button>
    <script>
      async function startGame() {
        await window.AutoCardUpdaterAPI.initGameSession({}, {
          templateData: {
            sheet_test: {
              name: "test_table",
              content: [["row_id", "location"], [1, "castle"]]
            }
          }
        });
      }
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'opening',
      type: 'opening',
      files: ['frontend/opening.html'],
      seedTables: {},
      expectText: ['start'],
      expectApiCalls: ['initGameSession'],
      interactions: [{ selector: '#start', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-frontend-inline-onclick-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(report.apiCalls.some((call) => call.name === 'initGameSession'));
  assert.ok(JSON.stringify(report.afterTables).includes('castle'));
}

async function testFrontendOpeningInjectsTemplatePlaceholder() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-template-placeholder';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tables'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'tables', 'table-template.json'), JSON.stringify({
    mate: { type: 'chatSheets', version: 1 },
    sheet_0: {
      uid: 'sheet_0',
      name: 'global',
      content: [['row_id', 'location'], [1, 'castle']]
    }
  }), 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'opening.html'), `
    <button id="start" onclick="startGame()">start</button>
    <script>
      const EMBEDDED_TEMPLATE_BASE64 = "{{TEMPLATE_BASE64}}";
      function decodeBase64ToObj(base64) {
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      }
      async function startGame() {
        await window.AutoCardUpdaterAPI.initGameSession({}, {
          templateData: decodeBase64ToObj(EMBEDDED_TEMPLATE_BASE64)
        });
      }
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'opening',
      type: 'opening',
      files: ['frontend/opening.html'],
      seedTables: {},
      expectText: ['start'],
      expectApiCalls: ['initGameSession'],
      interactions: [{ selector: '#start', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-frontend-template-placeholder-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(report.apiCalls.some((call) => call.name === 'initGameSession'));
  assert.ok(JSON.stringify(report.afterTables).includes('castle'));
  assert.ok(report.frontendHtml.includes('EMBEDDED_TEMPLATE_BASE64'));
  assert.ok(!report.frontendHtml.includes('{{TEMPLATE_BASE64}}'));
}

async function testFrontendCliOpeningAutoClicksStartButton() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-opening-auto-click';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tables'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'tables', 'table-template.json'), JSON.stringify({
    mate: { type: 'chatSheets', version: 1 },
    sheet_0: {
      uid: 'sheet_0',
      name: 'global',
      content: [['row_id', 'location'], [1, 'castle']]
    }
  }), 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'opening-regex.html'), `
    <button class="start-btn" onclick="startGame()">start</button>
    <script>
      const EMBEDDED_TEMPLATE_BASE64 = "{{TEMPLATE_BASE64}}";
      function decodeBase64ToObj(base64) {
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      }
      async function startGame() {
        await window.AutoCardUpdaterAPI.importTemplateFromData(decodeBase64ToObj(EMBEDDED_TEMPLATE_BASE64));
      }
    </script>
  `, 'utf8');

  const reports = await runFrontendCli({
    project: projectRoot,
    frontendScenario: 'opening',
    expectText: ['start'],
    report: 'output/temp/shujuku-local/unit-frontend-opening-auto-click-report'
  });

  assert.strictEqual(reports.length, 1);
  assert.strictEqual(reports[0].usability.status, 'usable');
  assert.ok(reports[0].apiCalls.some((call) => call.name === 'importTemplateFromData'));
}

async function testFrontendProvidesBareIndexedDbGlobal() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-indexeddb-global';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'status.html'), `
    <section id="status"></section>
    <script>
      const request = indexedDB.open('frontend-test-db', 1);
      request.onsuccess = (event) => {
        document.getElementById('status').textContent += ':' + !!event.target.result;
        const tx = event.target.result.transaction('items', 'readonly');
        const getRequest = tx.objectStore('items').get('missing');
        getRequest.onsuccess = (getEvent) => {
          document.getElementById('status').textContent += ':' + (getEvent.target.result === undefined);
        };
      };
      const tables = window.AutoCardUpdaterAPI.exportTableAsJson();
      document.getElementById('status').textContent = tables.global[1][1] + ':' + !!request;
    </script>
  `, 'utf8');

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'status',
      type: 'status',
      files: ['frontend/status.html'],
      seedTables: { global: [['row_id', 'location'], [1, 'castle']] },
      expectText: ['castle:true:true:true'],
      expectApiCalls: ['exportTableAsJson'],
      interactions: []
    },
    report: 'output/temp/shujuku-local/unit-frontend-indexeddb-global-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.deepStrictEqual(report.errors, []);
}

async function testFrontendOpeningImportsTemplate() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-opening-import';
  fs.mkdirSync(path.join(projectRoot, 'unpacked', 'extracted', 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'unpacked', 'extracted', 'frontend', 'opening-regex.source.html'), `
    <button id="importTemplate">导入表格模板</button>
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('importTemplate').addEventListener('click', async () => {
          await window.AutoCardUpdaterAPI.initGameSession({}, {
            injectTemplate: true,
            templateData: {
              sheet_test: {
                name: "测试表",
                content: [["行号", "名称"], [1, "维也纳宫廷"]]
              }
            }
          });
        });
      });
    </script>
  `, 'utf8');

  const scenarios = discoverFrontendScenarios(projectRoot);
  assert.ok(scenarios.some((item) => item.files[0].includes('unpacked')));

  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'opening-regex.source',
      type: 'opening',
      files: ['unpacked/extracted/frontend/opening-regex.source.html'],
      seedTables: {},
      expectText: ['导入表格模板'],
      expectApiCalls: ['initGameSession'],
      interactions: [{ selector: '#importTemplate', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-frontend-opening-import-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.ok(report.apiCalls.some((call) => call.name === 'initGameSession'));
  assert.ok(JSON.stringify(report.afterTables).includes('维也纳宫廷'));
}

async function testFrontendWritesReadableLivePreviewReport() {
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

async function testFrontendCliArgs() {
  const parsed = parseArgs([
    '--frontend',
    '--project', '测试卡',
    '--frontend-scenario', 'status',
    '--frontend-file', 'frontend/status.html',
    '--expect-text', '紧张',
    '--interaction', '#advance:click',
    '--mock-data', 'output/temp/mock-data.json'
  ]);
  assert.strictEqual(parsed.frontend, true);
  assert.strictEqual(parsed.frontendScenario, 'status');
  assert.strictEqual(parsed.frontendFile, 'frontend/status.html');
  assert.deepStrictEqual(parsed.expectText, ['紧张']);
  assert.deepStrictEqual(parsed.interactions, ['#advance:click']);
  assert.strictEqual(parsed.mockData, 'output/temp/mock-data.json');
}

async function testFrontendCliUsesMockDataFile() {
  const projectRoot = 'output/temp/shujuku-local/unit-frontend-mock-data';
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'status.html'), `
    <section id="status"></section>
    <script>
      const tables = window.AutoCardUpdaterAPI.exportTableAsJson();
      document.getElementById('status').textContent = tables["主角状态表"][1][1] + ":" + tables["主角状态表"][1][2];
    </script>
  `, 'utf8');
  const mockPath = 'output/temp/shujuku-local/unit-frontend-mock-data.json';
  fs.writeFileSync(mockPath, JSON.stringify({
    seedTables: {
      '主角状态表': [['行号', '状态', '体力'], [1, '平静', '99']]
    }
  }), 'utf8');

  const { runFrontendCli } = require('../tools/shujuku-local/frontend-runner');
  const reports = await runFrontendCli({
    project: projectRoot,
    frontendFile: 'frontend/status.html',
    frontendScenario: 'status',
    expectText: ['平静', '99'],
    mockData: mockPath,
    report: 'output/temp/shujuku-local/unit-frontend-mock-data-report'
  });

  assert.strictEqual(reports.length, 1);
  assert.strictEqual(reports[0].usability.status, 'usable');
  assert.ok(reports[0].renderedText.includes('平静:99'));
  assert.ok(JSON.stringify(reports[0].beforeTables).includes('99'));
}

async function testFrontendFileScenarioDefaultsToDatabaseReadExpectation() {
  const scenarios = buildCliScenarios({
    frontendFile: 'frontend/status.html',
    frontendScenario: 'status'
  }, 'output/temp/shujuku-local/unit-frontend-project');

  assert.deepStrictEqual(scenarios[0].expectApiCalls, ['exportTableAsJson']);
}

async function testGflStandbySyncsCombatMapFromBattleAndEnemyConfig() {
  const projectRoot = path.resolve(__dirname, '..', 'projects', '少女前线');
  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'gfl-map-sync-standby',
      type: 'custom',
      files: ['frontend/standby.html'],
      seedTables: {
        '全局数据表': [['行号', '当前位置', '当前时间', '天数', '当前玩法', '主角当前状态'], [1, '前线集结点', '2024-04-01 09:00', 1, '作战', '待命']],
        '当前章节表': [['行号', '当前阶段'], [1, '进行中']],
        '出战配置表': [['行号', '人形名称', '当前生命', '最大生命', '出战位', '所属区域'], [1, 'M950A', 400, 400, 1, '我方阵地'], [2, 'G36C', 520, 520, 2, '我方阵地']],
        '敌人配置表': [['行号', '敌人名称', '当前生命', '最大生命', '出战位', '所属区域'], [1, '铁血侦察者', 260, 260, 1, '敌方前哨'], [2, '铁血盾卫', 680, 680, 2, '敌方火线']],
        '地图元素表': [['行号', '元素名称', '元素类型', 'X坐标', 'Y坐标', '状态', '描述', '所属区域', '传说背景']]
      },
      expectText: ['战斗状态'],
      expectApiCalls: ['callAI', 'insertRow'],
      interactions: [{ selector: '#combat-btn', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-gfl-map-sync-standby-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.deepStrictEqual(report.errors, []);
  assert.ok(report.apiCalls.some((call) => call.name === 'callAI'));
  assert.ok(report.apiCalls.some((call) => call.name === 'deleteRow'));
  const rows = report.afterTables['地图元素表'] || [];
  const names = rows.slice(1).map((row) => row[1]);
  for (const expected of ['M950A', 'G36C', '铁血侦察者', '铁血盾卫']) {
    assert.ok(names.includes(expected), `地图元素表缺少 ${expected}`);
  }
}

async function testGflStandbySyncsCombatMapWithoutEnemies() {
  const projectRoot = path.resolve(__dirname, '..', 'projects', '少女前线');
  const report = await runShujukuFrontendScenario({
    projectRoot,
    scenario: {
      name: 'gfl-map-sync-standby-no-enemies',
      type: 'custom',
      files: ['frontend/standby.html'],
      seedTables: {
        '全局数据表': [['行号', '当前位置', '当前时间', '天数', '当前玩法', '主角当前状态'], [1, '前线集结点', '2024-04-01 09:00', 1, '作战', '待命']],
        '当前章节表': [['行号', '当前阶段'], [1, '进行中']],
        '出战配置表': [['行号', '人形名称', '当前生命', '最大生命', '出战位', '所属区域'], [1, 'M950A', 400, 400, 1, '我方阵地']],
        '敌人配置表': [['行号', '敌人名称', '当前生命', '最大生命', '出战位', '所属区域']],
        '地图元素表': [['行号', '元素名称', '元素类型', 'X坐标', 'Y坐标', '状态', '描述', '所属区域', '传说背景']]
      },
      expectText: ['战斗状态'],
      expectApiCalls: ['callAI', 'insertRow'],
      interactions: [{ selector: '#combat-btn', type: 'click' }]
    },
    report: 'output/temp/shujuku-local/unit-gfl-map-sync-standby-no-enemies-report'
  });

  assert.strictEqual(report.usability.status, 'usable');
  assert.deepStrictEqual(report.errors, []);
  const rows = report.afterTables['地图元素表'] || [];
  const bodyRows = rows.slice(1);
  const names = bodyRows.map((row) => row[1]);
  const types = bodyRows.map((row) => row[2]);
  assert.ok(names.includes('M950A'), '地图元素表缺少无敌人遭遇中的出战人形 M950A');
  assert.ok(types.includes('障碍物'), '无敌人遭遇仍应保留战场关键障碍物');
  assert.ok(types.includes('出口'), '无敌人遭遇仍应保留战场出口');
  assert.ok(!types.includes('敌方'), '敌人配置表为空时不得编造敌方单位');
}

async function runShujukuFrontendTests() {
  await testLoadFrontendFixture();
  await testDiscoverFrontendScenarios();
  await testFrontendReadsTableData();
  await testFrontendProgressionWritesTable();
  await testFrontendElementQuerySelectorReadsNestedData();
  await testFrontendInlineOnclickExecutesDuringInteraction();
  await testFrontendOpeningInjectsTemplatePlaceholder();
  await testFrontendCliOpeningAutoClicksStartButton();
  await testFrontendProvidesBareIndexedDbGlobal();
  await testFrontendOpeningImportsTemplate();
  await testFrontendWritesReadableLivePreviewReport();
  await testFrontendCliArgs();
  await testFrontendCliUsesMockDataFile();
  await testFrontendFileScenarioDefaultsToDatabaseReadExpectation();
  await testGflStandbySyncsCombatMapFromBattleAndEnemyConfig();
  await testGflStandbySyncsCombatMapWithoutEnemies();
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
