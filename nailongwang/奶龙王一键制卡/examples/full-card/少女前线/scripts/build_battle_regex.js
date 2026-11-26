#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENTRY_FILE = path.join(PROJECT_ROOT, 'frontend', 'battle.html');
const OUT_FILE = path.join(PROJECT_ROOT, 'release', '少女前线-战斗界面.regex.json');

function buildLauncherMarkup() {
  return [
    '<div class="gfl-battle-launcher" style="position:relative;margin:10px 0 12px;padding:12px 14px 12px 16px;border:1px solid rgba(232,200,64,.38);border-left:4px solid #e8c840;background:linear-gradient(135deg,rgba(18,18,18,.94),rgba(8,8,8,.88));box-shadow:0 10px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06);color:#f0f0f0;font-family:\'Microsoft YaHei\',\'PingFang SC\',\'Noto Sans SC\',sans-serif;overflow:hidden;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));">',
    '  <div class="gfl-battle-source" hidden>raw-chat</div>',
    '  <div style="position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(232,200,64,.055) 0,rgba(232,200,64,.055) 1px,transparent 1px,transparent 16px);opacity:.32;"></div>',
    '  <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">',
    '    <div style="min-width:210px;flex:1 1 auto;">',
    '      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">',
    '        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid rgba(224,64,64,.75);background:rgba(224,64,64,.14);color:#ffb0b0;font-size:13px;font-weight:900;box-shadow:0 0 12px rgba(224,64,64,.18);">!</span>',
    '        <span style="color:#e8c840;font-size:12px;font-weight:900;letter-spacing:2px;text-shadow:0 0 10px rgba(232,200,64,.2);">战斗遭遇已捕获</span>',
    '      </div>',
    '      <div style="color:#999;font-size:11px;line-height:1.6;letter-spacing:.5px;">检测到新的战场接触。点击右侧战术终端，在独立弹窗中展开战斗模拟，避免占用酒馆正文渲染。</div>',
    '    </div>',
    '    <button type="button" class="gfl-battle-open" data-gfl-battle-open="1" onclick="try{window.top.dispatchEvent(new CustomEvent(\'gfl-battle-open\'))}catch(e){}" style="position:relative;flex:0 0 auto;border:1px solid rgba(232,200,64,.78);background:linear-gradient(180deg,#e8c840,#a98218);color:#080808;padding:9px 15px;font-size:12px;font-weight:900;letter-spacing:2px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 16px rgba(232,200,64,.18);clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);">启动战术终端</button>',
    '    <div class="gfl-battle-status" style="flex:1 1 100%;min-height:14px;color:#f0d860;font-size:10px;letter-spacing:.5px;line-height:1.4;"></div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function buildRegex() {
  return {
    id: 'gfl-battle-button-regex-0001',
    scriptName: '少女前线-战斗按钮',
    findRegex: '/<gfl-battle-encounter>[\\s\\S]*?<\\/gfl-battle-encounter>/g',
    replaceString: buildLauncherMarkup(),
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
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(buildRegex(), null, 2) + '\n', 'utf8');
  console.log('✓ Generated ' + path.relative(process.cwd(), OUT_FILE));
}

main();
