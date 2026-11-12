const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function note(message) {
  console.log(`• ${message}`);
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  JSON.parse(content);
}

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.kilo', '__MACOSX'].includes(entry.name)) continue;
      walk(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function validateRequiredDirs() {
  const dirs = ['prompts', 'docs', 'data', 'schemas', 'templates', 'examples', 'projects', 'tools', 'tests', 'output'];
  for (const dir of dirs) {
    if (exists(dir)) pass(`目录存在: ${dir}`);
    else fail(`缺少目录: ${dir}`);
  }
}

function validateRootClean() {
  const allowedRootJson = new Set(['package.json', 'package-lock.json']);
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true }).filter((entry) => entry.isFile());
  for (const file of rootFiles) {
    if (file.name.endsWith('.json') && !allowedRootJson.has(file.name)) {
      fail(`根目录不应放业务 JSON: ${file.name}`);
    }
  }
  pass('根目录 JSON 边界检查完成');
}

function shouldSkipJson(filePath) {
  const parts = path.relative(ROOT, filePath).split(path.sep);
  return parts.includes('node_modules')
    || parts.includes('__MACOSX')
    || filePath.includes(`${path.sep}.kilo${path.sep}`);
}

function validateJsonFiles() {
  let count = 0;
  walk(ROOT, (filePath) => {
    if (!filePath.endsWith('.json')) return;
    if (shouldSkipJson(filePath)) return;
    try {
      readJson(filePath);
      count += 1;
    } catch (error) {
      fail(`JSON 解析失败: ${path.relative(ROOT, filePath)} - ${error.message}`);
    }
  });
  pass(`JSON 可解析文件数: ${count}`);
}

function validateProjects() {
  const projectsDir = path.join(ROOT, 'projects');
  if (!fs.existsSync(projectsDir)) return;
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectRoot = path.join(projectsDir, entry.name);
    const hasPlan = fs.existsSync(path.join(projectRoot, 'current-plan.md'))
      || fs.existsSync(path.join(projectRoot, 'current-plan.yaml'));
    const hasSourceDirs = ['entries', 'tables', 'frontend'].some((child) => fs.existsSync(path.join(projectRoot, child)));
    const unpackedOnly = fs.existsSync(path.join(projectRoot, 'unpacked')) && !hasPlan && !hasSourceDirs;

    if (fs.existsSync(path.join(projectRoot, 'latest'))) {
      fail(`项目 ${entry.name} 不应包含非标准工作目录: latest`);
    }
    if (fs.existsSync(path.join(projectRoot, 'archive'))) {
      fail(`项目 ${entry.name} 不应包含非标准工作目录: archive`);
    }

    if (unpackedOnly) {
      note(`项目 ${entry.name} 是 unpacked-only 工作区，跳过完整卡结构检查`);
      continue;
    }

    if (!hasPlan) fail(`项目 ${entry.name} 缺少 current-plan.md 或 current-plan.yaml`);

    for (const child of ['entries', 'tables', 'frontend']) {
      const target = path.join(projectRoot, child);
      if (!fs.existsSync(target)) fail(`项目 ${entry.name} 缺少 ${child}`);
    }

    for (const child of ['README.md', 'notes', 'build-config.json', 'assets', 'release']) {
      const target = path.join(projectRoot, child);
      if (!fs.existsSync(target)) note(`项目 ${entry.name} 未提供可选项目资产: ${child}`);
    }
  }
  pass('projects 项目结构检查完成');
}

function validateToolReferences() {
  const checks = [
    {
      file: path.join(ROOT, 'tools', 'build-card.js'),
      required: ["path.join(path.dirname(planPath), 'release')"]
    },
    {
      file: path.join(ROOT, 'tools', 'unpack-card.js'),
      required: ["'projects', baseName, 'unpacked'"]
    },
    {
      file: path.join(ROOT, 'tools', 'repack-card.js'),
      required: ["'output', 'latest'", "'release'"]
    }
  ];

  for (const check of checks) {
    const content = fs.readFileSync(check.file, 'utf-8');
    for (const text of check.required) {
      if (!content.includes(text)) {
        fail(`工具脚本缺少路径约定: ${path.relative(ROOT, check.file)} -> ${text}`);
      }
    }
  }

  pass('tools 路径约定检查完成');
}

function validatePackageScripts() {
  const packagePath = path.join(ROOT, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8').replace(/^\uFEFF/, ''));
  for (const scriptName of ['verify-release', 'verify-workflow-clean']) {
    if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
      fail(`package.json 缺少脚本: ${scriptName}`);
    }
  }
  pass('package.json release 校验脚本检查完成');
}

function validateWorkflowClean() {
  const result = spawnSync('node', ['tools/verify-workflow-clean.js'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    fail('工作流洁净扫描未通过');
  } else {
    pass('工作流洁净扫描通过');
  }
}

function validateSkillPackage() {
  const skillRoot = path.join(ROOT, '.kilo', 'skills', 'nailong-toolbox-skill');
  if (!fs.existsSync(skillRoot)) {
    pass('奶龙工具箱 skill 包未安装，跳过检查');
    return;
  }

  for (const child of ['README.md', 'registry.json']) {
    const target = path.join(skillRoot, child);
    if (!fs.existsSync(target)) fail(`奶龙工具箱 skill 包缺少 ${child}`);
  }

  const requiredSkills = [
    'tavern-runtime-router',
    'tavern-api-lookup',
    'tavern-mvu-zod',
    'tavern-format-examples',
    'tavern-docs-helper',
    'tavern-asset-validator'
  ];

  for (const skill of requiredSkills) {
    const skillMd = path.join(skillRoot, skill, 'SKILL.md');
    if (!fs.existsSync(skillMd)) fail(`奶龙工具箱 skill 缺少入口: ${skill}/SKILL.md`);
  }

  readJson(path.join(skillRoot, 'registry.json'));
  pass('奶龙工具箱 skill 包结构检查完成');
}

function validatePromptReferences() {
  const forbidden = [
    'output/范例项目-轮回禁则',
    'output/current-plan.md',
    'output/current-plan.yaml',
    'docs/图片与前端知识库/docs/图片与前端知识库',
    'projects/<卡名>/latest'
  ];

  for (const dirName of ['prompts', 'docs', '.kilo']) {
    const baseDir = path.join(ROOT, dirName);
    walk(baseDir, (filePath) => {
      if (!/\.(md|json|js|yaml)$/.test(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const text of forbidden) {
        if (content.includes(text)) {
          fail(`文档或索引包含非标准路径: ${path.relative(ROOT, filePath)} -> ${text}`);
        }
      }
    });
  }

  pass('路径引用检查完成');
}

function validateResidueFiles() {
  const residueNames = new Set(['.DS_Store']);
  const residueSuffixes = ['.bak', '.backup', '.tmp', '.old'];
  walk(ROOT, (filePath) => {
    const name = path.basename(filePath);
    if (residueNames.has(name) || residueSuffixes.some((suffix) => name.endsWith(suffix))) {
      fail(`发现残留文件: ${path.relative(ROOT, filePath)}`);
    }
  });
  pass('残留文件检查完成');
}

function main() {
  validatePackageScripts();
  validateWorkflowClean();
  validateRequiredDirs();
  validateRootClean();
  validateJsonFiles();
  validateProjects();
  validateToolReferences();
  validateSkillPackage();
  validatePromptReferences();
  validateResidueFiles();

  if (process.exitCode) {
    console.error('\n校验未通过');
    process.exit(process.exitCode);
  }

  console.log('\n全部校验通过');
}

main();
