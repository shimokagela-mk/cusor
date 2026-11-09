/* 公司生活 · 表格数据桥（只读展示用） */
(function (global) {
  'use strict';

  var TABLES = {
    global: { name: '全局数据表', uid: 'sheet_GlobalData' },
    characters: { name: '重要角色表', uid: 'sheet_NcBlYRH5' },
    affinity: { name: '好感进度表', uid: 'sheet_Affinity' },
    corruption: { name: '堕落服从表', uid: 'sheet_Corruption' },
    chronicle: { name: '纪要表', uid: 'sheet_3NoMc1wI' }
  };

  function roots() {
    var list = [];
    try { list.push(window); } catch (e) {}
    try { if (window.parent && window.parent !== window) list.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window) list.push(window.top); } catch (e) {}
    return list;
  }

  function getApi() {
    var rs = roots();
    for (var i = 0; i < rs.length; i++) {
      try {
        if (rs[i].AutoCardUpdaterAPI) return rs[i].AutoCardUpdaterAPI;
      } catch (e) {}
    }
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findSheet(all, meta) {
    if (!all || !meta) return null;
    if (all[meta.uid]) return all[meta.uid];
    for (var key in all) {
      if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
      if (key.indexOf('sheet_') !== 0) continue;
      var sheet = all[key];
      if (sheet && sheet.name === meta.name) return sheet;
    }
    return null;
  }

  function headerIndex(content) {
    var map = {};
    if (!content || !content[0]) return map;
    content[0].forEach(function (h, i) {
      if (h == null || h === 'row_id' || h === '行号') return;
      map[String(h)] = i;
    });
    return map;
  }

  function rowsAsObjects(sheet) {
    var content = sheet && sheet.content;
    if (!content || content.length < 2) return [];
    var idx = headerIndex(content);
    var out = [];
    for (var r = 1; r < content.length; r++) {
      var row = content[r] || [];
      var obj = {};
      Object.keys(idx).forEach(function (name) {
        obj[name] = row[idx[name]];
      });
      out.push(obj);
    }
    return out;
  }

  function firstRow(sheet) {
    var rows = rowsAsObjects(sheet);
    return rows[0] || null;
  }

  function exportAll() {
    var api = getApi();
    if (!api || typeof api.exportTableAsJson !== 'function') return null;
    try { return api.exportTableAsJson(); } catch (e) { return null; }
  }

  function snapshot() {
    var all = exportAll();
    if (!all) return { ok: false, reason: 'API不可用或尚未导入表格', global: null, characters: [], affinity: [], corruption: [] };
    var gSheet = findSheet(all, TABLES.global);
    var cSheet = findSheet(all, TABLES.characters);
    var aSheet = findSheet(all, TABLES.affinity);
    var dSheet = findSheet(all, TABLES.corruption);
    return {
      ok: true,
      global: firstRow(gSheet),
      characters: rowsAsObjects(cSheet),
      affinity: rowsAsObjects(aSheet),
      corruption: rowsAsObjects(dSheet)
    };
  }

  function onTableUpdate(cb) {
    var api = getApi();
    if (!api) return function () {};
    var handler = function () { try { cb(snapshot()); } catch (e) {} };
    if (typeof api.subscribeTableUpdate === 'function') {
      api.subscribeTableUpdate(handler);
      return function () {
        try { if (typeof api.unsubscribeTableUpdate === 'function') api.unsubscribeTableUpdate(handler); } catch (e) {}
      };
    }
    var timer = setInterval(handler, 2500);
    return function () { clearInterval(timer); };
  }

  global.OfficeDataBridge = {
    TABLES: TABLES,
    getApi: getApi,
    esc: esc,
    snapshot: snapshot,
    onTableUpdate: onTableUpdate
  };
})(typeof window !== 'undefined' ? window : globalThis);
