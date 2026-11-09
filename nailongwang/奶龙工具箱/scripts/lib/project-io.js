'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECTS_ROOT = path.join(ROOT, 'projects');

function rel(file) {
    return path.relative(ROOT, file).replace(/\\/g, '/');
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function readText(file) {
    return fs.readFileSync(file, 'utf8');
}

function writeText(file, text) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, text, 'utf8');
}

function readJson(file) {
    return JSON.parse(readText(file));
}

function writeJson(file, value) {
    writeText(file, JSON.stringify(value, null, 2) + '\n');
}

function resolveProject(input) {
    if (!input) throw new Error('请提供 projects/<项目名> 路径或项目名');
    const direct = path.resolve(input);
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
    const byName = path.join(PROJECTS_ROOT, input);
    if (fs.existsSync(byName) && fs.statSync(byName).isDirectory()) return byName;
    throw new Error(`项目不存在：${input}`);
}

function extractVersionTag(filename) {
    const match = path.basename(filename).match(/v\d+(?:\.\d+)+/);
    return match ? match[0] : null;
}

function stripVersionTag(name) {
    return name.replace(/\s*v\d+(?:\.\d+)+\s*$/u, '').trim();
}

function normalizeSlash(file) {
    return file.replace(/\\/g, '/');
}

function renderTemplate(template, vars) {
    return template.replace(/\{\{\s*version\s*\}\}/g, vars.version);
}

function listFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .map((name) => path.join(dir, name))
        .filter((file) => fs.statSync(file).isFile());
}

function countLines(text) {
    if (!text) return 0;
    return text.split(/\r?\n/).length;
}

function hasMarkdownCodeFence(text) {
    return /^```\s*\n[\s\S]*\n```\s*$/u.test(String(text || '').trim());
}

function unwrapMarkdownCodeFence(text) {
    const raw = String(text || '');
    const trimmed = raw.trim();
    const match = trimmed.match(/^```\s*\n([\s\S]*)\n```\s*$/u);
    return match ? match[1] : raw;
}

function wrapMarkdownCodeFence(text) {
    return '```\n' + String(text || '').replace(/\s*$/u, '') + '\n```\n';
}

function outputIdFromName(name) {
    return String(name || 'output')
        .replace(/\.[^.]+$/u, '')
        .replace(/\s*v\d+(?:\.\d+)+/u, '')
        .replace(/^酒馆助手脚本-/u, '')
        .replace(/^regex-/u, 'regex-')
        .trim()
        .replace(/[^\p{L}\p{N}_-]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'output';
}

function detectJsonType(obj) {
    if (obj && typeof obj === 'object' && typeof obj.content === 'string' && obj.type === 'script') {
        return 'js-slash-runner';
    }
    if (obj && typeof obj === 'object' && typeof obj.findRegex === 'string' && typeof obj.replaceString === 'string') {
        return 'sillytavern-regex';
    }
    return 'st-asset-json';
}

const ALLOWED_ASSET_ROOTS = new Set([
    'tavern helper',
    'regex',
    'extensions',
    'assets',
    'snippets',
    'stscript',
]);

function assetRootForType(type, id) {
    const safeId = id || 'main';
    if (type === 'plain-js' || type === 'js-slash-runner') return `tavern helper/${safeId}`;
    if (type === 'sillytavern-regex') return `regex/${safeId}`;
    if (type === 'sillytavern-extension') return `extensions/${safeId}`;
    if (type === 'frontend-snippet') return `snippets/${safeId}`;
    if (type === 'stscript') return `stscript/${safeId}`;
    return `assets/${type || 'json'}/${safeId}`;
}

function assetRootSegment(root) {
    return String(root || '').replace(/\\/g, '/').split('/').filter(Boolean)[0] || '';
}

function isAllowedAssetRoot(root) {
    return ALLOWED_ASSET_ROOTS.has(assetRootSegment(root));
}

function analyzeLatest(projectDir) {
    const projectName = path.basename(projectDir);
    const latestDir = path.join(projectDir, 'latest');
    const files = listFiles(latestDir);
    const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === '.json');
    const jsFiles = files.filter((file) => path.extname(file).toLowerCase() === '.js');
    const outputs = [];
    const consumedJs = new Set();

    for (const jsonFile of jsonFiles) {
        const obj = readJson(jsonFile);
        const version = extractVersionTag(path.basename(jsonFile));
        const type = detectJsonType(obj);
        if (type === 'js-slash-runner') {
            const matchingJs = jsFiles.find((file) => extractVersionTag(path.basename(file)) === version && readText(file) === obj.content);
            if (matchingJs) consumedJs.add(matchingJs);
            outputs.push({
                id: 'script',
                type,
                version,
                jsonFile,
                jsFile: matchingJs || null,
                obj,
                sourceText: obj.content,
                jsonBasename: path.basename(jsonFile),
                jsBasename: matchingJs ? path.basename(matchingJs) : `${projectName} ${version || '{{version}}'}.js`,
            });
        } else if (type === 'sillytavern-regex') {
            const replaceText = unwrapMarkdownCodeFence(obj.replaceString);
            outputs.push({
                id: 'regex',
                type,
                version,
                jsonFile,
                obj,
                sourceText: replaceText,
                findRegexText: obj.findRegex,
                replaceStringWrapper: hasMarkdownCodeFence(obj.replaceString) ? 'markdown-code-fence' : 'raw',
                jsonBasename: path.basename(jsonFile),
            });
        } else {
            outputs.push({
                id: outputIdFromName(path.basename(jsonFile)),
                type,
                version,
                jsonFile,
                obj,
                sourceText: JSON.stringify(obj, null, 2) + '\n',
                jsonBasename: path.basename(jsonFile),
            });
        }
    }

    for (const jsFile of jsFiles) {
        if (consumedJs.has(jsFile)) continue;
        outputs.push({
            id: outputIdFromName(path.basename(jsFile)),
            type: 'plain-js',
            version: extractVersionTag(path.basename(jsFile)),
            jsFile,
            sourceText: readText(jsFile),
            jsBasename: path.basename(jsFile),
        });
    }

    const versions = Array.from(new Set(outputs.map((out) => out.version).filter(Boolean)));
    return {
        projectName,
        latestDir,
        files,
        outputs,
        versions,
        version: versions.length === 1 ? versions[0] : (versions[0] || ''),
    };
}

function projectJsonPath(projectDir) {
    return path.join(projectDir, 'project.json');
}

function readProjectConfig(projectDir) {
    return readJson(projectJsonPath(projectDir));
}

function makeVersionedOutputName(basename) {
    const version = extractVersionTag(basename);
    return version ? basename.replace(version, '{{version}}') : basename;
}

function sourcePath(projectDir, relPath) {
    return path.join(projectDir, relPath);
}

function outputPath(projectDir, output, relPath) {
    if (!output.root) return sourcePath(projectDir, relPath);
    return sourcePath(projectDir, path.join(output.root, relPath));
}

function buildOutput(projectDir, output, version) {
    if (output.type === 'plain-js') {
        return [{
            file: sourcePath(projectDir, renderTemplate(output.jsOutput, { version })),
            text: readText(outputPath(projectDir, output, output.entry)),
        }];
    }

    if (output.type === 'js-slash-runner') {
        const source = readText(outputPath(projectDir, output, output.entry));
        const meta = readJson(outputPath(projectDir, output, output.meta));
        const merged = { ...meta, content: source };
        const files = [];
        if (output.jsOutput) {
            files.push({
                file: sourcePath(projectDir, renderTemplate(output.jsOutput, { version })),
                text: source,
            });
        }
        files.push({
            file: sourcePath(projectDir, renderTemplate(output.jsonOutput, { version })),
            text: JSON.stringify(merged, null, 2) + '\n',
        });
        return files;
    }

    if (output.type === 'sillytavern-regex') {
        const meta = readJson(outputPath(projectDir, output, output.meta));
        const findRegex = readText(outputPath(projectDir, output, output.findRegex)).trim();
        const replaceRaw = readText(outputPath(projectDir, output, output.replaceString));
        const replaceString = output.replaceStringWrapper === 'markdown-code-fence'
            ? wrapMarkdownCodeFence(replaceRaw)
            : replaceRaw;
        const merged = { ...meta, findRegex, replaceString };
        return [{
            file: sourcePath(projectDir, renderTemplate(output.jsonOutput, { version })),
            text: JSON.stringify(merged, null, 2) + '\n',
        }];
    }

    if (output.type === 'st-asset-json') {
        const obj = readJson(outputPath(projectDir, output, output.source));
        return [{
            file: sourcePath(projectDir, renderTemplate(output.jsonOutput, { version })),
            text: JSON.stringify(obj, null, 2) + '\n',
        }];
    }

    throw new Error(`不支持的 output.type：${output.type}`);
}

function buildAllOutputs(projectDir, config, version) {
    return (config.outputs || []).flatMap((output) => buildOutput(projectDir, output, version));
}

module.exports = {
    ROOT,
    PROJECTS_ROOT,
    rel,
    ensureDir,
    readText,
    writeText,
    readJson,
    writeJson,
    resolveProject,
    extractVersionTag,
    stripVersionTag,
    normalizeSlash,
    renderTemplate,
    listFiles,
    countLines,
    ALLOWED_ASSET_ROOTS,
    hasMarkdownCodeFence,
    unwrapMarkdownCodeFence,
    wrapMarkdownCodeFence,
    analyzeLatest,
    assetRootForType,
    assetRootSegment,
    isAllowedAssetRoot,
    projectJsonPath,
    readProjectConfig,
    makeVersionedOutputName,
    sourcePath,
    outputPath,
    buildOutput,
    buildAllOutputs,
};
