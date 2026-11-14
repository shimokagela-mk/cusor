#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const RELEASE_DIR = path.join(PROJECT_ROOT, 'release');
const INPUT = path.join(FRONTEND_DIR, 'opening-regex.html');
const LOCAL_OUT = path.join(RELEASE_DIR, '少女前线-开场初始化.local.html');
const REGEX_OUT = path.join(RELEASE_DIR, '少女前线-开场初始化.regex.json');

function buildRegex(html) {
  return {
    id: 'gfl-opening-init-regex-0001',
    scriptName: '少女前线-开场初始化',
    findRegex: '/<start>([\\s\\S]*?)<\\/start>/gsi',
    replaceString: '```html\n' + html + '\n```',
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null
  };
}

function main() {
  if (!fs.existsSync(INPUT)) throw new Error('入口文件不存在: ' + INPUT);
  const html = fs.readFileSync(INPUT, 'utf8');
  if (!html.includes('$1')) throw new Error('opening-regex.html 缺少 $1 占位符');
  if (!html.includes('__ACU_TEMPLATE_DATA__')) throw new Error('opening-regex.html 缺少世界书模板 key');
  if (!html.includes('AutoCardUpdaterAPI')) throw new Error('opening-regex.html 缺少 shujuku API 调用');
  if (!html.includes('sendToTavern')) throw new Error('opening-regex.html 缺少发送消息逻辑');
  if (!html.includes('importTableButton')) throw new Error('opening-regex.html 缺少导入按钮');
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_OUT, html.endsWith('\n') ? html : html + '\n', 'utf8');
  fs.writeFileSync(REGEX_OUT, JSON.stringify(buildRegex(html), null, 2) + '\n', 'utf8');
  console.log('✓ Generated ' + path.relative(process.cwd(), LOCAL_OUT));
  console.log('✓ Generated ' + path.relative(process.cwd(), REGEX_OUT));
}

if (require.main === module) main();
