#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    rel,
    writeText,
    writeJson,
    resolveProject,
    analyzeLatest,
    assetRootForType,
    makeVersionedOutputName,
} = require('./lib/project-io');

function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--') continue;
        else if (arg === '-h' || arg === '--help') options.help = true;
        else if (arg.startsWith('--')) throw new Error(`未知选项：${arg}`);
        else positional.push(arg);
    }
    return { positional, options };
}

function printHelp() {
    console.log([
        '项目级拆包工具（source-first）',
        '',
        '用法：',
        '  node scripts/unpack-project.js <projects/项目名>',
        '',
        '说明：',
        '  按 Tavern 资产类型分层生成 project.json 与源码目录。',
        '  本工具不修改 latest/ 与 archive/。',
    ].join('\n'));
}

function metadataWithout(obj, keys) {
    const out = { ...obj };
    keys.forEach((key) => delete out[key]);
    return out;
}

function artifactIdForOutput(output, analysis) {
    const hasRegex = analysis.outputs.some((item) => item.type === 'sillytavern-regex');
    if (output.type === 'sillytavern-regex') return 'main';
    if (output.type === 'js-slash-runner' && hasRegex) return 'bridge';
    if (output.type === 'plain-js' || output.type === 'js-slash-runner') return 'main';
    return output.id || 'main';
}

function uniqueArtifactId(baseId, type, usedRoots) {
    const baseRoot = assetRootForType(type, baseId);
    if (!usedRoots.has(baseRoot)) return baseId;
    let index = 2;
    while (usedRoots.has(assetRootForType(type, `${baseId}-${index}`))) index++;
    return `${baseId}-${index}`;
}

function outputForAsset(projectDir, output, analysis, usedRoots) {
    const artifactId = uniqueArtifactId(artifactIdForOutput(output, analysis), output.type, usedRoots);
    const root = assetRootForType(output.type, artifactId);
    usedRoots.add(root);
    if (output.type === 'plain-js') {
        writeText(path.join(projectDir, root, 'src', 'index.js'), output.sourceText);
        return {
            id: artifactId,
            type: 'plain-js',
            root,
            entry: 'src/index.js',
            jsOutput: 'latest/' + makeVersionedOutputName(output.jsBasename),
        };
    }

    if (output.type === 'js-slash-runner') {
        writeText(path.join(projectDir, root, 'src', 'index.js'), output.sourceText);
        writeJson(path.join(projectDir, root, 'meta.json'), metadataWithout(output.obj, ['content']));
        return {
            id: artifactId,
            type: 'js-slash-runner',
            root,
            entry: 'src/index.js',
            meta: 'meta.json',
            jsOutput: 'latest/' + makeVersionedOutputName(output.jsBasename),
            jsonOutput: 'latest/' + makeVersionedOutputName(output.jsonBasename),
        };
    }

    if (output.type === 'sillytavern-regex') {
        writeText(path.join(projectDir, root, 'src', 'findRegex.txt'), output.findRegexText + '\n');
        writeText(path.join(projectDir, root, 'src', 'replace.html'), output.sourceText.replace(/\s*$/u, '') + '\n');
        writeJson(path.join(projectDir, root, 'meta.json'), metadataWithout(output.obj, ['findRegex', 'replaceString']));
        return {
            id: artifactId,
            type: 'sillytavern-regex',
            root,
            findRegex: 'src/findRegex.txt',
            replaceString: 'src/replace.html',
            meta: 'meta.json',
            jsonOutput: 'latest/' + makeVersionedOutputName(output.jsonBasename),
            replaceStringWrapper: output.replaceStringWrapper,
        };
    }

    if (output.type === 'st-asset-json') {
        writeText(path.join(projectDir, root, 'src', 'source.json'), output.sourceText);
        return {
            id: artifactId,
            type: 'st-asset-json',
            root,
            source: 'src/source.json',
            jsonOutput: 'latest/' + makeVersionedOutputName(output.jsonBasename),
        };
    }

    throw new Error(`不支持的产物类型：${output.type}`);
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
    if (parsed.options.help || parsed.positional.length < 1) {
        printHelp();
        process.exit(parsed.options.help ? 0 : 2);
    }
    try {
        const projectDir = resolveProject(parsed.positional[0]);
        const projectName = path.basename(projectDir);
        const analysis = analyzeLatest(projectDir);
        if (!analysis.outputs.length) throw new Error(`${rel(path.join(projectDir, 'latest'))} 没有可拆包产物`);

        const usedRoots = new Set();
        const outputs = analysis.outputs.map((output) => outputForAsset(projectDir, output, analysis, usedRoots));

        const config = {
            name: projectName,
            version: analysis.version,
            outputs,
        };
        writeJson(path.join(projectDir, 'project.json'), config);

        console.log('[完成] 项目拆包');
        console.log(`  项目: ${rel(projectDir)}`);
        console.log('  拆包方式: Tavern 资产类型分层');
        console.log(`  输出: ${rel(path.join(projectDir, 'project.json'))}`);
    } catch (error) {
        console.error(`[错误] ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) main();
