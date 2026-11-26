#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildStandbyHtml } = require('./build_standby_regex');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const OUT_DIR = path.join(ROOT, 'release');
const PAGES = [
  { entry: 'standby.html', out: '少女前线-待机界面.local.html' },
  { entry: 'battle.html', out: '少女前线-战斗界面.local.html' }
];

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
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
  return html.replace(/url\((['"]?)([^)'"]+)\1\)/gi, (match, quote, raw) => {
    const value = raw.trim();
    if (!value || isExternalUrl(value)) return match;
    const clean = value.split('#')[0].split('?')[0];
    const asset = path.resolve(path.dirname(htmlFile), clean);
    if (!fs.existsSync(asset)) return match;
    const uri = dataUri(asset);
    if (!uri) return match;
    return `url("${uri}")`;
  });
}

function inlineScripts(html, htmlFile) {
  const baseDir = path.dirname(htmlFile);
  return html.replace(/<script\b([^>]*)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>\s*<\/script>/gi,
    (match, before, dq, sq, bare, after) => {
      const src = dq || sq || bare || '';
      if (isExternalUrl(src)) return match;
      const file = path.resolve(baseDir, src);
      if (!fs.existsSync(file)) throw new Error(`本地脚本不存在: ${src}`);
      const code = fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script');
      return `<script${before || ''}${after || ''}>\n${code}\n</script>`;
    });
}

function buildOne(page) {
  const input = path.join(FRONTEND, page.entry);
  const output = path.join(OUT_DIR, page.out);
  if (!fs.existsSync(input)) throw new Error(`入口文件不存在: ${input}`);
  let html = fs.readFileSync(input, 'utf8');
  html = inlineCssUrls(inlineScripts(html, input), input);
  if (page.entry === 'standby.html') {
    html = buildStandbyHtml();
  }
  if (/<script\b[^>]*\bsrc\s*=\s*(['"]?)(?!https?:|data:|blob:|\/\/)/i.test(html)) {
    throw new Error(`${page.entry} 打包后仍残留本地 script src`);
  }
  if (page.entry === 'standby.html' && !html.includes('GFL_STANDBY_SUBPAGES')) throw new Error('待机页单文件缺少内置子页面载荷');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(output, html.endsWith('\n') ? html : html + '\n', 'utf8');
  console.log(`✓ Generated ${path.relative(process.cwd(), output)}`);
}

PAGES.forEach(buildOne);
