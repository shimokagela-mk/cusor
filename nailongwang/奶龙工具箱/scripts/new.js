#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

const TEMPLATES = {
    'js-script': {
        source: 'examples/js-slash-runner/minimal-script.json',
        outDir: 'generated/js-slash-runner',
        ext: '.json',
        kind: 'json',
        description: 'JS-Slash-Runner 可导入脚本 JSON',
    },
    'js-script-buttons': {
        source: 'examples/js-slash-runner/multi-button-script.json',
        outDir: 'generated/js-slash-runner',
        ext: '.json',
        kind: 'json',
        description: 'JS-Slash-Runner 多按钮脚本 JSON',
    },
    'st-extension': {
        sourceDir: 'examples/sillytavern-extension',
        outDir: 'generated/sillytavern-extension',
        kind: 'dir',
        description: 'SillyTavern 原生扩展目录',
    },
    'quick-reply': {
        source: 'examples/sillytavern-assets/quick-reply-format.json',
        outDir: 'generated/sillytavern-assets',
        ext: '.json',
        kind: 'json',
        description: 'SillyTavern 快速回复 JSON',
    },
    'worldbook': {
        source: 'examples/sillytavern-assets/worldbook-format.json',
        outDir: 'generated/sillytavern-assets',
        ext: '.json',
        kind: 'json',
        description: 'SillyTavern 世界书 JSON',
    },
    'completion-preset': {
        source: 'examples/sillytavern-assets/completion-preset-format.json',
        outDir: 'generated/sillytavern-assets',
        ext: '.json',
        kind: 'json',
        description: 'SillyTavern 对话补全预设 JSON',
    },
    'theme': {
        source: 'examples/sillytavern-assets/theme-ui-format.json',
        outDir: 'generated/sillytavern-assets',
        ext: '.json',
        kind: 'json',
        description: 'SillyTavern 主题 UI JSON',
    },
    'regex': {
        source: 'examples/sillytavern-assets/regex-format.json',
        outDir: 'generated/sillytavern-assets',
        ext: '.json',
        kind: 'json',
        description: 'SillyTavern Regex JSON',
    },
    'worldbook-entry': {
        source: 'examples/worldbook-entry/minimal-entry.json',
        outDir: 'generated/worldbook-entry',
        ext: '.json',
        kind: 'json',
        description: '世界书单条目 JSON',
    },
    'frontend-snippet': {
        source: 'examples/frontend-snippets/status-panel.json',
        outDir: 'generated/frontend-snippets',
        ext: '.json',
        kind: 'json',
        description: 'Tavern 前端状态面板片段 JSON',
    },
    'regex-html-snippet': {
        source: 'examples/frontend-snippets/regex-replace-html.json',
        outDir: 'generated/frontend-snippets',
        ext: '.json',
        kind: 'json',
        description: 'Regex replaceString HTML 片段 JSON',
    },
    'stscript-quick-reply': {
        source: 'examples/stscript/quick-reply-command.json',
        outDir: 'generated/stscript',
        ext: '.json',
        kind: 'json',
        description: 'STscript Quick Reply 命令 JSON',
    },
    'stscript': {
        source: 'examples/stscript/basic-flow.stscript',
        outDir: 'generated/stscript',
        ext: '.stscript',
        kind: 'text',
        description: 'STscript 文本脚本',
    },
    'shujuku-template': {
        source: 'examples/shujuku/full-template-format.json',
        outDir: 'generated/shujuku',
        ext: '.json',
        kind: 'json',
        description: 'shujuku 完整数据库模板 JSON',
    },
    'shujuku-plot': {
        source: 'examples/shujuku/plot-preset-full-format.json',
        outDir: 'generated/shujuku',
        ext: '.json',
        kind: 'json',
        description: 'shujuku 剧情推进预设 JSON',
    },
    'shujuku-api-preset': {
        source: 'examples/shujuku/api-preset.json',
        outDir: 'generated/shujuku',
        ext: '.json',
        kind: 'json',
        description: 'shujuku API 预设 JSON',
    },
    'shujuku-ui-theme': {
        source: 'examples/shujuku/database-ui-theme-format.json',
        outDir: 'generated/shujuku',
        ext: '.json',
        kind: 'json',
        description: 'shujuku 数据库 UI 主题 JSON',
    },
    'shujuku-body-replace': {
        source: 'examples/shujuku/body-replace-preset-format.json',
        outDir: 'generated/shujuku',
        ext: '.json',
        kind: 'json',
        description: 'shujuku 正文替换预设 JSON',
    },
    'shujuku-ui': {
        source: 'examples/shujuku/external-ui.js',
        outDir: 'generated/shujuku',
        ext: '.js',
        kind: 'text',
        description: 'shujuku 外部调用 UI JS',
    },
    'mvu-initvar': {
        source: 'examples/mvu/initvar-format.json',
        outDir: 'generated/mvu',
        ext: '.json',
        kind: 'json',
        description: 'MVU [InitVar] 世界书初始变量 JSON',
    },
    'mvu-script': {
        source: 'examples/mvu/mvu-script.json',
        outDir: 'generated/mvu',
        ext: '.json',
        kind: 'json',
        description: 'MVU 变量控制脚本 JSON（JS-Slash-Runner）',
    },
    'zod-snippets': {
        source: 'examples/zod/zod-schema-snippets.js',
        outDir: 'generated/zod',
        ext: '.js',
        kind: 'text',
        description: 'Zod schema 片段 JS',
    },
};

function usage() {
    console.log([
        '模板生成器',
        '',
        '用法：',
        '  node scripts/new.js <type> <name> [--out <dir>] [--force]',
        '',
        '类型：',
        ...Object.entries(TEMPLATES).map(([key, cfg]) => `  ${key.padEnd(22)} ${cfg.description}`),
        '',
        '示例：',
        '  node scripts/new.js js-script 我的脚本',
        '  node scripts/new.js st-extension my-extension',
        '  node scripts/new.js shujuku-template 战斗模板',
        '  node scripts/new.js regex 清理标签 --out ./generated/assets',
        '  node scripts/new.js worldbook-entry 设定条目',
        '  node scripts/new.js frontend-snippet 状态面板',
        '  node scripts/new.js stscript-quick-reply 快捷命令',
    ].join('\n'));
}

function parseArgs(argv) {
    const args = { positional: [], force: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') args.help = true;
        else if (a === '--force') args.force = true;
        else if (a === '--out') args.out = argv[++i];
        else if (a.startsWith('--')) throw new Error(`未知选项：${a}`);
        else args.positional.push(a);
    }
    return args;
}

function slugify(name) {
    return String(name)
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'new-item';
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeFileSafe(file, content, force) {
    if (fs.existsSync(file) && !force) {
        throw new Error(`目标已存在：${file}\n如需覆盖，添加 --force`);
    }
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, content, 'utf8');
}

function replaceDeep(value, name, slug) {
    const uuid = crypto.randomUUID();
    if (typeof value === 'string') {
        return value
            .replace(/最小酒馆助手脚本样例|多按钮酒馆助手脚本样例|Quick Reply Set Name|Theme Name|Regex Script Name|Plot Preset Name|Body Replace Preset Name|示例：原生扩展设置面板|最小 shujuku 表格模板|最小剧情推进预设|最小 API 预设|MVU 变量控制脚本样例|Entry Name|Status Panel Snippet|Regex Replace HTML Snippet|STscript Quick Reply Commands/g, name)
            .replace(/nl-status-panel|nl-regex-chip/g, `nl-${slug}`)
            .replace(/theme-id-placeholder/g, slug)
            .replace(/sheet_example/g, `sheet_${slug.replace(/-/g, '_')}`)
            .replace(/00000000-0000-4000-8000-000000000001|00000000-0000-4000-8000-000000000002|00000000-0000-4000-8000-000000000010|00000000-0000-4000-8000-000000000020/g, uuid);
    }
    if (Array.isArray(value)) return value.map(v => replaceDeep(v, name, slug));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const newKey = k === 'sheet_example' ? `sheet_${slug.replace(/-/g, '_')}` : k;
            out[newKey] = replaceDeep(v, name, slug);
        }
        return out;
    }
    return value;
}

function generateJson(cfg, name, slug, outDir, force) {
    const source = path.join(ROOT, cfg.source);
    const data = JSON.parse(fs.readFileSync(source, 'utf8'));
    const next = replaceDeep(data, name, slug);

    if (cfg.source.includes('js-slash-runner')) {
        next.name = name;
        next.id = crypto.randomUUID();
    }
    if (cfg.source.includes('quick-reply')) next.name = name;
    if (cfg.source.includes('stscript/quick-reply-command')) next.name = name;
    if (cfg.source.includes('regex')) next.scriptName = name;
    if (cfg.source.includes('theme-ui')) next.name = name;
    if (cfg.source.includes('worldbook-entry')) next.comment = name;
    if (cfg.source.includes('frontend-snippets')) {
        next.name = name;
        next.scope_class = `nl-${slug}`;
    }

    const target = path.join(outDir, `${slug}${cfg.ext}`);
    writeFileSafe(target, JSON.stringify(next, null, 2) + '\n', force);
    return target;
}

function generateText(cfg, name, slug, outDir, force) {
    const source = path.join(ROOT, cfg.source);
    let text = fs.readFileSync(source, 'utf8');
    text = text
        .replace(/shujuku UI 样例/g, name)
        .replace(/ShujukuExternalUiExample/g, `${slug.replace(/-/g, '_')}Ui`)
        .replace(/STscript basic flow placeholder/g, name)
        .replace(/example_stage/g, `${slug.replace(/-/g, '_')}_stage`);
    const target = path.join(outDir, `${slug}${cfg.ext}`);
    writeFileSafe(target, text, force);
    return target;
}

function copyDir(src, dest, name, slug, force) {
    if (fs.existsSync(dest) && !force) {
        throw new Error(`目标目录已存在：${dest}\n如需覆盖，添加 --force`);
    }
    ensureDir(dest);
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, ent.name);
        const to = path.join(dest, ent.name);
        if (ent.isDirectory()) copyDir(from, to, name, slug, true);
        else {
            let text = fs.readFileSync(from, 'utf8');
            text = text
                .replace(/示例：原生扩展设置面板/g, name)
                .replace(/example-extension/g, slug)
                .replace(/example-extension-settings/g, `${slug}-settings`)
                .replace(/local-example/g, 'generated-example');
            writeFileSafe(to, text, true);
        }
    }
}

function main() {
    let args;
    try { args = parseArgs(process.argv.slice(2)); }
    catch (error) { console.error(`[错误] ${error.message}`); usage(); process.exit(2); }

    if (args.help || args.positional.length < 2) {
        usage();
        process.exit(args.help ? 0 : 2);
    }

    const [type, rawName] = args.positional;
    const cfg = TEMPLATES[type];
    if (!cfg) {
        console.error(`[错误] 未知类型：${type}`);
        usage();
        process.exit(2);
    }

    const name = rawName;
    const slug = slugify(rawName);
    const baseOutDir = path.resolve(args.out || path.join(ROOT, cfg.outDir));

    try {
        let target;
        if (cfg.kind === 'dir') {
            target = path.join(baseOutDir, slug);
            copyDir(path.join(ROOT, cfg.sourceDir), target, name, slug, args.force);
        } else if (cfg.kind === 'json') {
            target = generateJson(cfg, name, slug, baseOutDir, args.force);
        } else {
            target = generateText(cfg, name, slug, baseOutDir, args.force);
        }
        console.log(`[完成] ${cfg.description}`);
        console.log(`  类型: ${type}`);
        console.log(`  名称: ${name}`);
        console.log(`  输出: ${target}`);
    } catch (error) {
        console.error(`[错误] ${error.message}`);
        process.exit(1);
    }
}

main();
