// SillyTavern 原生扩展最小入口样例
// 目标：演示 getContext、事件监听、设置面板注入、DOM/CSS 作用域。

(function () {
    'use strict';

    const PLUGIN_ID = 'example-extension';
    const PANEL_ID = `${PLUGIN_ID}-settings`;
    const state = { settingsRetryTimer: null };

    function getHostWindow() {
        try {
            if (window.parent && window.parent !== window && window.parent.document) {
                return window.parent;
            }
        } catch (_) {}
        return window;
    }

    const hostWindow = getHostWindow();
    const hostDocument = hostWindow.document || document;

    function getContextSafe() {
        if (!window.SillyTavern || typeof window.SillyTavern.getContext !== 'function') {
            throw new Error('SillyTavern.getContext() 不可用：请确认当前脚本运行在 SillyTavern 原生扩展环境内');
        }
        return window.SillyTavern.getContext();
    }

    function showToast(message, type = 'info') {
        if (hostWindow.toastr && typeof hostWindow.toastr[type] === 'function') {
            hostWindow.toastr[type](message, '示例扩展');
        } else {
            console.log(`[示例扩展][${type}]`, message);
        }
    }

    function findSettingsMount() {
        const selectors = [
            '#extensions_settings2',
            '#extensions_settings',
            '#third_party_extension_settings',
            '.extensions_settings',
            '#rm_extensions_block .inline-drawer-content',
        ];
        for (const selector of selectors) {
            const node = hostDocument.querySelector(selector);
            if (node) return node;
        }
        return null;
    }

    function renderSettingsPanel(panel) {
        panel.innerHTML = `
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>示例扩展</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="example-extension-card">
                        <p>这是 SillyTavern 原生扩展设置面板样例。</p>
                        <button id="${PLUGIN_ID}-ping" class="menu_button">测试事件环境</button>
                    </div>
                </div>
            </div>
        `;
    }

    function bindSettingsPanel(panel, context) {
        const button = panel.querySelector(`#${PLUGIN_ID}-ping`);
        if (!button || button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';

        button.addEventListener('click', () => {
            const chatId = typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : '(unknown)';
            showToast(`当前聊天 ID: ${chatId}`, 'success');
        });
    }

    function ensureSettingsPanel(context) {
        const mount = findSettingsMount();
        if (!mount) {
            hostWindow.clearTimeout(state.settingsRetryTimer);
            state.settingsRetryTimer = hostWindow.setTimeout(() => ensureSettingsPanel(context), 1800);
            return;
        }

        let panel = hostDocument.getElementById(PANEL_ID);
        if (!panel) {
            panel = hostDocument.createElement('section');
            panel.id = PANEL_ID;
            panel.className = `${PLUGIN_ID}-settings`;
            renderSettingsPanel(panel);
            mount.appendChild(panel);
        }
        bindSettingsPanel(panel, context);
    }

    function registerEvents(context) {
        const { eventSource, event_types } = context;
        if (!eventSource || !event_types) return;

        eventSource.on(event_types.APP_READY, () => {
            showToast('SillyTavern 扩展已就绪');
        });

        eventSource.on(event_types.CHAT_CHANGED, () => {
            console.log('[示例扩展] 聊天已切换');
        });
    }

    function main() {
        const context = getContextSafe();
        ensureSettingsPanel(context);
        registerEvents(context);
    }

    try {
        main();
    } catch (error) {
        console.error('[示例扩展] 初始化失败:', error);
        showToast(error.message || String(error), 'error');
    }
})();
