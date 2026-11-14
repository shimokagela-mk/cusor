const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { renderReadableTables } = require('./render-embedded-tables');

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`读取文件失败: ${filePath}\n${error.message}`);
  }
}

function readJson(filePath) {
  const raw = readText(filePath);
  try {
    return { raw, data: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`JSON 解析失败: ${filePath}\n${error.message}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function tryExtractEmbeddedTemplate(firstMes) {
  const text = String(firstMes || '');
  const match = text.match(/const EMBEDDED_TEMPLATE_BASE64 = "([^"]+)";/);
  if (!match) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(match[1], 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.warn(`embedded template 提取失败: ${error.message}`);
    return null;
  }
}

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '未命名';
  }

  return cleaned.slice(0, 80);
}

function padNumber(value, width = 3) {
  return String(value).padStart(width, '0');
}

function summarizeText(text, maxLength = 160) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength - 1) + '…';
}

function detectControlBlocks(text) {
  const value = String(text || '');
  const blocks = [];

  if (/<start>/i.test(value)) {
    blocks.push('start');
  }
  if (/<state_bar>/i.test(value)) {
    blocks.push('state_bar');
  }
  if (/<tableEdit>/i.test(value)) {
    blocks.push('tableEdit');
  }
  if (/<UpdateVariable>/i.test(value)) {
    blocks.push('UpdateVariable');
  }

  return blocks;
}

function hasPath(target, segments) {
  let current = target;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return false;
    }
    current = current[segment];
  }

  return true;
}

function resolveDataRoot(card) {
  if (!card || typeof card !== 'object') {
    throw new Error('角色卡内容不是对象');
  }

  if (card.data && typeof card.data === 'object') {
    return card.data;
  }

  return card;
}

function collectWriteTargets(card) {
  const targets = {
    first_mes: [],
    alternate_greetings: [],
    character_book_entries: [],
    regex_scripts: [],
    tavern_helper_scripts: [],
    tavern_helper_variables: []
  };

  const hasDataRoot = card.data && typeof card.data === 'object';

  if (hasPath(card, ['first_mes'])) {
    targets.first_mes.push(['first_mes']);
  }
  if (hasPath(card, ['data', 'first_mes'])) {
    targets.first_mes.push(['data', 'first_mes']);
  }
  if (targets.first_mes.length === 0) {
    targets.first_mes.push(hasDataRoot ? ['data', 'first_mes'] : ['first_mes']);
  }

  if (hasPath(card, ['alternate_greetings'])) {
    targets.alternate_greetings.push(['alternate_greetings']);
  }
  if (hasPath(card, ['data', 'alternate_greetings'])) {
    targets.alternate_greetings.push(['data', 'alternate_greetings']);
  }
  if (targets.alternate_greetings.length === 0) {
    targets.alternate_greetings.push(hasDataRoot ? ['data', 'alternate_greetings'] : ['alternate_greetings']);
  }

  if (hasPath(card, ['character_book', 'entries'])) {
    targets.character_book_entries.push(['character_book', 'entries']);
  }
  if (hasPath(card, ['data', 'character_book', 'entries'])) {
    targets.character_book_entries.push(['data', 'character_book', 'entries']);
  }
  if (targets.character_book_entries.length === 0) {
    targets.character_book_entries.push(hasDataRoot
      ? ['data', 'character_book', 'entries']
      : ['character_book', 'entries']);
  }

  if (hasPath(card, ['extensions', 'regex_scripts'])) {
    targets.regex_scripts.push(['extensions', 'regex_scripts']);
  }
  if (hasPath(card, ['data', 'extensions', 'regex_scripts'])) {
    targets.regex_scripts.push(['data', 'extensions', 'regex_scripts']);
  }
  if (targets.regex_scripts.length === 0) {
    targets.regex_scripts.push(hasDataRoot
      ? ['data', 'extensions', 'regex_scripts']
      : ['extensions', 'regex_scripts']);
  }

  if (hasPath(card, ['extensions', 'tavern_helper', 'scripts'])) {
    targets.tavern_helper_scripts.push(['extensions', 'tavern_helper', 'scripts']);
  }
  if (hasPath(card, ['data', 'extensions', 'tavern_helper', 'scripts'])) {
    targets.tavern_helper_scripts.push(['data', 'extensions', 'tavern_helper', 'scripts']);
  }
  if (targets.tavern_helper_scripts.length === 0) {
    targets.tavern_helper_scripts.push(hasDataRoot
      ? ['data', 'extensions', 'tavern_helper', 'scripts']
      : ['extensions', 'tavern_helper', 'scripts']);
  }

  if (hasPath(card, ['extensions', 'tavern_helper', 'variables'])) {
    targets.tavern_helper_variables.push(['extensions', 'tavern_helper', 'variables']);
  }
  if (hasPath(card, ['data', 'extensions', 'tavern_helper', 'variables'])) {
    targets.tavern_helper_variables.push(['data', 'extensions', 'tavern_helper', 'variables']);
  }
  if (targets.tavern_helper_variables.length === 0) {
    targets.tavern_helper_variables.push(hasDataRoot
      ? ['data', 'extensions', 'tavern_helper', 'variables']
      : ['extensions', 'tavern_helper', 'variables']);
  }

  return targets;
}

function buildEntryFileName(entry, index) {
  const comment = sanitizeFileName(entry && entry.comment ? entry.comment : `条目-${index + 1}`);
  return `${padNumber(index + 1)}-${comment}.yaml`;
}

function buildRegexScriptFileName(script, index) {
  const name = sanitizeFileName(script && script.scriptName ? script.scriptName : `正则脚本-${index + 1}`);
  return `${padNumber(index + 1)}-${name}.json`;
}

function buildTavernHelperScriptFileName(script, index) {
  const name = sanitizeFileName(script && script.name ? script.name : `酒馆助手脚本-${index + 1}`);
  return `${padNumber(index + 1)}-${name}.json`;
}

function buildGreetingManifestItem(relativePath, text, index = null) {
  return {
    index,
    path: normalizeSlashes(relativePath),
    length: String(text || '').length,
    control_blocks: detectControlBlocks(text),
    summary: summarizeText(text)
  };
}

function buildEntryManifestItem(entry, index, relativePath) {
  return {
    index,
    id: entry && Object.prototype.hasOwnProperty.call(entry, 'id') ? entry.id : null,
    comment: entry && entry.comment ? entry.comment : '',
    path: normalizeSlashes(relativePath),
    keys: Array.isArray(entry && entry.keys) ? entry.keys : [],
    enabled: entry && Object.prototype.hasOwnProperty.call(entry, 'enabled') ? entry.enabled : true,
    constant: entry && Object.prototype.hasOwnProperty.call(entry, 'constant') ? entry.constant : null,
    position: entry && Object.prototype.hasOwnProperty.call(entry, 'position') ? entry.position : null,
    summary: summarizeText(entry && entry.content ? entry.content : '')
  };
}

function buildRegexScriptManifestItem(script, index, relativePath) {
  return {
    index,
    id: script && Object.prototype.hasOwnProperty.call(script, 'id') ? script.id : null,
    scriptName: script && script.scriptName ? script.scriptName : '',
    path: normalizeSlashes(relativePath),
    disabled: script && Object.prototype.hasOwnProperty.call(script, 'disabled') ? script.disabled : false,
    placement: Array.isArray(script && script.placement) ? script.placement : [],
    summary: summarizeText(script && script.findRegex ? script.findRegex : '')
  };
}

function buildTavernHelperScriptManifestItem(script, index, relativePath) {
  return {
    index,
    id: script && Object.prototype.hasOwnProperty.call(script, 'id') ? script.id : null,
    name: script && script.name ? script.name : '',
    path: normalizeSlashes(relativePath),
    enabled: script && Object.prototype.hasOwnProperty.call(script, 'enabled') ? script.enabled : true,
    type: script && script.type ? script.type : '',
    summary: summarizeText(script && script.content ? script.content : '')
  };
}

function inferOutputDir(inputPath, cardName) {
  const baseName = sanitizeFileName(cardName || path.basename(inputPath, path.extname(inputPath)));
  return path.join(process.cwd(), 'projects', baseName, 'unpacked');
}

function toYaml(value) {
  return yaml.dump(value, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
}

function printUsage() {
  console.log('用法: node tools/unpack-card.js <角色卡JSON路径> [输出目录]');
  console.log('示例: node tools/unpack-card.js 次元欢乐岛.json projects/次元欢乐岛/unpacked');
  console.log('默认输出目录: projects/<角色卡名>/unpacked');
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputPath = path.resolve(process.cwd(), args[0]);
  const { raw, data: card } = readJson(inputPath);
  const cardData = resolveDataRoot(card);

  const cardName = cardData.name || card.name || path.basename(inputPath, path.extname(inputPath));
  const outputDir = args[1]
    ? path.resolve(process.cwd(), args[1])
    : inferOutputDir(inputPath, cardName);

  const entriesDir = path.join(outputDir, 'entries');
  const greetingsDir = path.join(outputDir, 'greetings');
  const regexScriptsDir = path.join(outputDir, 'regex_scripts');
  const tavernHelperDir = path.join(outputDir, 'tavern_helper');
  const tavernHelperScriptsDir = path.join(tavernHelperDir, 'scripts');

  const entries = Array.isArray(cardData.character_book && cardData.character_book.entries)
    ? cardData.character_book.entries
    : [];
  const regexScripts = Array.isArray(cardData.extensions && cardData.extensions.regex_scripts)
    ? cardData.extensions.regex_scripts
    : [];
  const tavernHelper = cardData.extensions && cardData.extensions.tavern_helper && typeof cardData.extensions.tavern_helper === 'object'
    ? cardData.extensions.tavern_helper
    : {};
  const tavernHelperScripts = Array.isArray(tavernHelper.scripts)
    ? tavernHelper.scripts
    : [];
  const tavernHelperVariables = tavernHelper.variables && typeof tavernHelper.variables === 'object'
    ? tavernHelper.variables
    : {};
  const firstMes = typeof cardData.first_mes === 'string'
    ? cardData.first_mes
    : (typeof card.first_mes === 'string' ? card.first_mes : '');
  const alternateGreetings = Array.isArray(cardData.alternate_greetings)
    ? cardData.alternate_greetings
    : [];

  ensureDir(outputDir);
  ensureDir(entriesDir);
  ensureDir(greetingsDir);
  ensureDir(regexScriptsDir);
  ensureDir(tavernHelperScriptsDir);

  writeText(path.join(outputDir, 'original-card.json'), raw);

  const manifest = {
    manifest_version: 1,
    created_at: new Date().toISOString(),
    card_name: cardName,
    spec: card.spec || null,
    spec_version: card.spec_version || null,
    editable_scope: [
      'first_mes',
      'alternate_greetings',
      'character_book.entries',
      'extensions.regex_scripts',
      'extensions.tavern_helper.scripts',
      'extensions.tavern_helper.variables'
    ],
    files: {
      original_card: 'original-card.json',
      entries_dir: 'entries',
      greetings_dir: 'greetings',
      regex_scripts_dir: 'regex_scripts',
      tavern_helper_dir: 'tavern_helper',
      tavern_helper_scripts_dir: 'tavern_helper/scripts'
    },
    targets: collectWriteTargets(card),
    counts: {
      entries: entries.length,
      alternate_greetings: alternateGreetings.length,
      regex_scripts: regexScripts.length,
      tavern_helper_scripts: tavernHelperScripts.length
    },
    mappings: {
      first_mes: null,
      alternate_greetings: [],
      entries: [],
      regex_scripts: [],
      tavern_helper_scripts: [],
      tavern_helper_variables: null
    }
  };

  const firstMesRelativePath = path.join('greetings', 'first_mes.txt');
  writeText(path.join(outputDir, firstMesRelativePath), firstMes);
  manifest.mappings.first_mes = buildGreetingManifestItem(firstMesRelativePath, firstMes);

  const embeddedTemplate = tryExtractEmbeddedTemplate(firstMes);
  if (embeddedTemplate) {
    const tablesDir = path.join(outputDir, 'extracted', 'tables');
    const tablesPath = path.join(tablesDir, 'embedded-template.pretty.json');
    writeText(tablesPath, JSON.stringify(embeddedTemplate, null, 2));
    renderReadableTables(tablesPath);
  }

  alternateGreetings.forEach((text, index) => {
    const relativePath = path.join('greetings', `alternate-${padNumber(index + 1)}.txt`);
    writeText(path.join(outputDir, relativePath), typeof text === 'string' ? text : String(text ?? ''));
    manifest.mappings.alternate_greetings.push(
      buildGreetingManifestItem(relativePath, text, index)
    );
  });

  entries.forEach((entry, index) => {
    const relativePath = path.join('entries', buildEntryFileName(entry, index));
    writeText(path.join(outputDir, relativePath), toYaml(entry));
    manifest.mappings.entries.push(
      buildEntryManifestItem(entry, index, relativePath)
    );
  });

  regexScripts.forEach((script, index) => {
    const relativePath = path.join('regex_scripts', buildRegexScriptFileName(script, index));
    writeText(path.join(outputDir, relativePath), JSON.stringify(script, null, 2));
    manifest.mappings.regex_scripts.push(
      buildRegexScriptManifestItem(script, index, relativePath)
    );
  });

  tavernHelperScripts.forEach((script, index) => {
    const relativePath = path.join('tavern_helper', 'scripts', buildTavernHelperScriptFileName(script, index));
    writeText(path.join(outputDir, relativePath), JSON.stringify(script, null, 2));
    manifest.mappings.tavern_helper_scripts.push(
      buildTavernHelperScriptManifestItem(script, index, relativePath)
    );
  });

  const tavernHelperVariablesRelativePath = path.join('tavern_helper', 'variables.json');
  writeText(path.join(outputDir, tavernHelperVariablesRelativePath), JSON.stringify(tavernHelperVariables, null, 2));
  manifest.mappings.tavern_helper_variables = {
    path: normalizeSlashes(tavernHelperVariablesRelativePath),
    keys: Object.keys(tavernHelperVariables)
  };

  writeText(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`已解包角色卡: ${cardName}`);
  console.log(`输出目录: ${outputDir}`);
  console.log(`世界书条目: ${entries.length}`);
  console.log(`正则脚本: ${regexScripts.length}`);
  console.log(`酒馆助手脚本: ${tavernHelperScripts.length}`);
  console.log(`主开场白: greetings/first_mes.txt`);
  console.log(`候选开场白: ${alternateGreetings.length}`);
  console.log('已生成 original-card.json 与 manifest.json，后续回包时只覆盖这些已拆出的字段。');
}

main();
