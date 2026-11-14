const path = require('path');
const { createDefaultMate, renderReadableTablesFromData } = require('./render-embedded-tables');

function createSheet(uid, name, columns, rows = [], options = {}) {
  return {
    uid,
    name,
    sourceData: {
      note: options.note || '',
      initNode: options.initNode || '',
      deleteNode: options.deleteNode || '',
      updateNode: options.updateNode || '',
      insertNode: options.insertNode || ''
    },
    content: [[null, ...columns], ...rows.map((row) => [null, ...row])],
    updateConfig: options.updateConfig || {
      uiSentinel: -1,
      contextDepth: 2,
      updateFrequency: 1,
      batchSize: 1,
      skipFloors: -1
    },
    exportConfig: options.exportConfig || {
      enabled: false,
      splitByRow: false
    },
    orderNo: options.orderNo || 1
  };
}

function buildDefaultData() {
  return {
    mate: createDefaultMate(),
    sheet_CurrentStatus: createSheet('sheet_CurrentStatus', '当前状态表', ['当前位置', '当前时间', '天数'], [], {
      note: '记录当前场景的位置、时间和天数。此表有且仅有一行。',
      initNode: '故事初始化时插入一条记录。',
      updateNode: '每轮更新位置、时间和天数。',
      insertNode: '禁止操作。',
      deleteNode: '禁止删除。'
    }),
    sheet_Relationship: createSheet('sheet_Relationship', '关系状态表', ['角色1', '角色2', '关系', '亲密值', '特殊状态'], [], {
      note: '记录角色之间的关系状态。',
      initNode: '有关联关系的角色登场时插入对应行。',
      updateNode: '关系变化时更新对应行。',
      insertNode: '新关系建立时插入新行。',
      deleteNode: '禁止删除。'
    })
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('用法: node tools/init-readable-tables.js <项目目录>');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const projectDir = path.resolve(process.cwd(), args[0]);
  const outputPath = path.join(projectDir, 'extracted', 'tables', 'embedded-template.readable.md');
  const data = buildDefaultData();
  const result = renderReadableTablesFromData(data, outputPath, path.join(projectDir, 'extracted', 'tables', 'embedded-template.pretty.json'));

  console.log(`已初始化 readable 表目录: ${result.readableDir}`);
  console.log(`请先编辑 readable/*.md，之后可运行 build-from-readable 构建 JSON。`);
}

main();
