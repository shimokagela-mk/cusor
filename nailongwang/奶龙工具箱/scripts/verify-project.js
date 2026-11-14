#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
    buildAllOutputs,
    readProjectConfig,
    renderTemplate,
    sourcePath,
    outputPath,
    isAllowedAssetRoot,
} = require('./lib/project-io');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_ROOT = path.join(ROOT, 'projects');

function rel(file) {
    return path.relative(ROOT, file).replace(/\\/g, '/');
}

function extractVersionTag(filename) {
    const match = path.basename(filename).match(/v\d+(?:\.\d+)+/);
    return match ? match[0] : null;
}

function readJson(file, errors) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        errors.push(`${rel(file)} JSON 解析失败：${error.message}`);
        return null;
    }
}

function listFiles(dir, ext) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((name) => !ext || name.toLowerCase().endsWith(ext))
        .map((name) => path.join(dir, name))
        .filter((file) => fs.statSync(file).isFile());
}

function resolveProject(input) {
    if (!input) {
        throw new Error('请提供 projects/<脚本名> 路径或脚本名');
    }

    const direct = path.resolve(input);
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
        return direct;
    }

    const byName = path.join(PROJECTS_ROOT, input);
    if (fs.existsSync(byName) && fs.statSync(byName).isDirectory()) {
        return byName;
    }

    throw new Error(`项目不存在：${input}`);
}

function findSameVersion(files, versionTag) {
    return files.filter((file) => extractVersionTag(path.basename(file)) === versionTag);
}

function checkContentPairs(dir, errors, { requirePairs }) {
    const jsonFiles = listFiles(dir, '.json');
    const jsFiles = listFiles(dir, '.js');

    for (const jsonFile of jsonFiles) {
        const obj = readJson(jsonFile, errors);
        if (!obj || typeof obj.content !== 'string') continue;

        const versionTag = extractVersionTag(path.basename(jsonFile));
        if (!versionTag) {
            errors.push(`${rel(jsonFile)} 缺少版本号`);
            continue;
        }

        const matches = findSameVersion(jsFiles, versionTag);
        if (matches.length === 0) {
            if (requirePairs) {
                errors.push(`${rel(jsonFile)} 缺少同版本 .js 配对文件`);
            }
            continue;
        }
        if (matches.length > 1) {
            errors.push(`${rel(jsonFile)} 找到多个同版本 .js 配对文件`);
            continue;
        }

        const jsText = fs.readFileSync(matches[0], 'utf8');
        if (obj.content !== jsText) {
            errors.push(`${rel(jsonFile)} content 不等于 ${rel(matches[0])}`);
        }
    }
}

function checkLatest(projectDir, errors) {
    const latestDir = path.join(projectDir, 'latest');
    if (!fs.existsSync(latestDir) || !fs.statSync(latestDir).isDirectory()) {
        errors.push(`${rel(projectDir)} 缺少 latest/ 目录`);
        return;
    }

    const files = listFiles(latestDir);
    const versions = new Set(files.map((file) => extractVersionTag(path.basename(file))).filter(Boolean));
    if (versions.size === 0) {
        errors.push(`${rel(latestDir)} 中没有带版本号的发布文件`);
    }
    if (versions.size > 1) {
        errors.push(`${rel(latestDir)} 中存在多个版本号：${Array.from(versions).join(', ')}`);
    }

    checkContentPairs(latestDir, errors, { requirePairs: true });
}

function checkArchive(projectDir, errors) {
    const archiveDir = path.join(projectDir, 'archive');
    if (!fs.existsSync(archiveDir)) return;

    for (const entry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const versionTag = entry.name;
        if (!/^v\d+(?:\.\d+)+$/.test(versionTag)) {
            errors.push(`${rel(path.join(archiveDir, entry.name))} 不是语义版本目录名`);
            continue;
        }

        const dir = path.join(archiveDir, entry.name);
        for (const file of listFiles(dir)) {
            const fileVersion = extractVersionTag(path.basename(file));
            if (fileVersion && fileVersion !== versionTag) {
                errors.push(`${rel(file)} 文件版本号与 archive 目录 ${versionTag} 不一致`);
            }
        }
    }
}

function stableJson(value) {
    if (Array.isArray(value)) return value.map(stableJson);
    if (value && typeof value === 'object') {
        const out = {};
        for (const key of Object.keys(value).sort()) out[key] = stableJson(value[key]);
        return out;
    }
    return value;
}

function sameJsonText(a, b) {
    try {
        return JSON.stringify(stableJson(JSON.parse(a))) === JSON.stringify(stableJson(JSON.parse(b)));
    } catch (error) {
        return false;
    }
}

function checkSourceFirst(projectDir, errors) {
    const configPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(configPath)) return;

    let config;
    try {
        config = readProjectConfig(projectDir);
    } catch (error) {
        errors.push(`${rel(configPath)} 解析失败：${error.message}`);
        return;
    }

    if (Object.prototype.hasOwnProperty.call(config, 'profile')) errors.push(`${rel(configPath)} 不应再包含 profile`);
    if (Object.prototype.hasOwnProperty.call(config, 'profile_reason')) errors.push(`${rel(configPath)} 不应再包含 profile_reason`);
    if (!config.version || !/^v\d+(?:\.\d+)+$/.test(config.version)) {
        errors.push(`${rel(configPath)} version 必须是 vX.Y 或 vX.Y.Z`);
    }
    if (!Array.isArray(config.outputs) || config.outputs.length === 0) {
        errors.push(`${rel(configPath)} outputs 必须非空`);
        return;
    }

    for (const legacy of [path.join(projectDir, 'src', 'main.js'), path.join(projectDir, 'src', 'metadata')]) {
        if (fs.existsSync(legacy)) {
            errors.push(`${rel(legacy)} 是旧协议结构，新项目必须使用 Tavern 资产类型目录`);
        }
    }

    for (const output of config.outputs) {
        if (!output.root) {
            errors.push(`${rel(configPath)} output ${output.id || output.type} 缺少 root`);
        } else if (!isAllowedAssetRoot(output.root)) {
            errors.push(`${rel(configPath)} output ${output.id || output.type} 使用未知资产类型 root：${output.root}`);
        }
        const refs = ['entry', 'meta', 'findRegex', 'replaceString', 'source']
            .map((key) => output[key])
            .filter(Boolean);
        for (const refPath of refs) {
            const abs = output.root ? outputPath(projectDir, output, refPath) : sourcePath(projectDir, refPath);
            if (!fs.existsSync(abs)) {
                errors.push(`${rel(configPath)} 引用不存在：${refPath}`);
            }
        }
        for (const outKey of ['jsOutput', 'jsonOutput']) {
            if (!output[outKey]) continue;
            const target = sourcePath(projectDir, renderTemplate(output[outKey], { version: config.version }));
            if (!fs.existsSync(target)) {
                errors.push(`${rel(configPath)} 输出不存在：${output[outKey]}`);
            }
        }
    }

    let generated;
    try {
        generated = buildAllOutputs(projectDir, config, config.version);
    } catch (error) {
        errors.push(`${rel(configPath)} 源码回包失败：${error.message}`);
        return;
    }

    for (const out of generated) {
        if (!fs.existsSync(out.file)) {
            errors.push(`${rel(out.file)} 缺少由 src/ 生成的 latest 产物`);
            continue;
        }
        const actual = fs.readFileSync(out.file, 'utf8');
        if (path.extname(out.file).toLowerCase() === '.json') {
            if (!sameJsonText(actual, out.text)) {
                errors.push(`${rel(out.file)} 与 project.json/src 重新生成结果不一致`);
            }
        } else if (actual !== out.text) {
            errors.push(`${rel(out.file)} 与 project.json/src 重新生成结果不一致`);
        }
    }
}

function verifyProject(projectInput) {
    const projectDir = resolveProject(projectInput);
    const errors = [];

    checkLatest(projectDir, errors);
    checkArchive(projectDir, errors);
    checkSourceFirst(projectDir, errors);

    return {
        projectDir,
        errors,
    };
}

function main() {
    try {
        const result = verifyProject(process.argv[2]);
        if (result.errors.length > 0) {
            console.error(`[失败] ${rel(result.projectDir)} 项目校验未通过`);
            for (const error of result.errors) {
                console.error(`  - ${error}`);
            }
            process.exit(1);
        }
        console.log(`[通过] ${rel(result.projectDir)} 项目版本与 JSON/JS 配对校验通过`);
    } catch (error) {
        console.error(`[错误] ${error.message}`);
        process.exit(2);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    verifyProject,
    extractVersionTag,
};
