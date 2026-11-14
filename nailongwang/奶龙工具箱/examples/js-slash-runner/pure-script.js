
(function() {
    const API = window.TavernHelper || window.parent?.TavernHelper;

    if (!API) {
        toastr?.warning?.('未检测到 JS-Slash-Runner / TavernHelper');
        return;
    }

    const lastId = API.getLastMessageId?.() ?? 0;
    const messages = API.getChatMessages?.(`0-${lastId}`, { include_swipes: false }) ?? [];

    console.log('[JS-Slash-Runner 纯 JS 示例]', { lastId, count: messages.length });
})();
