const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { verifyReleaseCard } = require('../tools/verify-release-card');

const ROOT = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(ROOT, 'output', 'temp', 'release-verifier-'));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

const tableTemplate = {
  sheet_master: {
    name: '御主状态表',
    content: [['uid', '姓名'], ['row_1', '<user>']]
  }
};

const plotPreset = {
  name: '剧情推进预设',
  prompts: [{ identifier: 'main', content: '推进正文' }],
  prompt_order: [{ order: ['main'] }]
};

const exactRegex = ['欢迎页面', '状态栏', '测试-剧情推进美化', '测试-剧情推进高楼层隐藏'];

function createProject(name) {
  const projectDir = path.join(tempRoot, name);
  ensureDir(path.join(projectDir, 'entries'));
  ensureDir(path.join(projectDir, 'tables', '_build'));
  ensureDir(path.join(projectDir, 'frontend'));
  fs.writeFileSync(path.join(projectDir, 'entries', '001-main.yaml'), 'uid: 001\ncontent: test\n', 'utf8');
  writeJson(path.join(projectDir, 'entries', '_build', 'worldbook.json'), { entries: [{ uid: '001', content: 'test' }] });
  writeJson(path.join(projectDir, 'tables', '_build', 'table-template.json'), tableTemplate);
  writeJson(path.join(projectDir, 'frontend', '剧情推进.json'), plotPreset);
  writeJson(path.join(projectDir, 'frontend', '推进正则配置.json'), {
    beautify: { scriptName: '测试-剧情推进美化', findRegex: '/x/' },
    cleanup: { scriptName: '测试-剧情推进高楼层隐藏', findRegex: '/x/', replaceString: '' }
  });
  return projectDir;
}

function createCard(overrides = {}) {
  const welcomeReplace = overrides.placeholder
    ? 'const EMBEDDED_TEMPLATE_BASE64 = "{{TEMPLATE_BASE64}}";\nconst EMBEDDED_PRESET_BASE64 = "{{PRESET_BASE64}}";'
    : `const EMBEDDED_TEMPLATE_BASE64 = "${encode(overrides.tableTemplate || tableTemplate)}";\nconst EMBEDDED_PRESET_BASE64 = "${encode(overrides.plotPreset || plotPreset)}";`;

  const regexScripts = [
    { scriptName: '欢迎页面', replaceString: welcomeReplace },
    { scriptName: '状态栏', replaceString: 'status' },
    { scriptName: '测试-剧情推进美化', replaceString: 'beautify' },
    { scriptName: '测试-剧情推进高楼层隐藏', replaceString: '' }
  ];

  return {
    spec: overrides.spec || 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: '测试卡',
      character_book: {
        entries: overrides.entries || [{ uid: '001', content: 'test' }]
      },
      extensions: {
        regex_scripts: overrides.regexScripts || regexScripts,
        tavern_helper: { scripts: [] }
      }
    }
  };
}

function runVerify(card, projectDir, extra = {}) {
  const jsonPath = path.join(projectDir, 'release', `${Date.now()}-${Math.random()}.json`);
  writeJson(jsonPath, card);
  return verifyReleaseCard({
    project: projectDir,
    json: jsonPath,
    'exact-regex': exactRegex.join(','),
    ...extra
  });
}

{
  const projectDir = createProject('ok-card');
  const result = runVerify(createCard(), projectDir);
  assert.strictEqual(result.ok, true, result.findings.join('\n'));
}

{
  const projectDir = createProject('missing-worldbook-row');
  const result = runVerify(createCard({ entries: [] }), projectDir);
  assert.strictEqual(result.ok, false);
  assert(result.findings.some((message) => message.includes('worldbook entry count mismatch')));
}

{
  const projectDir = createProject('missing-regex');
  const card = createCard({ regexScripts: createCard().data.extensions.regex_scripts.slice(0, 3) });
  const result = runVerify(card, projectDir);
  assert.strictEqual(result.ok, false);
  assert(result.findings.some((message) => message.includes('regex script names mismatch')));
}

{
  const projectDir = createProject('placeholder-left');
  const result = runVerify(createCard({ placeholder: true }), projectDir);
  assert.strictEqual(result.ok, false);
  assert(result.findings.some((message) => message.includes('unresolved base64 const placeholders')));
}

{
  const projectDir = createProject('table-mismatch');
  const result = runVerify(createCard({ tableTemplate: { other: { name: '错表', content: [] } } }), projectDir);
  assert.strictEqual(result.ok, false);
  assert(result.findings.some((message) => message.includes('embedded table template does not match')));
}

{
  const projectDir = createProject('preset-mismatch');
  const result = runVerify(createCard({ plotPreset: { name: '其他预设', prompts: [], prompt_order: [] } }), projectDir);
  assert.strictEqual(result.ok, false);
  assert(result.findings.some((message) => message.includes('embedded plot preset does not match')));
}

{
  const projectDir = createProject('compare-mismatch');
  const card = createCard();
  const comparePath = path.join(projectDir, 'release', 'compare.json');
  writeJson(comparePath, { ...card, spec_version: 'changed' });
  const result = runVerify(card, projectDir, { 'compare-json': comparePath });
  assert.strictEqual(result.ok, false);
  assert(result.findings.some((message) => message.includes('does not match --compare-json')));
}

console.log('[pass] release verifier');
