/* GFL map sync orchestrator.
 * Owns AI-assisted map generation and map_elements table writes.
 * Boundary: SillyTavern/TavernHelper provide context, AutoCardUpdaterAPI provides callAI/table writes.
 */
(function(){
  'use strict';

  var Bridge = window.GFLDataBridge;
  var inFlight = null;
  var lastSyncKey = '';
  var drawVersion = 0;
  var autoLastRoundKey = '';
  var messageReceivedBound = false;

  var BASE_ITEMS = [
    row('作战指挥室','地标',395,85,'设施运转','指挥区','基地中枢，用于战役简报、梯队派遣与前线通信。','参考少前基地主界面的作战指挥功能设计。'),
    row('编队整备室','地标',185,175,'整备开放','战备区','主战梯队在此进行人形编成、装备确认与出击前检查。','连接编队页面的空间化表达。'),
    row('人形宿舍','地标',600,175,'日常开放','生活区','战术人形休息与互动区域，承担士气恢复和日常生活功能。','少前宿舍设施的基地化布局。'),
    row('建造工坊','地标',165,330,'生产待命','生产区','执行人形建造、装备调试与制造队列管理。','对应建造页面。'),
    row('修复中心','地标',390,330,'医疗待命','医疗区','大破修复、快速修复合约使用与战后损伤处理。','作战后勤核心设施。'),
    row('仓储库房','地标',620,330,'库存管理','仓储区','管理已拥有人形、皮肤、核心与装备库存。','对应仓库页面与看板设置。'),
    row('后勤调度室','地标',225,500,'任务调度','后勤区','后勤梯队派遣、资源回收和远程任务监控。','对应少前后勤系统。'),
    row('情报与模拟室','地标',535,500,'情报解析','训练区','情报解析、模拟作战和训练数据复盘。','承载后续战斗训练扩展。'),
    row('主通道','出口',400,575,'通路开放','出口','通往前线集结点与基地外部交通节点。','出击流程的空间出口。')
  ];

  function row(name,type,x,y,status,region,desc,legend){
    return {'元素名称':name,'元素类型':type,'X坐标':x,'Y坐标':y,'状态':status||'','描述':desc||status||'','所属区域':region||'','战术背景':legend||''};
  }
  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(e){return v;}}
  function getApi(){return Bridge && Bridge.getApi ? Bridge.getApi() : null;}
  function combatActive(){return !!(Bridge && Bridge.sortieActive && Bridge.sortieActive());}
  function rows(tableKey){return Bridge && Bridge.rows ? Bridge.rows(tableKey) : [];}
  function field(r,names,fallback){return Bridge && Bridge.field ? Bridge.field(r,names,fallback) : (fallback||'');}
  function num(v, def){var n=parseInt(v,10);return isNaN(n)?def:n;}
  function trim(v){return String(v==null?'':v).trim();}

  function roots(){
    var out = [];
    function add(root){ if(root && out.indexOf(root) < 0) out.push(root); }
    try{ add(window); }catch(e){}
    try{ add(window.parent); }catch(e){}
    try{ add(window.top); }catch(e){}
    return out;
  }

  function contextOf(root){
    try{ if(root && root.SillyTavern && typeof root.SillyTavern.getContext === 'function') return root.SillyTavern.getContext(); }catch(e){}
    try{ if(root && typeof root.getContext === 'function') return root.getContext(); }catch(e){}
    return null;
  }

  function textHash(text){
    var s = String(text || '');
    var h = 0;
    for(var i=0;i<s.length;i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return String(h);
  }

  function currentRoundKey(){
    var rs = roots();
    for(var j=0;j<rs.length;j++){
      try{
        var ctx = contextOf(rs[j]);
        var chat = (ctx && (ctx.chat || ctx.Chat)) || (rs[j].SillyTavern && rs[j].SillyTavern.chat) || rs[j].chat;
        if(Array.isArray(chat)) return 'chat:' + chat.length;
      }catch(e){}
    }
    var api = getApi();
    if(api && typeof api.getStoryContext === 'function'){
      try{return 'story:' + textHash(api.getStoryContext(8));}catch(e){}
    }
    return 'unknown';
  }

  function isStandbyHost(){
    return !!(document.querySelector('.gfl-home') && !document.getElementById('map-box'));
  }

  function latestAssistantRoundKey(){
    var rs = roots();
    for(var i=0;i<rs.length;i++){
      try{
        var ctx = contextOf(rs[i]);
        var chat = (ctx && (ctx.chat || ctx.Chat)) || (rs[i].SillyTavern && rs[i].SillyTavern.chat) || rs[i].chat;
        if(!Array.isArray(chat) || !chat.length) continue;
        var idx = chat.length - 1;
        var last = chat[idx] || {};
        var role = String(last.role || '').toLowerCase();
        var isUser = last.is_user === true || role === 'user';
        if(isUser) return '';
        var id = last.id != null ? last.id : idx;
        var content = last.mes != null ? last.mes : last.message != null ? last.message : last.content;
        return 'assistant:' + id + ':' + textHash(content || '');
      }catch(e){}
    }
    return '';
  }

  function eventContext(){
    var rs = roots();
    for(var i=0;i<rs.length;i++){
      try{
        var ctx = contextOf(rs[i]);
        if(ctx && ctx.eventSource && ctx.event_types) return ctx;
      }catch(e){}
    }
    return null;
  }

  function compactRows(list, columns){
    return (list||[]).map(function(r){
      var out = {};
      columns.forEach(function(c){out[c] = r[c] == null ? '' : r[c];});
      return out;
    });
  }

  function summarizeTables(){
    var battleCols = ['人形名称','tdoll_name','当前生命','current_hp','最大生命','max_hp','出战位','battle_slot'];
    var enemyCols = ['敌人名称','enemy_name','当前生命','current_hp','最大生命','max_hp','出战位','battle_slot'];
    return {
      currentStatus: compactRows(rows('currentStatus'), ['当前位置','当前时间','天数','当前玩法','主角当前状态']),
      battleConfig: compactRows(rows('battleConfig'), battleCols),
      enemyConfig: compactRows(rows('enemyConfig'), enemyCols),
      existingMap: compactRows(rows('mapElements'), ['元素名称','元素类型','X坐标','Y坐标','状态','描述','所属区域','战术背景','legend'])
    };
  }

  function normalizeChatMessage(m){
    var role = m && (m.role || (m.is_user ? 'user' : 'assistant')) || 'assistant';
    var content = m && (m.message != null ? m.message : m.mes != null ? m.mes : m.content) || '';
    return {role:String(role), content:String(content).slice(-1800)};
  }

  function getRecentChat(){
    var rs = roots();
    for(var i=0;i<rs.length;i++){
      try{
        var TH = rs[i].TavernHelper;
        if(TH && typeof TH.getLastMessageId === 'function' && typeof TH.getChatMessages === 'function'){
          var last = TH.getLastMessageId();
          var result = TH.getChatMessages(Math.max(0,last-8)+'-'+last, {include_swipes:false});
          if(result && typeof result.then === 'function') return result.then(function(list){return (list||[]).slice(-8).map(normalizeChatMessage);});
          return Promise.resolve((result||[]).slice(-8).map(normalizeChatMessage));
        }
      }catch(e){}
    }
    for(var j=0;j<rs.length;j++){
      try{
        var ctx = contextOf(rs[j]);
        var chat = (ctx && (ctx.chat || ctx.Chat)) || (rs[j].SillyTavern && rs[j].SillyTavern.chat) || rs[j].chat;
        if(Array.isArray(chat) && chat.length) return Promise.resolve(chat.slice(-8).map(normalizeChatMessage));
      }catch(e){}
    }
    var api = getApi();
    if(api && typeof api.getStoryContext === 'function'){
      try{
        var story = api.getStoryContext(8);
        if(story) return Promise.resolve([{role:'assistant', content:String(story).slice(-6000)}]);
      }catch(e){}
    }
    return Promise.resolve([]);
  }

  function buildMessages(mode, reason, chat, preparedBaseMap){
    var isBase = mode !== 'combat';
    var tableSummary = isBase ? null : summarizeTables();
    var currentStatus = compactRows(rows('currentStatus'), ['当前位置','当前时间','天数','当前玩法','主角当前状态']);
    var required = mode === 'combat'
      ? [
        '必须参考出战配置表 battleConfig；若敌人配置表 enemyConfig 存在敌人，也必须同时参考。必须同时参考 existingMap：保留仍然合理的旧坐标、地标、障碍、出口和状态，只对已经变化或缺失的单位/地形做新增、删除或更新。输出必须是完整最终地图，不是补丁。所有已配置出战人形、已配置敌人、关键地标/障碍/出口应组成完整战场地图。enemyConfig 为空表示当前未遭遇敌人，不得为了凑数编造敌人。',
        '战斗地图不是单位散点图。除了所有必需单位外，必须根据最近剧情和当前章节生成可绘制的战场地形层：地标、障碍物、出口。除非最近剧情完全没有地点信息，否则至少输出 1 个地标、2 个障碍物、1 个出口或目标点。',
        '每个非单位元素必须有明确战术用途，禁止装饰性元素。元素类型只写系统大类：地形、环境、火力、交互、部署、事件、出口。具体战术含义必须写在状态字段的受控标签里，例如元素类型=地形，状态=[重掩体] 货柜横倒。不要把掩体、重掩体、火力点等战术标签写进元素类型。',
        '状态字段必须以受控战术标签开头，格式为：[标签] 简短状态说明。战术丰富度只扩展状态标签，不扩展元素类型。',
        '状态标签按大类选择：地形=[掩体]/[重掩体]/[封锁]/[高地]/[建筑]/[载具残骸]/[通路]/[狭窄通道]；环境=[危险地形]/[烟雾]/[火焰]/[积水]/[毒雾]/[电磁干扰]/[塌陷区]/[辐射区]；火力=[火力点]/[火力覆盖区]/[狙击线]/[压制区]/[爆炸范围]/[自动炮塔]；交互=[物资]/[终端]/[门禁]/[控制台]/[电源]/[通信装置]/[数据核心]/[爆破点]/[开关]/[锁定目标]；部署或事件=[我方部署点]/[敌方部署点]/[增援点]/[伏击点]/[巡逻路线]/[警戒装置]/[陷阱]/[地雷]/[倒计时事件]/[集结点]；出口=[入口]/[撤离点]/[突破口]。',
        '元素类型和状态标签必须匹配：元素类型=地形时优先使用地形标签；元素类型=环境时优先使用环境标签；元素类型=火力时优先使用火力标签；元素类型=交互时优先使用交互标签；元素类型=部署/事件时使用部署或事件标签；元素类型=出口时使用出口标签。',
        '标签选择规则示例：轻型遮蔽物用[掩体]；墙体/货柜/工事用[重掩体]；路障/不可通行用[封锁]；烟幕/粉尘遮挡用[烟雾]；机枪塔/炮位用[火力点]；被火力覆盖的区域用[火力覆盖区]或[压制区]；控制台/服务器/核心设备用[终端]/[控制台]/[数据核心]；铁门/闸门/门锁用[门禁]；地雷/警报器/自动防御用[地雷]/[警戒装置]/[自动炮塔]；增援入口用[增援点]或[入口]。',
        '所属区域必须写具体战区名，建议 2-4 个区域，例如：我方接入点、中央交火区、敌方阵地、撤离路线、指挥设施。属于同一空间的单位、地标、障碍物必须使用同一个所属区域。前端会按所属区域绘制区域底板。',
        '坐标必须体现战术关系：我方单位应靠近我方接入/掩体，敌方单位应靠近敌方阵地/火力点，障碍物应位于单位之间或关键通路旁，出口应位于地图边缘或撤离方向。不要把所有元素平均散开。',
        '必须遵守距离约束，避免元素揉在一起：任意两个单位中心距离至少 70；任意单位和非单位地形中心距离至少 46；任意两个非单位地形中心距离至少 52。同一区域内可以相邻但不能重叠，不同区域应明显分开。',
        '战斗模式推荐布局范围：我方接入/初始阵地优先在 x=90-300；中央交火/障碍优先在 x=280-520；敌方阵地优先在 x=500-720；撤离点/入口/出口优先贴近地图边缘但不得超出 45-755,95-545 的可视边界。若剧情明确指定方向，以剧情为准，但仍必须满足最小间距。',
        '如果同一阵营有多名单位，请按小队形展开，不要重叠：横向或纵向间隔建议 75-120。障碍物应作为掩体线或封锁点分布在通路旁，而不是堆在单位脚下。',
        '战术背景字段必须解释这个元素为什么存在于战场上，例如“塌陷货柜提供侧向掩护”“废弃闸门是撤离路线”“铁血火力点控制中央通道”。'
      ].join('\n')
      : '必须参考 baseFacilities：它是完整固定基地底图，包括作战指挥室、编队整备室、人形宿舍、建造工坊、修复中心、仓储库房、后勤调度室、情报与模拟室、主通道。基地模式下不要输出这些固定设施，不要改写这些设施，只输出有上下文依据的角色/NPC基地位置。撤退时必须以 baseFacilities 作为角色落位的空间依据。信息不足时返回空数组。';
    var payload = isBase
      ? {mode:mode, reason:reason, currentMap:preparedBaseMap || clone(BASE_ITEMS), baseFacilities:clone(BASE_ITEMS), currentStatus:currentStatus, recentChat:chat}
      : {mode:mode, reason:reason, tables:tableSummary, recentChat:chat};
    return [
      {role:'system', content:'你是少女前线战术地图生成器。只输出 JSON，不要输出解释。地图不允许编造：不能确定就少给或给空数组。坐标必须符合 SVG viewBox 0..800 x 0..600。'},
      {role:'user', content:[
        '<GFL_MAP_SYNC_REQUEST>',
        required,
        isBase ? '基地模式输入中的 currentMap 已经由前端净化：包含完整基地设施和允许保留的自由人形/NPC。你只能基于 currentMap 调整人形/NPC位置；固定基地设施由前端保底。' : '输入中的 tables.existingMap 是当前地图元素表快照。生成时必须先判断旧元素是否仍符合当前出战配置、敌方配置和最近聊天。能保留则保留；需要变化才更新；已经不符合当前状态的元素必须移除。',
        '输出格式：{"items":[{"元素名称":"...","元素类型":"主角|友方|敌方|NPC|地形|环境|火力|交互|部署|事件|出口","X坐标":0,"Y坐标":0,"状态":"...","描述":"...","所属区域":"...","战术背景":"..."}]}',
        mode === 'combat' ? '战斗模式检查：必须包含所有 battleConfig 人形、所有 enemyConfig 敌人；有剧情地点时必须包含有用途的地标/障碍物/出口；所属区域不得留空；非单位元素的状态必须以受控标签开头。' : '',
        '输入数据：',
        JSON.stringify(payload),
        '</GFL_MAP_SYNC_REQUEST>'
      ].join('\n')}
    ];
  }

  function parseAiItems(text){
    var raw = String(text || '').trim();
    var fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if(fenced) raw = fenced[1].trim();
    var first = raw.indexOf('{'), last = raw.lastIndexOf('}');
    if(first >= 0 && last > first) raw = raw.slice(first, last + 1);
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
  }

  function normalizeAiRow(it){
    var name = trim(it && (it['元素名称'] || it.element_name || it.name));
    var type = trim(it && (it['元素类型'] || it.element_type || it.type));
    var allowed = {
      '主角':1,'友方':1,'敌方':1,'NPC':1,'地形':1,'环境':1,'火力':1,'交互':1,'部署':1,'事件':1,'地标':1,'障碍物':1,'出口':1,
      'protagonist':1,'ally':1,'enemy':1,'npc':1,'terrain':1,'environment':1,'fire':1,'interactive':1,'deployment':1,'event':1,'landmark':1,'obstacle':1,'exit':1
    };
    var x = num(it && (it['X坐标'] != null ? it['X坐标'] : it.pos_x != null ? it.pos_x : it.x), NaN);
    var y = num(it && (it['Y坐标'] != null ? it['Y坐标'] : it.pos_y != null ? it.pos_y : it.y), NaN);
    if(!name || !allowed[type] || isNaN(x) || isNaN(y) || x < 0 || x > 800 || y < 0 || y > 600) return null;
    return row(name,type,x,y,trim(it['状态'] || it.element_status || it.status),trim(it['所属区域'] || it.region),trim(it['描述'] || it.element_desc || it.desc || it['战术背景'] || it.legend),trim(it['战术背景'] || it.legend));
  }

  function validateItems(items, mode){
    var normalized = (items||[]).map(normalizeAiRow).filter(Boolean);
    if(mode !== 'combat') return normalized;
    var need = {};
    rows('battleConfig').forEach(function(r){var n=trim(field(r,['人形名称','tdoll_name','name']));if(n)need[n]='友方';});
    rows('enemyConfig').forEach(function(r){var n=trim(field(r,['敌人名称','enemy_name','name']));if(n)need[n]='敌方';});
    var seen = {};
    normalized.forEach(function(r){seen[trim(r['元素名称'])]=r['元素类型'];});
    var missing = Object.keys(need).filter(function(name){return !seen[name];});
    if(missing.length) throw new Error('AI 地图缺少已配置的出战/敌人单位: '+missing.join('、'));
    return relaxCombatSpacing(normalized);
  }

  function isCombatUnitType(type){
    return ['主角','友方','敌方','NPC','protagonist','ally','enemy','npc'].indexOf(trim(type)) >= 0;
  }

  function dist(a, b){
    var ax = num(a && a['X坐标'], 0), ay = num(a && a['Y坐标'], 0);
    var bx = num(b && b['X坐标'], 0), by = num(b && b['Y坐标'], 0);
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function minSpacingFor(a, b){
    var au = isCombatUnitType(a && a['元素类型']);
    var bu = isCombatUnitType(b && b['元素类型']);
    if(au && bu) return 70;
    if(au || bu) return 46;
    return 52;
  }

  function clampMapX(value){
    return Math.max(45, Math.min(755, Math.round(value)));
  }

  function clampMapY(value){
    return Math.max(95, Math.min(545, Math.round(value)));
  }

  function relaxCombatSpacing(items){
    var out = clone(items || []);
    for(var pass=0; pass<8; pass++){
      var changed = false;
      for(var i=0;i<out.length;i++){
        for(var j=i+1;j<out.length;j++){
          var min = minSpacingFor(out[i], out[j]);
          var ax = num(out[i]['X坐标'], 0), ay = num(out[i]['Y坐标'], 0);
          var bx = num(out[j]['X坐标'], 0), by = num(out[j]['Y坐标'], 0);
          var dx = bx - ax, dy = by - ay;
          var d = Math.sqrt(dx * dx + dy * dy);
          if(d >= min) continue;
          if(d < 1){
            var seed = (i + 1) * 37 + (j + 1) * 19;
            dx = Math.cos(seed) || 1;
            dy = Math.sin(seed) || .5;
            d = Math.sqrt(dx * dx + dy * dy);
          }
          var push = (min - d) / 2 + 3;
          var ux = dx / d, uy = dy / d;
          out[i]['X坐标'] = clampMapX(ax - ux * push);
          out[i]['Y坐标'] = clampMapY(ay - uy * push);
          out[j]['X坐标'] = clampMapX(bx + ux * push);
          out[j]['Y坐标'] = clampMapY(by + uy * push);
          changed = true;
        }
      }
      if(!changed) break;
    }
    return out;
  }

  function baseNameMap(){
    var out = {};
    BASE_ITEMS.forEach(function(it){out[trim(it['元素名称'])]=true;});
    return out;
  }

  function isBaseFreeUnit(it){
    var type = trim(it && it['元素类型']);
    return ['主角','友方','NPC','protagonist','ally','npc'].indexOf(type) >= 0;
  }

  function sanitizeBaseItems(items){
    var baseNames = baseNameMap();
    var seen = {};
    var out = clone(BASE_ITEMS);
    out.forEach(function(it){seen[trim(it['元素名称'])]=true;});
    (items||[]).forEach(function(it){
      var name = trim(it && it['元素名称']);
      if(!name || baseNames[name] || seen[name] || !isBaseFreeUnit(it)) return;
      out.push(it);
      seen[name]=true;
    });
    return out;
  }

  function mergeBaseItems(aiItems){
    return sanitizeBaseItems((aiItems||[]));
  }

  function writeMapRows(items, drawToken, mode){
    items = items || [];
    if(drawToken != null) assertFresh(drawToken, mode);
    if(!Bridge || typeof Bridge.executeSqlBatch !== 'function') return Promise.reject(new Error('GFLDataBridge.executeSqlBatch 不可用，无法写入地图元素表'));
    function lit(value){return value==null?'NULL':'\''+String(value).replace(/'/g,"''")+'\'';}
    var statements = ['DELETE FROM map_elements'];
    items.forEach(function(it){
      statements.push('INSERT INTO map_elements (element_name, element_type, pos_x, pos_y, element_status, element_desc, region, legend) VALUES ('+
        [lit(it['元素名称']),lit(it['元素类型']),parseInt(it['X坐标'],10)||0,parseInt(it['Y坐标'],10)||0,lit(it['状态']),lit(it['描述']),lit(it['所属区域']),lit(it['战术背景'])].join(', ')+')');
    });
    return Bridge.executeSqlBatch({sql:statements.join(';\n')+';', targetSheetKeys:['sheet_MapElements']}).then(function(){
      if(drawToken != null) assertFresh(drawToken, mode);
      return items.length;
    });
  }

  function currentMapItems(){
    return rows('mapElements').map(function(r){return normalizeAiRow(r);}).filter(Boolean);
  }

  function staleError(message){
    var error = new Error(message || '地图绘制请求已过期');
    error.stale = true;
    return error;
  }

  function assertFresh(drawToken, mode){
    if(drawToken !== drawVersion) throw staleError('旧地图绘制请求已被新请求取代');
    var active = combatActive();
    if(mode === 'combat' && !active) throw staleError('战斗地图返回时已不在出击状态');
    if(mode !== 'combat' && active) throw staleError('基地地图返回时已切入出击状态');
  }

  function callAiForMap(mode, reason, preparedBaseMap){
    var api = getApi();
    if(!api || typeof api.callAI !== 'function') return Promise.resolve([]);
    return getRecentChat().then(function(chat){
      var messages = buildMessages(mode, reason, chat, preparedBaseMap);
      return api.callAI(messages, {max_tokens:30000});
    }).then(function(text){
      return validateItems(parseAiItems(text), mode);
    });
  }

  function sync(options){
    options = options || {};
    var mode = options.mode || (combatActive() ? 'combat' : 'base');
    var reason = options.reason || 'manual';
    var key = mode + ':' + reason + ':' + (combatActive() ? '1' : '0') + ':' + (options.roundKey || 'direct');
    if(inFlight){
      if(options.force){
        drawVersion += 1;
        inFlight = null;
        lastSyncKey = '';
      } else {
        return inFlight;
      }
    }
    if(!options.force && key === lastSyncKey) return Promise.resolve({skipped:true, mode:mode});
    lastSyncKey = key;
    var drawToken = drawVersion += 1;
    var preparedBaseMap = null;
    var prepare = Promise.resolve();
    if(mode === 'base'){
      preparedBaseMap = reason === 'retreat' ? clone(BASE_ITEMS) : sanitizeBaseItems(currentMapItems());
    } else if(reason === 'combatStart'){
      prepare = writeMapRows([], drawToken, mode);
    }
    var syncPromise = prepare.then(function(){
      assertFresh(drawToken, mode);
      return callAiForMap(mode, reason, preparedBaseMap);
    }).then(function(aiItems){
      assertFresh(drawToken, mode);
      var finalItems = mode === 'base' ? mergeBaseItems(aiItems) : (aiItems || []);
      assertFresh(drawToken, mode);
      return writeMapRows(finalItems, drawToken, mode).then(function(count){return {ok:true, mode:mode, count:count, items:clone(finalItems)};});
    }).catch(function(error){
      if(error && error.stale){
        console.info('GFLMapSync 丢弃过期地图绘制结果:', error.message || error);
        return {stale:true, mode:mode, count:0, error:String(error && error.message || error)};
      }
      try{ assertFresh(drawToken, mode); }catch(stale){
        console.info('GFLMapSync 丢弃过期地图失败回退:', stale.message || stale);
        return {stale:true, mode:mode, count:0, error:String(stale && stale.message || stale)};
      }
      console.warn('GFLMapSync 同步失败，拒绝写入不可靠地图:', error);
      if(mode === 'base') return writeMapRows(BASE_ITEMS, drawToken, mode).then(function(count){return {ok:false, mode:mode, count:count, error:String(error && error.message || error)};});
      return writeMapRows([], drawToken, mode).then(function(){return {ok:false, mode:mode, count:0, error:String(error && error.message || error)};});
    }).finally(function(){if(inFlight === syncPromise) inFlight=null;});
    inFlight = syncPromise;
    return inFlight;
  }

  window.GFLMapSync = {
    baseItems:function(){return clone(BASE_ITEMS);},
    redraw:function(){
      if(inFlight) return inFlight;
      return sync({reason:'manual', force:true});
    },
    readDatabaseItems:function(){return currentMapItems();}
  };

  function handleMessageReceived(){
    var key = latestAssistantRoundKey() || currentRoundKey();
    if(!key || key === 'unknown' || key === autoLastRoundKey) return;
    autoLastRoundKey = key;
    sync({reason:'round', roundKey:key}).catch(function(error){
      console.warn('GFLMapSync AI 回复后地图绘制失败:', error);
    });
  }

  function startAutoRoundSync(){
    if(!isStandbyHost() || messageReceivedBound) return;
    var ctx = eventContext();
    var eventName = ctx && ctx.event_types && ctx.event_types.MESSAGE_RECEIVED;
    if(!ctx || !ctx.eventSource || !eventName || typeof ctx.eventSource.on !== 'function'){
      console.warn('GFLMapSync 未找到 SillyTavern MESSAGE_RECEIVED 事件，自动每轮绘制未启用；仍可使用地图页 AI重绘地图。');
      return;
    }
    autoLastRoundKey = latestAssistantRoundKey();
    ctx.eventSource.on(eventName, handleMessageReceived);
    messageReceivedBound = true;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAutoRoundSync, {once:true});
  else startAutoRoundSync();
})();
