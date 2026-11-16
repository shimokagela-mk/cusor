'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { validateSchema } = require('../scripts/lib/schema-validator');

const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function readText(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

const NEGATIVE_CASES = [
    { fixture: 'tests/fixtures/invalid/js-script-missing-content.json', schema: 'schemas/js-slash-runner-script.schema.json' },
    { fixture: 'tests/fixtures/invalid/js-script-wrong-type.json', schema: 'schemas/js-slash-runner-script.schema.json' },
    { fixture: 'tests/fixtures/invalid/quick-reply-missing-qrlist.json', schema: 'schemas/sillytavern-quick-reply.schema.json' },
    { fixture: 'tests/fixtures/invalid/worldbook-no-entries.json', schema: 'schemas/sillytavern-worldbook.schema.json' },
    { fixture: 'tests/fixtures/invalid/completion-preset-no-prompts.json', schema: 'schemas/sillytavern-completion-preset.schema.json' },
    { fixture: 'tests/fixtures/invalid/theme-no-name.json', schema: 'schemas/sillytavern-theme.schema.json' },
    { fixture: 'tests/fixtures/invalid/regex-missing-find.json', schema: 'schemas/sillytavern-regex.schema.json' },
    { fixture: 'tests/fixtures/invalid/worldbook-entry-empty-keys.json', schema: 'schemas/worldbook-entry.schema.json' },
    { fixture: 'tests/fixtures/invalid/st-worldbook-entry-empty-key.json', schema: 'schemas/sillytavern-worldbook-entry.schema.json' },
    { fixture: 'tests/fixtures/invalid/frontend-snippet-empty-html.json', schema: 'schemas/frontend-snippet.schema.json' },
    { fixture: 'tests/fixtures/invalid/shujuku-template-no-mate.json', schema: 'schemas/shujuku-template.schema.json' },
    { fixture: 'tests/fixtures/invalid/shujuku-plot-no-name.json', schema: 'schemas/shujuku-plot-preset.schema.json' },
    { fixture: 'tests/fixtures/invalid/shujuku-api-preset-no-name.json', schema: 'schemas/shujuku-api-preset.schema.json' },
    { fixture: 'tests/fixtures/invalid/shujuku-ui-theme-no-theme.json', schema: 'schemas/shujuku-ui-theme.schema.json' },
    { fixture: 'tests/fixtures/invalid/shujuku-body-replace-not-array.json', schema: 'schemas/shujuku-body-replace-preset.schema.json' },
    { fixture: 'tests/fixtures/invalid/mvu-initvar-bad-leaf.json', schema: 'schemas/mvu-initvar.schema.json' },
];

function runNegativeSchemaCases() {
    for (const c of NEGATIVE_CASES) {
        const data = readJson(c.fixture);
        const schema = readJson(c.schema);
        const errors = validateSchema(data, schema, c.fixture, schema);
        assert.ok(
            errors.length > 0,
            `负例未被 schema 拦截：${c.fixture} 应当对 ${c.schema} 校验失败`
        );
    }
}

function runNegativeSpecialCases() {
    const mvuScript = readJson('tests/fixtures/invalid/mvu-script-no-await.json');
    assert.ok(
        !mvuScript.content.includes("waitGlobalInitialized('Mvu')"),
        'MVU 反例脚本不应当包含 waitGlobalInitialized 调用'
    );
    assert.ok(
        mvuScript.content.includes('Mvu.events'),
        'MVU 反例脚本仍应当含 Mvu.events，用于体现“缺等待”而非“缺事件”'
    );

    const zodSnippet = readText('tests/fixtures/invalid/zod-snippet-no-safeparse.js');
    assert.ok(zodSnippet.includes('parse'), 'zod 反例至少应当展示 parse 调用');
    assert.ok(!zodSnippet.includes('safeParse'), 'zod 反例不应包含 safeParse');
}

function main() {
    runNegativeSchemaCases();
    runNegativeSpecialCases();
    console.log(`[通过] 反向测试：${NEGATIVE_CASES.length} 个 schema 反例 + 2 个特殊规则反例均被拦截`);
}

if (require.main === module) {
    main();
}

module.exports = { runNegativeSchemaCases, runNegativeSpecialCases };
