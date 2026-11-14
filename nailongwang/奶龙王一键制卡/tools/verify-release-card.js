const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  console.log('Usage: node tools/verify-release-card.js --project <name> --json <card.json> [--exact-regex <a,b>] [--compare-json <card.json>]');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function resolveProjectDir(projectArg) {
  if (!projectArg) return null;
  const direct = path.resolve(ROOT, projectArg);
  if (fileExists(direct) && fs.statSync(direct).isDirectory()) return direct;
  const byName = path.join(ROOT, 'projects', projectArg);
  if (fileExists(byName) && fs.statSync(byName).isDirectory()) return byName;
  return byName;
}

function getDataRoot(card) {
  return card && card.data && typeof card.data === 'object' ? card.data : card;
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = normalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalize(value));
}

function decodeBase64Json(encoded, label) {
  if (!encoded || /\{\{.*\}\}/.test(encoded)) {
    throw new Error(`${label} base64 payload is empty or still a placeholder`);
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`${label} base64 payload is not valid JSON: ${error.message}`);
  }
}

function extractConstBase64(source, names) {
  for (const name of names) {
    const pattern = new RegExp(`const\\s+${name}\\s*=\\s*"([^"]*)"`);
    const match = pattern.exec(source);
    if (match) return { name, value: match[1] };
  }
  return null;
}

function countEntryYamlFiles(projectDir) {
  const entriesDir = path.join(projectDir, 'entries');
  if (!fileExists(entriesDir)) return null;
  return fs.readdirSync(entriesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .length;
}

function loadPlotRegexConfig(projectDir) {
  const configPath = path.join(projectDir, 'frontend', '推进正则配置.json');
  if (!fileExists(configPath)) return null;
  const config = readJson(configPath);
  return {
    configPath,
    scriptNames: [config?.beautify?.scriptName, config?.cleanup?.scriptName].filter(Boolean)
  };
}

function findPlotPresetPath(projectDir) {
  const frontendDir = path.join(projectDir, 'frontend');
  for (const name of ['剧情推进.json', 'plot-preset.json', 'preset.json']) {
    const candidate = path.join(frontendDir, name);
    if (fileExists(candidate)) return candidate;
  }
  return null;
}

function getRegexScripts(dataRoot) {
  return dataRoot?.extensions?.regex_scripts;
}

function findRegexScript(dataRoot, scriptName) {
  const scripts = getRegexScripts(dataRoot);
  return Array.isArray(scripts) ? scripts.find((script) => script?.scriptName === scriptName) : null;
}

function getEntryKeys(entry) {
  const raw = [];
  if (!entry) return raw;
  if (Array.isArray(entry.keys)) raw.push(...entry.keys);
  if (Array.isArray(entry.key)) raw.push(...entry.key);
  else if (typeof entry.key === 'string') raw.push(entry.key);
  if (entry.comment) raw.push(entry.comment);
  return raw.map((value) => String(value || '').trim()).filter(Boolean);
}

function findWorldbookEntryContent(entries, key) {
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    if (getEntryKeys(entry).includes(key) && entry.content) {
      return String(entry.content).trim();
    }
  }
  return null;
}

function welcomeUsesWorldbookKey(replaceString, key) {
  return typeof replaceString === 'string' && replaceString.includes(key);
}

function verifyPayloadAgainstExpected({
  fail,
  pass,
  label,
  expected,
  embeddedNames,
  replaceString,
  worldbookKey,
  entries
}) {
  const embedded = extractConstBase64(replaceString, embeddedNames);
  if (embedded && embedded.value && !/\{\{.*\}\}/.test(embedded.value)) {
    try {
      const decoded = decodeBase64Json(embedded.value, label);
      if (stableStringify(decoded) !== stableStringify(expected)) {
        fail(`embedded ${label} does not match source asset`);
      } else {
        pass(`embedded ${label} matches source asset`);
      }
    } catch (error) {
      fail(error.message);
    }
    return;
  }

  if (welcomeUsesWorldbookKey(replaceString, worldbookKey)) {
    const content = findWorldbookEntryContent(entries, worldbookKey);
    if (!content) {
      fail(`${label} uses worldbook key ${worldbookKey} but entry content is missing`);
      return;
    }
    try {
      const decoded = decodeBase64Json(content, label);
      if (stableStringify(decoded) !== stableStringify(expected)) {
        fail(`worldbook ${label} (${worldbookKey}) does not match source asset`);
      } else {
        pass(`worldbook ${label} (${worldbookKey}) matches source asset`);
      }
    } catch (error) {
      fail(error.message);
    }
    return;
  }

  fail(`欢迎页面 regex does not expose embedded ${label} base64 or worldbook key ${worldbookKey}`);
}

function verifyReleaseCard(options) {
  const findings = [];
  const passes = [];
  const jsonPath = path.resolve(ROOT, options.json || '');
  const projectDir = options.project ? resolveProjectDir(options.project) : null;

  function fail(message) {
    findings.push(message);
  }

  function pass(message) {
    passes.push(message);
  }

  if (!options.json) {
    fail('missing --json');
    return { ok: false, findings, passes };
  }
  if (!fileExists(jsonPath)) {
    fail(`card JSON does not exist: ${jsonPath}`);
    return { ok: false, findings, passes };
  }

  let card;
  try {
    card = readJson(jsonPath);
  } catch (error) {
    fail(`card JSON is not parseable: ${error.message}`);
    return { ok: false, findings, passes };
  }

  const dataRoot = getDataRoot(card);

  if (card?.spec !== 'chara_card_v3') fail('top-level spec must be chara_card_v3');
  else pass('spec is chara_card_v3');

  const entries = dataRoot?.character_book?.entries;
  if (!Array.isArray(entries)) fail('data.character_book.entries must be an array');
  else pass(`worldbook entries: ${entries.length}`);

  const regexScripts = getRegexScripts(dataRoot);
  if (!Array.isArray(regexScripts)) fail('data.extensions.regex_scripts must be an array');
  else pass(`regex scripts: ${regexScripts.length}`);

  const tavernHelper = dataRoot?.extensions?.tavern_helper;
  if (!tavernHelper || typeof tavernHelper !== 'object') {
    fail('data.extensions.tavern_helper must be an object');
  } else if (!Array.isArray(tavernHelper.scripts)) {
    fail('data.extensions.tavern_helper.scripts must be an array');
  } else {
    pass(`tavern helper scripts: ${tavernHelper.scripts.length}`);
  }

  if (options['exact-regex']) {
    const expected = String(options['exact-regex']).split(/[,，]/).map((name) => name.trim()).filter(Boolean).sort();
    const actual = (Array.isArray(regexScripts) ? regexScripts : []).map((script) => script?.scriptName || '').sort();
    if (stableStringify(actual) !== stableStringify(expected)) {
      fail(`regex script names mismatch. expected ${expected.join(', ')}; actual ${actual.join(', ')}`);
    } else {
      pass(`exact regex set matched: ${expected.join(', ')}`);
    }
  }

  if (projectDir && fileExists(projectDir)) {
    const entryCount = countEntryYamlFiles(projectDir);
    if (entryCount !== null && Array.isArray(entries)) {
      if (entries.length !== entryCount) fail(`worldbook entry count mismatch: card=${entries.length}, entries/*.yaml=${entryCount}`);
      else pass(`worldbook entry count matches entries/*.yaml: ${entryCount}`);
    }

    const worldbookBuildPath = path.join(projectDir, 'entries', '_build', 'worldbook.json');
    if (fileExists(worldbookBuildPath) && Array.isArray(entries)) {
      const builtWorldbook = readJson(worldbookBuildPath);
      if (stableStringify(builtWorldbook?.entries || []) !== stableStringify(entries)) {
        fail('entries/_build/worldbook.json does not match card worldbook entries');
      } else {
        pass('entries/_build/worldbook.json matches card worldbook entries');
      }
    }

    const tableBuildPath = path.join(projectDir, 'tables', '_build', 'table-template.json');
    const welcomeScript = findRegexScript(dataRoot, '欢迎页面');
    if (fileExists(tableBuildPath)) {
      if (!welcomeScript) {
        fail('table template exists but regex script 欢迎页面 is missing');
      } else {
        const replaceString = String(welcomeScript.replaceString || '');
        if (/const\s+\w*BASE64\s*=\s*"\{\{(?:TEMPLATE_BASE64|PRESET_BASE64|MODULE_TEMPLATE_BASE64|PLAY_TEMPLATE_BASE64)\}\}";/.test(replaceString)) {
          fail('欢迎页面 regex still contains unresolved base64 const placeholders');
        }
        verifyPayloadAgainstExpected({
          fail,
          pass,
          label: 'table template',
          expected: readJson(tableBuildPath),
          embeddedNames: ['EMBEDDED_TEMPLATE_BASE64', 'TEMPLATE_BASE64'],
          replaceString,
          worldbookKey: '__ACU_TEMPLATE_DATA__',
          entries
        });
      }
    }

    const presetPath = findPlotPresetPath(projectDir);
    if (presetPath) {
      if (!welcomeScript) {
        fail('plot preset exists but regex script 欢迎页面 is missing');
      } else {
        const replaceString = String(welcomeScript.replaceString || '');
        verifyPayloadAgainstExpected({
          fail,
          pass,
          label: 'plot preset',
          expected: readJson(presetPath),
          embeddedNames: ['EMBEDDED_PRESET_BASE64', 'PRESET_BASE64'],
          replaceString,
          worldbookKey: '__ACU_PRESET_DATA__',
          entries
        });
      }

      const plotConfig = loadPlotRegexConfig(projectDir);
      if (!plotConfig) {
        fail('plot preset exists but frontend/推进正则配置.json is missing');
      } else {
        for (const scriptName of plotConfig.scriptNames) {
          if (!findRegexScript(dataRoot, scriptName)) fail(`plot regex script missing: ${scriptName}`);
          else pass(`plot regex script exists: ${scriptName}`);
        }
      }
    }
  }

  if (options['compare-json']) {
    const comparePath = path.resolve(ROOT, options['compare-json']);
    if (!fileExists(comparePath)) {
      fail(`compare JSON does not exist: ${comparePath}`);
    } else {
      const expected = readJson(comparePath);
      if (stableStringify(card) !== stableStringify(expected)) {
        fail('card JSON does not match --compare-json');
      } else {
        pass('card JSON matches --compare-json');
      }
    }
  }

  return { ok: findings.length === 0, findings, passes };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }

  const result = verifyReleaseCard(args);
  for (const message of result.passes) console.log(`[ok] ${message}`);
  for (const message of result.findings) console.error(`[fail] ${message}`);

  if (!result.ok) {
    console.error('\nrelease card verification failed');
    process.exit(1);
  }

  console.log('\nrelease card verification passed');
}

if (require.main === module) main();

module.exports = {
  verifyReleaseCard,
  stableStringify,
  decodeBase64Json
};
