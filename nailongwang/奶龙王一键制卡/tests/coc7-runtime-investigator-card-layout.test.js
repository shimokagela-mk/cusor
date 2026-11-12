const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT, 'projects');

function resolveRuntimePath() {
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/COC7th/i.test(entry.name)) continue;
    const runtimePath = path.join(PROJECTS_DIR, entry.name, 'frontend', 'multiplayer-runtime.js');
    if (fs.existsSync(runtimePath)) return runtimePath;
  }
  throw new Error('Unable to locate the COC7th runtime project');
}

const runtimePath = resolveRuntimePath();
const source = fs.readFileSync(runtimePath, 'utf8').replace(/^\uFEFF/, '');

function expectMatch(pattern, message) {
  assert(pattern.test(source), message);
}

function expectIncludes(text, message) {
  assert(source.includes(text), message);
}

function expectNotIncludes(text, message) {
  assert(!source.includes(text), message);
}

const preservedNameRenderer = ['leg', 'acyInvestigatorNameHtml'].join('');
expectMatch(new RegExp(`function ${preservedNameRenderer}\\(name\\)`), 'missing preserved investigator name renderer');
expectIncludes('class="inv-name" title="${safeName}"', 'investigator name nodes should keep the full title tooltip');
expectIncludes('.inv-name { color: var(--ink); font-size: 13px; font-weight: 900; line-height: 1.22; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; overflow-wrap: anywhere; max-height: 2.44em; }', 'compact investigator cards should clamp the name to two lines');
expectIncludes('[data-coc7-runtime-status-root] .desktop-investigators .investigator-card .inv-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;overflow-wrap:anywhere;line-height:1.22;max-height:2.44em}', 'desktop investigator cards should clamp the name to two lines');
expectIncludes('.inv-top > div { min-width: 0; }', 'compact investigator card identity wrapper should keep min-width:0');
expectIncludes('.desktop-investigators .investigator-card .inv-identity-row > div{min-width:0}', 'desktop investigator card identity wrapper should keep min-width:0');
expectIncludes('.desktop-investigators .investigator-card .inv-group-value,[data-coc7-runtime-status-root] .desktop-investigators .investigator-card .inv-location-value,[data-coc7-runtime-status-root] .desktop-investigators .investigator-card .inv-stat-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', 'desktop investigator card long text should stay ellipsized');
expectIncludes('.investigator-card-actions{grid-column:1 / -1;display:flex;align-items:center;justify-content:flex-end;', 'investigator card actions should stay right-aligned');
expectNotIncludes('.investigator-card-actions{grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;', 'investigator card actions should not revert to space-between');
expectIncludes('<div class="investigator-card-actions"><div class="dossier-cue">OPEN SHEET</div></div>', 'investigator card actions should only keep the OPEN SHEET cue');
expectNotIncludes('data-runtime-investigator-edit', 'homepage investigator cards should not restore the edit button marker');

console.log('[pass] coc7 runtime investigator card layout regression');
