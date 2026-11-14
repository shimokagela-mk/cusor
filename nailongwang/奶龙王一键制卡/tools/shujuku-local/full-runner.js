'use strict';

const fs = require('fs');
const path = require('path');
const { runShujukuScenario } = require('./scenario-runner');
const { runFrontendCli } = require('./frontend-runner');

const ROOT = path.resolve(__dirname, '..', '..');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function defaultReportBase(options = {}) {
  if (options.report) return path.resolve(ROOT, options.report).replace(/\.(json|md|html)$/i, '');
  return path.join(ROOT, 'output', 'temp', 'shujuku-local', `full-${Date.now()}`);
}

function fillModes(databaseMode) {
  return databaseMode === 'both' ? ['native', 'sqlite'] : [databaseMode || 'native'];
}

function frontendSeedReport(fillReports) {
  return fillReports.find((report) => report.databaseMode === 'native') || fillReports[0];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function buildFrontendSeedTables(fillReport) {
  const tables = clone(fillReport.afterTables || {});
  const storySummary = String(fillReport.storySummary || '').trim();
  if (storySummary && !JSON.stringify(tables).includes(storySummary)) {
    tables.shujuku_fill_summary = [
      ['row_id', 'source', 'summary'],
      [1, 'storySummary', storySummary]
    ];
  }
  return tables;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# shujuku 真实填表 + 前端预览组合报告');
  lines.push('');
  lines.push(`- 时间: ${report.generatedAt}`);
  lines.push(`- 项目: ${report.project || '(未指定)'}`);
  lines.push(`- AI 模式: ${report.aiMode}`);
  lines.push(`- 数据库模式: ${report.databaseMode}`);
  lines.push(`- 前端 mock 数据: \`${report.mockDataPath}\``);
  lines.push('');
  lines.push('## 填表报告');
  lines.push('');
  for (const fill of report.fillReports) {
    lines.push(`- ${fill.databaseMode}: ${fill.usability?.summary || '未生成可用性结论'}`);
    lines.push(`  - HTML: \`${fill.reportPaths.htmlPath}\``);
    lines.push(`  - Markdown: \`${fill.reportPaths.mdPath}\``);
    lines.push(`  - 表格变化数: ${fill.tableChanges.length}`);
  }
  lines.push('');
  lines.push('## 前端预览');
  lines.push('');
  for (const frontend of report.frontendReports) {
    lines.push(`- ${frontend.scenario} / ${frontend.scenarioType}: ${frontend.usability?.summary || '未生成可用性结论'}`);
    lines.push(`  - HTML: \`${frontend.reportPaths.htmlPath}\``);
    lines.push(`  - API 调用数: ${frontend.apiCalls.length}`);
    lines.push(`  - mock 数据: \`${frontend.mockDataPath || ''}\``);
  }
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  lines.push(report.summary);
  lines.push('');
  return lines.join('\n');
}

function renderHtml(markdown) {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>shujuku 真实填表 + 前端预览组合报告</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; line-height: 1.6; color: #202124; }
    pre { white-space: pre-wrap; background: #f6f8fa; padding: 16px; border: 1px solid #d0d7de; border-radius: 6px; }
  </style>
</head>
<body><pre>${escaped}</pre></body>
</html>
`;
}

function assessFull(fillReports, frontendReports) {
  const fillBlocked = fillReports.filter((report) => ['failed', 'limited'].includes(report.usability?.status));
  const frontendBlocked = frontendReports.filter((report) => report.usability?.status === 'failed');
  if (fillBlocked.length > 0 || frontendBlocked.length > 0) {
    return '组合测试存在阻断：至少一个填表或前端预览场景失败，不能作为交付验收。';
  }
  const fillReview = fillReports.some((report) => report.usability?.status === 'needs-review');
  const frontendReview = frontendReports.some((report) => report.usability?.status === 'needs-review');
  if (fillReview || frontendReview) {
    return '组合测试可查看真实填表数据和前端效果，但存在 needs-review 项，交付前需要复核报告中的提示。';
  }
  return '组合测试可用：填表结果已写成前端 mock 数据，前端预览已使用同一份表格快照完成读取或交互验证。';
}

async function runShujukuFullScenario(options = {}) {
  const reportBase = defaultReportBase(options);
  const modes = fillModes(options.databaseMode || process.env.SHUJUKU_DATABASE_MODE || 'native');
  const fillReports = [];
  for (const mode of modes) {
    fillReports.push(await runShujukuScenario({
      ...options,
      databaseMode: mode,
      report: `${reportBase}-fill-${mode}`
    }));
  }

  const seedReport = frontendSeedReport(fillReports);
  const seedTables = buildFrontendSeedTables(seedReport);
  const mockDataPath = `${reportBase}-filled-frontend-mock.json`;
  writeJson(mockDataPath, {
    source: {
      type: 'shujuku-filled-tables',
      databaseMode: seedReport.databaseMode,
      aiMode: seedReport.aiMode,
      fillReport: seedReport.reportPaths,
      inputSource: seedReport.inputSource,
      storySummary: seedReport.storySummary
    },
    seedTables
  });

  const frontendReports = await runFrontendCli({
    ...options,
    mockData: mockDataPath,
    report: `${reportBase}-frontend`
  });

  const report = {
    generatedAt: new Date().toISOString(),
    project: options.project || null,
    aiMode: options.aiMode || 'fake',
    databaseMode: options.databaseMode || process.env.SHUJUKU_DATABASE_MODE || 'native',
    mockDataPath,
    fillSeedDatabaseMode: seedReport.databaseMode,
    fillReports,
    frontendReports
  };
  report.summary = assessFull(fillReports, frontendReports);

  const jsonPath = `${reportBase}.json`;
  const mdPath = `${reportBase}.md`;
  const htmlPath = `${reportBase}.html`;
  report.reportPaths = { jsonPath, mdPath, htmlPath };
  writeJson(jsonPath, report);
  const markdown = renderMarkdown(report);
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(htmlPath, renderHtml(markdown), 'utf8');
  return report;
}

module.exports = {
  runShujukuFullScenario,
  assessFull
};
