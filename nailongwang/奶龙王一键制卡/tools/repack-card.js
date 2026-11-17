const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { renderReadableTables, syncReadableTablesToJson, buildEmbeddedTablesFromReadable } = require('./render-embedded-tables');

const INLINE_MULTIPLAYER_RUNTIME_ATTR = 'data-coc7-inline-runtime="coc7th-multiplayer-runtime"';
const REGEX_SCRIPT_NAME_ALIASES = {
  opening: ['opening', '欢迎页面'],
  '欢迎页面': ['opening', '欢迎页面'],
  'status-bar': ['status-bar', '状态栏'],
  '状态栏': ['status-bar', '状态栏']
};

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error('repack-card operation failed');
  }
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function readJson(filePath) {
  const raw = readText(filePath);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('repack-card operation failed');
  }
}

function readYaml(filePath) {
  const raw = readText(filePath);
  try {
    return yaml.load(raw);
  } catch (error) {
    throw new Error('repack-card operation failed');
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function encodeToBase64(jsonObj) {
  const jsonStr = JSON.stringify(jsonObj);
  const utf8Bytes = Buffer.from(jsonStr, 'utf-8');
  return utf8Bytes.toString('base64');
}

function injectTablesIntoHtml(html, tablesJson) {
  if (!tablesJson) {
    return html;
  }

  const templateBase64 = encodeToBase64(tablesJson);
  const pattern = /const EMBEDDED_TEMPLATE_BASE64 = "[^"]*";/;

  if (pattern.test(html)) {
    return html.replace(pattern, `const EMBEDDED_TEMPLATE_BASE64 = "${templateBase64}";`);
  }

  return html;
}

function createRegexReplaceString(html) {
  return '====\n```html\n' + html + '\n```';
}

function ensureCompleteHtml(content) {
  const hasDoctype = content.trim().toLowerCase().startsWith('<!doctype html');
  const hasHtmlTag = content.includes('<html');
  const hasHtmlEndTag = content.includes('</html>');

  if (hasDoctype && hasHtmlTag && hasHtmlEndTag) {
    return content;
  }

  if (!hasDoctype) {
    return `<!DOCTYPE html>
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

function matchesRegexScriptName(actualName, expectedName) {
  const actual = String(actualName || '').trim();
  const expected = String(expectedName || '').trim();
  if (!actual || !expected) {
    return false;
  }
  const aliases = REGEX_SCRIPT_NAME_ALIASES[expected] || [expected];
  return aliases.includes(actual);
}

function updateRegexScriptReplaceString(card, scriptName, replaceString) {
  const roots = [];

  if (card && card.data && card.data.extensions && Array.isArray(card.data.extensions.regex_scripts)) {
    roots.push(card.data.extensions.regex_scripts);
  }
  if (card && card.extensions && Array.isArray(card.extensions.regex_scripts)) {
    roots.push(card.extensions.regex_scripts);
  }

  roots.forEach((scripts) => {
    scripts.forEach((script) => {
      if (script && matchesRegexScriptName(script.scriptName, scriptName)) {
        script.replaceString = replaceString;
      }
    });
  });
}

function injectPresetIntoHtml(html, presetJson) {
  if (!presetJson) {
    return html;
  }

  const presetBase64 = encodeToBase64(presetJson);

  const pattern = /const EMBEDDED_PRESET_BASE64 = "{{PRESET_BASE64}}";/;
  if (pattern.test(html)) {
    return html.replace(pattern, `const EMBEDDED_PRESET_BASE64 = "${presetBase64}";`);
  }

  console.log('  Injected plot preset into {{PRESET_BASE64}} placeholder.');
  return html;
}

function loadPlotPreset(frontendDir) {
  if (!fileExists(frontendDir)) {
    return null;
  }

  const candidateFiles = ['闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閼碱剦鍞堕梻浣虹《閸撴繄绮欓幋鐘电焼閻庯綆鍋佹禍婊堟煙閹佃櫕娅呴柣蹇婃櫆閵囧嫰濡烽妷顬勬叏婵犲嫮甯涢柟宄版噽缁數鈧綆鍋嗙粔宄扳攽閻愯尙鎽犵紒顔肩墢閸掓帒鈻庤箛鏇熸濠电娀娼ч敃锕傛偪閳ь剟姊洪崫鍕窛闁哥姴瀛╅幆?json', 'plot-preset.json', 'preset.json'];

  for (const file of candidateFiles) {
    const filePath = path.join(frontendDir, file);
    if (fileExists(filePath)) {
      return {
        fileName: file,
        data: readJson(filePath)
      };
    }
  }

  return null;
}

function loadPlotRegexAssets(frontendDir, hasPlotPreset) {
  if (!hasPlotPreset) {
    return null;
  }

  const beautifyFileName = '闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑﹦绋忔繝銏ｆ硾椤戝洭銆呴幓鎹楀綊鎮╁顔煎壈缂備讲鍋撳鑸靛姉閸欐捇鏌涢妷锝呭缂佲偓閸愵亖鍋撶憴鍕鐎殿喛鍩栫粚杈ㄧ節閸ヨ埖鏅┑鐘绘涧濡柨效濡ゅ啰纾藉ù锝嗗絻娴滈箖姊洪崨濠傚Е闁哥姵鐗滅划濠氬捶椤撶姷锛滃銈嗘⒒閸樠呮暜閵娾晜鐓曢悗锝庡亝瀹曞本顨ラ悙鍙夊闁瑰嘲鎳樺畷銊︾節鎼粹剝鏆?html';
  const configFileName = '闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑﹦绋忔繝銏ｆ硾椤戝洭銆呴幓鎹楀綊鎮╁顔煎壈缂備讲鍋撳鑸靛姉閸欐捇鏌涢妷锝呭缂佲偓閸愵亖鍋撶憴鍕鐎殿喛鍩栫粚杈ㄧ節閸ヨ埖鏅┑鐐叉鐢晠宕濋崨顓涙斀闁绘劗鍎ら敍鐔兼煕濡や礁鈻曠€殿喖顭锋俊鎼佸Ψ閵忊剝鏉搁梻浣虹《閸撴繈鏁嬪┑鐐叉嫅缂嶄礁顫忛搹瑙勫珰闁肩⒈鍓涢濠囨⒑閸濄儱校闁绘娲熼敐鐐剁疀閹句焦妞介、鏃堝礋椤撱垻宕滈梻浣藉吹婵灚绂嶆禒瀣闂侇剙绉村洿婵犮垼娉涢鍥储?json';
  const beautifyPath = path.join(frontendDir, beautifyFileName);
  const configPath = path.join(frontendDir, configFileName);

  if (!fileExists(beautifyPath)) {
    throw new Error('repack-card operation failed');
  }

  if (!fileExists(configPath)) {
    throw new Error('repack-card operation failed');
  }

  const config = readJson(configPath);

  if (!config || typeof config !== 'object') {
    throw new Error('repack-card operation failed');
  }

  if (!config.beautify || !config.cleanup) {
    throw new Error('repack-card operation failed');
  }

  if (!config.beautify.scriptName || !config.beautify.findRegex) {
    throw new Error('repack-card operation failed');
  }

  if (!config.cleanup.scriptName || !config.cleanup.findRegex) {
    throw new Error('repack-card operation failed');
  }

  return {
    beautifyFileName,
    configFileName,
    beautifyHtml: readText(beautifyPath),
    config
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ensureCompleteHtml(content) {
  const hasDoctype = content.trim().toLowerCase().startsWith('<!doctype html');
  const hasHtmlTag = content.includes('<html');
  const hasHtmlEndTag = content.includes('</html>');

  if (hasDoctype && hasHtmlTag && hasHtmlEndTag) {
    return content;
  }

  if (!hasDoctype) {
    console.log('  HTML is missing <!DOCTYPE html>; wrapping as a complete document.');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoCardUpdater</title>
</head>
<body>
${content}
</body>
</html>`;
  }

  return content;
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

function ensureRegexScriptsArray(card) {
  const roots = [];
  if (card && card.data && card.data.extensions) {
    if (!Array.isArray(card.data.extensions.regex_scripts)) {
      card.data.extensions.regex_scripts = [];
    }
    roots.push(card.data.extensions.regex_scripts);
  }
  if (card && card.extensions) {
    if (!Array.isArray(card.extensions.regex_scripts)) {
      card.extensions.regex_scripts = [];
    }
    roots.push(card.extensions.regex_scripts);
  }
  return roots;
}

function addOrUpdateRegexScript(card, scriptName, newScript) {
  const roots = ensureRegexScriptsArray(card);
  let found = false;

  roots.forEach((scripts) => {
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i] && scripts[i].scriptName === scriptName) {
        scripts[i] = newScript;
        found = true;
        break;
      }
    }
  });

  if (!found) {
    roots.forEach((scripts) => {
      scripts.push(newScript);
    });
    console.log(`  闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晝閳ь剛澹曡ぐ鎺撶厽闁绘梻鍘ф禍浼存煟閺傛寧顥為柟渚垮妼椤啰鎷犻煫顓烆棜闂佽崵濮崇拃锕傚垂閸洖钃熸繛鎴欏灩缁犳盯鏌ｉ姀銈嗘锭閻㈩垬鍎遍埞鎴︽倷閻戞﹫绱甸梺鍛婎殕婵炲﹤顕ｆ繝姘╅柕澶堝灪閺傗偓闂備胶纭堕崜婵嬫晪濠电偛鎷戠紞浣割潖閾忚瀚氶柤纰卞墰椤斿﹪姊洪崫銉バｉ柣妤冨Т椤曪絾绻濆顑┭囨煕閵夘垳鍒板ù婊呭亾缁绘盯骞嬮悙鍨櫧闂佺粯甯熸慨銈夊Φ閸曨垱鏅查柛娑卞幘妤犲洨绱撴担铏瑰笡缂佽鐗撳畷娲焵? ${scriptName}`);
  } else {
    console.log(`  闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈠煕濮橆厽銇濆┑陇鍩栧鍕偓锝庝簷濡叉劙姊绘笟鈧褑澧濋梺鍝勬噺閻╊垶骞忛幋锔藉亜閻忓繋鐒﹂弬鈧梻浣虹帛钃辩憸鏉垮暞缁傚秹鎮欑€靛摜顔曢梻鍌氬€瑰娆忕暤閸℃稒鐓涢悘鐐额嚙婵″ジ鏌嶇憴鍕伌鐎规洖宕灒闁绘垶锕╂禒鈺呮⒒閸屾瑦绁版い鏇嗗懏宕查柟鐑橆殔缁愭鏌″搴″箹闁藉啰鍠栭弻鏇㈠醇濠靛洨顦遍梺绋款儐閹告悂鍩ユ径濞炬瀻婵☆垳鍘ф慨鐑樹繆閻愵亜鈧呭緤閽樺鍤曢柛鎾茬劍瀹曞弶绻濋棃娑卞剰闁? ${scriptName}`);
  }
}

function ensureAcuYamlFiles(entriesDir, tablesJson, presetJson) {
  const templateYaml = path.join(entriesDir, '999-ACU-闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾绾惧鏌ｉ幇顔芥毄闁活厽鐟╅悡顐﹀炊閵娧€妲堢紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忕細閸楀啿鐣烽幋鐘亾閿濆骸澧扮痪鎯с偢閹鏁愭惔鈥冲闂佹悶鍊х粻鎾诲蓟閿濆绫嶉柛灞捐壘娴犳﹢姊虹紒妯虹瑲婵＄偘绮欏璇测槈閵忕姷鐤€闂侀潧顭梽鍕偟閺嶎厽鈷?yaml');
  const presetYaml = path.join(entriesDir, '999-ACU-闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閼碱剦鍞堕梻浣虹《閸撴繄绮欓幋鐘电焼閻庯綆鍋佹禍婊堟煙閹佃櫕娅呴柣蹇婃櫆閵囧嫰濡烽妷顬勬叏婵犲嫮甯涢柟宄版噽缁數鈧綆鍋嗙粔宄扳攽閻愯尙鎽犵紒顔肩墢閸掓帒鈻庤箛鏇熸濠电娀娼ч敃锕傛偪閳ь剟姊洪崫鍕窛闁哥姴瀛╅幆鏃€绻濋崒妤佹杸闂佸疇妫勫Λ妤呮倶閻旇櫣纾煎Σ灞剧墪閺嬨倖淇婇崣澶婂闁轰焦鍔栧鍕偓锝庡墮楠炲牓姊绘担鍛婃儓婵炲眰鍨藉畷婵堜沪鐟欙絾鐎哄┑顔姐仜閸嬫捇鏌?yaml');

  if (!fileExists(templateYaml) && !fileExists(presetYaml)) {
    return 0;
  }

  let created = 0;

  if (tablesJson) {
    const entry = {
      id: 999800,
      keys: ['__ACU_TEMPLATE_DATA__'],
      secondary_keys: [],
      comment: 'AutoCardUpdater table template data',
      content: encodeToBase64(tablesJson),
      constant: false,
      selective: false,
      insertion_order: 9998,
      enabled: false,
      position: 'before_char',
      use_regex: false,
      extensions: {
        position: 0,
        exclude_recursion: true,
        display_index: 9998,
        probability: 100,
        useProbability: true,
        depth: 4,
        selectiveLogic: 0,
        prevent_recursion: true,
        delay_until_recursion: false,
        scan_depth: null,
        match_whole_words: null,
        use_group_scoring: false,
        case_sensitive: null,
        automation_id: '',
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
    writeText(templateYaml, yaml.dump(entry, { lineWidth: -1 }));
    created++;
  }

  if (presetJson) {
    const entry = {
      id: 999900,
      keys: ['__ACU_PRESET_DATA__'],
      secondary_keys: [],
      comment: 'AutoCardUpdater plot preset data',
      content: encodeToBase64(presetJson),
      constant: false,
      selective: false,
      insertion_order: 9999,
      enabled: false,
      position: 'before_char',
      use_regex: false,
      extensions: {
        position: 0,
        exclude_recursion: true,
        display_index: 9999,
        probability: 100,
        useProbability: true,
        depth: 4,
        selectiveLogic: 0,
        prevent_recursion: true,
        delay_until_recursion: false,
        scan_depth: null,
        match_whole_words: null,
        use_group_scoring: false,
        case_sensitive: null,
        automation_id: '',
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
    writeText(presetYaml, yaml.dump(entry, { lineWidth: -1 }));
    created++;
  }

  if (created > 0) {
    console.log(`  Created ACU YAML files: ${created}`);
  }

  return created;
}

function resolveProjectDirFromBundleDir(bundleDir) {
  if (path.basename(bundleDir) !== 'unpacked') {
    return null;
  }
  const projectDir = path.dirname(bundleDir);
  return path.basename(path.dirname(projectDir)) === 'projects' ? projectDir : null;
}

function resolveFrontendDir(bundleDir) {
  const extractedFrontendDir = path.join(bundleDir, 'extracted', 'frontend');
  if (fileExists(extractedFrontendDir)) {
    return extractedFrontendDir;
  }

  const projectDir = resolveProjectDirFromBundleDir(bundleDir);
  if (!projectDir) {
    return extractedFrontendDir;
  }

  const projectFrontendDir = path.join(projectDir, 'frontend');
  return fileExists(projectFrontendDir) ? projectFrontendDir : extractedFrontendDir;
}

function findFirstExistingPath(paths) {
  for (const filePath of paths) {
    if (filePath && fileExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

function syncExtractedAssets(bundleDir, card) {
  const frontendDir = resolveFrontendDir(bundleDir);
  const openingPath = findFirstExistingPath([
    path.join(frontendDir, 'opening-regex.source.html'),
    path.join(frontendDir, 'opening-regex.html')
  ]);
  const statusPath = findFirstExistingPath([
    path.join(frontendDir, 'status-bar.source.html'),
    path.join(frontendDir, 'status-bar.html')
  ]);
  const multiplayerRuntimePath = findFirstExistingPath([
    path.join(frontendDir, 'multiplayer-runtime.js')
  ]);
  const multiplayerRuntimeJs = multiplayerRuntimePath ? readText(multiplayerRuntimePath) : '';

  const presetInfo = loadPlotPreset(frontendDir);
  const presetJson = presetInfo ? presetInfo.data : null;
  if (presetInfo) {
    console.log(`  闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸崹楣冨箛娴ｅ湱绋佺紓鍌氬€烽悞锕佹懌闂佸憡鐟ョ换姗€寮婚悢纰辨晬闁挎繂娲ｅЧ妤呮偡濠婂懎顣奸悽顖涘浮閹瑦绻濋崘锔跨盎闂佺懓鎼Λ妤佺閸撗呯＝濞达絾褰冩禍楣冩⒑閸撴彃浜栭柛銊︽そ瀹曚即骞囬弶璺啇濠电儑缍嗛崜娆愪繆閼测晝妫柟顖嗗嫬浠撮梺缁樻惄閸嬪﹤鐣烽崼鏇炍╃憸澶娢ｉ崼銏㈢＝濞达絽鎼牎婵犵數鍋涢敃顏勵嚕婵犳艾鍗抽柣鏃囨椤旀洟姊洪崜鑼帥闁哥姵鐗犻垾鏍偓锝庡墰绾捐棄霉閿濆懏鎯堥棄瀣渻閵堝棙鑲犻柛鈩冪懁缂冩洟姊婚崒娆戭槮闁圭⒈鍋婅棟妞ゆ牜鍋為崐鑸电節闂堟侗鍎涢柡浣稿€归妵鍕箳瀹ュ顎栨繛? ${presetInfo.fileName}`);
  }

  let plotRegexAssets = null;
  try {
    plotRegexAssets = loadPlotRegexAssets(frontendDir, Boolean(presetJson));
  } catch (e) {
    console.error(`  闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾闁诡喖娼″畷鎯邦槷闁哄鐗犻弻锟犲炊閳轰焦鐎婚梺鎼炲妽濡啴骞冨Δ鍛棃婵炴垶鐟﹂崰鎰磽?${e.message}`);
  }

  if (plotRegexAssets) {
    console.log(`  闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸崹楣冨箛娴ｅ湱绋佺紓鍌氬€烽悞锕佹懌闂佸憡鐟ョ换姗€寮婚悢纰辨晬闁挎繂娲ｅЧ妤呮偡濠婂懎顣奸悽顖涘浮閹瑦绻濋崘锔跨盎闂佺懓鎼Λ妤佺閸撗呯＝濞达絽鎼牎婵犵數鍋涢敃顏勵嚕婵犳艾鍗抽柣鏃囨椤旀洟姊洪崜鑼帥闁哥姵鐗犻垾鏍偓锝庡墰绾捐棄霉閿濆懏鎯堥棄瀣倵鐟欏嫭绀堥柡浣侯焾鍗遍柟鐗堟緲缁犲鎮归崶顏勭毢闁稿﹦鍋ら幃宄邦煥閸曨剦妫冨銈冨灪閹告瓕鐏冮梺鍛婁緱閸犳牠鍩€椤掑倹鏆柡宀嬬秮婵偓闁绘ê鍚€缁數绱撴担钘夌厫闁烩剝婀歀: ${plotRegexAssets.beautifyFileName}`);
    console.log(`  闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸崹楣冨箛娴ｅ湱绋佺紓鍌氬€烽悞锕佹懌闂佸憡鐟ョ换姗€寮婚悢纰辨晬闁挎繂娲ｅЧ妤呮偡濠婂懎顣奸悽顖涘浮閹瑦绻濋崘锔跨盎闂佺懓鎼Λ妤佺閸撗呯＝濞达絽鎼牎婵犵數鍋涢敃顏勵嚕婵犳艾鍗抽柣鏃囨椤旀洟姊洪崜鑼帥闁哥姵鐗犻垾鏍偓锝庡墰绾捐棄霉閿濆懏鎯堥崯鍝ョ磽娓氬洤娅橀柛銊ョ埣閻涱噣宕奸妷銉庘晠鏌曟径鍫濈仾闁哄倵鍋撻梻鍌欐祰椤鐣峰Ο琛℃灃婵炴垯鍨归弰銉р偓鍏夊亾闁告洦鍏橀幏娲⒑閸涘﹥宕勯悘蹇旂懇瀹曘垹鈽夐姀锛勫幈闂侀潧顭堥崕鎶藉春閿濆洠鍋撳▓鍨灓缂侇噮鍨抽幑銏犫攽鐎ｎ亞锛滈梺闈涚墕閹冲繘宕愰鐐粹拻濞达綀顫夐崑鐘绘煕鎼搭喖娅嶇€殿喗褰冮…銊╁醇閻斿皝鍋? ${plotRegexAssets.configFileName}`);
  }

  if (openingPath) {
    const openingHtml = readText(openingPath);
    updateRegexScriptReplaceString(card, 'opening', createRegexReplaceString(openingHtml));
  }

  if (statusPath) {
    const statusHtml = inlineMultiplayerRuntime(readText(statusPath), multiplayerRuntimeJs);
    updateRegexScriptReplaceString(card, 'status-bar', createRegexReplaceString(statusHtml));
  }

  if (plotRegexAssets) {
    const beautifyScript = createPlotBeautifyRegex(plotRegexAssets.beautifyHtml, plotRegexAssets.config.beautify);
    addOrUpdateRegexScript(card, plotRegexAssets.config.beautify.scriptName, beautifyScript);

    const cleanupScript = createPlotCleanupRegex(plotRegexAssets.config.cleanup);
    addOrUpdateRegexScript(card, plotRegexAssets.config.cleanup.scriptName, cleanupScript);
  }
}

function normalizeToOsPath(baseDir, relativePath) {
  return path.join(baseDir, ...String(relativePath).split('/'));
}

function setAtPath(target, segments, value) {
  let current = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const nextKey = segments[i + 1];

    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = typeof nextKey === 'number' ? [] : {};
    }

    current = current[key];
  }

  current[segments[segments.length - 1]] = value;
}

function ensureArrayAtPath(target, segments) {
  let current = target;

  for (let i = 0; i < segments.length; i += 1) {
    const key = segments[i];
    const isLeaf = i === segments.length - 1;

    if (isLeaf) {
      if (!Array.isArray(current[key])) {
        current[key] = [];
      }
      return current[key];
    }

    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }

    current = current[key];
  }

  return [];
}

function inferOutputPath(bundleDir, card) {
  const cardName = (card.data && card.data.name) || card.name || 'character-card';
  const safeName = String(cardName).replace(/[\\/:*?"<>|]/g, '-').trim() || 'character-card';
  const projectDir = path.basename(bundleDir) === 'unpacked' ? path.dirname(bundleDir) : null;
  if (projectDir && path.basename(path.dirname(projectDir)) === 'projects') {
    return path.join(projectDir, 'release', `${safeName}-repacked.json`);
  }
  return path.join(process.cwd(), 'output', 'latest', `${safeName}-repacked.json`);
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('repack-card operation failed');
  }

  if (!manifest.mappings || typeof manifest.mappings !== 'object') {
    throw new Error('repack-card operation failed');
  }

  if (!manifest.targets || typeof manifest.targets !== 'object') {
    throw new Error('repack-card operation failed');
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node tools/repack-card.js <unpackedDir> [outputJsonPath]');
    console.log('Example: node tools/repack-card.js projects/<card>/unpacked projects/<card>/release/<card>-repacked.json');
    console.log('Default output path: projects/<card>/release/<card>-repacked.json, or output/latest/ when project name cannot be inferred.');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const bundleDir = path.resolve(process.cwd(), args[0]);
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const originalCardPath = path.join(bundleDir, 'original-card.json');

  const manifest = readJson(manifestPath);
  validateManifest(manifest);

  const originalCard = readJson(originalCardPath);

  const frontendDir = path.join(bundleDir, 'extracted', 'frontend');
  const tablesDir = path.join(bundleDir, 'extracted', 'tables');
  const entriesDir = path.join(bundleDir, 'entries');
  const tablesPath = path.join(tablesDir, 'embedded-template.pretty.json');
  const readableDir = path.join(tablesDir, 'readable');

  if (fileExists(path.join(readableDir, '00-闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀绾惧潡鏌ｉ姀銏╃劸闁汇倝绠栭弻宥夊传閸曨剙娅ｇ紓浣瑰姈椤ㄥ﹪寮婚垾鎰佸悑閹肩补鈧尙鏁栫紓鍌欒閸?md'))) {
    buildEmbeddedTablesFromReadable(readableDir, tablesPath);
    console.log('  濠电姷鏁告慨鐑藉极閹间礁纾绘繛鎴欏焺閺佸銇勯幘璺烘瀾闁告瑥绻橀幃妤呮濞戞瑦鍠愰梺缁樼矎瀹曠敻鍩€椤掆偓濠€閬嶁€﹂崼婵愮劷濠靛倻顭le MD闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸婂潡鏌ㄩ弴姘舵濞存粌缍婇弻娑㈠箛閸忓摜鏁栭梺娲诲幗閹瑰洭骞冨Δ鍛棃婵炴垶鐟﹂崰鎰磼閹冪稏缂侇喗鐟╁濠氭偄閻撳海顔夐梺褰掑亰閸撴盯宕㈤锔解拺缂佸顑欓崕鎰版煥閺囨ê鐏茬€殿喖顭峰鎾偄閾忓湱妲囬梻濠庡亜濞诧箓骞栭埡浼辨椽顢橀悢铏圭槇闂侀潧楠忕紞鍡楊焽閹扮増鐓冪憸婊堝礈濮樿埖鍊烽柡鍕工');
  }

  const tablesJson = fileExists(tablesPath) ? readJson(tablesPath) : null;
  const presetInfo = loadPlotPreset(frontendDir);
  const presetJson = presetInfo ? presetInfo.data : null;

  const acuCreated = ensureAcuYamlFiles(entriesDir, tablesJson, presetJson);
  const acuFiles = [
    '999-ACU-闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾绾惧鏌ｉ幇顔芥毄闁活厽鐟╅悡顐﹀炊閵娧€妲堢紓浣插亾濠㈣泛澶囬崑鎾荤嵁閸喖濮庡銈忕細閸楀啿鐣烽幋鐘亾閿濆骸澧扮痪鎯с偢閹鏁愭惔鈥冲闂佹悶鍊х粻鎾诲蓟閿濆绫嶉柛灞捐壘娴犳﹢姊虹紒妯虹瑲婵＄偘绮欏璇测槈閵忕姷鐤€闂侀潧顭梽鍕偟閺嶎厽鈷?yaml',
    '999-ACU-闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閼碱剦鍞堕梻浣虹《閸撴繄绮欓幋鐘电焼閻庯綆鍋佹禍婊堟煙閹佃櫕娅呴柣蹇婃櫆閵囧嫰濡烽妷顬勬叏婵犲嫮甯涢柟宄版噽缁數鈧綆鍋嗙粔宄扳攽閻愯尙鎽犵紒顔肩墢閸掓帒鈻庤箛鏇熸濠电娀娼ч敃锕傛偪閳ь剟姊洪崫鍕窛闁哥姴瀛╅幆鏃€绻濋崒妤佹杸闂佸疇妫勫Λ妤呮倶閻旇櫣纾煎Σ灞剧墪閺嬨倖淇婇崣澶婂闁轰焦鍔栧鍕偓锝庡墮楠炲牓姊绘担鍛婃儓婵炲眰鍨藉畷婵堜沪鐟欙絾鐎哄┑顔姐仜閸嬫捇鏌?yaml'
  ];

  function addAcuMappingIfMissing(file) {
    const relativePath = 'entries/' + file;
    const filePath = path.join(entriesDir, file);
    if (!fileExists(filePath) || manifest.mappings.entries.some(m => m.path === relativePath)) {
      return;
    }

    const entry = readYaml(filePath);
    manifest.mappings.entries.push({
      index: entry.insertion_order || 0,
      id: entry.id || null,
      comment: entry.comment || '',
      path: relativePath,
      keys: entry.keys || [],
      enabled: entry.enabled ?? false,
      constant: entry.constant ?? false,
      position: entry.position || null,
      summary: ''
    });
  }

  // ACU files may already exist from a previous pass even when this run does not create them.
  for (const file of acuFiles) {
    addAcuMappingIfMissing(file);
  }

  const firstMesMapping = manifest.mappings.first_mes;
  if (firstMesMapping && firstMesMapping.path) {
    const firstMes = readText(normalizeToOsPath(bundleDir, firstMesMapping.path));
    (manifest.targets.first_mes || []).forEach((segments) => {
      setAtPath(originalCard, segments, firstMes);
    });
  }

  const alternateGreetings = (manifest.mappings.alternate_greetings || []).map((item) => {
    return readText(normalizeToOsPath(bundleDir, item.path));
  });

  (manifest.targets.alternate_greetings || []).forEach((segments) => {
    setAtPath(originalCard, segments, alternateGreetings);
  });

  const rebuiltEntries = (manifest.mappings.entries || []).map((item) => {
    const entryPath = normalizeToOsPath(bundleDir, item.path);
    const entry = readYaml(entryPath);

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('repack-card operation failed');
    }

    return entry;
  });

  (manifest.targets.character_book_entries || []).forEach((segments) => {
    const arrayRef = ensureArrayAtPath(originalCard, segments);
    arrayRef.length = 0;
    rebuiltEntries.forEach((entry) => arrayRef.push(entry));
  });

  const rebuiltRegexScripts = (manifest.mappings.regex_scripts || []).map((item) => {
    const scriptPath = normalizeToOsPath(bundleDir, item.path);
    const script = readJson(scriptPath);

    if (!script || typeof script !== 'object' || Array.isArray(script)) {
      throw new Error('repack-card operation failed');
    }

    if (item.files) {
      const files = item.files;
      if (files.find) {
        const findPath = normalizeToOsPath(bundleDir, files.find);
        if (fileExists(findPath)) {
          script.findRegex = readText(findPath);
        }
      }
      if (files.replace) {
        const replacePath = normalizeToOsPath(bundleDir, files.replace);
        if (fileExists(replacePath)) {
          script.replaceString = createRegexReplaceString(readText(replacePath));
        }
      }
    }

    return script;
  });

  (manifest.targets.regex_scripts || []).forEach((segments) => {
    const arrayRef = ensureArrayAtPath(originalCard, segments);
    arrayRef.length = 0;
    rebuiltRegexScripts.forEach((script) => arrayRef.push(script));
  });

  const rebuiltTavernHelperScripts = (manifest.mappings.tavern_helper_scripts || []).map((item) => {
    const scriptPath = normalizeToOsPath(bundleDir, item.path);
    const script = readJson(scriptPath);

    if (!script || typeof script !== 'object' || Array.isArray(script)) {
      throw new Error('repack-card operation failed');
    }

    return script;
  });

  (manifest.targets.tavern_helper_scripts || []).forEach((segments) => {
    const arrayRef = ensureArrayAtPath(originalCard, segments);
    arrayRef.length = 0;
    rebuiltTavernHelperScripts.forEach((script) => arrayRef.push(script));
  });

  const tavernHelperVariablesMapping = manifest.mappings.tavern_helper_variables;
  if (tavernHelperVariablesMapping && tavernHelperVariablesMapping.path) {
    const variables = readJson(normalizeToOsPath(bundleDir, tavernHelperVariablesMapping.path));
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      throw new Error('repack-card operation failed');
    }
    (manifest.targets.tavern_helper_variables || []).forEach((segments) => {
      setAtPath(originalCard, segments, variables);
    });
  }

  syncExtractedAssets(bundleDir, originalCard);

  const outputPath = args[1]
    ? path.resolve(process.cwd(), args[1])
    : inferOutputPath(bundleDir, originalCard);

  writeText(outputPath, JSON.stringify(originalCard, null, 2));

  console.log(`闂傚倸鍊峰ù鍥敋瑜嶉湁闁绘垼妫勭粻鐘绘煙閹规劦鍤欑紒鐘靛枛濮婁粙宕堕鈧闂佸湱澧楀妯肩矆閸愨斂浜滄い鎾跺剱閸庢劖淇婇悙鑸殿棄妞ゆ洩绲剧粋鎺斺偓锝呯仛閺咃綁姊虹紒妯哄妞ゆ梹鐗曞嵄婵炲樊浜濋埛鎺懨归敐鍛暈闁哥喓鍋ら弻锝夊煛婵犲倻浠搁悗瑙勬礃閸ㄥ墎鎹㈠┑瀣＜闁靛牆娲ゆ慨娲⒒娴ｈ姤纭堕柛鐘虫尰閹便劑鎮介崨濠備簵闂佺粯顭囩划顖炲磻閳╁啰绠鹃柛鈩冾殘缁犵増銇勮箛濠冩珖缂佽鲸甯￠幊鐘垫崉閸濆嫭鍎梻? ${outputPath}`);
  console.log(`闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾缁愭鏌熼柇锕€鍔掓繛宸簻閸愨偓濡炪値鍓﹂崜姘辩矙閹达箑鐓″璺好￠悢鑽ょ杸闁哄洨鍋涙俊铏圭磽娴ｈ櫣甯涚紒璇茬墕閻ｇ兘鎮㈤悡骞晠鏌曟径鍫濃偓鏇⑺夊顓犵瘈闁汇垽娼ф禒锕傛煕閵娿儳鍩ｉ柟顔惧厴椤㈡稑顫濋敐鍡欎簴闂備礁鎼ú銊╁窗閸℃顩? first_mes / alternate_greetings / character_book.entries / extensions.regex_scripts / extensions.tavern_helper`);
  console.log(`濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙缂佺姵婢橀埞鎴︽偐瀹曞浂鏆￠梺绋款儏椤戝棛鎹㈠┑鍥╃瘈闁稿本绮岄。娲⒑濮瑰洤鈧宕戦幘璇参﹂柛鏇ㄥ灠缁犳盯鏌涢幘鑼妽闁稿瑪鍥ㄢ拺鐎规洖娲ㄧ敮娑欑箾閼碱剙鏋涚€殿喖顭锋俊鎼佸煛娴ｈ櫣娼夐梻浣规偠閸庢椽鎮樺┑瀣缂備焦顭囬崣鍐⒑缁嬫寧婀伴柛鎴濈秺瀹曟洟寮崼鐔哄幐閻庡厜鍋撻悗锝庡墰琚﹂梻浣虹《閺備線宕滃┑鍫熷床婵犻潧顑呯壕鍏肩箾閹寸偟鐓柟鏌ョ畺濮? ${rebuiltEntries.length}`);
  console.log(`婵犵數濮烽弫鍛婃叏閻㈠壊鏁婇柡宥庡幖缁愭淇婇妶鍛殲鐎规洘鐓￠弻鐔兼焽閿曗偓閺嬫稓绱掗煬鎻掆偓鏇㈡箒闂佺粯锚濡﹪宕曡箛娑欑厱闁靛鍎遍埀顒€缍婃俊鐢稿礋椤栨艾鍞ㄥ銈嗗姦濠⑩偓婵炲矈浜娲箹閻愭祴鍋撻弴鐏绘椽鏁冮崒姘辩杽闂侀潧顭堥崕鍝勵焽閵娾晜鐓曢柍鈺佸枤濞堟梻绱掗悩铏仢婵﹥妞藉畷鐑筋敇閻愭彃绠ｅ┑鐐茬摠缁矂鎮ラ悡搴殨? ${rebuiltRegexScripts.length}`);
  console.log(`闂傚倸鍊搁崐鎼佸磹閹间礁纾归柣鎴ｅГ閸ゅ嫰鏌ょ粙璺ㄤ粵婵炲懐濮垫穱濠囧Χ閸涱厽娈查梺鍝勬缁捇寮婚妸鈺傚亜闁告繂瀚呴悙鐑樼厓鐟滄粓宕滃▎鎾崇疇婵せ鍋撻柕鍡曠窔瀵挳濮€閳╁啯鐝栭梻渚€鈧偛鑻晶鎵磼椤旇偐澧涚€垫澘瀚伴獮鍥敇閻樻彃绗氶梻鍌欑閹诧紕鎹㈤崒婧惧亾濮樼厧澧撮柛鈹惧亾濡炪倖甯婇悞锕傚磹閹邦喗宕夋い鏍ㄥ搸閳ь剚甯掗～婵嬫晲閸涱剙顥氶梻鍌欑閹碱偆鎮锕€纾规俊銈呮噹閻掑灚銇勯幒宥堝厡闁愁垱娲橀妵鍕敇閻愭潙鏋犻梺闈涙閸婂灝鐣烽敐鍡楃窞鐎光偓閳ь剟鎯侀崼銉︹拺闂侇偆鍋涢懟顖涙櫠椤栫偞鍊甸梻鍫熺◤閸嬨垻鈧鍠栭悥濂哥嵁鐎ｎ喗鍊风痪鐗埫禍? ${rebuiltTavernHelperScripts.length}`);
  console.log(`闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ磵閳ь剨绠撳畷濂稿Ψ閿旇姤鐝栭梻渚€娼чˇ顐﹀疾濠婂牆纾婚柨鐔哄У閻撳啴鏌涘┑鍡楊仾闁革絽缍婇弻锝夊箳閹寸姳绮甸梺闈涙搐鐎氫即鐛幒妤€骞㈡俊鐐村劤椤ユ艾鈹戦敍鍕杭闁稿ě鍛亾闂堟稓鐒哥€规洖缍婂畷姗€宕ｉ崒锔剧М妤犵偛娲鍓佹崉椤垵鎮堥梻鍌欑劍鐎笛兠哄澶婄；闁瑰墽绮悡娆撴煟閻旂顥嬮柛鈺嬬秮閺岋紕浠﹂悢閿嬵棤闁汇倐鍋撴繝娈垮枟閿氶柛姘儑缁辩偤宕煎┑鎰瘜闂侀潧鐗嗛幊鎰不閻愮儤鐓曞┑鐘插暟缁犵偟鈧? ${alternateGreetings.length}`);
  console.log('Done. Review the output JSON before importing it.');
}

main();
