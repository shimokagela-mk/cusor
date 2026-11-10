'use strict';

/**
 * 工具脚本闭环测试：
 *   1. scripts/new.js 生成 js-script
 *   2. scripts/validate-examples.js 应当通过（生成产物使用 examples 已知 API）
 *   3. scripts/convert.js 解包后再打包，与原文 LF 归一化后字节恒等
 *   4. scripts/check-api-references.js 通过
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function runNode(script, args = [], opts = {}) {
    return execFileSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        ...opts,
    });
}

function readText(file) {
    return fs.readFileSync(file, 'utf8');
}

function rmrf(dir) {
    if (!fs.existsSync(dir)) return;
    fs.rmSync(dir, { recursive: true, force: true });
}

function lfHash(text) {
    const lf = text.replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(Buffer.from(lf, 'utf8')).digest('hex');
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeScriptJson(file, { name, id, content }) {
    fs.writeFileSync(file, JSON.stringify({
        type: 'script',
        enabled: true,
        name,
        id,
        content,
        info: '',
        button: { enabled: false, buttons: [] },
        data: {},
    }, null, 2) + '\n', 'utf8');
}

function writeRegexJson(file, { name, findRegex, replaceString }) {
    fs.writeFileSync(file, JSON.stringify({
        id: crypto.randomUUID(),
        scriptName: name,
        findRegex,
        replaceString,
        trimStrings: [],
        placement: [2],
        disabled: false,
        markdownOnly: true,
        promptOnly: false,
        runOnEdit: true,
        substituteRegex: 0,
        minDepth: 0,
        maxDepth: 999,
        info: '',
    }, null, 2) + '\n', 'utf8');
}

function runNodeCapture(script, args = []) {
    const result = spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error(`${script} 失败：${result.stdout || ''}${result.stderr || ''}`);
    }
    return `${result.stdout || ''}${result.stderr || ''}`;
}

function runNodeExpectFailure(script, args = []) {
    try {
        runNode(script, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
        return `${error.stdout || ''}${error.stderr || ''}`;
    }
    throw new Error(`${script} 应当失败，但实际成功`);
}

function testNewGeneratesValidScript() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-tools-'));
    try {
        runNode('scripts/new.js', ['js-script', '__tmp_test_script__', '--out', tmp, '--force']);
        const out = path.join(tmp, '__tmp_test_script__.json');
        assert.ok(fs.existsSync(out), '应当生成 JSON 文件');
        const json = JSON.parse(readText(out));
        assert.strictEqual(json.type, 'script');
        assert.strictEqual(json.name, '__tmp_test_script__');
        assert.ok(json.id && json.id.length >= 8, '应当生成 id');
        assert.ok(json.content.includes('window.TavernHelper'), '生成结果应当保留 window.TavernHelper 检查');
    } finally {
        rmrf(tmp);
    }
}

function testNewExtensionGeneratesDirectory() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ext-'));
    try {
        runNode('scripts/new.js', ['st-extension', '__tmp_ext__', '--out', tmp, '--force']);
        const dir = path.join(tmp, '__tmp_ext__');
        assert.ok(fs.existsSync(path.join(dir, 'manifest.json')), '应当生成 manifest.json');
        assert.ok(fs.existsSync(path.join(dir, 'index.js')), '应当生成 index.js');
        assert.ok(fs.existsSync(path.join(dir, 'style.css')), '应当生成 style.css');
        const idx = readText(path.join(dir, 'index.js'));
        assert.ok(idx.includes('SillyTavern.getContext'), '原生扩展样例必须包含 SillyTavern.getContext');
        assert.ok(idx.includes('__tmp_ext__'), '原生扩展样例应当使用新的 slug');
    } finally {
        rmrf(tmp);
    }
}

function testNewKnowledgeTemplates() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-knowledge-'));
    try {
        runNode('scripts/new.js', ['worldbook-entry', '__tmp_entry__', '--out', tmp, '--force']);
        const entry = JSON.parse(readText(path.join(tmp, '__tmp_entry__.json')));
        assert.strictEqual(entry.comment, '__tmp_entry__');
        assert.ok(Array.isArray(entry.keys) && entry.keys.length > 0, '世界书单条目应保留 keys');

        runNode('scripts/new.js', ['frontend-snippet', '__tmp_panel__', '--out', tmp, '--force']);
        const panel = JSON.parse(readText(path.join(tmp, '__tmp_panel__.json')));
        assert.strictEqual(panel.name, '__tmp_panel__');
        assert.strictEqual(panel.scope_class, 'nl-__tmp_panel__');
        assert.ok(panel.html.includes('nl-__tmp_panel__'), '前端片段 html 应使用新 scope_class');
        assert.ok(panel.css.includes('.nl-__tmp_panel__'), '前端片段 css 应使用新 scope_class');

        runNode('scripts/new.js', ['stscript-quick-reply', '__tmp_qr__', '--out', tmp, '--force']);
        const qr = JSON.parse(readText(path.join(tmp, '__tmp_qr__.json')));
        assert.strictEqual(qr.name, '__tmp_qr__');
        assert.ok(qr.qrList.some(item => item.message.includes('/setvar')), 'STscript Quick Reply 应保留 slash command');
    } finally {
        rmrf(tmp);
    }
}

function testConvertRoundTrip() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-convert-'));
    try {
        runNode('scripts/new.js', ['js-script', '__tmp_roundtrip__', '--out', tmp, '--force']);
        const sourceJson = path.join(tmp, '__tmp_roundtrip__.json');
        const unpacked = path.join(tmp, 'unpacked.js');
        runNode('scripts/convert.js', [sourceJson, '--out', unpacked, '--no-overwrite']);
        const repacked = path.join(tmp, 'repacked.json');
        runNode('scripts/convert.js', [unpacked, '--out', repacked, '--meta', sourceJson, '--no-overwrite']);

        const source = JSON.parse(readText(sourceJson));
        const round = JSON.parse(readText(repacked));
        assert.strictEqual(round.type, source.type);
        assert.strictEqual(round.id, source.id);
        assert.strictEqual(readText(unpacked), source.content, '解包 JS 应等于 JSON.parse(source).content');

        const sourceContentHash = lfHash(source.content);
        const roundContentHash = lfHash(round.content);
        assert.strictEqual(roundContentHash, sourceContentHash, '往返转换 LF 归一化后 content 应当一致');
    } finally {
        rmrf(tmp);
    }
}

function testConvertJsonContentDeserializesEscapes() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-convert-escapes-'));
    try {
        const sourceJson = path.join(tmp, 'escaped-script.json');
        const unpacked = path.join(tmp, 'escaped-script.js');
        const content = [
            'line1',
            'line2 "quote"',
            'path \\\\ slash',
            '',
        ].join('\n');
        fs.writeFileSync(sourceJson, JSON.stringify({
            type: 'script',
            enabled: true,
            name: 'escaped-script',
            id: '00000000-0000-4000-8000-000000000099',
            content,
            info: '',
            button: { enabled: false, buttons: [] },
            data: {},
        }, null, 2) + '\n', 'utf8');

        const output = runNode('scripts/convert.js', [sourceJson, '--out', unpacked, '--no-overwrite']);
        const js = readText(unpacked);
        assert.strictEqual(js, content, '输出 JS 必须等于 JSON.parse(input).content');
        assert.ok(js.includes('line1\nline2 "quote"'), '输出 JS 应包含真实换行和真实引号');
        assert.ok(!js.includes('\\nline2'), '输出 JS 不应保留字面 JSON 转义 \\n');
        assert.ok(output.includes('JSON content 反序列化'), '日志应标明 JSON content 反序列化');
        assert.ok(output.includes('输出 JS === JSON.parse(input).content'), '日志应输出等价校验');
    } finally {
        rmrf(tmp);
    }
}

function testConvertInfersProjectContext() {
    const projectName = '__tmp_convert_project__';
    const projectDir = path.join(ROOT, 'projects', projectName);
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        const content = 'console.log("project scoped");\n';
        const sourceJson = path.join(latest, `酒馆助手脚本-${projectName} v1.0.json`);
        writeScriptJson(sourceJson, {
            name: projectName,
            id: '00000000-0000-4000-8000-000000000101',
            content,
        });

        runNode('scripts/convert.js', [sourceJson, '--no-overwrite']);
        const unpacked = path.join(latest, `${projectName} v1.0.js`);
        assert.strictEqual(readText(unpacked), content, '项目内 JSON 解包应默认写入同项目 latest');

        const repacked = path.join(latest, 'repacked.json');
        runNode('scripts/convert.js', [unpacked, '--out', repacked, '--no-overwrite']);
        const round = JSON.parse(readText(repacked));
        assert.strictEqual(round.id, '00000000-0000-4000-8000-000000000101', 'JS 回包应只自动复用同项目 metadata');
        assert.strictEqual(round.content, content);
    } finally {
        rmrf(projectDir);
    }
}

function testConvertDoesNotUseOtherProjectMetadata() {
    const alphaDir = path.join(ROOT, 'projects', '__tmp_alpha_meta__', 'latest');
    const betaDir = path.join(ROOT, 'projects', '__tmp_beta_meta__', 'latest');
    try {
        ensureDir(alphaDir);
        ensureDir(betaDir);
        writeScriptJson(path.join(alphaDir, '酒馆助手脚本-alpha v1.0.json'), {
            name: 'alpha',
            id: '00000000-0000-4000-8000-000000000201',
            content: 'console.log("alpha");\n',
        });
        const betaJs = path.join(betaDir, '__tmp_beta_meta__ v1.0.js');
        fs.writeFileSync(betaJs, 'console.log("beta");\n', 'utf8');

        const out = path.join(betaDir, 'beta-packed.json');
        const log = runNode('scripts/convert.js', [betaJs, '--out', out, '--no-overwrite']);
        const packed = JSON.parse(readText(out));
        assert.notStrictEqual(packed.id, '00000000-0000-4000-8000-000000000201', '不应跨项目复用同版本 metadata');
        assert.ok(log.includes('默认模板'), '同项目无 metadata 时应使用默认模板并提示');
    } finally {
        rmrf(path.join(ROOT, 'projects', '__tmp_alpha_meta__'));
        rmrf(path.join(ROOT, 'projects', '__tmp_beta_meta__'));
    }
}

function testConvertRequiresOutForArchiveInput() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_archive_guard__');
    const archived = path.join(projectDir, 'archive', 'v1.0');
    try {
        ensureDir(archived);
        const sourceJson = path.join(archived, '酒馆助手脚本-archive v1.0.json');
        writeScriptJson(sourceJson, {
            name: 'archive',
            id: '00000000-0000-4000-8000-000000000301',
            content: 'console.log("archive");\n',
        });

        const output = runNodeExpectFailure('scripts/convert.js', [sourceJson]);
        assert.ok(output.includes('archive 历史版本'), 'archive 输入缺少 --out 时应阻止默认写入');
    } finally {
        rmrf(projectDir);
    }
}

function testVerifyProject() {
    const projectName = '__tmp_verify_project__';
    const projectDir = path.join(ROOT, 'projects', projectName);
    const latest = path.join(projectDir, 'latest');
    const archived = path.join(projectDir, 'archive', 'v0.9');
    try {
        ensureDir(latest);
        ensureDir(archived);
        const latestContent = 'console.log("latest");\n';
        const archiveContent = 'console.log("archive");\n';

        writeScriptJson(path.join(latest, `酒馆助手脚本-${projectName} v1.0.json`), {
            name: projectName,
            id: '00000000-0000-4000-8000-000000000401',
            content: latestContent,
        });
        fs.writeFileSync(path.join(latest, `${projectName} v1.0.js`), latestContent, 'utf8');

        writeScriptJson(path.join(archived, `酒馆助手脚本-${projectName} v0.9.json`), {
            name: projectName,
            id: '00000000-0000-4000-8000-000000000402',
            content: archiveContent,
        });
        fs.writeFileSync(path.join(archived, `${projectName} v0.9.js`), archiveContent, 'utf8');

        const output = runNode('scripts/verify-project.js', [projectName]);
        assert.ok(output.includes('项目版本与 JSON/JS 配对校验通过'));
    } finally {
        rmrf(projectDir);
    }
}

function testExpandJsStringLiterals() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-expand-strings-'));
    try {
        const input = path.join(tmp, 'input.js');
        const output = path.join(tmp, 'output.js');
        const source = [
            "import dep from './dep.js';",
            "const text = 'line1\\nline2';",
            "const keep = 'keep \\\\n as two chars';",
            "const special = 'line\\ntick ` and expr ${name} and slash \\\\';",
            "const templ = `alpha\\nbeta${name}tail\\nend`; ",
            "const obj = { 'key\\nname': 1 };",
            "const regex = /\\n/;",
            "console.log(dep, text, keep, special, templ, obj, regex);",
            '',
        ].join('\n');
        fs.writeFileSync(input, source, 'utf8');

        runNode('scripts/expand-js-string-literals.js', [input, '--out', output, '--no-overwrite']);
        execFileSync(process.execPath, ['--check', output], { cwd: ROOT, stdio: 'pipe' });

        const expanded = readText(output);
        assert.ok(expanded.includes('const text = `line1\nline2`;'), '换行字符串字面量应转为多行模板字符串');
        assert.ok(expanded.includes("const keep = 'keep \\\\n as two chars';"), '字面反斜杠 n 不应被误展开');
        assert.ok(expanded.includes('tick \\`'), '转换后的模板字符串必须转义反引号');
        assert.ok(expanded.includes('expr \\${name}'), '转换后的模板字符串必须转义模板插值标记');
        assert.ok(expanded.includes("const obj = { 'key\\nname': 1 };"), '非 computed 对象键不应被转换');
        assert.ok(expanded.includes('const regex = /\\n/;'), '正则字面量不应被转换');
        assert.ok(expanded.includes('`alpha\nbeta${name}tail\nend`'), '模板字符串片段中的转义换行应展开');
    } finally {
        rmrf(tmp);
    }
}

function testUnpackProjectCreatesTavernHelperForJsOnly() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_unpack_js_only__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        fs.writeFileSync(path.join(latest, '__tmp_unpack_js_only__ v1.0.js'), 'console.log("plain");\n', 'utf8');
        const log = runNode('scripts/unpack-project.js', [projectDir]);
        const config = JSON.parse(readText(path.join(projectDir, 'project.json')));
        assert.ok(!Object.prototype.hasOwnProperty.call(config, 'profile'), 'project.json 不应包含 profile');
        assert.ok(!Object.prototype.hasOwnProperty.call(config, 'profile_reason'), 'project.json 不应包含 profile_reason');
        assert.strictEqual(config.outputs[0].type, 'plain-js');
        assert.strictEqual(config.outputs[0].root, 'tavern helper/main');
        assert.strictEqual(config.outputs[0].entry, 'src/index.js');
        assert.strictEqual(readText(path.join(projectDir, 'tavern helper', 'main', 'src', 'index.js')), 'console.log("plain");\n');
        assert.ok(log.includes('Tavern 资产类型分层'));
    } finally {
        rmrf(projectDir);
    }
}

function testUnpackProjectCreatesTavernHelperForScriptPair() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_unpack_script_pair__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        const content = 'console.log("pair");\n';
        writeScriptJson(path.join(latest, '酒馆助手脚本-__tmp_unpack_script_pair__ v1.0.json'), {
            name: '__tmp_unpack_script_pair__',
            id: '00000000-0000-4000-8000-000000000501',
            content,
        });
        fs.writeFileSync(path.join(latest, '__tmp_unpack_script_pair__ v1.0.js'), content, 'utf8');
        runNode('scripts/unpack-project.js', [projectDir]);
        const config = JSON.parse(readText(path.join(projectDir, 'project.json')));
        assert.strictEqual(config.outputs[0].type, 'js-slash-runner');
        assert.strictEqual(config.outputs[0].root, 'tavern helper/main');
        assert.strictEqual(readText(path.join(projectDir, 'tavern helper', 'main', 'src', 'index.js')), content);
        const meta = JSON.parse(readText(path.join(projectDir, 'tavern helper', 'main', 'meta.json')));
        assert.strictEqual(meta.id, '00000000-0000-4000-8000-000000000501');
        assert.ok(!Object.prototype.hasOwnProperty.call(meta, 'content'), 'metadata 不应包含 content');
    } finally {
        rmrf(projectDir);
    }
}

function testUnpackProjectCreatesRegexAsset() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_unpack_regex_asset__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        const content = 'console.log("bridge");\n';
        writeScriptJson(path.join(latest, '酒馆助手脚本-__tmp_unpack_regex_asset__ v1.0.json'), {
            name: '__tmp_unpack_regex_asset__',
            id: '00000000-0000-4000-8000-000000000601',
            content,
        });
        fs.writeFileSync(path.join(latest, '__tmp_unpack_regex_asset__ v1.0.js'), content, 'utf8');
        writeRegexJson(path.join(latest, 'regex-__tmp_unpack_regex_asset__ v1.0.json'), {
            name: '__tmp_unpack_regex_asset__ v1.0',
            findRegex: '/<content>([\\s\\S]*?)<\\/content>/gi',
            replaceString: '```\n<body><style>.x{color:red}</style><script>console.log(1)</script></body>\n```\n',
        });

        runNode('scripts/unpack-project.js', [projectDir]);
        const config = JSON.parse(readText(path.join(projectDir, 'project.json')));
        assert.ok(!Object.prototype.hasOwnProperty.call(config, 'profile'), 'project.json 不应包含 profile');
        const bridge = config.outputs.find((output) => output.type === 'js-slash-runner');
        const regex = config.outputs.find((output) => output.type === 'sillytavern-regex');
        assert.strictEqual(bridge.root, 'tavern helper/bridge');
        assert.strictEqual(regex.root, 'regex/main');
        assert.ok(fs.existsSync(path.join(projectDir, 'tavern helper', 'bridge', 'src', 'index.js')));
        assert.ok(fs.existsSync(path.join(projectDir, 'regex', 'main', 'src', 'findRegex.txt')));
        assert.ok(readText(path.join(projectDir, 'regex', 'main', 'src', 'replace.html')).includes('<style>'));
    } finally {
        rmrf(projectDir);
    }
}

function testUnpackProjectRejectsProfileOption() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_unpack_reject_profile__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        fs.writeFileSync(path.join(latest, '__tmp_unpack_reject_profile__ v1.0.js'), 'console.log("reject");\n', 'utf8');
        const output = runNodeExpectFailure('scripts/unpack-project.js', [projectDir, '--profile', 'large']);
        assert.ok(output.includes('未知选项：--profile'), 'unpack-project 不应再接受 --profile');
    } finally {
        rmrf(projectDir);
    }
}

function testPackProjectArchivesAndUsesAssetRoots() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_pack_project__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        const content = 'console.log("pack");\n';
        writeScriptJson(path.join(latest, '酒馆助手脚本-__tmp_pack_project__ v1.0.json'), {
            name: '__tmp_pack_project__',
            id: '00000000-0000-4000-8000-000000000701',
            content,
        });
        fs.writeFileSync(path.join(latest, '__tmp_pack_project__ v1.0.js'), content, 'utf8');
        runNode('scripts/unpack-project.js', [projectDir]);
        runNode('scripts/pack-project.js', [projectDir, '--version', 'v1.1']);
        assert.ok(fs.existsSync(path.join(projectDir, 'archive', 'v1.0', '__tmp_pack_project__ v1.0.js')), '旧 latest 应归档');
        assert.ok(fs.existsSync(path.join(latest, '__tmp_pack_project__ v1.1.js')), '应生成新版本 JS');
        const packed = JSON.parse(readText(path.join(latest, '酒馆助手脚本-__tmp_pack_project__ v1.1.json')));
        assert.strictEqual(packed.content, content);
        const verify = runNode('scripts/verify-project.js', [projectDir]);
        assert.ok(verify.includes('校验通过'));
    } finally {
        rmrf(projectDir);
    }
}

function testVerifyProjectRejectsLegacyRootSrc() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_verify_legacy_src__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        fs.writeFileSync(path.join(latest, '__tmp_verify_legacy_src__ v1.0.js'), 'console.log("x");\n', 'utf8');
        runNode('scripts/unpack-project.js', [projectDir]);
        ensureDir(path.join(projectDir, 'src'));
        fs.writeFileSync(path.join(projectDir, 'src', 'main.js'), 'console.log("legacy");\n', 'utf8');
        const output = runNodeExpectFailure('scripts/verify-project.js', [projectDir]);
        assert.ok(output.includes('旧协议结构'));
    } finally {
        rmrf(projectDir);
    }
}

function testVerifyProjectRejectsUnknownAssetRoot() {
    const projectDir = path.join(ROOT, 'projects', '__tmp_verify_unknown_root__');
    const latest = path.join(projectDir, 'latest');
    try {
        ensureDir(latest);
        fs.writeFileSync(path.join(latest, '__tmp_verify_unknown_root__ v1.0.js'), 'console.log("x");\n', 'utf8');
        runNode('scripts/unpack-project.js', [projectDir]);
        const configPath = path.join(projectDir, 'project.json');
        const config = JSON.parse(readText(configPath));
        config.outputs[0].root = 'unknown/main';
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
        const output = runNodeExpectFailure('scripts/verify-project.js', [projectDir]);
        assert.ok(output.includes('未知资产类型 root'));
    } finally {
        rmrf(projectDir);
    }
}

function testValidateExamples() {
    runNode('scripts/validate-examples.js');
}

function testCheckReferences() {
    runNode('scripts/check-api-references.js');
}

function main() {
    testNewGeneratesValidScript();
    testNewExtensionGeneratesDirectory();
    testNewKnowledgeTemplates();
    testConvertRoundTrip();
    testConvertJsonContentDeserializesEscapes();
    testConvertInfersProjectContext();
    testConvertDoesNotUseOtherProjectMetadata();
    testConvertRequiresOutForArchiveInput();
    testVerifyProject();
    testExpandJsStringLiterals();
    testUnpackProjectCreatesTavernHelperForJsOnly();
    testUnpackProjectCreatesTavernHelperForScriptPair();
    testUnpackProjectCreatesRegexAsset();
    testUnpackProjectRejectsProfileOption();
    testPackProjectArchivesAndUsesAssetRoots();
    testVerifyProjectRejectsLegacyRootSrc();
    testVerifyProjectRejectsUnknownAssetRoot();
    testValidateExamples();
    testCheckReferences();
    console.log('[通过] 工具脚本测试：new / convert 往返 / validate-examples / check-api-references 全绿');
}

if (require.main === module) {
    main();
}

module.exports = {
    testNewGeneratesValidScript,
    testNewExtensionGeneratesDirectory,
    testNewKnowledgeTemplates,
    testConvertRoundTrip,
    testConvertJsonContentDeserializesEscapes,
    testConvertInfersProjectContext,
    testConvertDoesNotUseOtherProjectMetadata,
    testConvertRequiresOutForArchiveInput,
    testVerifyProject,
    testExpandJsStringLiterals,
    testUnpackProjectCreatesTavernHelperForJsOnly,
    testUnpackProjectCreatesTavernHelperForScriptPair,
    testUnpackProjectCreatesRegexAsset,
    testUnpackProjectRejectsProfileOption,
    testPackProjectArchivesAndUsesAssetRoots,
    testVerifyProjectRejectsLegacyRootSrc,
    testVerifyProjectRejectsUnknownAssetRoot,
    testValidateExamples,
    testCheckReferences,
};
