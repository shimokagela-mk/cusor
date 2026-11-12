#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '--out') {
            options.out = argv[++i];
        } else if (arg === '--no-overwrite') {
            options.noOverwrite = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg.startsWith('--')) {
            throw new Error(`未知选项：${arg}`);
        } else {
            positional.push(arg);
        }
    }
    return { positional, options };
}

function printHelp() {
    console.log([
        'JS 字符串字面量展开工具',
        '',
        '用途：',
        '  将 JS 字符串字面量里语义上真实的换行展开为模板字符串中的真实换行。',
        '  例如：const s = "a\\nb" -> const s = `a',
        '  b`',
        '',
        '边界：',
        '  - 使用 Babel AST 定位字符串边界，不做手写全文替换。',
        '  - 只替换需要展开的字符串 token，尽量保留其他源码结构。',
        '  - 不做 webpack 反打包、变量名恢复或业务逻辑重写。',
        '',
        '用法：',
        '  node scripts/expand-js-string-literals.js <input.js> [选项]',
        '',
        '选项：',
        '  --out <path>       指定输出文件或目录；缺省为原文件原地覆盖',
        '  --no-overwrite     输出文件已存在且不是原文件时报错',
        '  --dry-run          只统计可展开位置，不写入文件',
        '  -h, --help         打印帮助',
    ].join('\n'));
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function resolveOutputPath(inputPath, outArg) {
    if (!outArg) return inputPath;

    const abs = path.resolve(outArg);
    if (fs.existsSync(abs)) {
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) return path.join(abs, path.basename(inputPath));
        if (stat.isFile()) return abs;
        throw new Error(`--out 指向的对象既非文件也非目录：${abs}`);
    }

    if (/[\\/]$/.test(outArg)) {
        ensureDir(abs);
        return path.join(abs, path.basename(inputPath));
    }

    if (path.extname(outArg).toLowerCase() === '.js') {
        return abs;
    }

    ensureDir(abs);
    return path.join(abs, path.basename(inputPath));
}

function parseSource(source, filename) {
    return parser.parse(source, {
        sourceType: 'unambiguous',
        sourceFilename: filename,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        plugins: [
            'asyncGenerators',
            'bigInt',
            'classPrivateMethods',
            'classPrivateProperties',
            'classProperties',
            'dynamicImport',
            'exportDefaultFrom',
            'exportNamespaceFrom',
            'importAttributes',
            'importMeta',
            'logicalAssignment',
            'nullishCoalescingOperator',
            'numericSeparator',
            'objectRestSpread',
            'optionalCatchBinding',
            'optionalChaining',
            'regexpUnicodeSets',
            'topLevelAwait',
        ],
    });
}

function hasLineBreak(value) {
    return typeof value === 'string' && (value.includes('\n') || value.includes('\r'));
}

function isNonComputedKey(pathInfo) {
    const parent = pathInfo.parent;
    const node = pathInfo.node;
    if (!parent || parent.key !== node || parent.computed) return false;

    return (
        t.isObjectProperty(parent) ||
        t.isObjectMethod(parent) ||
        t.isClassMethod(parent) ||
        t.isClassProperty(parent) ||
        (typeof t.isClassAccessorProperty === 'function' && t.isClassAccessorProperty(parent))
    );
}

function shouldSkipStringLiteral(pathInfo) {
    const parent = pathInfo.parent;
    const node = pathInfo.node;
    if (!hasLineBreak(node.value)) return true;
    if (typeof node.start !== 'number' || typeof node.end !== 'number') return true;

    if (
        parent &&
        parent.source === node &&
        (t.isImportDeclaration(parent) ||
            t.isExportNamedDeclaration(parent) ||
            t.isExportAllDeclaration(parent))
    ) {
        return true;
    }

    return isNonComputedKey(pathInfo);
}

function hex2(code) {
    return code.toString(16).toUpperCase().padStart(2, '0');
}

function hex4(code) {
    return code.toString(16).toUpperCase().padStart(4, '0');
}

function appendEscapedCodeUnit(out, ch, next) {
    const code = ch.charCodeAt(0);

    if (ch === '\n') return out + '\n';
    if (ch === '\r') return out + '\\r';
    if (ch === '\\') return out + '\\\\';
    if (ch === '`') return out + '\\`';
    if (ch === '$' && next === '{') return out + '\\$';
    if (ch === '\t') return out + '\\t';
    if (ch === '\b') return out + '\\b';
    if (ch === '\f') return out + '\\f';
    if (ch === '\v') return out + '\\v';
    if (code === 0) return out + '\\x00';
    if (code < 0x20 || code === 0x7F) return out + `\\x${hex2(code)}`;
    if (code === 0x2028 || code === 0x2029) return out + `\\u${hex4(code)}`;

    return out + ch;
}

function valueToTemplateRaw(value) {
    let raw = '';
    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        const next = value[i + 1];
        if (ch === '\r' && next === '\n') {
            raw += '\\r\n';
            i++;
            continue;
        }
        raw = appendEscapedCodeUnit(raw, ch, next);
    }
    return raw;
}

function valueToTemplateLiteralCode(value) {
    const raw = valueToTemplateRaw(value);
    const node = t.templateLiteral(
        [t.templateElement({ raw, cooked: value }, true)],
        [],
    );
    return generate(node, {
        compact: false,
        jsescOption: { minimal: true },
    }).code;
}

function collectReplacements(source, filename) {
    const ast = parseSource(source, filename);
    const replacements = [];

    traverse(ast, {
        StringLiteral(pathInfo) {
            if (shouldSkipStringLiteral(pathInfo)) return;
            replacements.push({
                start: pathInfo.node.start,
                end: pathInfo.node.end,
                replacement: valueToTemplateLiteralCode(pathInfo.node.value),
                kind: 'string',
            });
        },
        TemplateElement(pathInfo) {
            const node = pathInfo.node;
            if (typeof node.start !== 'number' || typeof node.end !== 'number') return;
            if (!hasLineBreak(node.value.cooked)) return;
            if (!/\\r|\\n/.test(node.value.raw)) return;
            replacements.push({
                start: node.start,
                end: node.end,
                replacement: valueToTemplateRaw(node.value.cooked),
                kind: 'template',
            });
        },
    });

    replacements.sort((a, b) => a.start - b.start);
    for (let i = 1; i < replacements.length; i++) {
        if (replacements[i].start < replacements[i - 1].end) {
            throw new Error('AST 替换范围发生重叠，请停止输出并检查输入源码。');
        }
    }

    return replacements;
}

function applyReplacements(source, replacements) {
    let output = source;
    for (let i = replacements.length - 1; i >= 0; i--) {
        const item = replacements[i];
        output = output.slice(0, item.start) + item.replacement + output.slice(item.end);
    }
    return output;
}

function countByKind(replacements, kind) {
    return replacements.filter((item) => item.kind === kind).length;
}

function expandJsStringLiterals(source, filename) {
    const replacements = collectReplacements(source, filename);
    const output = applyReplacements(source, replacements);
    parseSource(output, filename);
    return {
        output,
        replacements,
        stringCount: countByKind(replacements, 'string'),
        templateCount: countByKind(replacements, 'template'),
    };
}

function writeOutput(outputPath, content, options) {
    const inputPath = options.inputPath;
    const samePath = path.resolve(outputPath) === path.resolve(inputPath);
    if (!samePath && fs.existsSync(outputPath) && options.noOverwrite) {
        throw new Error(`输出文件已存在：${outputPath}`);
    }
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, content, 'utf8');
}

function main() {
    let parsed;
    try {
        parsed = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(`[错误] ${error.message}`);
        printHelp();
        process.exit(2);
    }

    if (parsed.options.help || parsed.positional.length === 0) {
        printHelp();
        process.exit(parsed.options.help ? 0 : 2);
    }

    const inputPath = path.resolve(parsed.positional[0]);
    if (!fs.existsSync(inputPath)) {
        console.error(`[错误] 输入文件不存在：${inputPath}`);
        process.exit(1);
    }
    if (!fs.statSync(inputPath).isFile()) {
        console.error(`[错误] 输入路径不是文件：${inputPath}`);
        process.exit(1);
    }
    if (path.extname(inputPath).toLowerCase() !== '.js') {
        console.error('[错误] 仅支持 .js 文件');
        process.exit(2);
    }

    try {
        const source = fs.readFileSync(inputPath, 'utf8');
        const result = expandJsStringLiterals(source, inputPath);
        const outputPath = resolveOutputPath(inputPath, parsed.options.out);

        if (!parsed.options.dryRun) {
            writeOutput(outputPath, result.output, { ...parsed.options, inputPath });
        }

        console.log('[完成] JS 字符串字面量展开');
        console.log(`  输入: ${inputPath}`);
        console.log(`  输出: ${parsed.options.dryRun ? '(dry-run 未写入)' : outputPath}`);
        console.log(`  字符串字面量: ${result.stringCount}`);
        console.log(`  模板字符串片段: ${result.templateCount}`);
        console.log(`  合计替换: ${result.replacements.length}`);
        console.log('  校验: 输出 JS 可被 Babel parser 重新解析');
    } catch (error) {
        console.error(`[错误] ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    expandJsStringLiterals,
    collectReplacements,
    valueToTemplateRaw,
    valueToTemplateLiteralCode,
};
