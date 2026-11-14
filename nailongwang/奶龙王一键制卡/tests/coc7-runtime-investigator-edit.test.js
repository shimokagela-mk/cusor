const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT, 'projects');

function resolveProjectDir() {
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/COC7th/i.test(entry.name)) continue;
    const projectDir = path.join(PROJECTS_DIR, entry.name);
    const runtimePath = path.join(projectDir, 'frontend', 'multiplayer-runtime.js');
    const helperPath = path.join(projectDir, 'unpacked', 'tavern_helper', 'scripts', '001-COC_runtime.json');
    if (fs.existsSync(runtimePath) && fs.existsSync(helperPath)) return { projectDir, runtimePath, helperPath };
  }
  throw new Error('Unable to locate the COC7th runtime project');
}

const { runtimePath, helperPath } = resolveProjectDir();
const source = fs.readFileSync(runtimePath, 'utf8').replace(/^\uFEFF/, '');
const helperScript = JSON.parse(fs.readFileSync(helperPath, 'utf8').replace(/^\uFEFF/, ''));
const helperSource = String(helperScript.content || '');
const normalizedSource = source.replace(/\r\n/g, '\n');
const normalizedHelperSource = helperSource.replace(/\r\n/g, '\n');

function expectMatch(pattern, message) {
  assert(pattern.test(source), message);
}

function expectIncludes(text, message) {
  assert(source.includes(text), message);
}

function expectNotIncludes(text, message) {
  assert(!source.includes(text), message);
}

expectMatch(/function resolveRuntimeInvestigatorCardOpenTarget\(target\)/, 'missing resolveRuntimeInvestigatorCardOpenTarget');
expectMatch(/function captureRuntimeInvestigatorEditDraftFromDom\(name = ''\)/, 'missing captureRuntimeInvestigatorEditDraftFromDom');
expectMatch(/function restoreRuntimeInvestigatorEditFocus\(snapshot, body\)/, 'missing restoreRuntimeInvestigatorEditFocus');
expectMatch(/async function updateNamedTableRowByName\(api, tables, tableName, nameColumn, oldName, sourceRow\)/, 'missing updateNamedTableRowByName');
expectIncludes('data-runtime-dossier-delete', 'missing investigator dossier delete entry');
expectNotIncludes('data-runtime-investigator-edit', 'homepage investigator cards should not restore the old edit badge');

expectNotIncludes('extensions_settings2', 'runtime should not reintroduce extension settings injection');
expectNotIncludes('installCoc7ExtensionSettings', 'runtime should not reintroduce extension settings installers');
expectNotIncludes('data-coc7-settings-prompt', 'runtime should not reintroduce extension settings prompt controls');

expectIncludes("characterSheetAiPrompt: 'coc7th.multiplayer.characterSheetAiPrompt'", 'missing character sheet AI prompt storage key');
expectMatch(/function readStoredCharacterSheetAiPrompt\(\)/, 'missing readStoredCharacterSheetAiPrompt');
expectMatch(/function getCharacterSheetAiSystemPrompt\(\)/, 'missing getCharacterSheetAiSystemPrompt');
expectMatch(/function setCharacterSheetAiPromptOverride\(value = '', options = \{\}\)/, 'missing setCharacterSheetAiPromptOverride');
expectMatch(/function syncCharacterSheetAiPrompt\(targetUserId = ''\)/, 'missing syncCharacterSheetAiPrompt');
expectIncludes("if (envelope.type === 'character_sheet_ai_prompt_sync') applyCharacterSheetAiPromptSync(envelope.data || {});", 'missing character sheet AI prompt envelope handler');
expectIncludes("sendEnvelope('sync_user_state', { targetUserId: target, users: buildUsersSnapshot(), characterSheetAiPrompt: getCharacterSheetAiPromptOverride() });", 'host state sync should carry the AI prompt override');
expectIncludes("sendEnvelope('character_sheet_ai_prompt_sync', { targetUserId: target, prompt: getCharacterSheetAiPromptOverride() });", 'manual prompt sync should broadcast the AI prompt override');
expectIncludes("row.id = 'onlineHostSubmitControls';", 'missing host submit controls container');
expectIncludes("row.id = 'onlineCharacterSheetAiPromptCard';", 'missing character sheet AI prompt card');
expectIncludes("id=\"onlineCharacterSheetAiPromptInput\"", 'missing character sheet AI prompt textarea');
expectIncludes("id=\"onlineSyncCharacterSheetAiPromptBtn\"", 'missing prompt sync button');
expectIncludes("moveIntoOnlineSettingsSection(hostBody, ensureOnlineHostSubmitControls(scope));", 'host submit controls should be grouped inside host tools');
expectIncludes("moveIntoOnlineSettingsSection(hostBody, ensureOnlineCharacterSheetAiPromptCard(scope));", 'prompt card should be mounted inside host tools');
expectIncludes("row.innerHTML = '<input id=\"onlineAutoSubmitReadyInput\" type=\"checkbox\"><span class=\"online-field-label\">全员到齐后自动提交</span>';", 'auto submit label should reuse online-field-label');
expectIncludes("row.innerHTML = '<span class=\"online-field-label\">倒计时提交</span><input class=\"online-input\" id=\"onlineTimedInputSecondsInput\" type=\"number\" min=\"0\" max=\"3600\" step=\"1\" inputmode=\"numeric\" aria-label=\"倒计时提交秒数\"><span class=\"online-field-label\">秒</span>';", 'timed submit row should reuse online-field-label');
expectIncludes('.online-host-submit-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}', 'missing two-column host submit controls layout');
expectIncludes('.online-character-prompt-row{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:start}', 'missing character sheet AI prompt card layout');
expectIncludes('.online-character-prompt-textarea{min-height:154px;padding:10px 11px;resize:vertical;line-height:1.45;letter-spacing:0;white-space:pre-wrap;overflow:auto}', 'missing prompt textarea styling');
expectIncludes('.online-character-prompt-textarea.is-readonly{opacity:.88}', 'missing readonly prompt textarea styling');
expectIncludes('.online-character-prompt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}', 'missing prompt card header layout');
expectIncludes(".online-settings-section .online-row.is-three,[data-coc7-runtime-status-root] #onlinePanelBody .online-host-submit-controls{grid-template-columns:minmax(0,1fr)}", 'missing stacked host submit controls mobile layout');
expectIncludes("bindClick('onlineSyncCharacterSheetAiPromptBtn', () => syncCharacterSheetAiPrompt(), scope);", 'missing prompt sync button binding');
expectIncludes("setCharacterSheetAiPromptOverride(event.target?.value, { render: false, notice: false });", 'missing prompt textarea input binding');
expectIncludes("setSyncStatus('车卡 AI 系统提示词已更新，房主可点击同步提示词下发到房间'", 'missing host-side prompt update status copy');

assert.strictEqual(normalizedHelperSource, normalizedSource, 'helper script content must stay byte-for-byte aligned with the frontend runtime');

console.log('[pass] coc7 runtime investigator edit regression');
