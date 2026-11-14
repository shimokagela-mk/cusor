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
    `- Mock 数据: ${report.mockDataPath || '使用项目表格模板或 fixture seedTables'}`,
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
