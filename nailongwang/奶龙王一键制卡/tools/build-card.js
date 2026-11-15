const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { buildEmbeddedTablesFromReadable } = require('./render-embedded-tables');

const INLINE_MULTIPLAYER_RUNTIME_ATTR = 'data-coc7-inline-runtime="coc7th-multiplayer-runtime"';

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`);
    throw error;
  }
}

function readJsonFile(filePath) {
  const content = readFile(filePath);
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error(`JSON解析失败: ${filePath}`);
    throw error;
  }
}

function createEntryTemplate() {
  return {
    keys: [],
    secondary_keys: [],
    constant: true,
    selective: true,
    insertion_order: 100,
    enabled: true,
    position: "before_char",
    use_regex: true,
    extensions: {
      position: 0,
      exclude_recursion: false,
      display_index: 0,
      probability: 100,
      useProbability: true,
      depth: 4,
      selectiveLogic: 0,
      outlet_name: "",
      group: "",
      group_override: false,
      group_weight: 100,
      prevent_recursion: true,
      delay_until_recursion: false,
      scan_depth: null,
      match_whole_words: null,
      use_group_scoring: false,
      case_sensitive: null,
      automation_id: "",
      role: 0,
      vectorized: false,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      match_persona_description: false,
      match_character_description: false,
      match_character_personality: false,
      match_character_depth_prompt: false,
      match_scenario: false,
      match_creator_notes: false,
      triggers: [],
      ignore_budget: false
    }
  };
}

function convertPosition(positionStr) {
  const positionMap = {
    'before_char': 0,
    'after_char': 1,
    'before_em': 5,
    'after_em': 6,
    'before_an': 2,
    'after_an': 3,
    'at_depth': 4
  };
  return positionMap[positionStr] ?? 0;
}

function loadEntriesFromDir(entriesDir) {
  const entries = [];
  
  if (!fs.existsSync(entriesDir)) {
    console.log(`条目目录不存在: ${entriesDir}`);
    return entries;
  }
  
  const files = fs.readdirSync(entriesDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
  
  for (const file of files) {
    const filePath = path.join(entriesDir, file);
    const content = readFile(filePath);
    const entryData = yaml.load(content);
    
    const entry = createEntryTemplate();
    entry.id = entries.length;
    entry.comment = entryData.comment || file;
    entry.content = entryData.content || "";
    entry.enabled = entryData.enabled ?? true;
    entry.position = entryData.position || "before_char";
    entry.insertion_order = entryData.insertion_order ?? 100;
    
    if (entryData.constant === false) {
      entry.constant = false;
    }
    
    if (entryData.keys && Array.isArray(entryData.keys)) {
      entry.keys = entryData.keys;
    }
    
    if (entryData.secondary_keys && Array.isArray(entryData.secondary_keys)) {
      entry.secondary_keys = entryData.secondary_keys;
    }
    
    entry.extensions.position = convertPosition(entry.position);
    entry.extensions.display_index = entries.length;
    entry.extensions.depth = entryData.depth ?? 4;
    entry.extensions.role = entryData.role ?? 0;
    
    if (entryData.prevent_recursion === false) {
      entry.extensions.prevent_recursion = false;
    }
    
    if (entryData.exclude_recursion !== undefined) {
      entry.extensions.exclude_recursion = entryData.exclude_recursion;
    }
    
    entries.push(entry);
    console.log(`  加载条目: ${entryData.comment || file}`);
  }
  
  return entries;
}

function stPositionToName(position) {
  const map = {
    0: 'before_char',
    1: 'after_char',
    2: 'before_an',
    3: 'after_an',
    4: 'at_depth',
    5: 'before_em',
    6: 'after_em'
  };
  if (typeof position === 'number') return map[position] || 'before_char';
  if (typeof position === 'string' && ['before_char', 'after_char', 'before_an', 'after_an', 'at_depth', 'before_em', 'after_em'].includes(position)) {
    return position;
  }
  return 'before_char';
}

function convertStWorldInfoEntry(st, id) {
  const entry = createEntryTemplate();
  entry.id = id;
  entry.comment = st.comment || `wi-${st.uid ?? id}`;
  entry.content = typeof st.content === 'string' ? st.content : '';
  entry.enabled = st.disable !== true;
  entry.constant = st.constant === true;
  entry.selective = st.selective !== false;
  entry.keys = Array.isArray(st.key) ? st.key.map(String) : [];
  entry.secondary_keys = Array.isArray(st.keysecondary) ? st.keysecondary.map(String) : [];
  entry.insertion_order = Number.isFinite(st.order) ? st.order : (1000 + id);
  entry.position = stPositionToName(st.position);
  entry.use_regex = false;
  entry.extensions.position = typeof st.position === 'number' ? st.position : convertPosition(entry.position);
  entry.extensions.display_index = id;
  entry.extensions.depth = Number.isFinite(st.depth) ? st.depth : 4;
  entry.extensions.role = Number.isFinite(st.role) ? st.role : 0;
  entry.extensions.probability = Number.isFinite(st.probability) ? st.probability : 100;
  entry.extensions.useProbability = st.useProbability !== false;
  entry.extensions.prevent_recursion = st.preventRecursion === true;
  entry.extensions.exclude_recursion = st.excludeRecursion === true;
  entry.extensions.delay_until_recursion = st.delayUntilRecursion === true;
  entry.extensions.scan_depth = st.scanDepth ?? null;
  entry.extensions.match_whole_words = st.matchWholeWords ?? null;
  entry.extensions.case_sensitive = st.caseSensitive ?? null;
  entry.extensions.group = typeof st.group === 'string' ? st.group : '';
  entry.extensions.group_override = st.groupOverride === true;
  entry.extensions.group_weight = Number.isFinite(st.groupWeight) ? st.groupWeight : 100;
  entry.extensions.sticky = Number.isFinite(st.sticky) ? st.sticky : 0;
  entry.extensions.cooldown = Number.isFinite(st.cooldown) ? st.cooldown : 0;
  entry.extensions.delay = Number.isFinite(st.delay) ? st.delay : 0;
  entry.extensions.ignore_budget = st.ignoreBudget === true;
  entry.extensions.vectorized = st.vectorized === true;
  entry.extensions.selectiveLogic = Number.isFinite(st.selectiveLogic) ? st.selectiveLogic : 0;
  entry.extensions.triggers = Array.isArray(st.triggers) ? st.triggers : [];
  return entry;
}

function loadExtraWorldInfo(planDir, buildConfig, startId) {
  const configured = Array.isArray(buildConfig?.extraWorldInfo) ? buildConfig.extraWorldInfo : [];
  if (configured.length === 0) return [];

  const merged = [];
  let nextId = startId;
  for (const rel of configured) {
    const filePath = path.resolve(planDir, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`extraWorldInfo 文件不存在: ${filePath}`);
    }
    const data = readJsonFile(filePath);
    let sourceEntries = [];
    if (Array.isArray(data)) sourceEntries = data;
    else if (data && typeof data === 'object' && data.entries && typeof data.entries === 'object') {
      sourceEntries = Array.isArray(data.entries) ? data.entries : Object.values(data.entries);
    } else {
      throw new Error(`extraWorldInfo 无法识别条目结构: ${filePath}`);
    }

    for (const st of sourceEntries) {
      merged.push(convertStWorldInfoEntry(st || {}, nextId));
      nextId += 1;
    }
    console.log(`  合并外部世界书: ${rel} (${sourceEntries.length} 条)`);
  }
  return merged;
}

function encodeToBase64(jsonObj) {
  const jsonStr = JSON.stringify(jsonObj);
  const utf8Bytes = Buffer.from(jsonStr, 'utf-8');
  return utf8Bytes.toString('base64');
}

function replaceOpeningPlaceholder(openingHtml, placeholderName, jsonObj, label) {
  const placeholder = `{{${placeholderName}}}`;
  const placeholderCount = openingHtml.split(placeholder).length - 1;

  if (placeholderCount === 0) {
    console.log(`  ⚠️ 开场白未提供 ${placeholder} 占位符，跳过${label}注入`);
    return openingHtml;
  }

  if (!jsonObj) {
    console.log(`  ⚠️ 开场白存在 ${placeholder} 占位符，但未加载${label}，保留占位符`);
    return openingHtml;
  }

  const encoded = encodeToBase64(jsonObj);
  console.log(`  注入${label}: ${placeholder} x ${placeholderCount}`);
  return openingHtml.split(placeholder).join(encoded);
}

function injectTablesIntoOpening(openingHtml, tablesJson) {
  const templateBase64 = encodeToBase64(tablesJson);

  if (openingHtml.includes('__ACU_TEMPLATE_DATA__')) {
    console.log('  检测到世界书表格模板入口 __ACU_TEMPLATE_DATA__，跳过开场白内嵌 Base64 注入');
    return openingHtml;
  }
  
  // 只替换变量赋值语句中的占位符，保留函数调用中的占位符参数
  // 匹配: const EMBEDDED_TEMPLATE_BASE64 = "{{TEMPLATE_BASE64}}";
  const pattern = /const EMBEDDED_TEMPLATE_BASE64 = "{{TEMPLATE_BASE64}}";/;
  if (pattern.test(openingHtml)) {
    return openingHtml.replace(pattern, `const EMBEDDED_TEMPLATE_BASE64 = "${templateBase64}";`);
  }
  
  // 如果没有占位符，则补入当前模板注入脚本。
  const injectScript = `<script>
const TEMPLATE_BASE64 = "${templateBase64}";

function decodeBase64(base64Str) {
  try {
    const binaryStr = atob(base64Str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const jsonStr = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Base64解码失败:', e);
    return null;
  }
}

const TEMPLATE = decodeBase64(TEMPLATE_BASE64);
console.log('表格模板已加载:', TEMPLATE);
</script>`;
  
  if (openingHtml.includes('</body>')) {
    return openingHtml.replace('</body>', injectScript + '\n</body>');
  } else {
    return openingHtml + '\n' + injectScript;
  }
}

function injectAssetsIntoOpening(openingHtml, tablesJson, presetJson, openingAssets = {}) {
  let finalHtml = openingHtml;

  if (tablesJson) {
    finalHtml = injectTablesIntoOpening(finalHtml, tablesJson);
  }

  finalHtml = replaceOpeningPlaceholder(finalHtml, 'MODULE_TEMPLATE_BASE64', openingAssets.moduleTemplateJson, 'COC 模组制作模板');
  finalHtml = replaceOpeningPlaceholder(finalHtml, 'PLAY_TEMPLATE_BASE64', openingAssets.playTemplateJson, 'COC 游玩模板');
  finalHtml = replaceOpeningPlaceholder(finalHtml, 'PRESET_BASE64', presetJson, '剧情推进预设');

  return finalHtml;
}

function loadPlotPreset(frontendDir) {
  if (!fs.existsSync(frontendDir)) {
    return null;
  }

  const candidateFiles = ['剧情推进.json', 'plot-preset.json', 'preset.json'];

  for (const file of candidateFiles) {
    const filePath = path.join(frontendDir, file);
    if (fs.existsSync(filePath)) {
      return {
        fileName: file,
        data: readJsonFile(filePath)
      };
    }
  }

  return null;
}

function loadOpeningTemplateAsset(tablesDir, fileName, label) {
  const assetPath = path.join(tablesDir, fileName);

  if (!fs.existsSync(assetPath)) {
    console.log(`  ⚠️ 未找到${label}: ${assetPath}`);
    return null;
  }

  console.log(`  加载${label}: ${fileName}`);
  return readJsonFile(assetPath);
}

function loadPlotRegexAssets(frontendDir, hasPlotPreset) {
  if (!hasPlotPreset) {
    return null;
  }

  const beautifyFileName = '推进美化.html';
  const configFileName = '推进正则配置.json';
  const beautifyPath = path.join(frontendDir, beautifyFileName);
  const configPath = path.join(frontendDir, configFileName);

  if (!fs.existsSync(beautifyPath)) {
    throw new Error(`检测到剧情推进预设，但缺少卡专属推进美化HTML: ${beautifyPath}`);
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(`检测到剧情推进预设，但缺少卡专属推进正则配置: ${configPath}`);
  }

  const config = readJsonFile(configPath);

  if (!config || typeof config !== 'object') {
    throw new Error(`推进正则配置格式错误: ${configPath}`);
  }

  if (!config.beautify || !config.cleanup) {
    throw new Error(`推进正则配置必须同时包含 beautify 和 cleanup 段: ${configPath}`);
  }

  if (!config.beautify.scriptName || !config.beautify.findRegex) {
    throw new Error(`推进正则 beautify 段缺少 scriptName 或 findRegex: ${configPath}`);
  }

  if (!config.cleanup.scriptName || !config.cleanup.findRegex) {
    throw new Error(`推进正则 cleanup 段缺少 scriptName 或 findRegex: ${configPath}`);
  }

  return {
    beautifyFileName,
    configFileName,
    beautifyHtml: readFile(beautifyPath),
    config
  };
}

function loadTavernHelperScripts(planDir, buildConfig = null) {
  const configuredSource = typeof buildConfig?.tavernHelperSource === 'string'
    ? buildConfig.tavernHelperSource.trim()
    : '';
  const scriptsDir = configuredSource
    ? path.resolve(planDir, configuredSource)
    : path.join(planDir, 'unpacked', 'tavern_helper', 'scripts');

  if (!fs.existsSync(scriptsDir)) {
    console.log(`  未找到酒馆助手脚本目录: ${scriptsDir}`);
    return [];
  }

  return fs.readdirSync(scriptsDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const filePath = path.join(scriptsDir, file);
      const script = readJsonFile(filePath);

      if (!script || typeof script !== 'object' || Array.isArray(script)) {
        throw new Error(`酒馆助手脚本格式错误: ${filePath}`);
      }
      if (script.type !== 'script') {
        throw new Error(`酒馆助手脚本缺少 type=script: ${filePath}`);
      }
      if (typeof script.content !== 'string' || !script.content.trim()) {
        throw new Error(`酒馆助手脚本缺少 content: ${filePath}`);
      }

      return script;
    });
}

// 检查并补全开场白的 <start> 标签
function ensureStartTags(content) {
  const hasStartTag = content.includes('<start>');
  const hasEndTag = content.includes('</start>');
  
  if (!hasStartTag && !hasEndTag) {
    console.log('  ⚠️ 开场白缺少 <start> 标签，已自动补全');
    return '<start>\n' + content + '\n</start>';
  } else if (!hasStartTag) {
    console.log('  ⚠️ 开场白缺少 <start> 开始标签，已自动补全');
    return '<start>\n' + content;
  } else if (!hasEndTag) {
    console.log('  ⚠️ 开场白缺少 </start> 结束标签，已自动补全');
    return content + '\n</start>';
  }
  return content;
}

// 检查并补全状态栏的完整HTML格式
function ensureCompleteHtml(content) {
  const hasDoctype = content.trim().toLowerCase().startsWith('<!doctype html');
  const hasHtmlTag = content.includes('<html');
  const hasHtmlEndTag = content.includes('</html>');
  
  // 如果已经是完整的HTML文档，直接返回
  if (hasDoctype && hasHtmlTag && hasHtmlEndTag) {
    return content;
  }
  
  // 如果缺少完整HTML结构，自动补全
  if (!hasDoctype) {
    console.log('  ⚠️ 状态栏缺少 <!DOCTYPE html>，已自动补全');
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>状态栏</title>
</head>
<body>
${content}
</body>
</html>`;
    return htmlContent;
  }
  
  return content;
}

function inlineMultiplayerRuntime(html, runtimeJs) {
  if (!runtimeJs || !String(runtimeJs).trim()) {
    return ensureCompleteHtml(html);
  }

  const finalHtml = ensureCompleteHtml(html);
  if (finalHtml.includes(INLINE_MULTIPLAYER_RUNTIME_ATTR)) {
    return finalHtml;
  }

  const scriptTag = `<script ${INLINE_MULTIPLAYER_RUNTIME_ATTR}>\n${runtimeJs}\n</script>`;
  if (/<\/body>/i.test(finalHtml)) {
    return finalHtml.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  }
  return `${finalHtml}\n${scriptTag}`;
}

function createOpeningRegex(openingHtml, tablesJson, presetJson, openingAssets = {}) {
  // 检查并补全 <start> 标签
  let finalHtml = ensureStartTags(openingHtml);
  finalHtml = injectAssetsIntoOpening(finalHtml, tablesJson, presetJson, openingAssets);
  
  // 使用 $1 占位符来引用正则匹配的第一个捕获组（即 <start> 标签内的内容）
  // 这样开场白内容会被插入到 HTML 中显示
  const replaceString = "====\n```html\n" + finalHtml + "\n```";
  
  return {
    id: generateUUID(),
    scriptName: "欢迎页面",
    findRegex: "/<start>([\\s\\S]*?)<\\/start>/gsi",
    replaceString: replaceString,
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 1,  // 启用正则替换，使用 $1 引用捕获组
    minDepth: null,
    maxDepth: 0
  };
}

// 从 opening-regex.html 创建正则（完整的HTML文档，不需要检查 <start> 标签）
function createOpeningRegexFromHtml(openingHtml, tablesJson, presetJson, openingAssets = {}) {
  let finalHtml = openingHtml;
  finalHtml = injectAssetsIntoOpening(finalHtml, tablesJson, presetJson, openingAssets);
  
  // opening-regex.html 是完整的HTML文档，直接使用
  const replaceString = "====\n```html\n" + finalHtml + "\n```";
  
  return {
    id: generateUUID(),
    scriptName: "欢迎页面",
    findRegex: "/<start>([\\s\\S]*?)<\\/start>/gsi",
    replaceString: replaceString,
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 1,  // 启用正则替换，使用 $1 引用捕获组
    minDepth: null,
    maxDepth: 0
  };
}

function createRegexScriptFromConfig(scriptConfig, replaceString) {
  return {
    id: generateUUID(),
    scriptName: scriptConfig.scriptName,
    findRegex: scriptConfig.findRegex,
    replaceString,
    trimStrings: Array.isArray(scriptConfig.trimStrings) ? scriptConfig.trimStrings : [],
    placement: Array.isArray(scriptConfig.placement) && scriptConfig.placement.length > 0 ? scriptConfig.placement : [1],
    disabled: scriptConfig.disabled ?? false,
    markdownOnly: scriptConfig.markdownOnly ?? true,
    promptOnly: scriptConfig.promptOnly ?? false,
    runOnEdit: scriptConfig.runOnEdit ?? true,
    substituteRegex: scriptConfig.substituteRegex ?? 0,
    minDepth: scriptConfig.minDepth ?? null,
    maxDepth: scriptConfig.maxDepth ?? null
  };
}

function createPlotBeautifyRegex(plotBeautifyHtml, scriptConfig) {
  const finalHtml = ensureCompleteHtml(plotBeautifyHtml);
  const replaceString = "====\n```html\n" + finalHtml + "\n```";
  return createRegexScriptFromConfig(scriptConfig, replaceString);
}

function createPlotCleanupRegex(scriptConfig) {
  return createRegexScriptFromConfig(scriptConfig, scriptConfig.replaceString ?? "");
}

function createStatusBarRegex(statusBarHtml, runtimeJs = '') {
  // 检查并补全完整HTML格式
  const finalHtml = inlineMultiplayerRuntime(statusBarHtml, runtimeJs);
  
  const replaceString = "====\n```html\n" + finalHtml + "\n```";
  
  return {
    id: generateUUID(),
    scriptName: "状态栏",
    findRegex: "/$/g",
    replaceString: replaceString,
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: 0
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function buildLatestTablesFromReadable(tablesDir) {
  const readableDir = path.join(tablesDir, 'readable');
  const indexPath = path.join(readableDir, '00-目录.md');

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const outputPath = path.join(tablesDir, 'table-template.json');
  const result = buildEmbeddedTablesFromReadable(readableDir, outputPath);
  const data = readJsonFile(outputPath);
  const tableCount = Object.keys(data).filter(k => k !== 'mate').length;
  console.log(`  从 readable/*.md 重建表格模板: table-template.json (${tableCount} 张表)`);
  return data;
}

function loadTableTemplates(tablesDir) {
  if (!fs.existsSync(tablesDir)) {
    return null;
  }

  const readableTables = buildLatestTablesFromReadable(tablesDir);
  if (readableTables) {
    return readableTables;
  }

  const mergedTables = {};
  const loadedUids = new Set();

  // ===== 阶段1：加载 JSON 文件（当前输入格式） =====
  const jsonFiles = fs.readdirSync(tablesDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .sort();

  for (const file of jsonFiles) {
    const filePath = path.join(tablesDir, file);
    const content = readFile(filePath);
    try {
      const tableData = JSON.parse(content);

      if (tableData.mate) {
        mergedTables.mate = tableData.mate;
      }

      if (tableData.mate && tableData.mate.type === 'chatSheets') {
        Object.keys(tableData).forEach(key => {
          if (key !== 'mate') {
            mergedTables[key] = tableData[key];
            if (tableData[key].uid) {
              loadedUids.add(tableData[key].uid);
            }
          }
        });
        console.log(`  加载表格(JSON/奶龙格式): ${file}`);
      } else if (typeof tableData === 'object' && !Array.isArray(tableData)) {
        Object.keys(tableData).forEach(key => {
          if (key !== 'mate') {
            mergedTables[key] = tableData[key];
            if (tableData[key].uid) {
              loadedUids.add(tableData[key].uid);
            }
          }
        });
        console.log(`  加载表格(JSON/对象格式): ${file}`);
      } else {
        console.log(`  跳过不支持的表格格式: ${file}`);
      }
    } catch (e) {
      console.log(`  表格解析失败: ${file} - ${e.message}`);
    }
  }

  // ===== 阶段2：加载 YAML 文件 =====
  const yamlFiles = fs.readdirSync(tablesDir)
    .filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && f !== '000-meta.yaml')
    .sort();

  // 先加载 meta
  const metaPath = path.join(tablesDir, '000-meta.yaml');
  if (fs.existsSync(metaPath)) {
    const metaContent = readFile(metaPath);
    const metaData = yaml.load(metaContent);
    if (!mergedTables.mate) {
      mergedTables.mate = metaData;
    }
    console.log(`  加载表格元数据: 000-meta.yaml`);
  }

  // 加载各表 YAML
  for (const file of yamlFiles) {
    const filePath = path.join(tablesDir, file);
    const content = readFile(filePath);
    try {
      const sheetData = yaml.load(content);

      if (!sheetData || !sheetData.uid) {
        console.log(`  跳过无效YAML: ${file}（缺少uid）`);
        continue;
      }

      // 冲突检测：同一个 uid 不能同时存在于 JSON 和 YAML 中
      if (loadedUids.has(sheetData.uid)) {
        throw new Error(`表格uid冲突: ${sheetData.uid} 同时存在于JSON和YAML中，请删除其中一个`);
      }

      const key = sheetData.uid;
      mergedTables[key] = sheetData;
      loadedUids.add(sheetData.uid);
      console.log(`  加载表格(YAML): ${file} → ${sheetData.name}`);
    } catch (e) {
      if (e.message.includes('冲突')) throw e;
      console.log(`  YAML解析失败: ${file} - ${e.message}`);
    }
  }

  // ===== 阶段3：检查结果 =====
  const tableCount = Object.keys(mergedTables).filter(k => k !== 'mate').length;
  if (tableCount === 0) {
    return null;
  }

  // 如果没有 mate，自动生成默认值
  if (!mergedTables.mate) {
    mergedTables.mate = { type: 'chatSheets', version: 1 };
    console.log('  ⚠️ 未找到 mate 信息，使用默认值');
  }

  console.log(`  共加载 ${tableCount} 个表格`);

  const hasJournal = Object.keys(mergedTables).some(k => 
    mergedTables[k].name === '纪要表' || mergedTables[k].uid?.includes('3NoMc1wI')
  );
  const hasCharacters = Object.keys(mergedTables).some(k => 
    mergedTables[k].name === '重要角色表' || mergedTables[k].uid?.includes('NcBlYRH5')
  );

  if (!hasJournal) {
    console.log('  ⚠️ 警告: 缺少纪要表，将使用默认模板');
  }
  if (!hasCharacters) {
    console.log('  ⚠️ 警告: 缺少重要角色表，将使用默认模板');
  }

  return mergedTables;
}

function loadReleaseTavernHelperScripts(planDir) {
  const releaseDir = path.join(planDir, 'release');
  if (!fs.existsSync(releaseDir)) return [];
  return fs.readdirSync(releaseDir)
    .filter(file => file.endsWith('.tavern-helper.json'))
    .sort()
    .map(file => {
      const script = readJsonFile(path.join(releaseDir, file));
      if (!script || script.type !== 'script' || !script.content) {
        throw new Error(`Tavern Helper 脚本格式无效: ${path.join(releaseDir, file)}`);
      }
      console.log(`  加载酒馆助手脚本: ${file}`);
      return script;
    });
}

function validateRegexScript(script, filePath) {
  if (!script || typeof script !== 'object') {
    throw new Error(`正则脚本格式无效: ${filePath}`);
  }

  if (!script.scriptName || !script.findRegex || typeof script.replaceString !== 'string') {
    throw new Error(`正则脚本缺少 scriptName/findRegex/replaceString: ${filePath}`);
  }
}

function loadReleaseRegexScripts(planDir, existingScripts = []) {
  const releaseDir = path.join(planDir, 'release');
  if (!fs.existsSync(releaseDir)) return [];

  const existingScriptNames = new Set(existingScripts.map(script => script.scriptName).filter(Boolean));
  const existingFindRegexes = new Set(existingScripts.map(script => script.findRegex).filter(Boolean));
  const loadedScripts = [];

  const files = fs.readdirSync(releaseDir)
    .filter(file => file.endsWith('.regex.json'))
    .sort();

  for (const file of files) {
    if (file.includes('待机界面')) {
      console.log(`  跳过 release 正则脚本（待机界面已迁移为 Tavern Helper）: ${file}`);
      continue;
    }

    const filePath = path.join(releaseDir, file);
    const script = readJsonFile(filePath);
    validateRegexScript(script, filePath);

    if (script.scriptName === '少女前线-待机界面') {
      console.log(`  跳过 release 正则脚本（待机界面已迁移为 Tavern Helper）: ${file}`);
      continue;
    }

    if (existingScriptNames.has(script.scriptName)) {
      console.log(`  跳过 release 正则脚本（scriptName 已存在）: ${file}`);
      continue;
    }

    if (existingFindRegexes.has(script.findRegex)) {
      console.log(`  跳过 release 正则脚本（findRegex 已存在）: ${file}`);
      continue;
    }

    loadedScripts.push(script);
    existingScriptNames.add(script.scriptName);
    existingFindRegexes.add(script.findRegex);
    console.log(`  加载 release 正则脚本: ${file}`);
  }

  return loadedScripts;
}

function hasAcuTemplateKey(entry) {
  const keys = [];
  if (Array.isArray(entry.keys)) keys.push(...entry.keys);
  if (Array.isArray(entry.key)) keys.push(...entry.key);
  else if (typeof entry.key === 'string') keys.push(entry.key);
  return keys.map(key => String(key).trim()).includes('__ACU_TEMPLATE_DATA__');
}

function syncAcuTemplateEntry(entriesDir, entries, tablesJson) {
  if (!tablesJson || !Array.isArray(entries)) return;

  const templateBase64 = encodeToBase64(tablesJson);
  const targetEntry = entries.find(entry => hasAcuTemplateKey(entry));

  if (!targetEntry) {
    console.log('  ⚠️ 未找到 __ACU_TEMPLATE_DATA__ 世界书条目，开场页将无法从世界书导入表格');
    return;
  }

  targetEntry.content = templateBase64;

  const acuEntryPath = path.join(entriesDir, '999-ACU-表格模板.yaml');
  if (fs.existsSync(acuEntryPath)) {
    const currentContent = readFile(acuEntryPath);
    const nextContent = currentContent.match(/^content:\s*.*$/m)
      ? currentContent.replace(/^content:\s*.*$/m, `content: ${templateBase64}`)
      : `${currentContent.trimEnd()}\ncontent: ${templateBase64}\n`;

    if (nextContent !== currentContent) {
      fs.writeFileSync(acuEntryPath, nextContent, 'utf-8');
      console.log('  已同步 ACU 表格模板世界书条目: entries/999-ACU-表格模板.yaml');
    } else {
      console.log('  ACU 表格模板世界书条目已是最新');
    }
  } else {
    console.log('  ⚠️ 未找到 entries/999-ACU-表格模板.yaml，仅同步本次构建内存条目');
  }
}

function buildCharacterCard(planPath) {
  const planDir = path.dirname(planPath);
  const entriesDir = path.join(planDir, 'entries');
  const tablesDir = path.join(planDir, 'tables');
  const frontendDir = path.join(planDir, 'frontend');
  const buildConfig = loadOptionalBuildConfig(planDir);
  
  console.log('\n正在构建角色卡...\n');
  
  console.log('1. 加载世界书条目...');
  const entries = loadEntriesFromDir(entriesDir);
  const extraEntries = loadExtraWorldInfo(planDir, buildConfig, entries.length);
  if (extraEntries.length > 0) {
    entries.push(...extraEntries);
  }
  console.log(`  共加载 ${entries.length} 个条目（含外部世界书 ${extraEntries.length}）\n`);
  
  console.log('2. 加载表格模板...');
  const tablesJson = loadTableTemplates(tablesDir);
  if (tablesJson) {
    const tableCount = Object.keys(tablesJson).filter(k => k !== 'mate').length;
    syncAcuTemplateEntry(entriesDir, entries, tablesJson);
    console.log(`  表格模板加载完成\n`);
  } else {
    console.log('  未找到表格模板\n');
  }

  console.log('2.1 加载开场页内嵌模板...');
  const openingAssets = {
    moduleTemplateJson: loadOpeningTemplateAsset(tablesDir, 'module-template.json', 'COC 模组制作模板'),
    playTemplateJson: loadOpeningTemplateAsset(tablesDir, 'play-template.json', 'COC 游玩模板')
  };
  console.log('');

  console.log('3. 加载剧情推进预设...');
  const presetInfo = loadPlotPreset(frontendDir);
  const presetJson = presetInfo ? presetInfo.data : null;
  const plotRegexAssets = loadPlotRegexAssets(frontendDir, Boolean(presetJson));
  if (presetInfo) {
    console.log(`  加载剧情推进预设: ${presetInfo.fileName}`);
    console.log(`  加载推进美化HTML: ${plotRegexAssets.beautifyFileName}`);
    console.log(`  加载推进正则配置: ${plotRegexAssets.configFileName}\n`);
  } else {
    console.log('  未找到剧情推进预设（将仅注入表格模板）\n');
  }
  
  console.log('4. 加载前端组件...');
  const tavernHelperScripts = loadTavernHelperScripts(planDir, buildConfig);
  if (tavernHelperScripts.length > 0) {
    const helperNames = tavernHelperScripts.map((script) => script.name || script.scriptName || '未命名脚本').join(', ');
    console.log(`  加载酒馆助手脚本: ${helperNames}`);
  } else {
    console.log('  未找到酒馆助手脚本，构建产物不会注入 tavern_helper.scripts');
  }
  const regexScripts = [];
  
  // 优先使用 opening-regex.html（完整的美化HTML），否则使用 opening.html
  const openingRegexPath = path.join(frontendDir, 'opening-regex.html');
  const openingPath = path.join(frontendDir, 'opening.html');
  
  if (fs.existsSync(openingRegexPath)) {
    // opening-regex.html 是完整的HTML文档，不需要检查 <start> 标签
    const openingHtml = readFile(openingRegexPath);
    regexScripts.push(createOpeningRegexFromHtml(openingHtml, tablesJson, presetJson, openingAssets));
    console.log(`  加载开场白美化正则HTML（opening-regex.html，${presetJson ? '已注入表格模板+剧情推进预设' : '已注入表格模板'}）`);
  } else if (fs.existsSync(openingPath)) {
    // opening.html 是纯文本，需要检查 <start> 标签
    const openingHtml = readFile(openingPath);
    regexScripts.push(createOpeningRegex(openingHtml, tablesJson, presetJson, openingAssets));
    console.log(`  加载开场白（${presetJson ? '已注入表格模板+剧情推进预设' : '已注入表格模板'}）`);
  }
  
  let statusFiles = [];
  if (fs.existsSync(frontendDir)) {
    statusFiles = fs.readdirSync(frontendDir)
      .filter(f => f.startsWith('status-bar') && f.endsWith('.html'))
      .sort();
  }

  const multiplayerRuntimePath = path.join(frontendDir, 'multiplayer-runtime.js');
  const multiplayerRuntimeJs = fs.existsSync(multiplayerRuntimePath) ? readFile(multiplayerRuntimePath) : '';
  if (multiplayerRuntimeJs) {
    console.log('  鍔犺浇鑱旀満杩愯鏃? multiplayer-runtime.js');
  }
  
  for (const file of statusFiles) {
    const filePath = path.join(frontendDir, file);
    const statusBarHtml = readFile(filePath);
    regexScripts.push(createStatusBarRegex(statusBarHtml, multiplayerRuntimeJs));
    console.log(`  加载状态栏: ${file}`);
  }

  if (plotRegexAssets) {
    regexScripts.push(createPlotBeautifyRegex(plotRegexAssets.beautifyHtml, plotRegexAssets.config.beautify));
    console.log(`  加载剧情推进美化正则: ${plotRegexAssets.config.beautify.scriptName}`);

    regexScripts.push(createPlotCleanupRegex(plotRegexAssets.config.cleanup));
    console.log(`  加载剧情推进高楼层隐藏正则: ${plotRegexAssets.config.cleanup.scriptName}`);
  }

  regexScripts.push(...loadReleaseRegexScripts(planDir, regexScripts));

  for (const script of loadReleaseTavernHelperScripts(planDir)) {
    tavernHelperScripts.push(script);
  }
  console.log('');
  
  let planData = {};
  if (fs.existsSync(planPath)) {
    const planContent = readFile(planPath);
    try {
      planData = yaml.load(planContent);
    } catch (e) {
      console.error('\n❌ 错误: 计划文件解析失败！');
      console.error(`  文件: ${planPath}`);
      console.error(`  错误信息: ${e.message}`);
      console.error('\n请检查计划文件的YAML格式后重试。');
      process.exit(1);
    }
  } else {
    console.error('\n❌ 错误: 计划文件不存在！');
    console.error(`  期望路径: ${planPath}`);
    console.error('\n请确保计划文件存在后重试。');
    process.exit(1);
  }
  
  const now = new Date();
  const createDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} @${now.getHours()}h ${now.getMinutes()}m ${now.getSeconds()}s ${now.getMilliseconds()}ms`;
  
  const cardName = planData.name || planData['角色名称'] || '角色卡';
  
  const card = {
    name: cardName,
    description: planData.description || "",
    personality: planData.personality || "",
    scenario: planData.scenario || "",
    first_mes: planData.first_mes || "<start>\n简要描述你的角色，让我们开始冒险吧\n</start>",
    mes_example: planData.mes_example || "",
    creatorcomment: "",
    avatar: "none",
    talkativeness: planData.extensions?.talkativeness || "0.5",
    fav: planData.extensions?.fav || false,
    tags: [],
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: cardName,
      description: planData.description || "",
      personality: planData.personality || "",
      scenario: planData.scenario || "",
      first_mes: planData.first_mes || "<start>\n简要描述你的角色，让我们开始冒险吧\n</start>",
      mes_example: planData.mes_example || "",
      creator_notes: planData.creator_notes || "",
      system_prompt: planData.system_prompt || "",
      post_history_instructions: planData.post_history_instructions || "",
      tags: [],
      creator: planData.creator || "",
      character_version: planData.character_version || "1.0",
      alternate_greetings: [],
      extensions: {
        talkativeness: planData.extensions?.talkativeness || "0.5",
        fav: planData.extensions?.fav || false,
        world: planData.extensions?.world || cardName,
        depth_prompt: {
          prompt: "",
          depth: 4,
          role: "system"
        },
        tavern_helper: {
          scripts: tavernHelperScripts,
          variables: {}
        },
        regex_scripts: regexScripts
      },
      group_only_greetings: [],
      character_book: {
        entries: entries,
        name: cardName
      }
    },
    create_date: createDate
  };
  
  return { card, cardName, hasPreset: Boolean(presetJson), tablesJson };
}

// 导出独立资产到 _build/ 子目录
function exportBuildAssets(planDir, entries, tablesJson) {
  console.log('\n5. 导出独立资产...');

  // 导出世界书 JSON 到 entries/_build/
  const entriesDir = path.join(planDir, 'entries');
  if (entries && entries.length > 0 && fs.existsSync(entriesDir)) {
    const entriesBuildDir = path.join(entriesDir, '_build');
    if (!fs.existsSync(entriesBuildDir)) {
      fs.mkdirSync(entriesBuildDir, { recursive: true });
    }
    const worldbook = { entries: entries };
    const wbPath = path.join(entriesBuildDir, 'worldbook.json');
    fs.writeFileSync(wbPath, JSON.stringify(worldbook, null, 2), 'utf-8');
    console.log(`  导出世界书: entries/_build/worldbook.json (${entries.length} 条)`);
  }

  // 导出表格模板 JSON 到 tables/_build/
  const tablesDir = path.join(planDir, 'tables');
  if (tablesJson && fs.existsSync(tablesDir)) {
    const tablesBuildDir = path.join(tablesDir, '_build');
    if (!fs.existsSync(tablesBuildDir)) {
      fs.mkdirSync(tablesBuildDir, { recursive: true });
    }
    const tablePath = path.join(tablesBuildDir, 'table-template.json');
    fs.writeFileSync(tablePath, JSON.stringify(tablesJson, null, 2), 'utf-8');
    const tableCount = Object.keys(tablesJson).filter(k => k !== 'mate').length;
    console.log(`  导出表格模板: tables/_build/table-template.json (${tableCount} 张表)`);
  }
}

function loadOptionalBuildConfig(planDir) {
  const buildConfigPath = path.join(planDir, 'build-config.json');
  if (!fs.existsSync(buildConfigPath)) {
    return null;
  }
  return readJsonFile(buildConfigPath);
}

function resolveSourceCardPath(planDir, buildConfig) {
  const sourceCard = typeof buildConfig?.sourceCard === 'string'
    ? buildConfig.sourceCard.trim()
    : '';
  if (!sourceCard) {
    return null;
  }
  return path.resolve(planDir, sourceCard);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('用法: node build-card.js <计划文件路径>');
    console.error('示例: node tools/build-card.js projects/落霞宗遗址/current-plan.yaml');
    console.error('输出: projects/落霞宗遗址/release/落霞宗遗址.json');
    process.exit(1);
  }
  
  const planPath = args[0];
  
  try {
    const { card, cardName, hasPreset, tablesJson } = buildCharacterCard(planPath);
    
    const planDir = path.dirname(planPath);
    const buildConfig = loadOptionalBuildConfig(planDir);
    const outputDir = path.join(path.dirname(planPath), 'release');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, `${cardName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(card, null, 2), 'utf-8');

    const sourceCardPath = resolveSourceCardPath(planDir, buildConfig);
    if (sourceCardPath) {
      fs.mkdirSync(path.dirname(sourceCardPath), { recursive: true });
      fs.writeFileSync(sourceCardPath, JSON.stringify(card, null, 2), 'utf-8');
      console.log(`  同步项目源卡: ${sourceCardPath}`);
    }
    
    console.log(`\n✓ 角色卡已成功生成: ${outputPath}\n`);

    // 导出独立资产到 _build/ 子目录
    exportBuildAssets(planDir, card.data.character_book.entries, tablesJson);

    console.log('\n统计信息:');
    console.log(`  - 世界书条目: ${card.data.character_book.entries.length} 个`);
    console.log(`  - 正则脚本: ${card.data.extensions.regex_scripts.length} 个`);
    console.log(`  - 酒馆助手脚本: ${card.data.extensions.tavern_helper.scripts.length} 个`);
    
    const tableStatus = card.data.extensions.regex_scripts.filter(s =>
      s.scriptName === "欢迎页面"
    ).length > 0 ? "已注入开场白" : "无";
    const builtInRegexNames = new Set(["欢迎页面", "状态栏"]);
    const extraRegexCount = card.data.extensions.regex_scripts.filter(s =>
      !builtInRegexNames.has(s.scriptName)
    ).length;
    console.log(`  - 表格模板: ${tableStatus}`);
    console.log(`  - 剧情推进预设: ${hasPreset ? '已注入' : '无'}`);
    console.log(`  - 额外正则: ${extraRegexCount} 个`);
    
    const blueEntries = card.data.character_book.entries.filter(e =>
      e.constant === true && e.extensions.prevent_recursion === true
    ).length;
    const greenEntries = card.data.character_book.entries.filter(e => 
      e.constant === false
    ).length;
    console.log(`  - 蓝灯条目: ${blueEntries} 个`);
    console.log(`  - 绿灯条目: ${greenEntries} 个`);
  } catch (error) {
    console.error('构建失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
