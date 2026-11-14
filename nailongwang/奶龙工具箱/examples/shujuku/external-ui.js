// shujuku 外部调用 UI 最小样例
// 目标：演示 window.AutoCardUpdaterAPI 的可用性检查、预设切换、表格更新、AI 调用。

(function () {
    'use strict';

    function getApi() {
        const api = window.AutoCardUpdaterAPI;
        if (!api) {
            throw new Error('window.AutoCardUpdaterAPI 不可用：请确认 shujuku / 神·数据库扩展已加载');
        }
        return api;
    }

    function notify(message, type = 'info') {
        if (window.toastr && typeof window.toastr[type] === 'function') {
            window.toastr[type](message, 'shujuku UI 样例');
        } else {
            console.log(`[shujuku UI 样例][${type}]`, message);
        }
    }

    async function showPresetNames() {
        const api = getApi();
        const names = api.getPlotPresetNames();
        notify(`剧情推进预设：${names.join(', ') || '(无)'}`);
        return names;
    }

    async function updateHeroStrength() {
        const api = getApi();
        const success = await api.updateRow('主角信息', 1, { 力量: 15 });
        if (success) {
            await api.refreshDataAndWorldbook();
            notify('已更新主角力量并刷新世界书', 'success');
        } else {
            notify('更新失败：请确认表名和行号存在', 'error');
        }
    }

    async function analyzeStory() {
        const api = getApi();
        const context = api.getStoryContext(5);
        const result = await api.callAI([
            { role: 'system', content: '你是剧情分析助手。' },
            { role: 'user', content: `请分析以下剧情的发展趋势：\n\n${context}` },
        ], { max_tokens: 1200 });

        if (result) {
            notify('AI 分析完成，请查看控制台', 'success');
            console.log('[shujuku UI 样例] AI 分析:', result);
        } else {
            notify('AI 调用失败', 'error');
        }
    }

    window.ShujukuExternalUiExample = {
        showPresetNames,
        updateHeroStrength,
        analyzeStory,
    };
})();
