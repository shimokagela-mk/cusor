'use strict';

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => ({
    role: String(message && message.role ? message.role : 'user'),
    content: String(message && message.content ? message.content : '')
  }));
}

function createFakeAiResponder(fixtures = {}) {
  const rules = Array.isArray(fixtures.rules) ? fixtures.rules : [];
  const defaultText = fixtures.defaultText || [
    '本地 fake AI 响应。',
    '这是确定性测试输出，用于验证 shujuku 调用链路，不代表真实模型填表质量。'
  ].join('\n');

  return async function fakeAiResponder(messages, options = {}) {
    const normalized = normalizeMessages(messages);
    const promptText = normalized.map((item) => `${item.role}: ${item.content}`).join('\n');

    for (const rule of rules) {
      if (!rule || typeof rule !== 'object') continue;
      const includes = Array.isArray(rule.includes) ? rule.includes : [rule.includes].filter(Boolean);
      const matched = includes.every((text) => promptText.includes(String(text)));
      if (matched) {
        return String(rule.response || '');
      }
    }

    const localFillMatch = promptText.match(/<shujuku-local-fill-request>\s*([\s\S]*?)\s*<\/shujuku-local-fill-request>/);
    if (localFillMatch) {
      try {
        const request = JSON.parse(localFillMatch[1]);
        const tableName = request.targetTable || '纪要表';
        const rowData = request.rowData || {};
        if (request.databaseMode === 'sqlite') {
          const columns = Object.keys(rowData);
          const values = columns.map((name) => String(rowData[name] == null ? '' : rowData[name]).replace(/'/g, "''"));
          return [
            '<thought>已根据正文提取地点、事件和概要，并生成 SQLite 填表语句。</thought>',
            '<tableEdit>',
            `INSERT INTO "${tableName}" (${columns.map((name) => `"${name}"`).join(', ')}) VALUES (${values.map((value) => `'${value}'`).join(', ')});`,
            '</tableEdit>'
          ].join('\n');
        }
        return [
          '<thought>已根据正文提取地点、事件和概要，并生成原生表格填表指令。</thought>',
          '<content>',
          '<tableEdit>',
          `insertRow("${tableName}", ${JSON.stringify(rowData)})`,
          '</tableEdit>',
          '</content>'
        ].join('\n');
      } catch (_error) {
        return '<tableEdit></tableEdit>';
      }
    }

    const mapSyncMatch = promptText.match(/<GFL_MAP_SYNC_REQUEST>\s*[\s\S]*?输入数据：\s*([\s\S]*?)\s*<\/GFL_MAP_SYNC_REQUEST>/);
    if (mapSyncMatch) {
      try {
        const request = JSON.parse(mapSyncMatch[1]);
        const tables = request.tables || {};
        const mode = request.mode || 'base';
        const items = [];
        if (mode === 'combat') {
          const battle = Array.isArray(tables.battleConfig) ? tables.battleConfig : [];
          const enemies = Array.isArray(tables.enemyConfig) ? tables.enemyConfig : [];
          battle.forEach((row, index) => {
            const name = row['人形名称'] || row.tdoll_name || row.name;
            if (!name) return;
            items.push({
              '元素名称': String(name),
              '元素类型': '友方',
              'X坐标': 135 + index * 70,
              'Y坐标': 380 + (index % 2) * 50,
              '状态': `我方出战单位 · HP ${row['当前生命'] || row.current_hp || '?'}/${row['最大生命'] || row.max_hp || '?'}`,
              '描述': '由 fake AI 根据出战配置表生成，用于本地验证地图同步链路。',
              '所属区域': row['所属区域'] || '我方阵地',
              '传说背景': ''
            });
          });
          enemies.forEach((row, index) => {
            const name = row['敌人名称'] || row.enemy_name || row.name;
            if (!name) return;
            items.push({
              '元素名称': String(name),
              '元素类型': '敌方',
              'X坐标': 585 + index * 45,
              'Y坐标': 150 + (index % 5) * 70,
              '状态': `敌方单位 · HP ${row['当前生命'] || row.current_hp || '?'}/${row['最大生命'] || row.max_hp || '?'}`,
              '描述': '由 fake AI 根据敌人配置表生成，用于本地验证地图同步链路。',
              '所属区域': row['所属区域'] || '敌方阵地',
              '传说背景': ''
            });
          });
          if (items.length) {
            items.push({'元素名称':'中央掩体','元素类型':'障碍物','X坐标':405,'Y坐标':295,'状态':'可提供临时掩护','描述':'由 fake AI 生成的战场地形节点。','所属区域':'中央交战区','传说背景':''});
            items.push({'元素名称':'撤离点','元素类型':'出口','X坐标':95,'Y坐标':520,'状态':'可撤退','描述':'由 fake AI 生成的战场撤离点。','所属区域':'我方后撤线','传说背景':''});
          }
        }
        return JSON.stringify({ items });
      } catch (_error) {
        return JSON.stringify({ items: [] });
      }
    }

    if (options && options.format === 'openai-chat') {
      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: defaultText
            }
          }
        ]
      };
    }

    return defaultText;
  };
}

async function callRealOpenAiCompatible(messages, options = {}) {
  const baseUrl = String(process.env.OPENAI_COMPAT_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = String(process.env.OPENAI_COMPAT_API_KEY || '');
  const model = String(process.env.OPENAI_COMPAT_MODEL || '');

  if (!baseUrl || !apiKey || !model) {
    throw new Error('真实 AI 模式需要 OPENAI_COMPAT_BASE_URL、OPENAI_COMPAT_API_KEY、OPENAI_COMPAT_MODEL');
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: normalizeMessages(messages),
    max_tokens: Number(options.max_tokens || options.maxTokens || 1024),
    temperature: Number(options.temperature || 0)
  });

  const fetchImpl = globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前 Node 运行时缺少 fetch，无法使用真实 AI 模式');
  }

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body
  });

  if (!response.ok) {
    throw new Error(`真实 AI 请求失败: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? String(payload.choices[0].message.content || '')
    : null;
}

function createAiResponder(mode, fixtures = {}) {
  if (mode === 'real') {
    return callRealOpenAiCompatible;
  }
  return createFakeAiResponder(fixtures);
}

module.exports = {
  createFakeAiResponder,
  createAiResponder,
  callRealOpenAiCompatible
};
