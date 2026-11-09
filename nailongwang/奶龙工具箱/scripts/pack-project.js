#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    rel,
    ensureDir,
    writeText,
    resolveProject,
    analyzeLatest,
    readProjectConfig,
    writeJson,
    buildAllOutputs,
    extractVersionTag,
    isAllowedAssetRoot,
} = require('./lib/project-io');

function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--') continue;
        else if (arg === '-h' || arg === '--help') options.help = true;
        else if (arg === '--version') options.version = argv[++i];
        else if (arg.startsWith('--')) throw new Error(`未知选项：${arg}`);
        else positional.push(arg);
    }
    return { positional, options };
}

function printHelp() {
    console.log([
        '项目级回包工具（source-first）',
        '',
        '用法：',
        '  node scripts/pack-project.js <projects/项目名> --version vX.Y',
        '',
        '说明：',
        '  读取 project.json 与资产目录源码，生成 latest/ 发布产物。',
        '  当目标版本不同于当前 latest 版本时，会先归档旧 latest/。',
    ].join('\n'));
}

function assertOutputRoots(config) {
    for (const output of config.outputs || []) {
        if (!output.root) throw new Error(`output ${output.id || output.type} 缺少 root`);
        if (!isAllowedAssetRoot(output.root)) throw new Error(`output ${output.id || output.type} 使用未知资产类型 root：${output.root}`);
    }
}

function archiveLatestIfNeeded(projectDir, targetVersion) {
    const latestDir = path.join(projectDir, 'latest');
    const archiveDir = path.join(projectDir, 'archive');
    const analysis = analyzeLatest(projectDir);
    const currentVersion = analysis.version;
    if (!currentVersion || currentVersion === targetVersion || analysis.files.length === 0) return null;

    const targetArchive = path.join(archiveDir, currentVersion);
    if (fs.existsSync(targetArchive)) {
        const existing = fs.readdirSync(targetArchive).filter((name) => fs.statSync(path.join(targetArchive, name)).isFile());
        if (existing.length === 0) {
            throw new Error(`${rel(targetArchive)} 已存在但为空，请先处理历史归档`);
        }
        console.log(`[跳过] ${rel(targetArchive)} 已存在且非空`);
        return targetArchive;
    }

    ensureDir(targetArchive);
    for (const file of analysis.files) {
        fs.copyFileSync(file, path.join(targetArchive, path.basename(file)));
    }
    return targetArchive;
}

function cleanLatest(latestDir, expectedFiles) {
    ensureDir(latestDir);
    const expected = new Set(expectedFiles.map((file) => path.resolve(file)));
    for (const entry of fs.readdirSync(latestDir)) {
        const file = path.join(latestDir, entry);
        if (!fs.statSync(file).isFile()) continue;
        if (!expected.has(path.resolve(file))) fs.rmSync(file, { force: true });
    }
}

function validateOutputs(outputs, version) {
    for (const output of outputs) {
        const fileVersion = extractVersionTag(path.basename(output.file));
        if (fileVersion && fileVersion !== version) {
            throw new Error(`${rel(output.file)} 文件版本号与目标版本 ${version} 不一致`);
        }
        if (path.extname(output.file).toLowerCase() === '.json') {
            JSON.parse(output.text);
        }
    }
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
    if (parsed.options.help || parsed.positional.length < 1 || !parsed.options.version) {
        printHelp();
        process.exit(parsed.options.help ? 0 : 2);
    }
    if (!/^v\d+(?:\.\d+)+$/.test(parsed.options.version)) {
        console.error('[错误] --version 必须是 vX.Y 或 vX.Y.Z 格式');
        process.exit(2);
    }

    try {
        const projectDir = resolveProject(parsed.positional[0]);
        const config = readProjectConfig(projectDir);
        const version = parsed.options.version;
        assertOutputRoots(config);
        const outputs = buildAllOutputs(projectDir, config, version);
        validateOutputs(outputs, version);
        const archived = archiveLatestIfNeeded(projectDir, version);

        cleanLatest(path.join(projectDir, 'latest'), outputs.map((out) => out.file));
        for (const output of outputs) writeText(output.file, output.text);
        config.version = version;
        writeJson(path.join(projectDir, 'project.json'), config);

        console.log('[完成] 项目回包');
        console.log(`  项目: ${rel(projectDir)}`);
        console.log(`  版本: ${version}`);
        if (archived) console.log(`  归档: ${rel(archived)}`);
        outputs.forEach((out) => console.log(`  输出: ${rel(out.file)}`));
    } catch (error) {
        console.error(`[错误] ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) main();
