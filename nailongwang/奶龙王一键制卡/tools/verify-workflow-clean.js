const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'output', 'temp', 'workflow-clean-report.json');

function joinParts(parts) {
  return parts.join('');
}

function usage() {
  console.log('Usage: node tools/verify-workflow-clean.js [--report-only]');
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (token === '--report-only') args.reportOnly = true;
    if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walk(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function shouldSkipDir(name) {
  return ['node_modules', '.git', '.kilo', '__MACOSX', 'projects', 'examples', 'docs', 'output', 'release'].includes(name)
    || name === '_build'
    || name.endsWith('_build');
}

function collectWorkflowFiles(root = ROOT) {
  const files = [];
  for (const name of ['AGENTS.md', 'README.md', 'package.json']) {
    const fullPath = path.join(root, name);
    if (fs.existsSync(fullPath)) files.push(fullPath);
  }
  for (const dir of ['prompts', 'tools', 'tests']) {
    const base = path.join(root, dir);
    walk(base, (filePath) => {
      if (!/\.(md|js|json)$/i.test(filePath)) return;
      files.push(filePath);
    });
  }
  return files.sort();
}

function buildRules() {
  const currentOnlyTerms = [
    joinParts(['旧', '格式', '兼容']),
    joinParts(['旧', '项目', '兼容']),
    joinParts(['向', '后', '兼容']),
    joinParts(['兼容', '之前', '版本']),
    joinParts(['leg', 'acy']),
    joinParts(['back', 'ward'])
  ];

  const correctiveTerms = [
    joinParts(['常见', '错误', '与', '纠正']),
    joinParts(['错误', '流程', '示例']),
    joinParts(['纠', '正：'])
  ];

  const oldPackagingTerms = [
    joinParts(['如', '需要 PNG，再', '封装为']),
    joinParts(['可', '按需', '生成 `output/[名称].png`']),
    joinParts(['如果', '需要 PNG 角色卡，先用 `tools/json-to-png.js` 封装']),
    joinParts(['如用户', '需要 Tavern Card PNG，可再用 `tools/json-to-png.js`'])
  ];

  const negationRewritePattern = new RegExp(`${joinParts(['不', '要'])}[^。；\\n]{0,50}[，,；;、][^。；\\n]{0,50}${joinParts(['要'])}`);

  return [
    ...currentOnlyTerms.map((term) => ({
      id: 'current-only-version-rule',
      test: (line) => line.toLowerCase().includes(term.toLowerCase()),
      message: 'workflow text contains version-history wording'
    })),
    ...correctiveTerms.map((term) => ({
      id: 'clean-workflow-wording',
      test: (line) => line.includes(term),
      message: 'workflow text contains correction-template wording'
    })),
    {
      id: 'clean-workflow-wording',
      test: (line) => /^###\s*错误\d/.test(line.trim()),
      message: 'workflow text contains correction-template heading'
    },
    {
      id: 'clean-workflow-wording',
      test: (line) => negationRewritePattern.test(line),
      message: 'workflow text contains negation-to-command rewrite wording'
    },
    ...oldPackagingTerms.map((term) => ({
      id: 'release-gate-required',
      test: (line) => line.includes(term),
      message: 'workflow text contains pre-gate PNG packaging wording'
    }))
  ];
}

function scanText(content, relativePath = '<inline>') {
  const rules = buildRules();
  const findings = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.test(line)) {
        findings.push({
          rule: rule.id,
          message: rule.message,
          file: relativePath,
          line: index + 1,
          text: line.trim()
        });
      }
    }
  });
  return findings;
}

function scanWorkflow(root = ROOT) {
  const files = collectWorkflowFiles(root);
  const findings = [];
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    findings.push(...scanText(content, relativePath));
  }
  return {
    ok: findings.length === 0,
    scannedFiles: files.map((filePath) => path.relative(root, filePath).replace(/\\/g, '/')),
    findings
  };
}

function writeReport(report, reportPath = REPORT_PATH) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const report = scanWorkflow(ROOT);
  writeReport(report);
  console.log(`workflow clean scan files: ${report.scannedFiles.length}`);
  console.log(`workflow clean findings: ${report.findings.length}`);
  console.log(`workflow clean report: ${path.relative(ROOT, REPORT_PATH)}`);

  for (const finding of report.findings) {
    console.error(`[${finding.rule}] ${finding.file}:${finding.line} ${finding.message}`);
  }

  if (!args.reportOnly && !report.ok) {
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  scanText,
  scanWorkflow,
  collectWorkflowFiles,
  buildRules
};
