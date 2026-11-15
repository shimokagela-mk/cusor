const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function sanitizeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeTemplate(sourceRelative, targetPath, cardName) {
  const sourcePath = path.join(ROOT, sourceRelative);
  const content = fs.readFileSync(sourcePath, 'utf-8').replace(/{{CARD_NAME}}/g, cardName);
  fs.writeFileSync(targetPath, content, 'utf-8');
}

function main() {
  const cardName = process.argv.slice(2).join(' ').trim();
  if (!cardName) {
    console.error('用法: node tools/new-project.js <卡名>');
    process.exit(1);
  }

  const safeName = sanitizeName(cardName);
  const projectRoot = path.join(ROOT, 'projects', safeName);

  ensureDir(projectRoot);
  ensureDir(path.join(projectRoot, 'notes'));
  ensureDir(path.join(projectRoot, 'entries'));
  ensureDir(path.join(projectRoot, 'tables'));
  ensureDir(path.join(projectRoot, 'frontend'));
  ensureDir(path.join(projectRoot, 'assets'));
  ensureDir(path.join(projectRoot, 'release'));

  writeTemplate('templates/card-project/README.template.md', path.join(projectRoot, 'README.md'), cardName);
  writeTemplate('templates/card-project/current-plan.template.md', path.join(projectRoot, 'current-plan.md'), cardName);
  writeTemplate('templates/card-project/build-config.template.json', path.join(projectRoot, 'build-config.json'), cardName);
  writeTemplate('templates/card-project/worldbook-entry.template.yaml', path.join(projectRoot, 'entries', '001-条目.yaml'), cardName);
  writeTemplate('templates/card-json/minimal-character-card.template.json', path.join(projectRoot, 'card.json'), cardName);

  console.log(`已创建项目: ${path.relative(ROOT, projectRoot)}`);
}

main();
