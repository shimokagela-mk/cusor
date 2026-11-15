#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildBattleHtml } = require('./build_tavern_helper_console');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(PROJECT_ROOT, 'release');
const OUT_FILE = path.join(RELEASE_DIR, '少女前线-战斗UI.tavern-helper.json');
const OUT_JS_FILE = path.join(RELEASE_DIR, '少女前线-战斗UI.js');
const BATTLE_VERSION = '2026-06-16-sql-only-data-access';

function buildScriptContent(battleHtml = buildBattleHtml()) {
  const battleHtmlLiteral = JSON.stringify(battleHtml).replace(/<\/script/gi, '<\\/script');
  return `
(function(){
  'use strict';
  const SCRIPT_ID = 'gfl-battle-ui';
  const BATTLE_VERSION = '${BATTLE_VERSION}';
  const PANEL_ID = 'gfl-battle-console-panel';
  const IFRAME_ID = 'gfl-battle-console-frame';
  const RUNTIME_KEY = '__GFLBattleUiRuntime';
  const PANEL_POS_KEY = 'gfl-battle-console-panel-pos';
  const INSTANCE_ID = SCRIPT_ID + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const BATTLE_HTML = ${battleHtmlLiteral};
  let battleApi = null;
  let lastBattleSrcdoc = '';

  function getRootWindow(){
    try { if (window.top && window.top.document) return window.top; } catch (e) {}
    try { if (window.parent && window.parent.document) return window.parent; } catch (e) {}
    return window;
  }

  const ROOT = getRootWindow();

  function toast(message, type){
    const api = ROOT.toastr || window.toastr;
    if (api && typeof api[type || 'info'] === 'function') api[type || 'info'](message, '少女前线战斗UI');
    else console.log('[少女前线战斗UI]', message);
  }

  function removeNode(doc, id){
    const node = doc && doc.getElementById ? doc.getElementById(id) : null;
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function cleanup(){
    const doc = ROOT.document;
    removeNode(doc, PANEL_ID);
    removeNode(doc, SCRIPT_ID + '-style');
    try { ROOT.removeEventListener('gfl-battle-open', handleBattleOpenEvent); } catch (e) {}
    try { if (window !== ROOT) window.removeEventListener('gfl-battle-open', handleBattleOpenEvent); } catch (e) {}
    try { if (ROOT.document) ROOT.document.removeEventListener('click', handleBattleButtonClick, true); } catch (e) {}
    try { if (window.document && window.document !== ROOT.document) window.document.removeEventListener('click', handleBattleButtonClick, true); } catch (e) {}
    try { if (ROOT[RUNTIME_KEY] && ROOT[RUNTIME_KEY].instanceId === INSTANCE_ID) delete ROOT[RUNTIME_KEY]; } catch (e) {}
    try { if (ROOT.GFLBattleConsole && ROOT.GFLBattleConsole.instanceId === INSTANCE_ID) delete ROOT.GFLBattleConsole; } catch (e) {}
    try { if (window.GFLBattleConsole && window.GFLBattleConsole.instanceId === INSTANCE_ID) delete window.GFLBattleConsole; } catch (e) {}
  }

  function installRuntime(){
    try { if (ROOT[RUNTIME_KEY] && typeof ROOT[RUNTIME_KEY].cleanup === 'function') ROOT[RUNTIME_KEY].cleanup(); } catch (e) {}
    ROOT[RUNTIME_KEY] = { instanceId: INSTANCE_ID, cleanup: cleanup };
  }

  function publishApi(api){
    battleApi = api;
    try { window.GFLBattleConsole = api; } catch (e) {}
    try { ROOT.GFLBattleConsole = api; } catch (e) {}
  }

  function ensureStyles(doc){
    if (doc.getElementById(SCRIPT_ID + '-style')) return;
    const css = '#gfl-battle-console-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1220px,calc(100vw - 34px));height:min(820px,calc(100vh - 46px));z-index:40001;border:1px solid rgba(224,64,64,.62);border-radius:14px;overflow:hidden;background:#050505;box-shadow:0 24px 70px rgba(0,0,0,.72),0 0 28px rgba(224,64,64,.18);display:none}' +
      '#gfl-battle-console-panel.open{display:block}' +
      '#gfl-battle-console-panel .gfl-battle-head{height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;background:linear-gradient(90deg,#1c0808,#090909 70%);border-bottom:1px solid rgba(224,64,64,.42);color:#ffb0b0;font-size:12px;font-weight:900;letter-spacing:2px;cursor:grab;user-select:none}' +
      '#gfl-battle-console-panel.dragging .gfl-battle-head{cursor:grabbing}' +
      '#gfl-battle-console-panel .gfl-battle-head span::before{content:"⚠";margin-right:8px;color:#e8c840}' +
      '#gfl-battle-console-panel .gfl-battle-close{min-width:44px;height:40px;border:0;background:rgba(224,64,64,.12);color:#ffb0b0;font-size:24px;line-height:1;cursor:pointer;padding:0 10px;border-left:1px solid rgba(224,64,64,.28)}' +
      '#gfl-battle-console-frame{width:100%;height:calc(100% - 40px);border:0;background:#000;display:block}' +
      '@media(max-width:720px){#gfl-battle-console-panel{left:8px;top:max(56px,calc(env(safe-area-inset-top,0px) + 12px));right:auto;bottom:auto;transform:none;width:calc(100vw - 16px);height:calc(100dvh - max(72px,calc(env(safe-area-inset-top,0px) + 28px)) - env(safe-area-inset-bottom,0px));border-radius:12px}#gfl-battle-console-panel .gfl-battle-head{height:46px;padding-left:12px}#gfl-battle-console-frame{height:calc(100% - 46px)}#gfl-battle-console-panel .gfl-battle-close{height:46px;min-width:52px;font-size:28px}}';
    const style = doc.createElement('style');
    style.id = SCRIPT_ID + '-style';
    style.textContent = css;
    doc.head.appendChild(style);
  }

  function loadPos(){
    try { const raw = ROOT.localStorage && ROOT.localStorage.getItem(PANEL_POS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function savePos(pos){
    try { if (ROOT.localStorage) ROOT.localStorage.setItem(PANEL_POS_KEY, JSON.stringify(pos)); } catch (e) {}
  }

  function clampPos(pos, width, height){
    const maxLeft = Math.max(8, ROOT.innerWidth - width - 8);
    const maxTop = Math.max(8, ROOT.innerHeight - height - 8);
    return { left: Math.max(8, Math.min(maxLeft, pos.left)), top: Math.max(8, Math.min(maxTop, pos.top)) };
  }

  function applyFixedPos(el, pos){
    if (!el || !pos) return;
    el.style.left = Math.round(pos.left) + 'px';
    el.style.top = Math.round(pos.top) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'none';
  }

  function restorePos(el){
    const pos = loadPos();
    if (!el || !pos) return;
    const rect = el.getBoundingClientRect();
    applyFixedPos(el, clampPos(pos, rect.width || 1220, rect.height || 820));
  }

  function makeDraggable(el, handle){
    if (!el || !handle || handle.dataset.gflBattleDragBound === INSTANCE_ID) return;
    handle.dataset.gflBattleDragBound = INSTANCE_ID;
    let active = false, moved = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    handle.addEventListener('pointerdown', function(ev){
      if (ev.button != null && ev.button !== 0) return;
      if (ev.target && ev.target.closest && ev.target.closest('.gfl-battle-close')) return;
      const rect = el.getBoundingClientRect();
      active = true; moved = false; startX = ev.clientX; startY = ev.clientY; startLeft = rect.left; startTop = rect.top;
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    });
    handle.addEventListener('pointermove', function(ev){
      if (!active) return;
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
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
      savePos({ left: rect.left, top: rect.top });
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  function escapeTextarea(value){
    return String(value || '').replace(/<\\/textarea/gi, '<\\\\/textarea');
  }

  function buildBattleSrcdoc(encounterText){
    const source = '<textarea class="gfl-encounter-source" style="display:none">' + escapeTextarea(encounterText) + '</textarea>';
    const bodyOpen = BATTLE_HTML.match(/<body[^>]*>/i);
    if (bodyOpen && bodyOpen.index != null) {
      const insertAt = bodyOpen.index + bodyOpen[0].length;
      return BATTLE_HTML.slice(0, insertAt) + source + BATTLE_HTML.slice(insertAt);
    }
    const firstScript = BATTLE_HTML.search(/<script[\\s>]/i);
    if (firstScript >= 0) return BATTLE_HTML.slice(0, firstScript) + source + BATTLE_HTML.slice(firstScript);
    return source + BATTLE_HTML;
  }

  function ensureBattlePanel(){
    const doc = ROOT.document;
    if (!doc || !doc.body) return null;
    ensureStyles(doc);
    let panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      panel = doc.createElement('div');
      panel.id = PANEL_ID;
      panel.innerHTML = '<div class="gfl-battle-head"><span>战术终端 / 独立战斗模拟</span><button class="gfl-battle-close" type="button" aria-label="关闭">×</button></div><iframe id="' + IFRAME_ID + '" title="少女前线战斗模拟" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>';
      doc.body.appendChild(panel);
      panel.querySelector('.gfl-battle-close').addEventListener('click', function(){ panel.classList.remove('open'); });
    }
    restorePos(panel);
    makeDraggable(panel, panel.querySelector('.gfl-battle-head'));
    return panel;
  }

  function extractEncounterText(text){
    const value = String(text || '');
    const openRe = /<(?:custom-)?gfl-battle-encounter>/g;
    const closeRe = /<\\/(?:custom-)?gfl-battle-encounter>/g;
    let match;
    let lastValid = '';
    while ((match = openRe.exec(value))) {
      closeRe.lastIndex = openRe.lastIndex;
      const closeMatch = closeRe.exec(value);
      if (!closeMatch) continue;
      const block = value.slice(match.index, closeMatch.index + closeMatch[0].length);
      if (isValidEncounterBlock(block)) lastValid = block;
    }
    return lastValid;
  }

  function isValidEncounterBlock(block){
    const body = String(block || '').replace(/<\\/?(?:custom-)?gfl-battle-encounter>/g, '').trim();
    if (!body) return false;
    try {
      const parsed = JSON.parse(body);
      return !!(parsed && parsed.version === 1 && Array.isArray(parsed.current) && Array.isArray(parsed.additions));
    } catch (e) {
      return false;
    }
  }

  function getSillyTavernContext(){
    try { if (ROOT.SillyTavern && typeof ROOT.SillyTavern.getContext === 'function') return ROOT.SillyTavern.getContext(); } catch (e) {}
    try { if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') return window.SillyTavern.getContext(); } catch (e) {}
    return null;
  }

  function addChatMessageCandidates(candidates, item){
    if (!item) return;
    candidates.push(item.mes, item.__bl_original_mes, item.__bl_diff_last_cleaned_mes);
    if (Array.isArray(item.swipes)) {
      if (item.swipe_id != null) candidates.push(item.swipes[item.swipe_id]);
      for (let i = 0; i < item.swipes.length; i++) candidates.push(item.swipes[i]);
    }
  }

  function encounterTextFromRawChat(){
    const ctx = getSillyTavernContext();
    const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
    const candidates = [];
    for (let i = chat.length - 1; i >= 0; i--) addChatMessageCandidates(candidates, chat[i]);
    for (let i = 0; i < candidates.length; i++) {
      const found = extractEncounterText(candidates[i]);
      if (found) return found;
    }
    return '';
  }

  function openBattle(encounterText){
    const panel = ensureBattlePanel();
    if (!panel) return null;
    const iframe = panel.querySelector('#' + IFRAME_ID);
    if (iframe) {
      const nextSrcdoc = buildBattleSrcdoc(encounterText);
      if (iframe.getAttribute('srcdoc') !== nextSrcdoc || lastBattleSrcdoc !== nextSrcdoc) {
        iframe.srcdoc = nextSrcdoc;
        lastBattleSrcdoc = nextSrcdoc;
      }
    }
    panel.classList.add('open');
    return panel;
  }

  function openBattleFromLatestChat(){
    const text = encounterTextFromRawChat();
    if (!text) {
      toast('没有找到战斗遭遇数据，已打开当前配置战术终端。', 'warning');
      return openBattle('');
    }
    return openBattle(text);
  }

  function handleBattleOpenEvent(event){
    const detail = event && event.detail ? event.detail : {};
    if (detail.encounterText) { openBattle(String(detail.encounterText || '')); return; }
    openBattleFromLatestChat();
  }

  function isBattleOpenTarget(target){
    if (!target || !target.closest) return null;
    return target.closest('[data-gfl-battle-open],.gfl-battle-open,.custom-gfl-battle-open');
  }

  function handleBattleButtonClick(event){
    const button = isBattleOpenTarget(event && event.target);
    if (!button) return;
    try { event.preventDefault(); } catch (e) {}
    try { event.stopPropagation(); } catch (e) {}
    openBattleFromLatestChat();
  }

  function closeBattle(){
    const panel = ensureBattlePanel();
    if (panel) panel.classList.remove('open');
    return panel;
  }

  function main(){
    console.info('[少女前线战斗UI] 启动版本:', BATTLE_VERSION);
    installRuntime();
    const api = { instanceId: INSTANCE_ID, open: openBattle, openLatest: openBattleFromLatestChat, close: closeBattle, ensure: ensureBattlePanel, cleanup: cleanup };
    publishApi(api);
    try { ROOT.removeEventListener('gfl-battle-open', handleBattleOpenEvent); ROOT.addEventListener('gfl-battle-open', handleBattleOpenEvent); } catch (e) {}
    try { if (window !== ROOT) { window.removeEventListener('gfl-battle-open', handleBattleOpenEvent); window.addEventListener('gfl-battle-open', handleBattleOpenEvent); } } catch (e) {}
    try { if (ROOT.document) { ROOT.document.removeEventListener('click', handleBattleButtonClick, true); ROOT.document.addEventListener('click', handleBattleButtonClick, true); } } catch (e) {}
    try { if (window.document && window.document !== ROOT.document) { window.document.removeEventListener('click', handleBattleButtonClick, true); window.document.addEventListener('click', handleBattleButtonClick, true); } } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true });
  else main();
})();
`.trim() + '\n';
}

function buildHelperScript(battleHtml = buildBattleHtml()) {
  return {
    type: 'script',
    enabled: true,
    name: '少女前线战斗UI',
    id: 'gfl-battle-ui-script-0001',
    content: buildScriptContent(battleHtml),
    info: '少女前线独立战斗 UI。配合战斗按钮正则，从 <gfl-battle-encounter> 区块打开战术终端；战斗数据读取和写回使用 SQL-only 路径，不再全库导入或 CRUD 降级。版本: ' + BATTLE_VERSION,
    button: {
      enabled: false,
      buttons: []
    },
    data: {
      source: 'projects/少女前线/frontend/battle.html',
      triggeredByRegex: '少女前线-战斗按钮',
      version: BATTLE_VERSION
    }
  };
}

function main() {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const battleHtml = buildBattleHtml();
  const script = buildHelperScript(battleHtml);
  fs.writeFileSync(OUT_JS_FILE, script.content + '\n', 'utf8');
  fs.writeFileSync(OUT_FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_JS_FILE));
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_FILE));
}

if (require.main === module) main();

module.exports = { buildHelperScript, buildScriptContent };
