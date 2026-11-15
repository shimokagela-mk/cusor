'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runShujukuFullScenario } = require('../tools/shujuku-local/full-runner');

async function testFullScenarioFeedsFilledTablesToFrontend() {
  const projectRoot = 'output/temp/shujuku-local/unit-full-project';
  fs.mkdirSync(path.join(projectRoot, 'tables'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'tables', 'table-template.json'), JSON.stringify({
    mate: { type: 'chatSheets', version: 1 },
    sheet_0: {
      uid: 'sheet_0',
      name: 'global',
      sourceData: {},
      content: [
        ['row_id', 'item', 'value'],
        [1, 'status', 'empty']
      ]
    }
  }), 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'frontend', 'status.html'), `
    <main id="status"></main>
    <script>
      const tables = window.AutoCardUpdaterAPI.exportTableAsJson();
      document.getElementById('status').textContent = JSON.stringify(tables);
    </script>
  `, 'utf8');

  const result = await runShujukuFullScenario({
    project: projectRoot,
    skipBundle: true,
    aiMode: 'fake',
    databaseMode: 'native',
    storyText: 'Story: The hero records the silver key at Silver Harbor.',
    frontendScenario: 'status',
    frontendFile: 'frontend/status.html',
    expectText: ['Silver Harbor'],
    report: 'output/temp/shujuku-local/unit-full-report'
  });

  assert.strictEqual(result.fillReports.length, 1);
  assert.strictEqual(result.frontendReports.length, 1);
  assert.ok(fs.existsSync(result.mockDataPath), 'filled frontend mock data should be written');
  const mockData = JSON.parse(fs.readFileSync(result.mockDataPath, 'utf8'));
  assert.ok(JSON.stringify(mockData.seedTables).includes('Silver Harbor'));
  assert.strictEqual(result.frontendReports[0].mockDataPath, result.mockDataPath);
  assert.ok(result.frontendReports[0].renderedText.includes('Silver Harbor'));
  assert.ok(fs.existsSync(result.reportPaths.htmlPath));
  assert.ok(fs.existsSync(result.reportPaths.mdPath));
}

async function runShujukuFullTests() {
  await testFullScenarioFeedsFilledTablesToFrontend();
}

if (require.main === module) {
  runShujukuFullTests()
    .then(() => console.log('[通过] shujuku-full 单元测试'))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runShujukuFullTests };
