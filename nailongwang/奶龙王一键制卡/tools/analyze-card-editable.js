const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${filePath}\n${error.message}`);
  }
}

function readYaml(filePath) {
  const raw = readText(filePath);
  try {
    return yaml.load(raw);
  } catch (error) {
    throw new Error(`YAML 解析失败: ${filePath}\n${error.message}`);
  }
}

function normalizeToOsPath(baseDir, relativePath) {
  return path.join(baseDir, ...String(relativePath).split('/'));
}

function summarizeText(text, maxLength = 140) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '（空）';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength - 1) + '…';
}

function detectBlockTags(text) {
  const value = String(text || '');
  const tags = [];

  if (/<start>/i.test(value)) tags.push('start');
  if (/<state_bar>/i.test(value)) tags.push('state_bar');
  if (/<tableEdit>/i.test(value)) tags.push('tableEdit');
  if (/<UpdateVariable>/i.test(value)) tags.push('UpdateVariable');

  return tags;
}

function classifyEntry(entry) {
  const comment = String(entry.comment || '');
  const content = String(entry.content || '');
  const joined = `${comment}\n${content}`;

  if (/[主角|角色|人物|设定|档案|资料]/.test(joined)) {
    return '人物设定';
  }
  if (/[剧情|事件|阶段|流程|主线|支线]/.test(joined)) {
    return '剧情规则';
  }
  if (/[地点|区域|建筑|场景]/.test(joined)) {
    return '地点设定';
  }
  if (/[规则|机制|系统|数值|状态]/.test(joined)) {
    return '系统规则';
  }

  return '通用条目';
}

function buildReport(bundleDir, manifest) {
  const lines = [];
  lines.push(`# 可编辑资产说明 - ${manifest.card_name}`);
  lines.push('');
  lines.push('## 可直接修改的文件');
  lines.push('');
  lines.push('- [`greetings/first_mes.txt`](greetings/first_mes.txt)：主开场白。');
  lines.push('- [`greetings/alternate-*.txt`](greetings)：候选开场白。');
  lines.push('- [`entries/*.yaml`](entries)：世界书条目，包括人物设定、规则、地点、剧情等。');
  lines.push('- [`regex_scripts/*.json`](regex_scripts)：SillyTavern 正则脚本。');
  lines.push('- [`tavern_helper/scripts/*.json`](tavern_helper/scripts)：酒馆助手 / JS-Slash-Runner 角色脚本。');
  lines.push('- [`tavern_helper/variables.json`](tavern_helper/variables.json)：酒馆助手变量。');
  lines.push('- [`manifest.json`](manifest.json)：映射清单，请勿随意手改结构字段。');
  lines.push('');

  lines.push('## 开场白概览');
  lines.push('');

  if (manifest.mappings.first_mes) {
    const item = manifest.mappings.first_mes;
    const firstMesPath = normalizeToOsPath(bundleDir, item.path);
    const firstMes = readText(firstMesPath);
    const tags = detectBlockTags(firstMes);
    lines.push(`- 主开场白 [\`${item.path}\`](${item.path})`);
    lines.push(`  - 控制块：${tags.length ? tags.join('、') : '无'}`);
    lines.push(`  - 摘要：${summarizeText(firstMes)}`);
  }

  if ((manifest.mappings.alternate_greetings || []).length > 0) {
    lines.push('');
    lines.push('### 候选开场白');
    lines.push('');
    manifest.mappings.alternate_greetings.forEach((item, index) => {
      const filePath = normalizeToOsPath(bundleDir, item.path);
      const text = readText(filePath);
      const tags = detectBlockTags(text);
      lines.push(`- 备选 ${index + 1} [\`${item.path}\`](${item.path})`);
      lines.push(`  - 控制块：${tags.length ? tags.join('、') : '无'}`);
      lines.push(`  - 摘要：${summarizeText(text)}`);
    });
  }

  lines.push('');
  lines.push('## 世界书条目概览');
  lines.push('');

  (manifest.mappings.entries || []).forEach((item, index) => {
    const filePath = normalizeToOsPath(bundleDir, item.path);
    const entry = readYaml(filePath) || {};
    const category = classifyEntry(entry);
    const keys = Array.isArray(entry.keys) ? entry.keys.join('、') : '';
    lines.push(`### ${index + 1}. ${entry.comment || `条目-${index + 1}`}`);
    lines.push('');
    lines.push(`- 文件：[` + `${item.path}` + `](${item.path})`);
    lines.push(`- 类型：${category}`);
    lines.push(`- 关键词：${keys || '无'}`);
    lines.push(`- 启用状态：${entry.enabled === false ? '禁用' : '启用'}`);
    lines.push(`- 摘要：${summarizeText(entry.content)}`);
    lines.push('');
  });

  lines.push('## 正则脚本概览');
  lines.push('');

  (manifest.mappings.regex_scripts || []).forEach((item, index) => {
    const filePath = normalizeToOsPath(bundleDir, item.path);
    const script = readJson(filePath) || {};
    lines.push(`### ${index + 1}. ${script.scriptName || `正则脚本-${index + 1}`}`);
    lines.push('');
    lines.push(`- 文件：[` + `${item.path}` + `](${item.path})`);
    lines.push(`- 启用状态：${script.disabled === true ? '禁用' : '启用'}`);
    lines.push(`- placement：${Array.isArray(script.placement) ? script.placement.join('、') : '未设置'}`);
    lines.push(`- 匹配：${summarizeText(script.findRegex)}`);
    lines.push(`- 替换摘要：${summarizeText(script.replaceString)}`);
    lines.push('');
  });

  lines.push('## 酒馆助手脚本概览');
  lines.push('');

  (manifest.mappings.tavern_helper_scripts || []).forEach((item, index) => {
    const filePath = normalizeToOsPath(bundleDir, item.path);
    const script = readJson(filePath) || {};
    lines.push(`### ${index + 1}. ${script.name || `酒馆助手脚本-${index + 1}`}`);
    lines.push('');
    lines.push(`- 文件：[` + `${item.path}` + `](${item.path})`);
    lines.push(`- 类型：${script.type || '未设置'}`);
    lines.push(`- 启用状态：${script.enabled === false ? '禁用' : '启用'}`);
    lines.push(`- 内容摘要：${summarizeText(script.content)}`);
    lines.push('');
  });

  if (manifest.mappings.tavern_helper_variables && manifest.mappings.tavern_helper_variables.path) {
    lines.push('### 酒馆助手变量');
    lines.push('');
    lines.push(`- 文件：[` + `${manifest.mappings.tavern_helper_variables.path}` + `](${manifest.mappings.tavern_helper_variables.path})`);
    lines.push(`- 键：${(manifest.mappings.tavern_helper_variables.keys || []).join('、') || '无'}`);
    lines.push('');
  }

  lines.push('## 回包说明');
  lines.push('');
  lines.push('- 回包脚本会覆盖已拆出的 `first_mes`、`alternate_greetings`、`character_book.entries`、`extensions.regex_scripts`、`extensions.tavern_helper.scripts`、`extensions.tavern_helper.variables` 对应内容。');
  lines.push('- 未拆出的扩展字段、按钮配置与未知字段全部沿用 [`original-card.json`](original-card.json)。');
  lines.push('- 不要修改文件名和 [`manifest.json`](manifest.json) 的映射字段，否则可能导致回包失败。');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('用法: node tools/analyze-card-editable.js <解包目录>');
    console.log('示例: node tools/analyze-card-editable.js 次元欢乐岛-editable');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const bundleDir = path.resolve(process.cwd(), args[0]);
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  const report = buildReport(bundleDir, manifest);
  const reportPath = path.join(bundleDir, 'editable-summary.md');

  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(`已生成说明文件: ${reportPath}`);
}

main();
