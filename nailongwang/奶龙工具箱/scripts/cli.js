#!/usr/bin/env node
'use strict';

/**
 * 交互式 CLI：选模式 → 选模板 → 输名字 → 自动校验。
 * 默认零依赖，使用 readline，完成后调用 scripts/new.js 与 scripts/validate-examples.js。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function loadCapabilities() {
    return readJson('data/capabilities-index.json');
}

function ask(rl, prompt) {
    return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
}

function runNode(script, args = []) {
    return execFileSync(process.execPath, [script, ...args], { cwd: ROOT, stdio: 'inherit' });
}

async function main() {
    const caps = loadCapabilities();
    const generators = [];
    for (const mode of caps.modes) {
        for (const gen of mode.generators || []) {
            generators.push({ code: mode.code, mode: mode.name, gen });
        }
    }

    if (process.argv.includes('--list')) {
        for (const item of generators) {
            console.log(`  [${item.code}] ${item.gen.padEnd(22)} ${item.mode}`);
        }
        return;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log('Tavern Kit 交互式生成器');
        console.log('======================');
        console.log('可生成类型：');
        generators.forEach((item, i) => {
            console.log(`  ${String(i + 1).padStart(2)}. [${item.code}] ${item.gen.padEnd(22)} ${item.mode}`);
        });

        const sel = await ask(rl, '\n选择编号: ');
        const idx = parseInt(sel, 10) - 1;
        if (Number.isNaN(idx) || idx < 0 || idx >= generators.length) {
            console.error('无效选择');
            process.exit(2);
        }
        const chosen = generators[idx];

        const name = await ask(rl, `输入名称（用于 ${chosen.gen}）: `);
        if (!name) {
            console.error('名称不能为空');
            process.exit(2);
        }

        const force = (await ask(rl, '若已存在是否覆盖? (y/N): ')).toLowerCase().startsWith('y');
        const validate = !(await ask(rl, '生成后跳过校验? (y/N): ')).toLowerCase().startsWith('y');

        const args = [chosen.gen, name];
        if (force) args.push('--force');

        console.log(`\n[运行] node scripts/new.js ${args.join(' ')}`);
        runNode('scripts/new.js', args);

        if (validate) {
            console.log('\n[运行] node scripts/validate-examples.js');
            runNode('scripts/validate-examples.js');
        }

        console.log('\n[完成]');
    } finally {
        rl.close();
    }
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});
