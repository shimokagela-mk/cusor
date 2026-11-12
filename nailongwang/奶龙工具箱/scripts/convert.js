#!/usr/bin/env node
/**
 * 酒馆助手脚本 ↔ 纯 JS 双向转换工具
 *
 * 用法：
 *   node scripts/convert.js <input> [选项]
 *
 * 输入文件扩展名决定转换方向：
 *   *.json  → JSON.parse 后反序列化/反转义 content 字段，原样输出为 .js
 *   *.js    → 读取 JS 文本并序列化进 JSON 模板的 content 字段
 *
 * 选项：
 *   --out <path>          指定输出文件或目录
 *   --meta <ref.json>     JS→JSON 时复用此 JSON 的 metadata（id/name/info/button/data/...）
 *   --project <脚本名>    输入不在 projects/<脚本名>/ 下时，显式指定项目上下文
 *   --no-overwrite        若输出文件已存在则报错而非覆盖
 *   -h, --help            打印帮助
 *
 * 例：
 *   node scripts/convert.js "projects/聊天记录导出工具/latest/酒馆助手脚本-聊天记录导出 v6.0.2.json"
 *   node scripts/convert.js "projects/聊天记录导出工具/latest/聊天记录导出工具 v6.0.2.js" --meta "projects/聊天记录导出工具/latest/酒馆助手脚本-聊天记录导出 v6.0.2.json"
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECTS_ROOT = path.join(PROJECT_ROOT, 'projects');

// ---------- 工具函数 ----------

/** 解析命令行参数为 { positional: [], options: {} } */
function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') {
            options.help = true;
        } else if (a === '--no-overwrite') {
            options.noOverwrite = true;
        } else if (a === '--out') {
            options.out = argv[++i];
        } else if (a === '--meta') {
            options.meta = argv[++i];
        } else if (a === '--project') {
            options.project = argv[++i];
        } else if (a.startsWith('--')) {
            throw new Error(`未知选项：${a}`);
        } else {
            positional.push(a);
        }
    }
    return { positional, options };
}

function printHelp() {
    const help = [
        '酒馆助手脚本 ↔ 纯 JS 双向转换工具',
        '',
        '说明：JSON → JS 会执行 JSON.parse，并把反序列化/反转义后的 content 字符串原样写入 .js。',
        '      如果 content 本身是压缩 bundle，输出仍会是压缩 bundle；本工具不做反编译或格式化。',
        '',
        '用法：',
        '  node scripts/convert.js <input> [选项]',
        '',
        '选项：',
        '  --out <path>          指定输出文件或目录',
        '  --meta <ref.json>     JS→JSON 时复用此 JSON 的 metadata',
        '  --project <脚本名>    输入不在 projects/<脚本名>/ 下时，显式指定项目上下文',
        '  --no-overwrite        若输出文件已存在则报错而非覆盖',
        '  -h, --help            打印此帮助',
        '',
        '示例：',
        '  node scripts/convert.js "projects/聊天记录导出工具/latest/酒馆助手脚本-聊天记录导出 v6.0.2.json"',
        '  node scripts/convert.js "projects/聊天记录导出工具/latest/聊天记录导出工具 v6.0.2.js"',
        '  node scripts/convert.js "my.js" --meta "projects/聊天记录导出工具/latest/酒馆助手脚本-聊天记录导出 v6.0.2.json"',
    ].join('\n');
    console.log(help);
}

/** 从 "聊天记录导出工具 v6.0.js" 或 "酒馆助手脚本-聊天记录导出 v6.0.json" 中抽出 "v6.0" */
function extractVersionTag(filename) {
    const m = path.basename(filename).match(/v\d+(?:\.\d+)+/);
    return m ? m[0] : null;
}

function stripVersionTag(name) {
    return name.replace(/\s*v\d+(?:\.\d+)+\s*$/u, '').trim();
}

function inferProjectContext(inputPath, options = {}) {
    if (options.project) {
        const projectDir = path.join(PROJECTS_ROOT, options.project);
        if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
            throw new Error(`--project 指定的项目不存在：${projectDir}`);
        }
        return {
            projectName: options.project,
            projectDir,
            latestDir: path.join(projectDir, 'latest'),
            archiveDir: path.join(projectDir, 'archive'),
            location: 'explicit',
        };
    }

    const abs = path.resolve(inputPath);
    const rel = path.relative(PROJECTS_ROOT, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;

    const parts = rel.split(path.sep);
    if (parts.length < 3) return null;

    const [projectName, bucket, maybeVersion] = parts;
    const projectDir = path.join(PROJECTS_ROOT, projectName);
    if (bucket === 'latest') {
        return {
            projectName,
            projectDir,
            latestDir: path.join(projectDir, 'latest'),
            archiveDir: path.join(projectDir, 'archive'),
            location: 'latest',
        };
    }
    if (bucket === 'archive' && maybeVersion) {
        return {
            projectName,
            projectDir,
            latestDir: path.join(projectDir, 'latest'),
            archiveDir: path.join(projectDir, 'archive'),
            location: 'archive',
            archiveVersion: maybeVersion,
        };
    }
    return null;
}

function assertWritableDefault(context, direction) {
    if (!context) return;
    if (context.location === 'archive') {
        throw new Error(`${direction} 输入位于 archive 历史版本；请显式指定 --out，避免改写只读留存目录`);
    }
}

function defaultOutputDir(inputPath, context, direction) {
    if (context) {
        assertWritableDefault(context, direction);
        return context.latestDir;
    }
    return path.dirname(inputPath);
}

/** 在当前 projects/<脚本名>/latest 与 archive 下按版本号查找匹配的旧 JSON 文件，找不到返回 null */
function findMatchingJsonByVersion(context, versionTag) {
    if (!versionTag) return null;
    if (!context) return null;
    const candidates = [];
    if (fs.existsSync(context.latestDir)) {
        for (const f of fs.readdirSync(context.latestDir)) {
            if (f.endsWith('.json')) candidates.push(path.join(context.latestDir, f));
        }
    }
    if (fs.existsSync(context.archiveDir)) {
        for (const v of fs.readdirSync(context.archiveDir)) {
            const dir = path.join(context.archiveDir, v);
            if (!fs.statSync(dir).isDirectory()) continue;
            for (const f of fs.readdirSync(dir)) {
                if (f.endsWith('.json')) candidates.push(path.join(dir, f));
            }
        }
    }
    const exact = candidates.filter((p) => extractVersionTag(path.basename(p)) === versionTag);
    if (exact.length > 1) {
        throw new Error(`同项目内找到多个 ${versionTag} metadata 候选，请显式指定 --meta：${exact.join('；')}`);
    }
    return exact[0] || null;
}

/** 确保目录存在 */
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

/** 读取 JSON 文件，失败时给出清晰错误 */
function readJsonFile(file) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
        throw new Error(`读取文件失败 (${file})：${e.message}`);
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        throw new Error(`输入 JSON 格式不合法 (${file})：${e.message}`);
    }
}

function validateMetaProject(metaPath, context) {
    if (!context) return;
    const metaContext = inferProjectContext(metaPath);
    if (!metaContext) return;
    if (metaContext.projectDir !== context.projectDir) {
        throw new Error(`--meta 来自其他项目 (${metaContext.projectName})，当前输入项目为 ${context.projectName}`);
    }
}

function validateMetaVersion(metaPath, inputVersion) {
    if (!inputVersion) return;
    const metaVersion = extractVersionTag(path.basename(metaPath));
    if (metaVersion && metaVersion !== inputVersion) {
        throw new Error(`--meta 版本 (${metaVersion}) 与输入版本 (${inputVersion}) 不一致`);
    }
}

/**
 * 解析 --out：可能是文件路径，也可能是目录。
 * 四态判定：
 *   1. 已存在且是文件 → 按文件路径处理
 *   2. 已存在且是目录 → 按目录处理，拼接默认文件名
 *   3. 不存在但以斜杠结尾 → 按目录处理（创建后拼默认文件名）
 *   4. 不存在且无尾斜杠：扩展名等于期望扩展名 → 文件；否则按目录处理（创建后拼默认文件名）
 *
 * expectedExt 由调用方传入（'.js' 或 '.json'），表示当前转换方向的目标文件扩展名。
 */
function resolveOutputPath(outArg, defaultDir, defaultBasename, expectedExt) {
    if (!outArg) {
        return path.join(defaultDir, defaultBasename);
    }
    const abs = path.resolve(outArg);

    if (fs.existsSync(abs)) {
        const st = fs.statSync(abs);
        if (st.isFile()) return abs;
        if (st.isDirectory()) return path.join(abs, defaultBasename);
        throw new Error(`--out 指向的对象既非文件也非目录：${abs}`);
    }

    if (/[\\/]$/.test(outArg)) {
        ensureDir(abs);
        return path.join(abs, defaultBasename);
    }

    const ext = path.extname(outArg).toLowerCase();
    if (ext === expectedExt) {
        return abs;
    }
    // 无扩展名或扩展名不匹配 → 视为目录
    ensureDir(abs);
    return path.join(abs, defaultBasename);
}

function writeOutput(outputPath, content, { noOverwrite }) {
    if (fs.existsSync(outputPath)) {
        if (noOverwrite) {
            throw new Error(`输出文件已存在 (${outputPath})，使用 --no-overwrite 时不会覆盖`);
        }
        console.log(`[覆盖] ${outputPath}`);
    }
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, content, 'utf8');
}

// ---------- 转换核心 ----------

/** JSON → JS：JSON.parse 后取反序列化/反转义的 content 字段写出为 .js */
function convertJsonToJs(inputPath, options) {
    const obj = readJsonFile(inputPath);
    if (typeof obj.content !== 'string') {
        throw new Error(`输入 JSON 缺少字符串型 content 字段 (${inputPath})`);
    }

    const context = inferProjectContext(inputPath, options);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const versionTag = extractVersionTag(baseName);
    const scriptBase = context
        ? context.projectName
        : stripVersionTag(baseName.replace(/^酒馆助手脚本-/u, ''));
    const defaultBase = versionTag
        ? `${scriptBase} ${versionTag}.js`
        : `${baseName}.js`;

    const outputPath = resolveOutputPath(options.out, defaultOutputDir(inputPath, context, 'JSON → JS'), defaultBase, '.js');
    writeOutput(outputPath, obj.content, options);

    const written = fs.readFileSync(outputPath, 'utf8');
    if (written !== obj.content) {
        throw new Error(`输出校验失败：输出 JS 不等于 JSON.parse(input).content (${outputPath})`);
    }

    console.log(`[完成] JSON content 反序列化 → JS`);
    console.log(`  输入: ${inputPath}`);
    console.log(`  输出: ${outputPath}`);
    console.log(`  校验: 输出 JS === JSON.parse(input).content`);
    console.log(`  字节: ${Buffer.byteLength(obj.content, 'utf8')}`);
    return outputPath;
}

/** 默认 metadata 模板 */
function buildDefaultMeta(jsBaseName) {
    return {
        type: 'script',
        enabled: true,
        name: jsBaseName,
        id: crypto.randomUUID(),
        content: '',
        info: '',
        button: { enabled: false, buttons: [] },
        data: {},
    };
}

/** JS → JSON：将 .js 文本嵌入到 JSON 模板的 content 字段 */
function convertJsToJson(inputPath, options) {
    let jsContent;
    try {
        jsContent = fs.readFileSync(inputPath, 'utf8');
    } catch (e) {
        throw new Error(`读取文件失败 (${inputPath})：${e.message}`);
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const versionTag = extractVersionTag(baseName);
    const context = inferProjectContext(inputPath, options);

    // 决定 metadata 来源
    let metaObj;
    let metaSource = '';
    let metaPathForDefaultName = '';
    if (options.meta) {
        const metaPath = path.resolve(options.meta);
        if (!fs.existsSync(metaPath)) {
            throw new Error(`--meta 指定的文件不存在：${metaPath}`);
        }
        validateMetaProject(metaPath, context);
        validateMetaVersion(metaPath, versionTag);
        metaObj = readJsonFile(metaPath);
        if (typeof metaObj.content !== 'string') {
            throw new Error(`--meta 缺少字符串型 content 字段：${metaPath}`);
        }
        metaSource = `--meta (${metaPath})`;
        metaPathForDefaultName = metaPath;
    } else {
        const auto = findMatchingJsonByVersion(context, versionTag);
        if (auto) {
            metaObj = readJsonFile(auto);
            if (typeof metaObj.content !== 'string') {
                throw new Error(`自动匹配的 metadata 缺少字符串型 content 字段：${auto}`);
            }
            metaSource = `自动匹配版本 (${auto})`;
            metaPathForDefaultName = auto;
        } else {
            metaObj = buildDefaultMeta(baseName);
            metaSource = '默认模板';
            console.warn('[警告] 未在当前项目内找到匹配的 metadata 参考文件，将使用默认模板与新生成的 UUID');
        }
    }

    // 替换 content 字段，保持其他字段顺序与值不变
    const merged = { ...metaObj, content: jsContent };

    // 还原打包格式：缩进 2，与酒馆助手默认导出一致
    const jsonText = JSON.stringify(merged, null, 2) + '\n';

    const projectName = context ? context.projectName : stripVersionTag(baseName);
    const defaultBase = metaPathForDefaultName
        ? path.basename(metaPathForDefaultName)
        : (versionTag ? `酒馆助手脚本-${projectName} ${versionTag}.json` : `${baseName}.json`);
    const outputPath = resolveOutputPath(options.out, defaultOutputDir(inputPath, context, 'JS → JSON'), defaultBase, '.json');
    writeOutput(outputPath, jsonText, options);

    const written = readJsonFile(outputPath);
    if (written.content !== jsContent) {
        throw new Error(`输出校验失败：JSON.parse(output).content 不等于输入 JS (${outputPath})`);
    }

    console.log(`[完成] JS → JSON content 序列化`);
    console.log(`  输入: ${inputPath}`);
    console.log(`  metadata 来源: ${metaSource}`);
    console.log(`  输出: ${outputPath}`);
    console.log(`  校验: JSON.parse(output).content === 输入 JS`);
    console.log(`  字节: ${Buffer.byteLength(jsonText, 'utf8')}`);
    return outputPath;
}

// ---------- 主入口 ----------

function main() {
    let parsed;
    try {
        parsed = parseArgs(process.argv.slice(2));
    } catch (e) {
        console.error(`[错误] ${e.message}`);
        printHelp();
        process.exit(2);
    }

    if (parsed.options.help || parsed.positional.length === 0) {
        printHelp();
        process.exit(parsed.options.help ? 0 : 2);
    }

    const inputArg = parsed.positional[0];
    const inputPath = path.resolve(inputArg);
    if (!fs.existsSync(inputPath)) {
        console.error(`[错误] 输入文件不存在: ${inputPath}`);
        process.exit(1);
    }
    if (!fs.statSync(inputPath).isFile()) {
        console.error(`[错误] 输入路径不是文件: ${inputPath}`);
        process.exit(1);
    }

    const ext = path.extname(inputPath).toLowerCase();
    try {
        if (ext === '.json') {
            convertJsonToJs(inputPath, parsed.options);
        } else if (ext === '.js') {
            convertJsToJson(inputPath, parsed.options);
        } else {
            console.error(`[错误] 不支持的输入扩展名 ${ext || '(无扩展名)'}（仅支持 .json/.js）`);
            process.exit(2);
        }
    } catch (e) {
        console.error(`[错误] ${e.message}`);
        process.exit(1);
    }
}

main();
