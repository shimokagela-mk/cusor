#!/usr/bin/env node
'use strict';

const { runShujukuScenario } = require('./scenario-runner');
const { loadShujukuBundle } = require('./fetch-shujuku');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function appendReportMode(reportPath, mode) {
  if (!reportPath) return reportPath;
  return String(reportPath).replace(/\.(json|md|html)$/i, '') + `-${mode}`;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--smoke') options.smoke = true;
    else if (arg === '--full') options.full = true;
    else if (arg === '--frontend') options.frontend = true;
    else if (arg === '--frontend-scenario') options.frontendScenario = argv[++i];
    else if (arg === '--frontend-file') options.frontendFile = argv[++i];
    else if (arg === '--frontend-fixture') options.frontendFixture = argv[++i];
    else if (arg === '--mock-data' || arg === '--frontend-mock-data') options.mockData = argv[++i];
    else if (arg === '--expect-text') {
      if (!options.expectText) options.expectText = [];
      options.expectText.push(argv[++i]);
    }
    else if (arg === '--interaction') {
      if (!options.interactions) options.interactions = [];
      options.interactions.push(argv[++i]);
    }
    else if (arg === '--project') options.project = argv[++i];
    else if (arg === '--template') options.template = argv[++i];
    else if (arg === '--fixture') options.fixture = argv[++i];
    else if (arg === '--ai') options.aiMode = argv[++i];
    else if (arg === '--ai-config') options.aiConfig = argv[++i];
    else if (arg === '--database-mode') options.databaseMode = argv[++i];
    else if (arg === '--story-text') options.storyText = argv[++i];
    else if (arg === '--story-file') options.storyFile = argv[++i];
    else if (arg === '--chat-file') options.chatFile = argv[++i];
    else if (arg === '--manual-update') options.manualUpdate = true;
    else if (arg === '--shujuku-ref') options.shujukuRef = argv[++i];
    else if (arg === '--report') options.report = argv[++i];
    else if (arg === '--refresh') options.refresh = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数: ${arg}`);
  }
  return options;
}

function loadAiConfig(configPath) {
  if (!configPath) return null;
  const fullPath = path.resolve(ROOT, configPath);
  if (!fs.existsSync(fullPath)) throw new Error(`AI 配置文件不存在: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
  const baseUrl = config.baseUrl || config.base_url || config.OPENAI_COMPAT_BASE_URL;
  const apiKey = config.apiKey || config.api_key || config.OPENAI_COMPAT_API_KEY;
  const model = config.model || config.OPENAI_COMPAT_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('AI 配置文件必须包含 baseUrl、apiKey、model');
  }
  return { baseUrl, apiKey, model };
}

function applyAiConfig(configPath) {
  const config = loadAiConfig(configPath);
  if (!config) return null;
  process.env.OPENAI_COMPAT_BASE_URL = String(config.baseUrl);
  process.env.OPENAI_COMPAT_API_KEY = String(config.apiKey);
  process.env.OPENAI_COMPAT_MODEL = String(config.model);
  return config;
}

function printHelp() {
  console.log(`用法:
  node tools/shujuku-local/cli.js --smoke [--shujuku-ref main] [--refresh]
  node tools/shujuku-local/cli.js --project <项目名或路径> [--ai fake|real] [--ai-config output/config/shujuku-ai.local.json] [--database-mode native|sqlite|both] [--report output/temp/shujuku-local/report]
  node tools/shujuku-local/cli.js --template <table-template.json路径> [--fixture fixture.json] [--story-text 正文] [--story-file path] [--chat-file chat.json] [--manual-update]
  node tools/shujuku-local/cli.js --frontend --project <项目名或路径> [--frontend-scenario opening|status|progression|all] [--frontend-file frontend/opening.html] [--frontend-fixture frontend-test.json] [--mock-data mock-data.json] [--expect-text 文本] [--interaction "#advance:click"]
  node tools/shujuku-local/cli.js --full --project <项目名或路径> [--ai fake|real] [--ai-config output/config/shujuku-ai.local.json] [--database-mode native|sqlite|both] [--story-text 正文] [--chat-file chat.json] [--frontend-scenario all]

环境变量:
  SHUJUKU_REF=main
  SHUJUKU_REFRESH=1
  SHUJUKU_CACHE_DIR=output/cache/shujuku
  SHUJUKU_DATABASE_MODE=native
  OPENAI_COMPAT_BASE_URL / OPENAI_COMPAT_API_KEY / OPENAI_COMPAT_MODEL

AI 配置文件:
  可用 --ai-config 指向 JSON 文件，字段为 baseUrl、apiKey、model。
  示例模板: tools/shujuku-local/ai-config.example.json
`);
}

function printReport(report) {
  console.log('shujuku 本地测试完成。');
  console.log(`  数据库模式: ${report.databaseMode}`);
  console.log(`  API 来源: ${report.apiSource}`);
  console.log(`  模板来源: ${report.templatePath}`);
  console.log(`  正文总结: ${report.storySummary}`);
  console.log(`  AI 指令: ${report.fillSummary && report.fillSummary.aiGenerated ? 'api.callAI 已生成' : '未生成，使用本地数据'}`);
  console.log(`  填表变化数: ${report.tableChanges.length}`);
  if (report.usability) {
    console.log(`  填表可用性: ${report.usability.summary}`);
  }
  console.log(`  JSON 报告: ${report.reportPaths.jsonPath}`);
  console.log(`  可读报告: ${report.reportPaths.mdPath}`);
  console.log(`  HTML 报告: ${report.reportPaths.htmlPath}`);
  if (report.warnings && report.warnings.length > 0) {
    console.log('  提示:');
    for (const warning of report.warnings) console.log(`  - ${warning}`);
  }
  if (report.errors.length > 0) {
    console.log('  注意:');
    for (const error of report.errors) console.log(`  - ${error}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  applyAiConfig(options.aiConfig);
  if (options.help) {
    printHelp();
    return;
  }

  if (options.smoke) {
    const result = await loadShujukuBundle({
      ref: options.shujukuRef,
      refresh: options.refresh
    });
    console.log('shujuku bundle 已准备:');
    console.log(`  ref: ${result.ref}`);
    console.log(`  bundle: ${result.bundlePath}`);
    console.log(`  cache: ${result.cacheDir}`);
    return;
  }

  if (options.frontend) {
    const { runFrontendCli } = require('./frontend-runner');
    const reports = await runFrontendCli(options);
    for (const report of reports) {
      console.log('shujuku 前端本地测试完成。');
      console.log(`  场景: ${report.scenario} / ${report.scenarioType}`);
      console.log(`  前端可用性: ${report.usability.summary}`);
      console.log(`  API 调用数: ${report.apiCalls.length}`);
      console.log(`  JSON 报告: ${report.reportPaths.jsonPath}`);
      console.log(`  可读报告: ${report.reportPaths.mdPath}`);
      console.log(`  HTML 预览: ${report.reportPaths.htmlPath}`);
      if (report.errors.length > 0) {
        console.log('  注意:');
        for (const error of report.errors) console.log(`  - ${error}`);
      }
    }
    return;
  }

  if (options.full) {
    const { runShujukuFullScenario } = require('./full-runner');
    const report = await runShujukuFullScenario(options);
    console.log('shujuku 真实填表 + 前端预览组合测试完成。');
    console.log(`  结论: ${report.summary}`);
    console.log(`  前端 mock 数据: ${report.mockDataPath}`);
    for (const fill of report.fillReports) {
      console.log(`  填表 ${fill.databaseMode}: ${fill.usability && fill.usability.summary}`);
      console.log(`    HTML: ${fill.reportPaths.htmlPath}`);
    }
    for (const frontend of report.frontendReports) {
      console.log(`  前端 ${frontend.scenario}/${frontend.scenarioType}: ${frontend.usability && frontend.usability.summary}`);
      console.log(`    HTML: ${frontend.reportPaths.htmlPath}`);
    }
    console.log(`  组合报告: ${report.reportPaths.htmlPath}`);
    return;
  }

  if (options.databaseMode === 'both') {
    for (const mode of ['native', 'sqlite']) {
      const report = await runShujukuScenario({
        ...options,
        databaseMode: mode,
        report: appendReportMode(options.report, mode)
      });
      printReport(report);
    }
  } else {
    const report = await runShujukuScenario(options);
    printReport(report);
  }
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(error.message);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  appendReportMode,
  loadAiConfig,
  applyAiConfig
};
