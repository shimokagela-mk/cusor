#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const ENTRY_FILE = path.join(FRONTEND_DIR, 'standby.html');
const OUT_FILE = path.join(PROJECT_ROOT, 'release', '少女前线-待机界面.regex.json');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

const SUBPAGES = {
  formation: { title: '编队', entry: 'formation.html' },
  map: { title: '战术地图', entry: 'map.html' },
  build: { title: '人形建造', entry: 'construction.html' },
  depot: { title: '仓库', entry: 'warehouse.html' },
  equipment: { title: '装备仓库', entry: 'equipment.html' },
  mission: { title: '任务', entry: 'mission.html' }
};

function isExternalUrl(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(String(value || '').trim());
}

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function inlineCssUrls(html, htmlFile) {
  return String(html || '').replace(/url\((['"]?)([^)'" ]+)\1\)/gi, (match, quote, raw) => {
    const value = raw.trim();
    if (!value || isExternalUrl(value)) return match;
    const clean = value.split('#')[0].split('?')[0];
    const asset = path.resolve(path.dirname(htmlFile), clean);
    if (!fs.existsSync(asset)) return match;
    const uri = dataUri(asset);
    return uri ? `url("${uri}")` : match;
  });
}

function inlineLocalScripts(html, filename) {
  const baseDir = path.dirname(filename);
  return String(html || '').replace(/<script\b([^>]*)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>\s*<\/script>/gi,
    (match, beforeAttrs, doubleQuoted, singleQuoted, bare, afterAttrs) => {
      const src = doubleQuoted || singleQuoted || bare || '';
      if (isExternalUrl(src) || /^data:/i.test(src)) return match;
      const scriptPath = path.resolve(baseDir, src);
      if (!fs.existsSync(scriptPath)) throw new Error('外部脚本不存在: ' + src);
      const code = fs.readFileSync(scriptPath, 'utf8').replace(/<\/script/gi, '<\\/script');
      return `<script${beforeAttrs || ''}${afterAttrs || ''}>\n${code}\n</script>`;
    });
}

function sanitizeSubpageHtml(html, entry) {
  let out = String(html || '');
  if (entry === 'map.html') {
    out = out.replace(/onclick="location\.href='standby\.html'"/g, 'onclick="parent.postMessage({type:\'gfl-close-subpage\'}, \'*\')"');
  } else {
    out = out.replace(/onclick="history\.back\(\)"/g, 'onclick="parent.postMessage({type:\'gfl-close-subpage\'}, \'*\')"');
  }
  return out;
}

function bundleHtmlFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  html = sanitizeSubpageHtml(html, path.basename(file));
  html = inlineCssUrls(inlineLocalScripts(html, file), file);
  if (/<script\b[^>]*\bsrc\s*=\s*(['"]?)(?!https?:|data:|blob:|\/\/)/i.test(html)) {
    throw new Error(path.basename(file) + ' 打包后仍残留本地 script src');
  }
  return html;
}

function buildSubpagePayload() {
  const payload = {};
  for (const [action, page] of Object.entries(SUBPAGES)) {
    const file = path.join(FRONTEND_DIR, page.entry);
    if (!fs.existsSync(file)) throw new Error('子页面不存在: ' + page.entry);
    payload[action] = { title: page.title, html: bundleHtmlFile(file) };
  }
  return payload;
}

function injectSubpages(html) {
  const marker = '<script src="gfl-data-bridge.js"></script>';
  const payloadJson = JSON.stringify(buildSubpagePayload()).replace(/<\//g, '<\\/');
  const payloadScript = '<script>\nwindow.GFL_STANDBY_SUBPAGES = ' + payloadJson + ';\n</script>\n';
  if (!html.includes(marker)) throw new Error('待机页缺少数据桥接脚本标记，无法注入子页面载荷');
  return html.replace(marker, payloadScript + marker);
}

function validateNoBulkyLocalAssets(html) {
  const checks = [
    { label: '本地 assets 路径', regex: /\.\.\/assets/i },
    { label: '本地待机背景文件名', regex: /standby-bg/i },
    { label: '内联 data:image 图片', regex: /data:image/i },
    { label: 'base64 资源标记', regex: /base64/i },
    { label: 'Live2D seed 脚本', regex: /l2d-indexeddb-seed/i },
    { label: 'Live2D IndexedDB 写入脚本', regex: /bubble-live2d-indexeddb/i },
    { label: 'Live2D 写入接口', regex: /writeLive2DPackage/i },
    { label: 'Live2D seed 全局变量', regex: /GFLSeed/i },
    { label: '旧 K11 本地立绘', regex: /character-k11/i }
  ];
  const hits = checks.filter((item) => item.regex.test(html));
  if (hits.length) {
    throw new Error('待机页产物包含禁止的本地/大体积资源残留: ' + hits.map((item) => item.label).join(', '));
  }
}

function buildStandbyHtml() {
  if (!fs.existsSync(ENTRY_FILE)) throw new Error('入口文件不存在: ' + ENTRY_FILE);
  const html = inlineCssUrls(inlineLocalScripts(injectSubpages(fs.readFileSync(ENTRY_FILE, 'utf8')), ENTRY_FILE), ENTRY_FILE);
  if (/<script\b[^>]*\bsrc\s*=\s*(['"]?)(?!https?:|data:|blob:|\/\/)/i.test(html)) throw new Error('待机页打包后仍残留本地 script src');
  if (!html.includes('GFL_STANDBY_SUBPAGES')) throw new Error('待机页打包后缺少子页面载荷');
  validateNoBulkyLocalAssets(html);
  return html;
}


function buildRegex(html) {
  return {
    id: 'gfl-standby-ui-regex-0001',
    scriptName: '少女前线-待机界面',
    findRegex: '/$/g',
    replaceString: '\n```html\n' + html + '\n```',
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

function main() {
  const html = buildStandbyHtml();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(buildRegex(html), null, 2) + '\n', 'utf8');
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_FILE));
}

if (require.main === module) {
  main();
}

module.exports = { buildStandbyHtml };
