/**
 * unpack-tables.js
 * 
 * 将表格模板 JSON 文件拆分为多个 YAML 文件，每张表一个文件。
 * 仿照世界书的拆分方式，方便独立编辑和管理。
 * 
 * 用法：
 *   node tools/unpack-tables.js <tables目录路径>
 *   node tools/unpack-tables.js projects/我独自升级/tables
 * 
 * 输出：
 *   tables/000-meta.yaml          ← mate 信息
 *   tables/001-纪要表.yaml        ← 第一张表（按 orderNo 排序）
 *   tables/002-重要角色表.yaml    ← 第二张表
 *   tables/...
 * 
 * 原 JSON 文件重命名为 .json.bak 备份。
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ===== 工具函数 =====

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error(`JSON 解析失败: ${filePath}`);
    throw error;
  }
}

function sanitizeFileName(name) {
  // 移除文件名中不安全的字符
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}

function formatYaml(data) {
  return yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
    sortKeys: false
  });
}

// ===== 核心逻辑 =====

function unpackTables(tablesDir) {
  if (!fs.existsSync(tablesDir)) {
    console.error(`目录不存在: ${tablesDir}`);
    process.exit(1);
  }

  const jsonFiles = fs.readdirSync(tablesDir)
    .filter(f => f.endsWith('.json') && !f.endsWith('.bak.json'));

  if (jsonFiles.length === 0) {
    console.log('tables/ 目录下没有 JSON 文件，无需解包。');
    return;
  }

  // 检查是否已有 YAML 文件（防止重复解包）
  const existingYaml = fs.readdirSync(tablesDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  if (existingYaml.length > 0) {
    console.error('⚠️ tables/ 目录下已存在 YAML 文件，可能已经解包过。');
    console.error('   如需重新解包，请先删除现有 YAML 文件。');
    console.error(`   现有文件: ${existingYaml.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n开始解包表格模板...`);
  console.log(`目录: ${tablesDir}`);
  console.log(`找到 ${jsonFiles.length} 个 JSON 文件\n`);

  for (const file of jsonFiles) {
    const filePath = path.join(tablesDir, file);
    console.log(`处理: ${file}`);

    const data = readJsonFile(filePath);

    // 导出 mate 信息
    if (data.mate) {
      const metaPath = path.join(tablesDir, '000-meta.yaml');
      const metaContent = formatYaml(data.mate);
      fs.writeFileSync(metaPath, metaContent, 'utf-8');
      console.log(`  → 000-meta.yaml`);
    }

    // 收集所有 sheet，按 orderNo 排序
    const sheets = Object.keys(data)
      .filter(k => k !== 'mate')
      .map(k => ({
        originalKey: k,
        ...data[k]
      }))
      .sort((a, b) => (a.orderNo ?? 999) - (b.orderNo ?? 999));

    if (sheets.length === 0) {
      console.log('  ⚠️ 没有找到表格数据，跳过。');
      continue;
    }

    // 逐个导出为 YAML
    sheets.forEach((sheet, index) => {
      const seq = String(index + 1).padStart(3, '0');
      const name = sanitizeFileName(sheet.name || sheet.uid || `sheet_${index}`);
      const fileName = `${seq}-${name}.yaml`;
      const outputPath = path.join(tablesDir, fileName);

      // 移除 originalKey（这是内部用的，不写入 YAML）
      const { originalKey, ...sheetData } = sheet;

      const yamlContent = formatYaml(sheetData);
      fs.writeFileSync(outputPath, yamlContent, 'utf-8');
      console.log(`  → ${fileName} (uid: ${sheetData.uid})`);
    });

    // 备份原 JSON
    const backupPath = filePath + '.bak';
    if (fs.existsSync(backupPath)) {
      // 如果备份已存在，加时间戳
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const timestampBackup = filePath.replace('.json', `.${timestamp}.json.bak`);
      fs.renameSync(filePath, timestampBackup);
      console.log(`  → 备份: ${path.basename(timestampBackup)}`);
    } else {
      fs.renameSync(filePath, backupPath);
      console.log(`  → 备份: ${file}.bak`);
    }

    console.log(`  ✓ 完成，共导出 ${sheets.length} 张表\n`);
  }

  console.log('解包完成！');
  console.log('提示: 原 JSON 已备份为 .bak 文件，确认无误后可删除。');
}

// ===== CLI 入口 =====

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('用法: node tools/unpack-tables.js <tables目录路径>');
  console.log('示例: node tools/unpack-tables.js projects/我独自升级/tables');
  process.exit(0);
}

const tablesDir = path.resolve(args[0]);
unpackTables(tablesDir);
