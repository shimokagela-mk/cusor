#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateSchema } = require('./lib/schema-validator');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(ROOT, 'examples');
const SCHEMAS_DIR = path.join(ROOT, 'schemas');
const DATA_DIR = path.join(ROOT, 'data');

const EXAMPLE_SCHEMA_MAP = [
    ['examples/js-slash-runner/minimal-script.json', 'schemas/js-slash-runner-script.schema.json'],
    ['examples/js-slash-runner/multi-button-script.json', 'schemas/js-slash-runner-script.schema.json'],
    ['examples/sillytavern-assets/quick-reply-format.json', 'schemas/sillytavern-quick-reply.schema.json'],
    ['examples/sillytavern-assets/worldbook-format.json', 'schemas/sillytavern-worldbook.schema.json'],
    ['examples/sillytavern-assets/completion-preset-format.json', 'schemas/sillytavern-completion-preset.schema.json'],
    ['examples/sillytavern-assets/theme-ui-format.json', 'schemas/sillytavern-theme.schema.json'],
    ['examples/sillytavern-assets/regex-format.json', 'schemas/sillytavern-regex.schema.json'],
    ['examples/worldbook-entry/minimal-entry.json', 'schemas/worldbook-entry.schema.json'],
    ['examples/worldbook-entry/st-json-entry.json', 'schemas/sillytavern-worldbook-entry.schema.json'],
    ['examples/frontend-snippets/status-panel.json', 'schemas/frontend-snippet.schema.json'],
    ['examples/frontend-snippets/regex-replace-html.json', 'schemas/frontend-snippet.schema.json'],
    ['examples/stscript/quick-reply-command.json', 'schemas/sillytavern-quick-reply.schema.json'],
    ['examples/shujuku/minimal-template.json', 'schemas/shujuku-template.schema.json'],
    ['examples/shujuku/full-template-format.json', 'schemas/shujuku-template.schema.json'],
    ['examples/shujuku/plot-preset.json', 'schemas/shujuku-plot-preset.schema.json'],
    ['examples/shujuku/plot-preset-full-format.json', 'schemas/shujuku-plot-preset.schema.json'],
    ['examples/shujuku/api-preset.json', 'schemas/shujuku-api-preset.schema.json'],
    ['examples/shujuku/database-ui-theme-format.json', 'schemas/shujuku-ui-theme.schema.json'],
    ['examples/shujuku/body-replace-preset-format.json', 'schemas/shujuku-body-replace-preset.schema.json'],
    ['examples/mvu/initvar-format.json', 'schemas/mvu-initvar.schema.json'],
    ['examples/mvu/mvu-script.json', 'schemas/js-slash-runner-script.schema.json'],
];

const DATA_SCHEMA_MAP = [
    ['data/js-slash-runner-api.json', 'data/js-slash-runner-api.schema.json'],
    ['data/sillytavern-extension-api.json', 'data/sillytavern-extension-api.schema.json'],
    ['data/sillytavern-assets-api.json', 'data/sillytavern-assets-api.schema.json'],
    ['data/worldbook-entry-api.json', 'data/worldbook-entry-api.schema.json'],
    ['data/sillytavern-regex-api.json', 'data/sillytavern-regex-api.schema.json'],
    ['data/sillytavern-preset-api.json', 'data/sillytavern-preset-api.schema.json'],
    ['data/tavern-frontend-snippets-api.json', 'data/tavern-frontend-snippets-api.schema.json'],
    ['data/sillytavern-stscript-api.json', 'data/sillytavern-stscript-api.schema.json'],
    ['data/tavern-card-v3-format.json', 'data/tavern-card-v3-format.schema.json'],
    ['data/sillytavern-api-connections.json', 'data/sillytavern-api-connections.schema.json'],
    ['data/shujuku-api.json', 'data/shujuku-api.schema.json'],
    ['data/mvu-api.json', 'data/mvu-api.schema.json'],
    ['data/zod-api.json', 'data/zod-api.schema.json'],
    ['data/capabilities-index.json', 'data/capabilities-index.schema.json'],
];

function rel(file) {
    return path.relative(ROOT, file).replace(/\\/g, '/');
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        throw new Error(`${rel(file)} JSON 解析失败：${error.message}`);
    }
}

function listFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...listFiles(full));
        else out.push(full);
    }
    return out;
}

function checkJsonParseable() {
    const files = [
        ...listFiles(EXAMPLES_DIR).filter(f => f.endsWith('.json')),
        ...listFiles(SCHEMAS_DIR).filter(f => f.endsWith('.json')),
        ...listFiles(DATA_DIR).filter(f => f.endsWith('.json')),
        path.join(ROOT, 'package.json'),
    ];
    for (const file of files) readJson(file);
    return files.length;
}

function runMappedSchemaChecks(map) {
    const errors = [];
    for (const [jsonRel, schemaRel] of map) {
        const data = readJson(path.join(ROOT, jsonRel));
        const schema = readJson(path.join(ROOT, schemaRel));
        errors.push(...validateSchema(data, schema, jsonRel, schema));
    }
    return errors;
}

function runSpecialChecks() {
    const errors = [];

    for (const [jsonRel] of EXAMPLE_SCHEMA_MAP) {
        const text = fs.readFileSync(path.join(ROOT, jsonRel), 'utf8');
        const banned = ['伊兹米', '爱德华', 'Moonlit Echoes', 'Rivelle', 'Stitches Reborn', '小钰'];
        for (const word of banned) {
            if (text.includes(word)) errors.push(`${jsonRel}: 格式样例中残留正文/作品专名：${word}`);
        }
    }

    const jsScripts = EXAMPLE_SCHEMA_MAP.filter(([file, schema]) => schema.includes('js-slash-runner'));
    for (const [jsonRel] of jsScripts) {
        const obj = readJson(path.join(ROOT, jsonRel));
        if (!obj.content.includes('window.TavernHelper')) errors.push(`${jsonRel}: content 未检查 window.TavernHelper`);
    }

    const mvuScript = path.join(ROOT, 'examples/mvu/mvu-script.json');
    if (fs.existsSync(mvuScript)) {
        const obj = readJson(mvuScript);
        if (!obj.content.includes("waitGlobalInitialized('Mvu')")) {
            errors.push('examples/mvu/mvu-script.json: content 未等待 Mvu 初始化');
        }
        if (!obj.content.includes('Mvu.events')) {
            errors.push('examples/mvu/mvu-script.json: content 未使用 Mvu.events');
        }
    }

    const zodSnippet = path.join(ROOT, 'examples/zod/zod-schema-snippets.js');
    if (fs.existsSync(zodSnippet)) {
        const text = fs.readFileSync(zodSnippet, 'utf8');
        if (!text.includes('z.object(')) errors.push('examples/zod/zod-schema-snippets.js: 缺少 z.object 用法');
        if (!text.includes('safeParse')) errors.push('examples/zod/zod-schema-snippets.js: 缺少 safeParse 示例');
    }

    const stExt = path.join(ROOT, 'examples/sillytavern-extension/index.js');
    if (fs.existsSync(stExt)) {
        const text = fs.readFileSync(stExt, 'utf8');
        if (!text.includes('SillyTavern.getContext')) errors.push('examples/sillytavern-extension/index.js: 未使用 SillyTavern.getContext()');
    }

    const shujukuUi = path.join(ROOT, 'examples/shujuku/external-ui.js');
    if (fs.existsSync(shujukuUi)) {
        const text = fs.readFileSync(shujukuUi, 'utf8');
        if (!text.includes('window.AutoCardUpdaterAPI')) errors.push('examples/shujuku/external-ui.js: 未检查 window.AutoCardUpdaterAPI');
    }

    for (const relPath of [
        'examples/frontend-snippets/status-panel.json',
        'examples/frontend-snippets/regex-replace-html.json',
    ]) {
        const obj = readJson(path.join(ROOT, relPath));
        if (!obj.html.includes(obj.scope_class)) errors.push(`${relPath}: html 未包含 scope_class`);
        if (obj.css && !obj.css.includes(`.${obj.scope_class}`)) errors.push(`${relPath}: css 未使用 scope_class 作为选择器`);
        if (/on(?:click|error|load)\s*=|<script/i.test(obj.html + '\n' + (obj.css || ''))) {
            errors.push(`${relPath}: 前端片段包含潜在可执行 HTML`);
        }
    }

    const stscriptText = path.join(ROOT, 'examples/stscript/basic-flow.stscript');
    if (fs.existsSync(stscriptText)) {
        const text = fs.readFileSync(stscriptText, 'utf8');
        for (const command of ['/setvar', '/getvar', '/if']) {
            if (!text.includes(command)) errors.push(`examples/stscript/basic-flow.stscript: 缺少 ${command} 示例`);
        }
    }

    return errors;
}

function runValidation() {
    const parsedCount = checkJsonParseable();
    const errors = [
        ...runMappedSchemaChecks(EXAMPLE_SCHEMA_MAP),
        ...runMappedSchemaChecks(DATA_SCHEMA_MAP),
        ...runSpecialChecks(),
    ];
    return { parsedCount, errors };
}

function main() {
    const { parsedCount, errors } = runValidation();
    if (errors.length) {
        console.error(`[失败] 校验发现 ${errors.length} 个问题：`);
        for (const err of errors) console.error(`  - ${err}`);
        process.exit(1);
    }
    console.log(`[通过] JSON 可解析文件数: ${parsedCount}`);
    console.log(`[通过] 示例 schema 校验数: ${EXAMPLE_SCHEMA_MAP.length}`);
    console.log(`[通过] API 数据库 schema 校验数: ${DATA_SCHEMA_MAP.length}`);
    console.log('[通过] 特殊规则校验：入口对象/正文残留检查');
}

module.exports = {
    runValidation,
    EXAMPLE_SCHEMA_MAP,
    DATA_SCHEMA_MAP,
    ROOT,
};

if (require.main === module) {
    main();
}
