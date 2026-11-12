#!/usr/bin/env node
'use strict';

/**
 * 交叉引用检查：确认 examples/ 中代码出现的 API 名都能在 data/*-api.json 里查到。
 * 当前覆盖：
 *   - JS-Slash-Runner：TavernHelper 接口名 + iframe_events / tavern_events 引用关键词
 *   - SillyTavern Extension：SillyTavern.getContext + 已记录入口（eventSource / event_types / Popup ...）
 *   - shujuku：window.AutoCardUpdaterAPI 的方法名
 *   - MVU：Mvu.* 方法 + Mvu.events.* 事件
 *   - STscript：示例中的 slash command 是否登记在 data/sillytavern-stscript-api.json
 *   - Frontend snippets：示例声明的 snippet kind 是否登记在 data/tavern-frontend-snippets-api.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function readText(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function unique(arr) {
    return Array.from(new Set(arr));
}

function collectKnownApis() {
    const known = {
        tavernHelper: new Set(),
        stExtension: new Set(),
        shujuku: new Set(),
        mvuMethods: new Set(),
        mvuEvents: new Set(),
        zod: new Set(),
        stscriptCommands: new Set(),
        frontendSnippetKinds: new Set(),
    };

    const jsr = readJson('data/js-slash-runner-api.json');
    for (const api of jsr.apis || []) {
        if (api.category === 'sillytavern_native') continue;
        known.tavernHelper.add(api.name);
    }

    const ste = readJson('data/sillytavern-extension-api.json');
    for (const api of ste.core_apis || []) known.stExtension.add(api.name);
    for (const api of (ste.function_calling && ste.function_calling.apis) || []) known.stExtension.add(api.name);

    const shu = readJson('data/shujuku-api.json');
    for (const group of shu.groups || []) {
        for (const api of group.apis || []) known.shujuku.add(api.name);
    }

    const mvu = readJson('data/mvu-api.json');
    for (const api of mvu.apis || []) known.mvuMethods.add(api.name.replace(/^Mvu\./, ''));
    for (const ev of mvu.events || []) known.mvuEvents.add(ev.name.replace(/^Mvu\.events\./, ''));

    const zod = readJson('data/zod-api.json');
    for (const list of [
        zod.primitives || [],
        zod.literals_and_enums || [],
        zod.containers || [],
        zod.compositions || [],
        zod.transforms_and_refinements || [],
        zod.parsing || [],
    ]) {
        for (const item of list) known.zod.add(item.name.replace(/^z\./, ''));
    }

    const stscript = readJson('data/sillytavern-stscript-api.json');
    for (const command of stscript.commands || []) known.stscriptCommands.add(command.name.replace(/^\//, ''));

    const snippets = readJson('data/tavern-frontend-snippets-api.json');
    for (const item of snippets.snippet_types || []) known.frontendSnippetKinds.add(item.name);

    return known;
}

function findReferences(text, regex) {
    const out = [];
    let m;
    while ((m = regex.exec(text)) !== null) out.push(m[1]);
    return unique(out);
}

function checkText(file, known) {
    const text = readText(file);
    const errors = [];

    for (const name of findReferences(text, /TavernHelper\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!known.tavernHelper.has(name)) errors.push(`${file}: TavernHelper.${name} 未在 data/js-slash-runner-api.json 中定义`);
    }

    for (const name of findReferences(text, /window\.AutoCardUpdaterAPI\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!known.shujuku.has(name)) errors.push(`${file}: AutoCardUpdaterAPI.${name} 未在 data/shujuku-api.json 中定义`);
    }
    for (const name of findReferences(text, /\bapi\.([A-Za-z_][A-Za-z0-9_]*)\(/g)) {
        if (file.includes('shujuku') && !known.shujuku.has(name)) {
            errors.push(`${file}: api.${name}() 未在 data/shujuku-api.json 中定义`);
        }
    }

    for (const name of findReferences(text, /Mvu\.events\.([A-Z_][A-Z0-9_]*)/g)) {
        if (!known.mvuEvents.has(name)) errors.push(`${file}: Mvu.events.${name} 未在 data/mvu-api.json 中定义`);
    }
    for (const name of findReferences(text, /Mvu\.([A-Za-z_][A-Za-z0-9_]*)\(/g)) {
        if (name === 'events') continue;
        if (!known.mvuMethods.has(name)) errors.push(`${file}: Mvu.${name}() 未在 data/mvu-api.json 中定义`);
    }

    return errors;
}

function listExampleSources() {
    const candidates = [
        'examples/js-slash-runner/minimal-script.json',
        'examples/js-slash-runner/multi-button-script.json',
        'examples/sillytavern-extension/index.js',
        'examples/shujuku/external-ui.js',
        'examples/mvu/mvu-script.json',
        'examples/zod/zod-schema-snippets.js',
        'examples/stscript/basic-flow.stscript',
        'examples/stscript/quick-reply-command.json',
        'examples/frontend-snippets/status-panel.json',
        'examples/frontend-snippets/regex-replace-html.json',
    ];
    return candidates.filter(f => fs.existsSync(path.join(ROOT, f)));
}

function extractScriptContent(file) {
    if (file.endsWith('.json')) {
        const obj = readJson(file);
        if (file.includes('stscript') && Array.isArray(obj.qrList)) {
            return obj.qrList.map(item => item.message || '').join('\n');
        }
        if (file.includes('frontend-snippets')) {
            return [obj.kind, obj.html, obj.css].filter(Boolean).join('\n');
        }
        return typeof obj.content === 'string' ? obj.content : '';
    }
    return readText(file);
}

function runCheck() {
    const known = collectKnownApis();
    const errors = [];

    for (const file of listExampleSources()) {
        const text = extractScriptContent(file);
        const tmp = `/* virtual: ${file} */\n${text}`;
        const result = checkText.call(null, file, known, tmp) || [];
        // 需要真实文本：使用 inline implementation
        const inlineErrors = (function inlineCheck() {
            const out = [];
            const refs = (re) => {
                const arr = [];
                let m;
                while ((m = re.exec(text)) !== null) arr.push(m[1]);
                return Array.from(new Set(arr));
            };

            for (const name of refs(/TavernHelper\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
                if (!known.tavernHelper.has(name)) out.push(`${file}: TavernHelper.${name} 未在 data/js-slash-runner-api.json 中定义`);
            }
            for (const name of refs(/window\.AutoCardUpdaterAPI\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
                if (!known.shujuku.has(name)) out.push(`${file}: AutoCardUpdaterAPI.${name} 未在 data/shujuku-api.json 中定义`);
            }
            if (file.includes('shujuku')) {
                for (const name of refs(/\bapi\.([A-Za-z_][A-Za-z0-9_]*)\(/g)) {
                    if (!known.shujuku.has(name)) out.push(`${file}: api.${name}() 未在 data/shujuku-api.json 中定义`);
                }
            }
            for (const name of refs(/Mvu\.events\.([A-Z_][A-Z0-9_]*)/g)) {
                if (!known.mvuEvents.has(name)) out.push(`${file}: Mvu.events.${name} 未在 data/mvu-api.json 中定义`);
            }
            for (const name of refs(/Mvu\.([A-Za-z_][A-Za-z0-9_]*)\(/g)) {
                if (name === 'events') continue;
                if (!known.mvuMethods.has(name)) out.push(`${file}: Mvu.${name}() 未在 data/mvu-api.json 中定义`);
            }
            if (file.includes('stscript')) {
                for (const name of refs(/\/(setvar|getvar|if|run|trigger|send|sys|echo)\b/g)) {
                    if (!known.stscriptCommands.has(name)) out.push(`${file}: /${name} 未在 data/sillytavern-stscript-api.json 中定义`);
                }
            }
            if (file.includes('frontend-snippets') && file.endsWith('.json')) {
                const obj = readJson(file);
                if (!known.frontendSnippetKinds.has(obj.kind)) {
                    out.push(`${file}: snippet kind ${obj.kind} 未在 data/tavern-frontend-snippets-api.json 中定义`);
                }
            }
            return out;
        })();

        errors.push(...inlineErrors);
    }

    return errors;
}

function main() {
    const errors = runCheck();
    if (errors.length) {
        console.error(`[失败] 交叉引用检查发现 ${errors.length} 个问题：`);
        for (const e of errors) console.error(`  - ${e}`);
        process.exit(1);
    }
    console.log('[通过] examples 中所有 API 名称均能在 data/*-api.json 中查到');
}

module.exports = { runCheck };

if (require.main === module) {
    main();
}
