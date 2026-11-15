#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildStandbyHtml } = require('./build_standby_regex');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SYSTEM_ROOT = path.resolve(PROJECT_ROOT, '..', '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const BATTLE_ENTRY_FILE = path.join(FRONTEND_DIR, 'battle.html');
const LIVE2D_VENDOR_DIR = path.join(FRONTEND_DIR, 'vendor', 'live2d');
const LIVE2D_REF_DIR = path.join(SYSTEM_ROOT, 'ref', 'Girls-Frontline');
const TDOLL_REF_DIR = path.join(SYSTEM_ROOT, 'ref', 'gf_tdoll_data');
const RELEASE_DIR = path.join(PROJECT_ROOT, 'release');
const OUT_FILE = path.join(RELEASE_DIR, '少女前线-控制台.tavern-helper.json');
const OUT_JS_FILE = path.join(RELEASE_DIR, '少女前线-控制台.js');
const OUT_HTML_FILE = path.join(RELEASE_DIR, '少女前线-控制台.html');
const CONSOLE_VERSION = '2026-06-16-sql-only-data-access';

const LIVE2D_VENDOR_FILES = [
  'pixi.min.js',
  'live2d-core.min.js',
  'pixi-live2d-cubism2.min.js'
];

const SPECIAL_LIVE2D_SKIN_MAPPINGS = [
  { tdollName: 'ST AR-15', skinName: '心智升级', dir: 'ar15mod', code: 'mod' },
  { tdollName: 'M4A1', skinName: '心智升级', dir: 'm4a1mod', code: 'mod' },
  { tdollName: 'M4 SOPMODII', skinName: '心智升级', dir: 'm4 sopmod iimod', code: 'mod' }
];

const LIVE2D_TDOLL_NAME_OVERRIDES = {
  '卡尔卡诺M91_38': '卡尔卡诺M91'
};

function readLive2dVendorScripts() {
  return LIVE2D_VENDOR_FILES.map((filename) => {
    const file = path.join(LIVE2D_VENDOR_DIR, filename);
    if (!fs.existsSync(file)) throw new Error('Live2D vendor 文件不存在: ' + path.relative(PROJECT_ROOT, file));
    return {
      filename,
      code: fs.readFileSync(file, 'utf8')
    };
  });
}

function live2dVendorShim(filename) {
  if (filename !== 'pixi-live2d-cubism2.min.js') return '';
  return [
    '(function(){',
    '  var PIXI = window.PIXI = window.PIXI || {};',
    '  PIXI.utils = PIXI.utils || {};',
    '  if (!PIXI.utils.EventEmitter && PIXI.EventEmitter) PIXI.utils.EventEmitter = PIXI.EventEmitter;',
    '})();',
    ''
  ].join('\n');
}

function injectLive2dVendors(html) {
  const headClose = '</head>';
  const insertAt = html.lastIndexOf(headClose);
  if (insertAt < 0) throw new Error('待机页缺少 </head>，无法内联 Live2D vendor');
  const vendorScripts = readLive2dVendorScripts().map(({ filename, code }) => (
    '<script data-gfl-live2d-vendor="' + filename + '">\n' + live2dVendorShim(filename) + code + '\n</script>'
  )).join('\n');
  return html.slice(0, insertAt) + vendorScripts + '\n' + html.slice(insertAt);
}

function normalizeName(value) {
  return String(value || '')
    .replace(/[\s_\-·.]/g, '')
    .replace(/[（）()【】\[\]★☆]/g, '')
    .toLowerCase();
}

function normalizeSkinName(value) {
  return String(value || '').replace(/（l2d）|\(l2d\)/ig, '').trim();
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function collectLive2DDirsByCode() {
  const byCode = new Map();
  for (const dir of listDirs(LIVE2D_REF_DIR)) {
    const match = dir.match(/_(\d+)$/);
    if (!match) continue;
    const code = match[1];
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(dir);
  }
  return byCode;
}

function chooseLive2DDir(candidates, tdollName, code) {
  if (!candidates || !candidates.length) return '';
  if (candidates.length === 1) return candidates[0];
  const normalizedTdoll = normalizeName(tdollName);
  return candidates.find((dir) => normalizeName(dir.replace(new RegExp('_' + code + '$'), '')).includes(normalizedTdoll) || normalizedTdoll.includes(normalizeName(dir.replace(new RegExp('_' + code + '$'), '')))) || candidates[0];
}

function getLive2DTdollDisplayName(sourceName) {
  return LIVE2D_TDOLL_NAME_OVERRIDES[sourceName] || sourceName;
}

function collectLive2DSkinMap() {
  const liveDirsByCode = collectLive2DDirsByCode();
  const entries = [];
  for (const category of listDirs(TDOLL_REF_DIR)) {
    const categoryDir = path.join(TDOLL_REF_DIR, category);
    for (const tdollDirName of listDirs(categoryDir)) {
      const sourceTdollName = tdollDirName.replace(/_[★☆]+$/g, '');
      const tdollName = getLive2DTdollDisplayName(sourceTdollName);
      const portraitDir = path.join(categoryDir, tdollDirName, '01_立绘展示');
      for (const skinName of listDirs(portraitDir)) {
        const skinDir = path.join(portraitDir, skinName);
        const files = fs.readdirSync(skinDir).filter((file) => /\.(?:png|webp|jpg|jpeg)$/i.test(file));
        const codes = new Set();
        for (const file of files) {
          const match = file.match(/_(\d+)(?:_D)?(?:_HD)?\.[^.]+$/i);
          if (match) codes.add(match[1]);
        }
        for (const code of codes) {
          const dir = chooseLive2DDir(liveDirsByCode.get(code), sourceTdollName, code);
          if (!dir) continue;
          const cleanSkinName = normalizeSkinName(skinName);
          entries.push({
            tdollName,
            skinName: cleanSkinName,
            l2dSkinName: cleanSkinName + '（l2d）',
            code,
            dir
          });
        }
      }
    }
  }
  entries.sort((a, b) => (a.tdollName + a.skinName).localeCompare(b.tdollName + b.skinName, 'zh-Hans-CN'));
  const byTdollSkin = {};
  const bySkin = {};
  const byCode = {};
  for (const entry of entries) {
    const tdollKey = normalizeName(entry.tdollName);
    const skinKey = normalizeName(entry.skinName);
    const l2dSkinKey = normalizeName(entry.l2dSkinName);
    byTdollSkin[tdollKey + '|' + skinKey] = entry.dir;
    byTdollSkin[tdollKey + '|' + l2dSkinKey] = entry.dir;
    bySkin[skinKey] = entry.dir;
    bySkin[l2dSkinKey] = entry.dir;
    byCode[entry.code] = entry.dir;
  }
  for (const special of SPECIAL_LIVE2D_SKIN_MAPPINGS) {
    if (!fs.existsSync(path.join(LIVE2D_REF_DIR, special.dir))) continue;
    const entry = {
      tdollName: special.tdollName,
      skinName: special.skinName,
      l2dSkinName: special.skinName + '（l2d）',
      code: special.code,
      dir: special.dir,
      special: true
    };
    entries.push(entry);
    const tdollKey = normalizeName(entry.tdollName);
    const skinKey = normalizeName(entry.skinName);
    const l2dSkinKey = normalizeName(entry.l2dSkinName);
    byTdollSkin[tdollKey + '|' + skinKey] = entry.dir;
    byTdollSkin[tdollKey + '|' + l2dSkinKey] = entry.dir;
  }
  return { entries, byTdollSkin, bySkin, byCode, generatedAt: new Date().toISOString() };
}

function injectLive2DSkinMap(html) {
  const headClose = '</head>';
  const insertAt = html.lastIndexOf(headClose);
  if (insertAt < 0) throw new Error('待机页缺少 </head>，无法内联 Live2D 皮肤映射');
  const mapJson = JSON.stringify(collectLive2DSkinMap()).replace(/<\//g, '<\\/');
  const script = '<script>\nwindow.GFL_LIVE2D_SKIN_MAP = ' + mapJson + ';\n</script>\n';
  return html.slice(0, insertAt) + script + html.slice(insertAt);
}

function inlineLocalScripts(html, filename) {
  const baseDir = path.dirname(filename);
  return String(html || '').replace(/<script\b([^>]*)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>\s*<\/script>/gi,
    (match, beforeAttrs, doubleQuoted, singleQuoted, bare, afterAttrs) => {
      const src = doubleQuoted || singleQuoted || bare || '';
      if (/^(?:https?:)?\/\//i.test(src) || /^data:/i.test(src)) return match;
      const scriptPath = path.resolve(baseDir, src);
      if (!fs.existsSync(scriptPath)) throw new Error('战斗页外部脚本不存在: ' + src);
      const code = fs.readFileSync(scriptPath, 'utf8').replace(/<\/script/gi, '<\\/script');
      return `<script${beforeAttrs || ''}${afterAttrs || ''}>\n${code}\n</script>`;
    });
}

function buildBattleHtml() {
  if (!fs.existsSync(BATTLE_ENTRY_FILE)) throw new Error('战斗页入口文件不存在: ' + BATTLE_ENTRY_FILE);
  const html = inlineLocalScripts(fs.readFileSync(BATTLE_ENTRY_FILE, 'utf8'), BATTLE_ENTRY_FILE);
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) throw new Error('战斗页打包后仍残留 script src');
  return html;
}

function buildScriptContent(html) {
  const htmlLiteral = JSON.stringify(html).replace(/<\/script/gi, '<\\/script');
  return `(function(){
  'use strict';
  const SCRIPT_ID = 'gfl-standby-console';
  const CONSOLE_VERSION = '${CONSOLE_VERSION}';
  const PANEL_ID = 'gfl-standby-console-panel';
  const BUTTON_ID = 'gfl-standby-console-button';
  const IFRAME_ID = 'gfl-standby-console-frame';
  const RUNTIME_KEY = '__GFLStandbyConsoleRuntime';
  const BUTTON_POS_KEY = 'gfl-standby-console-button-pos';
  const PANEL_POS_KEY = 'gfl-standby-console-panel-pos';
  const INSTANCE_ID = SCRIPT_ID + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const HTML = ${htmlLiteral};
  const TH = window.TavernHelper || (window.parent && window.parent.TavernHelper) || null;

  function getRootWindow(){
    try { if (window.top && window.top.document) return window.top; } catch (e) {}
    try { if (window.parent && window.parent.document) return window.parent; } catch (e) {}
    return window;
  }

  const ROOT = getRootWindow();
  let contextSignatureAtStart = null;
  let lifecycleTimer = null;
  let consoleSrcdocReady = false;

  function currentContextSignature(){
    const root = ROOT;
    try {
      const st = root.SillyTavern || window.SillyTavern;
      const ctx = st && typeof st.getContext === 'function' ? st.getContext() : null;
      if (ctx) {
        const charId = ctx.characterId ?? ctx.this_chid ?? ctx.character_id ?? '';
        const chatId = ctx.chatId ?? ctx.chat_id ?? ctx.chatMetadata?.chatId ?? ctx.chatMetadata?.file_name ?? ctx.chat?.id ?? '';
        const groupId = ctx.groupId ?? ctx.group_id ?? '';
        const character = ctx.characters && charId !== '' ? ctx.characters[charId] : null;
        const avatar = character && (character.avatar || character.name) || '';
        if (charId !== '' || chatId || groupId || avatar) return [charId, chatId, groupId, avatar].join('|');
      }
    } catch (e) {}
    try { return root.location ? root.location.href : document.location.href; } catch (e) { return 'unknown'; }
  }

  function removeNode(doc, id){
    const node = doc && doc.getElementById ? doc.getElementById(id) : null;
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function removeDom(){
    const doc = ROOT.document;
    if (!doc) return;
    removeNode(doc, PANEL_ID);
    removeNode(doc, BUTTON_ID);
    removeNode(doc, SCRIPT_ID + '-style');
  }

  function cleanup(){
    if (lifecycleTimer) { clearInterval(lifecycleTimer); lifecycleTimer = null; }
    removeDom();
    try { if (ROOT[RUNTIME_KEY] && ROOT[RUNTIME_KEY].instanceId === INSTANCE_ID) delete ROOT[RUNTIME_KEY]; } catch (e) {}
    try { if (ROOT.GFLStandbyConsole && ROOT.GFLStandbyConsole.instanceId === INSTANCE_ID) delete ROOT.GFLStandbyConsole; } catch (e) {}
    try { if (window.GFLStandbyConsole && window.GFLStandbyConsole.instanceId === INSTANCE_ID) delete window.GFLStandbyConsole; } catch (e) {}
  }

  function installRuntime(){
    try { if (ROOT[RUNTIME_KEY] && typeof ROOT[RUNTIME_KEY].cleanup === 'function') ROOT[RUNTIME_KEY].cleanup(); } catch (e) {}
    ROOT[RUNTIME_KEY] = { instanceId: INSTANCE_ID, cleanup: cleanup, signature: contextSignatureAtStart };
  }

  function startLifecycleWatch(){
    if (lifecycleTimer) clearInterval(lifecycleTimer);
    lifecycleTimer = setInterval(function(){
      const sig = currentContextSignature();
      if (contextSignatureAtStart && sig && sig !== contextSignatureAtStart) cleanup();
    }, 800);
    try { ROOT.addEventListener('pagehide', cleanup, { once: true }); } catch (e) {}
    try { ROOT.addEventListener('beforeunload', cleanup, { once: true }); } catch (e) {}
  }

  function toast(message, type){
    const api = ROOT.toastr || window.toastr;
    if (api && typeof api[type || 'info'] === 'function') api[type || 'info'](message, '少女前线控制台');
    else console.log('[少女前线控制台]', message);
  }

  function ensureStyles(doc){
    if (doc.getElementById(SCRIPT_ID + '-style')) return;
    const css = [
      '#gfl-standby-console-button{position:fixed;right:18px;bottom:88px;width:58px;height:58px;z-index:40000;border:1px solid #e8c840;background:radial-gradient(circle at 32% 24%,#343434,#080808 62%,#000);color:#f0d860;border-radius:50%;padding:0;font-size:0;font-weight:800;letter-spacing:0;box-shadow:0 10px 28px rgba(0,0,0,.55),0 0 18px rgba(232,200,64,.18),inset 0 1px 0 rgba(255,255,255,.16);cursor:grab;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none}',
      '#gfl-standby-console-button::before{content:"💻";font-size:27px;line-height:1;filter:drop-shadow(0 0 6px rgba(232,200,64,.35))}',
      '#gfl-standby-console-button:hover{filter:brightness(1.12)}#gfl-standby-console-button:active{cursor:grabbing;transform:scale(.96)}',
      '#gfl-standby-console-panel{position:fixed;right:16px;bottom:138px;width:min(1100px,calc(100vw - 32px));height:min(760px,calc(100vh - 168px));z-index:39999;border:1px solid rgba(232,200,64,.5);border-radius:16px;overflow:hidden;background:#050505;box-shadow:0 18px 48px rgba(0,0,0,.62);display:none}',
      '#gfl-standby-console-panel.open{display:block}',
      '#gfl-standby-console-panel .gfl-console-head{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;background:linear-gradient(90deg,#171717,#0a0a0a);border-bottom:1px solid rgba(232,200,64,.35);color:#f0d860;font-size:12px;font-weight:800;letter-spacing:2px;cursor:grab;touch-action:none;user-select:none}',
      '#gfl-standby-console-panel.dragging .gfl-console-head{cursor:grabbing}',
      '#gfl-standby-console-panel .gfl-console-close{border:0;background:transparent;color:#f0d860;font-size:20px;line-height:1;cursor:pointer;padding:4px 8px}',
      '#gfl-standby-console-frame{width:100%;height:calc(100% - 38px);border:0;background:#000;display:block}',
      '@media(max-width:720px){#gfl-standby-console-button{right:12px;bottom:76px;width:54px;height:54px}#gfl-standby-console-panel{right:8px;bottom:122px;width:calc(100vw - 16px);height:calc(100vh - 142px);border-radius:12px}}'
    ].join('');
    const style = doc.createElement('style');
    style.id = SCRIPT_ID + '-style';
    style.textContent = css;
    doc.head.appendChild(style);
  }

  function loadPos(key){
    try { const raw = ROOT.localStorage && ROOT.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function savePos(key, pos){
    try { if (ROOT.localStorage) ROOT.localStorage.setItem(key, JSON.stringify(pos)); } catch (e) {}
  }

  function clampPos(pos, width, height){
    const maxLeft = Math.max(8, ROOT.innerWidth - width - 8);
    const maxTop = Math.max(8, ROOT.innerHeight - height - 8);
    return { left: Math.max(8, Math.min(maxLeft, pos.left)), top: Math.max(8, Math.min(maxTop, pos.top)) };
  }

  function isMobileViewport(){
    return ROOT.innerWidth <= 720;
  }

  function centerPanel(panel){
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const width = rect.width || Math.min(1100, Math.max(0, ROOT.innerWidth - 16));
    const height = rect.height || Math.min(760, Math.max(0, ROOT.innerHeight - 142));
    applyFixedPos(panel, clampPos({ left: (ROOT.innerWidth - width) / 2, top: (ROOT.innerHeight - height) / 2 }, width, height));
  }

  function placeMobileButton(button){
    if (!button) return;
    const size = 54;
    applyFixedPos(button, clampPos({ left: ROOT.innerWidth - size - 12, top: ROOT.innerHeight - size - 118 }, size, size));
  }

  function applyFixedPos(el, pos){
    if (!el || !pos) return;
    el.style.left = Math.round(pos.left) + 'px';
    el.style.top = Math.round(pos.top) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  function restorePos(el, key){
    if (key === PANEL_POS_KEY && isMobileViewport()) return centerPanel(el);
    if (key === BUTTON_POS_KEY && isMobileViewport()) return placeMobileButton(el);
    const pos = loadPos(key);
    if (!el || !pos) return;
    const rect = el.getBoundingClientRect();
    applyFixedPos(el, clampPos(pos, rect.width || 58, rect.height || 58));
  }

  function makeDraggable(el, handle, key, options){
    options = options || {};
    if (!el || !handle || handle.dataset.gflDragBound === INSTANCE_ID) return;
    handle.dataset.gflDragBound = INSTANCE_ID;
    let active = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    handle.addEventListener('pointerdown', function(ev){
      if (ev.button != null && ev.button !== 0) return;
      if (options.ignore && ev.target && ev.target.closest && ev.target.closest(options.ignore)) return;
      const rect = el.getBoundingClientRect();
      active = true;
      moved = false;
      startX = ev.clientX;
      startY = ev.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    });
    handle.addEventListener('pointermove', function(ev){
      if (!active) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
      if (!moved) return;
      el.classList.add('dragging');
      const rect = el.getBoundingClientRect();
      applyFixedPos(el, clampPos({ left: startLeft + dx, top: startTop + dy }, rect.width, rect.height));
      ev.preventDefault();
    });
    function endDrag(ev){
      if (!active) return;
      active = false;
      el.classList.remove('dragging');
      try { handle.releasePointerCapture(ev.pointerId); } catch (e) {}
      const rect = el.getBoundingClientRect();
      savePos(key, { left: rect.left, top: rect.top });
      if (options.onClick && !moved) options.onClick(ev);
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  function ensurePanel(){
    const doc = ROOT.document;
    if (!doc || !doc.body) return null;
    ensureStyles(doc);
    let panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      panel = doc.createElement('div');
      panel.id = PANEL_ID;
      panel.innerHTML = '<div class="gfl-console-head"><span>少女前线控制台</span><button class="gfl-console-close" type="button" aria-label="关闭">×</button></div><iframe id="' + IFRAME_ID + '" title="少女前线控制台" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>';
      doc.body.appendChild(panel);
      panel.querySelector('.gfl-console-close').addEventListener('click', function(){ panel.classList.remove('open'); });
      const iframe = panel.querySelector('#' + IFRAME_ID);
      iframe.srcdoc = HTML;
      consoleSrcdocReady = true;
    }
    restorePos(panel, PANEL_POS_KEY);
    makeDraggable(panel, panel.querySelector('.gfl-console-head'), PANEL_POS_KEY, { ignore: '.gfl-console-close' });

    let button = doc.getElementById(BUTTON_ID);
    if (!button) {
      button = doc.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.setAttribute('aria-label', '打开少女前线控制台');
      button.title = '少女前线控制台';
      button.textContent = '';
      doc.body.appendChild(button);
    }
    button.dataset.gflInstanceId = INSTANCE_ID;
    restorePos(button, BUTTON_POS_KEY);
    if (isMobileViewport()) placeMobileButton(button);
    makeDraggable(button, button, BUTTON_POS_KEY, { onClick: function(){ toggleConsole(); } });
    return panel;
  }

  function openConsole(){
    const panel = ensurePanel();
    if (panel) {
      const iframe = panel.querySelector('#' + IFRAME_ID);
      if (iframe && (!consoleSrcdocReady || iframe.getAttribute('srcdoc') !== HTML)) { iframe.srcdoc = HTML; consoleSrcdocReady = true; }
      panel.classList.add('open');
      try { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'gfl-console-opened' }, '*'); } catch (e) {}
      if (isMobileViewport()) centerPanel(panel);
    }
    return panel;
  }

  function closeConsole(){
    const panel = ensurePanel();
    if (panel) panel.classList.remove('open');
    return panel;
  }

  function toggleConsole(){
    const panel = ensurePanel();
    if (panel) {
      if (!panel.classList.contains('open')) {
        const iframe = panel.querySelector('#' + IFRAME_ID);
        if (iframe && (!consoleSrcdocReady || iframe.getAttribute('srcdoc') !== HTML)) { iframe.srcdoc = HTML; consoleSrcdocReady = true; }
        panel.classList.add('open');
        try { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'gfl-console-opened' }, '*'); } catch (e) {}
        if (isMobileViewport()) centerPanel(panel);
      } else {
        panel.classList.remove('open');
      }
    }
    return panel;
  }

  function main(){
    console.info('[少女前线控制台] 启动版本:', CONSOLE_VERSION);
    contextSignatureAtStart = currentContextSignature();
    installRuntime();
    startLifecycleWatch();
    window.GFLStandbyConsole = { instanceId: INSTANCE_ID, open: openConsole, close: closeConsole, toggle: toggleConsole, ensure: ensurePanel, cleanup: cleanup };
    ROOT.GFLStandbyConsole = window.GFLStandbyConsole;
    if (!TH) console.warn('[少女前线控制台] 未检测到 TavernHelper，将仅创建常驻 UI 面板。');
    const panel = ensurePanel();
    try { ROOT.addEventListener('resize', function(){ const btn = ROOT.document && ROOT.document.getElementById(BUTTON_ID); if (isMobileViewport() && btn) placeMobileButton(btn); }, { passive: true }); } catch (e) {}
    if (panel) toast('控制台已加载，可用右下角按钮打开。', 'success');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true });
  else main();
})();
`;
}

function buildConsoleHtml() {
  return injectLive2DSkinMap(injectLive2dVendors(buildStandbyHtml()));
}

function buildHelperScript(html = buildConsoleHtml()) {
  return {
    type: 'script',
    enabled: true,
    name: '少女前线控制台',
    id: 'gfl-standby-console-script-0001',
    content: buildScriptContent(html),
    info: '少女前线常驻待机控制台。数据访问改为 SQL-only：读取只用 queryTableRows/SQL 查询，写入只用 executeSqlBatch/executeSqlMutation；禁用全库 exportTableAsJson 与 CRUD 降级。版本: ' + CONSOLE_VERSION,
    button: {
      enabled: true,
      buttons: [
        {
          name: '打开少女前线控制台',
          visible: true,
          script: 'window.GFLStandbyConsole && window.GFLStandbyConsole.toggle()'
        }
      ]
    },
    data: {
      source: 'projects/少女前线/frontend/standby.html',
      version: CONSOLE_VERSION
    }
  };
}

function main() {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const html = buildConsoleHtml();
  const script = buildHelperScript(html);
  fs.writeFileSync(OUT_HTML_FILE, html + '\n', 'utf8');
  fs.writeFileSync(OUT_JS_FILE, script.content + '\n', 'utf8');
  fs.writeFileSync(OUT_FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_HTML_FILE));
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_JS_FILE));
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_FILE));
}

if (require.main === module) main();

module.exports = { buildConsoleHtml, buildHelperScript, buildBattleHtml };
