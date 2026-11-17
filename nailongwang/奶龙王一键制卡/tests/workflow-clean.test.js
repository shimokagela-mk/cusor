const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { scanText, scanWorkflow } = require('../tools/verify-workflow-clean');

const ROOT = path.resolve(__dirname, '..');

function phrase(parts) {
  return parts.join('');
}

function assertBlocked(text, expectedRule) {
  const findings = scanText(text, '<test>');
  assert(findings.some((finding) => finding.rule === expectedRule), `expected ${expectedRule} to block: ${text}`);
}

assertBlocked(phrase(['旧', '格式', '兼容']), 'current-only-version-rule');
assertBlocked(phrase(['常见', '错误', '与', '纠正']), 'clean-workflow-wording');
assertBlocked(`### ${phrase(['错误'])}0：示例`, 'clean-workflow-wording');
assertBlocked(phrase(['纠', '正：']) + '改成执行标准。', 'clean-workflow-wording');
assertBlocked(`${phrase(['不', '要'])}把 JSON 直接交付，要先核对。`, 'clean-workflow-wording');
assertBlocked(phrase(['如', '需要 PNG，再', '封装为']) + ' output/card.png', 'release-gate-required');

assert.strictEqual(scanText('build/repack -> verify release JSON -> json-to-png -> png-to-json -> verify extracted JSON -> delivery').length, 0);
assert.strictEqual(scanText("const fallbackValue = source || 'default';").length, 0);

const tempRoot = fs.mkdtempSync(path.join(ROOT, 'output', 'temp', 'workflow-clean-'));
fs.mkdirSync(path.join(tempRoot, 'prompts'), { recursive: true });
fs.mkdirSync(path.join(tempRoot, 'examples'), { recursive: true });
fs.mkdirSync(path.join(tempRoot, 'tools'), { recursive: true });
fs.mkdirSync(path.join(tempRoot, 'tests'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'AGENTS.md'), 'release JSON gate\n', 'utf8');
fs.writeFileSync(path.join(tempRoot, 'README.md'), 'png round-trip gate\n', 'utf8');
fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
fs.writeFileSync(path.join(tempRoot, 'prompts', 'ok.md'), 'verify extracted JSON before delivery\n', 'utf8');
fs.writeFileSync(path.join(tempRoot, 'examples', 'ignored.md'), phrase(['旧', '格式', '兼容']), 'utf8');

const report = scanWorkflow(tempRoot);
assert.strictEqual(report.ok, true, report.findings.map((finding) => `${finding.file}:${finding.line}`).join('\n'));

console.log('[pass] workflow clean verifier');
