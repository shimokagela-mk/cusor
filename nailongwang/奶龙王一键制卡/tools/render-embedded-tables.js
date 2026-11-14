const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`读取或解析 JSON 失败: ${filePath}\n${error.message}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function summarizeNote(note) {
  return String(note || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractSection(markdown, heading) {
  const lines = String(markdown || '').split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) {
    return [];
  }

  const sectionLines = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().startsWith('## ')) {
      break;
    }
    sectionLines.push(line);
  }

  while (sectionLines.length > 0 && sectionLines[0].trim() === '') {
    sectionLines.shift();
  }
  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === '') {
    sectionLines.pop();
  }

  return sectionLines;
}

function parseBulletSection(sectionLines) {
  return sectionLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function parseUpdateRules(sectionLines) {
  const rules = {};
  const fieldMap = {
    '初始化': 'initNode',
    '更新': 'updateNode',
    '插入': 'insertNode',
    '删除': 'deleteNode'
  };

  let lastKey = null;
  sectionLines
    .map((line) => line.trim())
    .forEach((line) => {
      if (line.startsWith('- ')) {
        const body = line.slice(2).trim();
        const match = body.match(/^([^:：]+)[:：]\s*(.*)$/);
        if (!match) {
          if (lastKey !== null) {
            rules[lastKey] += '\n' + line;
          }
          return;
        }
        const key = fieldMap[match[1].trim()];
        if (!key) {
          if (lastKey !== null) {
            rules[lastKey] += '\n' + line;
          }
          return;
        }
        rules[key] = match[2].trim();
        lastKey = key;
      } else if (line !== '' && lastKey !== null) {
        rules[lastKey] += '\n' + line;
      }
    });

  return rules;
}

function extractSqlCodeBlock(sectionLines) {
  const lines = Array.isArray(sectionLines) ? sectionLines : [];
  const startIndex = lines.findIndex((line) => line.trim().startsWith('```sql'));
  if (startIndex === -1) {
    return null;
  }

  const body = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '```') {
      break;
    }
    body.push(line);
  }

  return body.join('\n').trim() || null;
}

function extractJsonCodeBlock(sectionLines) {
  const lines = Array.isArray(sectionLines) ? sectionLines : [];
  const startIndex = lines.findIndex((line) => line.trim().startsWith('```json'));
  if (startIndex === -1) {
    return null;
  }

  const body = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '```') {
      break;
    }
    body.push(line);
  }

  const jsonText = body.join('\n').trim();
  if (!jsonText) {
    return null;
  }

  return JSON.parse(jsonText);
}

function syncGlobalConfigFromIndex(data, readableDir) {
  const indexPath = path.join(readableDir, '00-目录.md');
  if (!fs.existsSync(indexPath)) {
    return false;
  }

  const markdown = readText(indexPath);
  const globalConfig = extractJsonCodeBlock(extractSection(markdown, '全局注入配置'));
  if (!globalConfig) {
    return false;
  }

  if (!data.mate || typeof data.mate !== 'object') {
    data.mate = {};
  }

  if (JSON.stringify(data.mate.globalInjectionConfig || {}) !== JSON.stringify(globalConfig)) {
    data.mate.globalInjectionConfig = globalConfig;
    return true;
  }

  return false;
}

function renderMarkdownTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return ['（空表）'];
  }

  const normalized = rows.map((row) => (Array.isArray(row) ? row.slice(1) : []));
  const header = normalized[0] || [];
  const body = normalized.slice(1);

  const lines = [];
  lines.push(`| ${header.map(escapeCell).join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);

  for (const row of body) {
    const padded = header.map((_, index) => escapeCell(row[index]));
    lines.push(`| ${padded.join(' | ')} |`);
  }

  return lines;
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '未命名';
}

function parseMarkdownTable(markdown) {
  const lines = String(markdown || '').split('\n');
  const tableLines = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));

  if (tableLines.length < 2) {
    return null;
  }

  const rows = tableLines
    .filter((line, index) => {
      if (index === 1) return false;
      return true;
    })
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim().replace(/<br>/g, '\n').replace(/\\\|/g, '|')));

  return rows;
}

function coerceCellValue(value) {
  const trimmed = String(value || '').trim();
  if (trimmed === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function parseHeaderMeta(markdown) {
  const lines = String(markdown || '').split('\n');
  const meta = {
    name: '',
    uid: '',
    orderNo: 0
  };

  const titleLine = lines.find((line) => line.trim().startsWith('# '));
  if (titleLine) {
    meta.name = titleLine.trim().slice(2).trim();
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const uidMatch = line.match(/^- uid: `(.+)`$/);
    if (uidMatch) {
      meta.uid = uidMatch[1].trim();
    }
    const orderMatch = line.match(/^- orderNo: (.+)$/);
    if (orderMatch) {
      const num = Number(orderMatch[1].trim());
      meta.orderNo = Number.isNaN(num) ? 0 : num;
    }
  }

  return meta;
}

function createDefaultMate(globalInjectionConfig = null) {
  return {
    type: 'chatSheets',
    version: 1,
    updateConfigUiSentinel: -1,
    globalInjectionConfig: globalInjectionConfig || {
      readableEntryPlacement: {
        position: 'before_char',
        depth: 2,
        order: 99981
      },
      wrapperPlacement: {
        position: 'before_char',
        depth: 2,
        order: 99980
      }
    }
  };
}

function buildEmbeddedTablesFromReadable(readableDirOrIndexPath, outputJsonPath) {
  const resolvedInput = path.resolve(readableDirOrIndexPath);
  const readableDir = resolvedInput.endsWith('.md')
    ? path.dirname(resolvedInput)
    : resolvedInput;
  const indexPath = path.join(readableDir, '00-目录.md');

  if (!fs.existsSync(indexPath)) {
    throw new Error(`缺少目录文件: ${indexPath}`);
  }

  const indexMarkdown = readText(indexPath);
  const globalInjectionConfig = extractJsonCodeBlock(extractSection(indexMarkdown, '全局注入配置')) || createDefaultMate().globalInjectionConfig;

  const files = fs.readdirSync(readableDir)
    .filter((file) => file.endsWith('.md') && file !== '00-目录.md')
    .sort();

  const data = {
    mate: createDefaultMate(globalInjectionConfig)
  };

  for (const file of files) {
    const filePath = path.join(readableDir, file);
    const markdown = readText(filePath);
    const meta = parseHeaderMeta(markdown);
    if (!meta.uid || !meta.name) {
      throw new Error(`分表文件缺少 uid 或标题: ${filePath}`);
    }

    const noteLines = parseBulletSection(extractSection(markdown, '说明'));
    const updateRules = parseUpdateRules(extractSection(markdown, '更新规则'));
    const ddlText = extractSqlCodeBlock(extractSection(markdown, 'DDL'));
    const updateConfig = extractJsonCodeBlock(extractSection(markdown, '更新配置')) || {
      uiSentinel: -1,
      contextDepth: 2,
      updateFrequency: 1,
      batchSize: 1,
      skipFloors: -1
    };
    const exportConfig = extractJsonCodeBlock(extractSection(markdown, '导出配置')) || {
      enabled: false,
      splitByRow: false
    };
    const parsedRows = parseMarkdownTable(markdown) || [];
    const content = parsedRows.map((row, idx) => [idx === 0 ? '行号' : idx, ...row.map(coerceCellValue)]);

    const sourceData = {
      note: noteLines.join('\n'),
      initNode: updateRules.initNode || '',
      deleteNode: updateRules.deleteNode || '',
      updateNode: updateRules.updateNode || '',
      insertNode: updateRules.insertNode || ''
    };

    if (ddlText) {
      sourceData.ddl = ddlText;
    }

    data[meta.uid] = {
      uid: meta.uid,
      name: meta.name,
      sourceData,
      content,
      updateConfig,
      exportConfig,
      orderNo: meta.orderNo
    };
  }

  const outputPath = path.resolve(outputJsonPath);
  writeText(outputPath, JSON.stringify(data, null, 2));
  return {
    outputPath,
    readableDir: path.join(path.dirname(outputPath), 'readable'),
    count: Object.keys(data).filter(k => k.startsWith('sheet_')).length
  };
}

function sheetSortComparator(data) {
  return (a, b) => {
    const lo = Number(data[a].orderNo) || 0;
    const ro = Number(data[b].orderNo) || 0;
    return lo - ro;
  };
}

function renderReadableTablesFromData(data, outputPath, sourceLabel = 'memory') {
  const combinedPath = path.resolve(outputPath);
  const readableDir = path.join(path.dirname(combinedPath), 'readable');

  const sheetKeys = Object.keys(data)
    .filter((key) => key.startsWith('sheet_'))
    .sort(sheetSortComparator(data));

  const sheetItems = sheetKeys.map((key, index) => {
    const sheet = data[key];
    const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeFileName(sheet.name)}.md`;
    return {
      key,
      name: sheet.name,
      fileName,
      content: buildSheetMarkdown(sheet)
    };
  });

  ensureDir(readableDir);
  
  const existingFiles = fs.readdirSync(readableDir).filter(f => f.endsWith('.md'));
  for (const oldFile of existingFiles) {
    fs.unlinkSync(path.join(readableDir, oldFile));
  }
  
  for (const item of sheetItems) {
    writeText(path.join(readableDir, item.fileName), item.content);
  }

  writeText(path.join(readableDir, '00-目录.md'), buildIndexMarkdown(data, sourceLabel, sheetItems));
  writeText(combinedPath, buildCombinedMarkdown(sourceLabel, sheetItems));

  return {
    combinedPath,
    readableDir,
    count: sheetItems.length
  };
}

function syncReadableTablesToJson(jsonPath, combinedPath = null) {
  const resolvedJsonPath = path.resolve(jsonPath);
  const data = readJson(resolvedJsonPath);
  const outputPath = combinedPath
    ? path.resolve(combinedPath)
    : path.join(path.dirname(resolvedJsonPath), 'embedded-template.readable.md');
  const readableDir = path.join(path.dirname(outputPath), 'readable');

  if (!fs.existsSync(readableDir)) {
    return { updated: false, reason: 'readable directory not found' };
  }

  const sheetKeys = Object.keys(data)
    .filter((key) => key.startsWith('sheet_'))
    .sort(sheetSortComparator(data));

  let changed = false;

  if (syncGlobalConfigFromIndex(data, readableDir)) {
    changed = true;
  }

  sheetKeys.forEach((key, index) => {
    const sheet = data[key];
    const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeFileName(sheet.name)}.md`;
    const filePath = path.join(readableDir, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const markdown = readText(filePath);
    const noteLines = parseBulletSection(extractSection(markdown, '说明'));
    const updateRules = parseUpdateRules(extractSection(markdown, '更新规则'));
    const ddlText = extractSqlCodeBlock(extractSection(markdown, 'DDL'));
    const updateConfig = extractJsonCodeBlock(extractSection(markdown, '更新配置'));
    const exportConfig = extractJsonCodeBlock(extractSection(markdown, '导出配置'));
    const parsedRows = parseMarkdownTable(markdown);

    if (!sheet.sourceData || typeof sheet.sourceData !== 'object') {
      sheet.sourceData = {};
    }

    const nextNote = noteLines.join('\n');
    if (nextNote && String(sheet.sourceData.note || '') !== nextNote) {
      sheet.sourceData.note = nextNote;
      changed = true;
    }

    for (const [field, value] of Object.entries(updateRules)) {
      if (String(sheet.sourceData[field] || '') !== value) {
        sheet.sourceData[field] = value;
        changed = true;
      }
    }

    if (ddlText !== null && String(sheet.sourceData.ddl || '') !== ddlText) {
      sheet.sourceData.ddl = ddlText;
      changed = true;
    }

    if (updateConfig && JSON.stringify(sheet.updateConfig || {}) !== JSON.stringify(updateConfig)) {
      sheet.updateConfig = updateConfig;
      changed = true;
    }

    if (exportConfig && JSON.stringify(sheet.exportConfig || {}) !== JSON.stringify(exportConfig)) {
      sheet.exportConfig = exportConfig;
      changed = true;
    }

    if (!parsedRows || parsedRows.length === 0) {
      return;
    }

    const rebuiltRows = parsedRows.map((row, idx) => [idx === 0 ? '行号' : idx, ...row.map(coerceCellValue)]);
    const currentRows = JSON.stringify(sheet.content || []);
    const nextRows = JSON.stringify(rebuiltRows);
    if (currentRows !== nextRows) {
      sheet.content = rebuiltRows;
      changed = true;
    }
  });

  if (changed) {
    writeText(resolvedJsonPath, JSON.stringify(data, null, 2));
  }

  const rendered = renderReadableTables(resolvedJsonPath, outputPath);
  return {
    updated: changed,
    combinedPath: rendered.combinedPath,
    readableDir: rendered.readableDir,
    count: rendered.count
  };
}

function buildSheetMarkdown(sheet) {
  const lines = [];
  lines.push(`# ${sheet.name}`);
  lines.push('');
  lines.push(`- uid: \`${sheet.uid}\``);
  if (typeof sheet.orderNo !== 'undefined') {
    lines.push(`- orderNo: ${sheet.orderNo}`);
  }
  lines.push('');

  lines.push('## 可编辑说明');
  lines.push('');
  lines.push('- 可以直接修改 `## 说明`，会回写到 `sourceData.note`。');
  lines.push('- 可以直接修改 `## 更新规则`，但必须保持以下四行格式：`- 初始化: ...`、`- 更新: ...`、`- 插入: ...`、`- 删除: ...`。');
  lines.push('- 可以直接修改 `## DDL` 中的 SQL，会回写到 `sourceData.ddl`（仅 SQLite 模式需要）。');
  lines.push('- 可以直接修改 `## 当前内容` 下的 Markdown 表格，会回写到 `content`。');
  lines.push('- 可以直接修改 `## 更新配置` 中的 JSON，会回写到 `updateConfig`，适合调整上下文深度、批次、更新频率等运行参数。');
  lines.push('- 可以直接修改 `## 导出配置` 中的 JSON，会回写到 `exportConfig`，适合调整分组参数、导出参数与注入位置。');
  lines.push('- 不要修改 `# 表名`、`uid`、`orderNo`。这些字段当前仅用于展示，不参与回写。');
  lines.push('- 修改完成后，运行回包流程即可自动同步到 `embedded-template.pretty.json`。');
  lines.push('');

  const noteLines = summarizeNote(sheet.sourceData && sheet.sourceData.note);
  if (noteLines.length > 0) {
    lines.push('## 说明');
    lines.push('');
    for (const note of noteLines) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  if (sheet.sourceData) {
    lines.push('## 更新规则');
    lines.push('');
    const ruleLabels = [
      ['初始化', 'initNode'],
      ['更新', 'updateNode'],
      ['插入', 'insertNode'],
      ['删除', 'deleteNode']
    ];
    for (const [label, key] of ruleLabels) {
      const value = sheet.sourceData[key] || '无';
      const valueLines = value.split('\n');
      lines.push(`- ${label}: ${valueLines[0]}`);
      for (let i = 1; i < valueLines.length; i++) {
        lines.push(`  ${valueLines[i]}`);
      }
    }
    lines.push('');
  }

  if (sheet.sourceData && sheet.sourceData.ddl) {
    lines.push('## DDL');
    lines.push('');
    lines.push('```sql');
    lines.push(sheet.sourceData.ddl);
    lines.push('```');
    lines.push('');
  }

  lines.push('## 当前内容');
  lines.push('');
  lines.push(...renderMarkdownTable(sheet.content));
  lines.push('');

  if (sheet.updateConfig) {
    lines.push('## 更新配置');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(sheet.updateConfig, null, 2));
    lines.push('```');
    lines.push('');
  }

  if (sheet.exportConfig) {
    lines.push('## 导出配置');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(sheet.exportConfig, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function buildIndexMarkdown(data, sourcePath, sheetItems) {
  const lines = [];
  lines.push('# Embedded Tables 可读目录');
  lines.push('');
  lines.push(`- 来源文件: \`${sourcePath}\``);
  lines.push(`- 生成时间: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('这是项目级通用的表格可读视图入口。每张表会拆成独立 Markdown，方便直接阅读。');
  lines.push('');
  lines.push('## 使用说明');
  lines.push('');
  lines.push('- `readable/*.md` 不是纯预览文件，而是可编辑工作文件。');
  lines.push('- 允许修改的部分：`## 说明`、`## 更新规则`、`## 当前内容`、`## 更新配置`、`## 导出配置`。');
  lines.push('- `## 更新规则` 必须保持四条固定键名：`初始化 / 更新 / 插入 / 删除`。');
  lines.push('- `## 更新配置` 必须保持合法 JSON 代码块格式。');
  lines.push('- `## 导出配置` 必须保持合法 JSON 代码块格式。');
  lines.push('- 暂不允许修改的部分：表名、uid、orderNo。');
  lines.push('- `00-目录.md` 中的 `## 全局注入配置` 也可编辑，会回写到 `mate.globalInjectionConfig`。');
  lines.push('- 回包时会自动执行：`readable/*.md + 00-目录.md -> embedded-template.pretty.json -> 注入角色卡`。');
  lines.push('');
  lines.push('## 表单目录');
  lines.push('');
  for (const item of sheetItems) {
    lines.push(`- [${item.name}](./${item.fileName})`);
  }
  lines.push('');
  if (data.mate) {
    lines.push('## 全局注入配置');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(data.mate.globalInjectionConfig || {}, null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function buildCombinedMarkdown(sourcePath, sheetItems) {
  const lines = [];
  lines.push('# Embedded Tables 可读总览');
  lines.push('');
  lines.push(`- 来源文件: \`${sourcePath}\``);
  lines.push(`- 生成时间: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('这个文件用于快速总览；分表版本位于 `readable/` 目录。');
  lines.push('');
  lines.push('## 表单目录');
  lines.push('');
  for (const item of sheetItems) {
    lines.push(`- ${item.name}`);
  }
  lines.push('');
  for (const item of sheetItems) {
    lines.push(item.content.replace(/^# /, '## '));
    lines.push('');
  }
  return lines.join('\n');
}

function renderReadableTables(inputPath, outputPath = null) {
  const resolvedInput = path.resolve(inputPath);
  const data = readJson(resolvedInput);
  const combinedPath = outputPath
    ? path.resolve(outputPath)
    : path.join(path.dirname(resolvedInput), 'embedded-template.readable.md');
  return renderReadableTablesFromData(data, combinedPath, resolvedInput);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('用法1: node tools/render-embedded-tables.js <embedded-template.pretty.json路径> [输出md路径]');
    console.log('用法2: node tools/render-embedded-tables.js --build-from-readable <readable目录> <输出json路径>');
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args[0] === '--build-from-readable') {
    if (args.length < 3) {
      console.log('用法: node tools/render-embedded-tables.js --build-from-readable <readable目录> <输出json路径>');
      process.exit(1);
    }
    const result = buildEmbeddedTablesFromReadable(args[1], args[2]);
    console.log(`已从 readable 构建 embedded tables: ${result.outputPath}`);
    console.log(`已生成分表目录: ${result.readableDir}`);
    console.log(`表格数量: ${result.count}`);
    return;
  }

  const result = renderReadableTables(args[0], args[1]);
  console.log(`已生成可读表格总览: ${result.combinedPath}`);
  console.log(`已生成分表目录: ${result.readableDir}`);
  console.log(`表格数量: ${result.count}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  renderReadableTables,
  syncReadableTablesToJson,
  buildEmbeddedTablesFromReadable,
  renderReadableTablesFromData,
  createDefaultMate
};
