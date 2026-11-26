/* GFL frontend data bridge.
 *
 * Centralizes access to shujuku tables and Bubble asset APIs so individual pages
 * do not duplicate fragile table parsing or iframe API lookup code.
 */
(function(){
  'use strict';

  var TABLES = {
    currentStatus: {uid:'sheet_current_status', name:'全局数据表', ddlName:'current_status'},
    tdollWarehouse: {uid:'sheet_tdoll_warehouse', name:'人形仓库表', ddlName:'tdoll_warehouse'},
    tdollSkins: {uid:'sheet_tdoll_skins', name:'人形皮肤表', ddlName:'tdoll_skins'},
    battleConfig: {uid:'sheet_battle_config', name:'出战配置表', ddlName:'battle_config'},
    enemyConfig: {uid:'sheet_enemy_config', name:'敌人配置表', ddlName:'enemy_config'},
    enemyData: {uid:'sheet_enemy_data', name:'敌人资料表', ddlName:'enemy_data'},
    resourceStatus: {uid:'sheet_resource_status', name:'资源表', ddlName:'resource_status'},
    constructionQueue: {uid:'sheet_tdoll_construction', name:'人形建造表', ddlName:'tdoll_construction'},
    equipmentCatalog: {uid:'sheet_equipment_catalog', name:'装备图鉴表', ddlName:'equipment_catalog'},
    equipmentWarehouse: {uid:'sheet_equipment_warehouse', name:'装备仓库表', ddlName:'equipment_warehouse'},
    tdollEquipment: {uid:'sheet_tdoll_equipment', name:'人形装备栏表', ddlName:'tdoll_equipment'},
    equipmentConstruction: {uid:'sheet_equipment_construction', name:'装备制造表', ddlName:'equipment_construction'},
    logisticsTasks: {uid:'sheet_logistics_tasks', name:'后勤任务表', ddlName:'logistics_tasks'},
    logisticsSquads: {uid:'sheet_logistics_squads', name:'后勤队列表', ddlName:'logistics_squads'},
    currentTasks: {uid:'sheet_current_tasks', name:'当前任务表', ddlName:'current_tasks'},
    currentChapter: {uid:'sheet_current_chapter', name:'当前章节表', ddlName:'current_chapter'},
    totalChapters: {uid:'sheet_total_chapters', name:'总章节表', ddlName:'total_chapters'},
    storyFlags: {uid:'sheet_story_flags', name:'剧情标记表', ddlName:'story_flags'},
    mapElements: {uid:'sheet_MapElements', name:'地图元素表', ddlName:'map_elements'}
  };

  function clone(value){
    if(value == null) return value;
    try{ return JSON.parse(JSON.stringify(value)); }catch(e){ return value; }
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function pickWindowApi(prop){
    var scopes = [];
    try{ scopes.push(window); }catch(e){}
    try{ if(window.parent && window.parent !== window) scopes.push(window.parent); }catch(e){}
    try{ if(window.top && window.top !== window.parent) scopes.push(window.top); }catch(e){}
    for(var i=0;i<scopes.length;i++){
      try{ if(scopes[i] && scopes[i][prop]) return scopes[i][prop]; }catch(e){}
    }
    return null;
  }

  function rootWindows(){
    var out = [];
    function add(root){ if(root && out.indexOf(root) < 0) out.push(root); }
    try{ add(window); }catch(e){}
    try{ add(window.parent); }catch(e){}
    try{ add(window.top); }catch(e){}
    return out;
  }

  function getApi(){ return pickWindowApi('AutoCardUpdaterAPI'); }
  function getBubbleCG(){ return pickWindowApi('BubbleCG'); }
  function getBubbleAvatar(){ return pickWindowApi('BubbleAvatar'); }
  function getBubbleLive2D(){ return pickWindowApi('BubbleLive2D'); }

  function sqlApi(){
    var api = getApi();
    return api && (typeof api.queryTableRows === 'function' || typeof api.executeSqlBatch === 'function' || typeof api.executeSqlMutation === 'function') ? api : null;
  }

  function requireSqlApi(method){
    var api = getApi();
    if(!api || typeof api[method] !== 'function') throw new Error('AutoCardUpdaterAPI.' + method + ' 不可用；控制台不再使用全库导入或 CRUD 降级');
    return api;
  }

  function waitForApi(getter, options){
    options = options || {};
    var timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 6000;
    var intervalMs = typeof options.intervalMs === 'number' ? options.intervalMs : 250;
    var label = options.label || 'API';
    var started = Date.now();
    return new Promise(function(resolve, reject){
      function tick(){
        var api = getter();
        if(api){ resolve(api); return; }
        if(Date.now() - started >= timeoutMs){ reject(new Error(label + ' 未就绪')); return; }
        setTimeout(tick, intervalMs);
      }
      tick();
    });
  }

  function ddlTableName(sheet){
    var ddl = sheet && sheet.sourceData && sheet.sourceData.ddl ? String(sheet.sourceData.ddl) : '';
    var m = ddl.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w]+)\b/i);
    return m ? m[1] : '';
  }

  function ddlColumnMap(sheet){
    var map = {};
    var ddl = sheet && sheet.sourceData && sheet.sourceData.ddl ? String(sheet.sourceData.ddl) : '';
    ddl.split('\n').forEach(function(line){
      var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\b[^-]*--\s*([^,\n]+)/);
      if(m){
        map[m[1]] = m[1];
        map[m[2].trim()] = m[1];
      }
    });
    map.row_id = 'row_id';
    map['行号'] = 'row_id';
    return map;
  }

  function sheetMatchesTableName(sheet, tableName){
    var wanted = String(tableName || '').trim();
    if(!sheet || !wanted) return false;
    return sheet.name === wanted || ddlTableName(sheet) === wanted;
  }

  function getSheet(tables, uid, name, ddlName){
    if(!tables) return null;
    var names = [name, ddlName].filter(function(v){ return String(v || '').trim(); });
    for(var n=0;n<names.length;n++){
      for(var k in tables){
        if(!Object.prototype.hasOwnProperty.call(tables, k)) continue;
        if(sheetMatchesTableName(tables[k], names[n])) return tables[k];
      }
    }
    if(name && tables[name]) return tables[name];
    if(ddlName && tables[ddlName]) return tables[ddlName];
    if(uid && tables[uid]) return tables[uid];
    for(var key in tables){
      if(!Object.prototype.hasOwnProperty.call(tables, key)) continue;
      var sheet = tables[key];
      if(sheet && uid && sheet.uid === uid) return sheet;
    }
    return null;
  }

  function tableDef(tableKey){
    if(TABLES[tableKey]) return TABLES[tableKey];
    var name = String(tableKey || '').trim();
    for(var key in TABLES){
      if(!Object.prototype.hasOwnProperty.call(TABLES, key)) continue;
      var def = TABLES[key];
      if(def && (def.name === name || def.uid === name || def.ddlName === name)) return def;
    }
    return {name:name, ddlName:name};
  }

  var COLUMN_LABELS = {
    current_status:{current_location:'当前位置',cur_time:'当前时间',day_count:'天数'},
    tdoll_warehouse:{tdoll_name:'人形名称',weapon_type:'枪种',rarity:'星级',data:'数据',can_neural_upgrade:'是否可以心智改造',neural_upgraded:'是否已心智改造',mod_data:'改造后的MOD数据',acquired:'是否已获取',current_skin:'当前皮肤',damage_state:'损伤状态'},
    tdoll_skins:{tdoll_name:'人形名称',skin_list:'皮肤列表'},
    battle_config:{tdoll_name:'人形名称',battle_slot:'出战位',current_hp:'当前生命',max_hp:'最大生命',damage:'伤害',accuracy:'命中',evasion:'回避',rate_of_fire:'射速',armor:'护甲',movement:'移动',armor_piercing:'穿甲',critical_rate:'暴击',ammo_chain:'弹链'},
    enemy_config:{enemy_name:'敌人名称',battle_slot:'出战位',current_hp:'当前生命',max_hp:'最大生命',damage:'伤害',accuracy:'命中',evasion:'回避',rate_of_fire:'射速',armor:'护甲',movement:'移动',armor_piercing:'穿甲',critical_rate:'暴击',ammo_chain:'弹链'},
    enemy_data:{enemy_name:'敌人名称',enemy_type:'敌人类型',threat_level:'威胁等级',base_grade:'基础档位',boss_flag:'Boss标记',chapter_binding:'章节绑定',tags:'标签',stat_template:'属性模板',skill_summary:'技能摘要',story_role:'剧情定位',data_source:'数据来源'},
    resource_status:{resource_name:'资源项',amount:'数量'},
    tdoll_construction:{cost_manpower:'消耗人力',cost_ammo:'消耗弹药',cost_ration:'消耗口粮',cost_parts:'消耗零件',start_time:'开始时间',construction_time:'建造时间'},
    equipment_catalog:{equipment_id:'装备ID',equipment_name:'装备名称',equipment_category:'装备类别',slot_type:'槽位类型',rarity:'星级',allowed_weapon_types:'可装备枪种',allowed_tdoll_names:'特定人形白名单',stat_min:'属性生成下限',stat_max:'属性生成上限',max_level:'最高强化等级',enhance_growth:'强化成长规则',calibration_fields:'可校准属性',rule_tags:'规则标签',recipe_tags:'制造配方标签',construction_time:'制造时间',construction_weight:'制造权重',dismantle_yield:'分解产出',description:'描述'},
    equipment_warehouse:{equipment_id:'装备ID',base_stats:'实例基础属性',stats:'实例当前属性',level:'强化等级',calibration:'校准记录',exp:'强化经验',locked:'是否锁定',acquired:'是否拥有',source:'来源'},
    tdoll_equipment:{tdoll_name:'人形名称',slot_type:'槽位类型',equipment_row_id:'装备仓库行号'},
    equipment_construction:{start_time:'开始时间',construction_time:'制造时间',cost_manpower:'消耗人力',cost_ammo:'消耗弹药',cost_ration:'消耗口粮',cost_parts:'消耗零件',recipe_type:'配方类型',result_seed:'结果种子',result_equipment_id:'结果装备ID',candidate_pool_hash:'候选池哈希'},
    logistics_tasks:{task_name:'任务名称',task_difficulty:'任务难度',required_hg:'HG数量要求',required_smg:'SMG数量要求',required_rf:'RF数量要求',required_ar:'AR数量要求',required_mg:'MG数量要求',required_sg:'SG数量要求',assigned_squad:'执行人形小队',start_time:'开始时间',duration:'任务时长',reward_manpower:'奖励人力',reward_ammo:'奖励弹药',reward_ration:'奖励口粮',reward_parts:'奖励零件',reward_memory_core:'奖励心智核心'},
    logistics_squads:{squad_name:'小队名',tdoll_list:'人形列表',total_stars:'总星级',hg_count:'HG数量',smg_count:'SMG数量',rf_count:'RF数量',ar_count:'AR数量',mg_count:'MG数量',sg_count:'SG数量'},
    current_tasks:{task_name:'任务名称',task_source:'任务来源',task_type:'任务类型',priority:'优先级',description:'描述',trigger_basis:'触发依据',completion_condition:'完成条件',failure_condition:'失败条件',status:'状态'},
    current_chapter:{chapter_name:'章节名',current_stage:'当前阶段',sortie_state:'出击状态',sortie_area:'出击地区'},
    total_chapters:{chapter_name:'章节名',chapter_type:'章节类型',chapter_status:'状态'},
    story_flags:{flag_name:'标记名称',is_triggered:'是否触发'},
    map_elements:{element_name:'元素名称',element_type:'元素类型',pos_x:'X坐标',pos_y:'Y坐标',element_status:'状态',element_desc:'描述',region:'所属区域',legend:'战术背景'}
  };

  function addDisplayLabels(row, tableKey){
    var def = tableDef(tableKey);
    var labels = COLUMN_LABELS[def.ddlName] || {};
    Object.keys(labels).forEach(function(en){
      if(row[en] !== undefined && row[labels[en]] === undefined) row[labels[en]] = row[en];
    });
    return row;
  }

  function tableNameForApi(tableKey){
    var def = tableDef(tableKey);
    return def.ddlName || def.name || String(tableKey || '').trim();
  }

  function sheetKeyForTable(tableKey){
    var def = tableDef(tableKey);
    return def.uid || null;
  }

  function columnNameForSql(tableKey, colIdentifier){
    if(typeof colIdentifier === 'number') return colIdentifier;
    var name = String(colIdentifier || '').trim();
    if(!name) return name;
    var def = tableDef(tableKey);
    var labels = COLUMN_LABELS[def.ddlName] || {};
    for(var en in labels){
      if(Object.prototype.hasOwnProperty.call(labels, en) && labels[en] === name) return en;
    }
    return labels[name] ? name : name;
  }

  function normalizeSqlData(tableKey, data){
    var out = {};
    Object.keys(data || {}).forEach(function(key){
      var col = columnNameForSql(tableKey, key);
      if(col && col !== 'row_id') out[col] = data[key];
    });
    return out;
  }

  function getTable(tableKey, tables){
    if(!tables) throw new Error('GFLDataBridge.getTable 禁止隐式全库读取：' + tableKey);
    var def = tableDef(tableKey);
    return getSheet(tables, def.uid, def.name, def.ddlName);
  }

  function normalizeRowObject(row, rowIndex){
    var out = clone(row) || {};
    if(out.__rowIndex__ == null) out.__rowIndex__ = rowIndex;
    return out;
  }

  function rowsOf(sheet){
    if(!sheet) return [];
    if(Array.isArray(sheet)){
      if(sheet.length < 2) return [];
      var rawHead = Array.isArray(sheet[0]) ? sheet[0].slice(1) : [];
      return sheet.slice(1).filter(function(r){ return Array.isArray(r) && r.length > 1; }).map(function(r, i){
        var out = {__rowIndex__: i + 1};
        rawHead.forEach(function(h, idx){ out[h] = r[idx + 1]; });
        return out;
      });
    }
    if(Array.isArray(sheet.rows)) return sheet.rows.map(function(r,i){ return normalizeRowObject(r, i + 1); });
    if(Array.isArray(sheet.data)) return sheet.data.map(function(r,i){ return normalizeRowObject(r, i + 1); });
    if(!Array.isArray(sheet.content) || sheet.content.length < 2) return [];
    var head = sheet.content[0].slice(1);
    return sheet.content.slice(1).filter(function(r){ return r && r.length > 1; }).map(function(r, i){
      var out = {__rowIndex__: i + 1};
      head.forEach(function(h, idx){ out[h] = r[idx + 1]; });
      return out;
    });
  }

  function normalizeSqlRows(result){
    if(!result || !Array.isArray(result.rows)) return [];
    return result.rows.map(function(row, i){
      var out = normalizeRowObject(row, i + 1);
      if(out.row_id != null && out.row_id !== '') out.__rowIndex__ = out.row_id;
      else if(out.rowId != null && out.rowId !== '') out.__rowIndex__ = out.rowId;
      else if(out.__rowIndex__ == null) out.__rowIndex__ = i + 1;
      return out;
    });
  }

  function sqlValue(value){
    if(value == null) return 'NULL';
    if(typeof value === 'number' && isFinite(value)) return String(value);
    if(typeof value === 'boolean') return value ? '1' : '0';
    return '\'' + String(value).replace(/'/g, "''") + '\'';
  }

  function queryRows(tableKey, options){
    options = options || {};
    var api = requireSqlApi('queryTableRows');
    try{
      return normalizeSqlRows(api.queryTableRows({
        tableName: tableNameForApi(tableKey),
        orderBy: options.orderBy || {column:'row_id', direction:'ASC'},
        limit: options.limit || 1000,
        offset: options.offset || 0
      })).map(function(row){ return addDisplayLabels(row, tableKey); });
    }catch(e){
      throw new Error('GFLDataBridge queryTableRows 失败：' + tableKey + ' / ' + (e && e.message ? e.message : e));
    }
  }

  function rows(tableKey, tables){
    if(!tables) return queryRows(tableKey);
    return rowsOf(getTable(tableKey, tables));
  }

  function field(row, names, fallback){
    if(!row) return fallback == null ? '' : fallback;
    for(var i=0;i<names.length;i++){
      var v = row[names[i]];
      if(v !== undefined && v !== null && String(v) !== '') return v;
    }
    return fallback == null ? '' : fallback;
  }

  function num(value, fallback){
    var n = parseInt(value, 10);
    return isNaN(n) ? (fallback == null ? 0 : fallback) : n;
  }

  function yes(value){ return String(value || '').trim() === '是'; }

  function rarityNumber(value){
    var text = String(value || '');
    var m = text.match(/[1-6]/);
    if(m) return parseInt(m[0], 10);
    var stars = text.match(/★/g);
    return stars ? stars.length : 0;
  }

  function parseStats(text){
    var out = {};
    String(text || '').split(/[，,]/).forEach(function(part){
      var m = part.trim().match(/^([^0-9+\-]+)\s*([+\-]?\d+)/);
      if(!m) return;
      var key = m[1].trim();
      var value = parseInt(m[2], 10);
      if(isNaN(value)) return;
      var map = {
        '生命':'hp', '最大生命':'hp', '伤害':'damage', '命中':'accuracy', '回避':'evasion',
        '射速':'rof', '护甲':'armor', '移动':'movement', '移速':'movement',
        '穿甲':'armorPiercing', '暴击':'critRate', '弹链':'ammoChain',
        '暴伤':'critDamage', '暴击伤害':'critDamage', '夜战抵消':'nightAccuracyOffset',
        '换弹':'reloadSpeed', '前置冷却':'initialCooldown', '全队命中':'teamAccuracy'
      };
      out[map[key] || key] = value;
    });
    return out;
  }

  function normalizeSkinName(name){
    return String(name || '').replace(/（l2d）|\(l2d\)/ig, '').trim();
  }

  function safeImageGroupPart(value){
    return String(value || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名';
  }

  function skinImageGroup(tdollName, skinName){
    var cleanSkin = normalizeSkinName(skinName) || '默认立绘';
    var cleanTdoll = String(tdollName || '').trim();
    if(!cleanTdoll) return cleanSkin;
    return safeImageGroupPart(cleanTdoll) + '_' + safeImageGroupPart(cleanSkin);
  }

  function isLive2DSkinName(name){ return /（l2d）|\(l2d\)/i.test(String(name || '')); }

  function splitSkinList(text, tdollName){
    return String(text || '').split('、').map(function(raw){
      var label = raw.trim();
      if(!label) return null;
      var cleanLabel = normalizeSkinName(label);
      return {label:cleanLabel, rawLabel:label, live2d:isLive2DSkinName(label), imageGroup:skinImageGroup(tdollName, cleanLabel)};
    }).filter(Boolean);
  }

  function getSkinRowMap(tables){
    var map = Object.create(null);
    rows('tdollSkins', tables).forEach(function(row){
      var name = String(field(row, ['人形名称','tdoll_name','name'])).trim();
      if(name) map[name] = row;
    });
    return map;
  }

  function tdollFromWarehouseRow(row, skinMap){
    var name = String(field(row, ['人形名称','tdoll_name','name'])).trim();
    var currentSkin = normalizeSkinName(field(row, ['当前皮肤','current_skin'], '默认立绘')) || '默认立绘';
    var damageState = String(field(row, ['损伤状态','damage_state'], '正常')).trim() || '正常';
    var baseStats = parseStats(field(row, ['数据','data']));
    var modStats = parseStats(field(row, ['改造后的MOD数据','mod_data']));
    var skinRow = skinMap && skinMap[name];
    var skins = skinRow ? splitSkinList(field(skinRow, ['皮肤列表','skin_list']), name) : [{label:currentSkin, rawLabel:currentSkin, live2d:false, imageGroup:skinImageGroup(name, currentSkin)}];
    if(!skins.length) skins = [{label:'默认立绘', rawLabel:'默认立绘', live2d:false, imageGroup:skinImageGroup(name, '默认立绘')}];
    return {
      rowIndex: row.__rowIndex__,
      name: name,
      type: String(field(row, ['枪种','weapon_type','type'])).trim(),
      stars: rarityNumber(field(row, ['星级','rarity','stars'])),
      acquired: yes(field(row, ['是否已获取','acquired'])),
      canMod: yes(field(row, ['是否可以心智改造','can_neural_upgrade'])),
      modded: yes(field(row, ['是否已心智改造','neural_upgraded'])),
      currentSkin: currentSkin,
      damageState: damageState,
      damaged: damageState === '大破' || damageState === '损坏',
      repairCost: damageState === '损坏' ? 200 : (damageState === '大破' ? 100 : 0),
      currentSkinGroup: skinImageGroup(name, currentSkin),
      skins: skins,
      baseStats: baseStats,
      modStats: Object.keys(modStats).length ? modStats : null,
      raw: row
    };
  }

  function ownedTdolls(tables){
    var skinMap = getSkinRowMap(tables);
    return warehouseTdolls(tables, skinMap).filter(function(t){ return t.name && t.acquired; });
  }

  function warehouseTdolls(tables, skinMap){
    skinMap = skinMap || getSkinRowMap(tables);
    return rows('tdollWarehouse', tables).map(function(row){ return tdollFromWarehouseRow(row, skinMap); })
      .filter(function(t){ return t.name; });
  }

  function resourceState(tables){
    var list = rows('resourceStatus', tables);
    var row = list[0] || {};
    var byName = {};
    list.forEach(function(item){
      var name = String(field(item, ['资源项','resource_name','name'])).trim();
      if(name) byName[name] = item;
    });
    function resourceAmount(displayName, legacyKey){
      if(byName[displayName]) return num(field(byName[displayName], ['数量','amount','value']), 0);
      return num(field(row, [displayName, legacyKey]), 0);
    }
    return {
      rowIndex: row.__rowIndex__ || 1,
      manpower: resourceAmount('人力','manpower'),
      ammo: resourceAmount('弹药','ammo'),
      ration: resourceAmount('口粮','ration'),
      parts: resourceAmount('零件','parts'),
      memoryCore: resourceAmount('心智核心','memory_core'),
      enhanceMaterial: resourceAmount('强化材料','enhance_material'),
      calibrationTicket: resourceAmount('校准券','calibration_ticket'),
      raw: row
    };
  }

  function splitList(text){ return String(text || '').split(/[,，、]/).map(function(v){return v.trim();}).filter(function(v){return v && v !== '-' && v !== '无' && v.toLowerCase() !== 'none';}); }
  function statKey(name){ var parsed = parseStats(String(name || '') + '0'); return Object.keys(parsed)[0] || String(name || '').trim(); }
  function statText(stats){
    var names = {hp:'生命',damage:'伤害',accuracy:'命中',evasion:'回避',rof:'射速',armor:'护甲',movement:'移动',armorPiercing:'穿甲',critRate:'暴击',ammoChain:'弹链',critDamage:'暴伤',nightAccuracyOffset:'夜战抵消',reloadSpeed:'换弹',initialCooldown:'前置冷却',teamAccuracy:'全队命中'};
    return Object.keys(stats || {}).map(function(k){return (names[k] || k) + stats[k];}).join('，');
  }
  function parseStatsRange(text){
    var out = {};
    String(text || '').split(/[;；]/).forEach(function(part){
      var m = part.trim().match(/^([^=]+)=(-?\d+)(?:~(-?\d+))?$/);
      if(!m) return;
      var key = statKey(m[1]);
      out[key] = {min:num(m[2],0), max:num(m[3] == null ? m[2] : m[3],0)};
    });
    return out;
  }
  function stableHash(text){ var h=2166136261, s=String(text||''); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function rangeValue(seed, key, range){ var min=range.min, max=range.max; if(max<min){var t=min;min=max;max=t;} return min + (stableHash(seed + '|' + key) % (max - min + 1)); }
  function equipmentCatalogRows(tables){
    return rows('equipmentCatalog', tables).map(function(row){
      return {rowIndex:row.__rowIndex__, id:field(row,['装备ID','equipment_id']), name:field(row,['装备名称','equipment_name']), category:field(row,['装备类别','equipment_category']), slotType:field(row,['槽位类型','slot_type']), rarity:field(row,['星级','rarity']), stars:rarityNumber(field(row,['星级','rarity'])), allowedWeaponTypes:splitList(field(row,['可装备枪种','allowed_weapon_types'])), allowedTdollNames:field(row,['特定人形白名单','allowed_tdoll_names'],'*'), statMin:field(row,['属性生成下限','stat_min']), statMax:field(row,['属性生成上限','stat_max']), maxLevel:num(field(row,['最高强化等级','max_level']),10), enhanceGrowth:field(row,['强化成长规则','enhance_growth']), calibrationFields:splitList(field(row,['可校准属性','calibration_fields'])), ruleTags:splitList(field(row,['规则标签','rule_tags'])), recipeTags:splitList(field(row,['制造配方标签','recipe_tags'])), constructionTime:field(row,['制造时间','construction_time']), constructionWeight:num(field(row,['制造权重','construction_weight']),100), dismantleYield:field(row,['分解产出','dismantle_yield']), description:field(row,['描述','description']), raw:row};
    }).filter(function(row){return row.id;});
  }
  function equipmentCatalogMap(tables){ var map={}; equipmentCatalogRows(tables).forEach(function(row){map[row.id]=row;}); return map; }
  function equipmentRelationRows(tables){
    return rows('tdollEquipment', tables).map(function(row){return {rowIndex:row.__rowIndex__, tdollName:field(row,['人形名称','tdoll_name']), slotType:field(row,['槽位类型','slot_type']), equipmentRowId:num(field(row,['装备仓库行号','equipment_row_id']),0), raw:row};}).filter(function(row){return row.tdollName && row.equipmentRowId;});
  }
  function equipmentWarehouseRows(tables){
    var catalog = equipmentCatalogMap(tables), relations = equipmentRelationRows(tables), wearerById = {};
    relations.forEach(function(rel){wearerById[rel.equipmentRowId]=rel;});
    return rows('equipmentWarehouse', tables).map(function(row){
      var rowId=row.__rowIndex__, cat=catalog[field(row,['装备ID','equipment_id'])] || null, rel=wearerById[rowId] || null;
      return {rowId:rowId, rowIndex:rowId, equipmentId:field(row,['装备ID','equipment_id']), catalog:cat, name:cat?cat.name:field(row,['装备ID','equipment_id']), category:cat?cat.category:'未知', slotType:cat?cat.slotType:'', rarity:cat?cat.rarity:'', stars:cat?cat.stars:0, baseStatsText:field(row,['实例基础属性','base_stats']), statsText:field(row,['实例当前属性','stats']), baseStats:parseStats(field(row,['实例基础属性','base_stats'])), stats:parseStats(field(row,['实例当前属性','stats'])), level:num(field(row,['强化等级','level']),0), calibration:field(row,['校准记录','calibration']), exp:num(field(row,['强化经验','exp']),0), locked:field(row,['是否锁定','locked'],'否')==='是', acquired:field(row,['是否拥有','acquired'],'是')==='是', source:field(row,['来源','source']), equippedBy:rel?rel.tdollName:'', relation:rel, raw:row};
    }).filter(function(row){return row.rowId && row.acquired;});
  }
  function tdollCanEquip(tdoll, equip){
    if(!tdoll || !equip || !equip.catalog) return {ok:false, reason:'缺少人形或装备数据'};
    if(equip.catalog.allowedWeaponTypes.indexOf(tdoll.type) < 0) return {ok:false, reason:tdoll.name + ' 不能装备' + equip.name + '：仅限 ' + equip.catalog.allowedWeaponTypes.join('/')};
    var allowNames = String(equip.catalog.allowedTdollNames || '*').trim();
    if(allowNames !== '*' && splitList(allowNames).indexOf(tdoll.name) < 0) return {ok:false, reason:'该装备仅限指定人形装备'};
    return {ok:true, reason:'可装备'};
  }
  function equipmentForTdoll(tdollName, tables){
    var rels = equipmentRelationRows(tables).filter(function(rel){return rel.tdollName === tdollName;});
    var byId = {}; equipmentWarehouseRows(tables).forEach(function(e){byId[e.rowId]=e;});
    return rels.map(function(rel){var e=byId[rel.equipmentRowId]; if(e) e.slotType = rel.slotType || e.slotType; return e;}).filter(Boolean);
  }
  function applyEquipmentStats(baseStats, equipmentList){
    var out = clone(baseStats || {}) || {};
    out.critDamage = out.critDamage == null ? 150 : out.critDamage;
    out.nightAccuracyOffset = out.nightAccuracyOffset || 0;
    out.reloadSpeed = out.reloadSpeed || 0;
    out.initialCooldown = out.initialCooldown || 0;
    out.teamAccuracy = out.teamAccuracy || 0;
    out.equipmentTags = [];
    out.equipmentSummary = '';
    (equipmentList || []).forEach(function(e){
      Object.keys(e.stats || {}).forEach(function(k){ out[k] = (out[k] || 0) + e.stats[k]; });
      if(e.catalog && e.catalog.ruleTags) out.equipmentTags = out.equipmentTags.concat(e.catalog.ruleTags);
    });
    out.rof = Math.max(1, num(out.rof, 1) + Math.floor(num(out.reloadSpeed,0) / 5));
    out.movement = Math.max(0, num(out.movement, 0));
    out.nightAccuracyOffset = Math.max(0, Math.min(100, num(out.nightAccuracyOffset, 0)));
    out.equipmentTags = out.equipmentTags.filter(function(v,i,a){return v && a.indexOf(v) === i;});
    out.equipmentSummary = (equipmentList || []).map(function(e){return e.name + '+' + e.level + '(' + e.statsText + ')';}).join('；');
    return out;
  }
  function generateEquipmentStats(catalog, seed){
    var min = parseStatsRange(catalog && catalog.statMin), max = parseStatsRange(catalog && catalog.statMax), out = {};
    Object.keys(min).forEach(function(k){ out[k] = rangeValue(seed || catalog.id, k, {min:min[k].min, max:(max[k] ? max[k].max : min[k].max)}); });
    return out;
  }
  function equipmentConstructionRows(tables){
    return rows('equipmentConstruction', tables).map(function(row, i){return {rowId:row.__rowIndex__, rowIndex:row.__rowIndex__, displayIndex:i+1, startTime:field(row,['开始时间','start_time']), constructionTime:field(row,['制造时间','construction_time']), cost:{manpower:num(field(row,['消耗人力','cost_manpower']),0), ammo:num(field(row,['消耗弹药','cost_ammo']),0), ration:num(field(row,['消耗口粮','cost_ration']),0), parts:num(field(row,['消耗零件','cost_parts']),0)}, recipeType:field(row,['配方类型','recipe_type']), resultSeed:field(row,['结果种子','result_seed']), resultEquipmentId:field(row,['结果装备ID','result_equipment_id']), candidatePoolHash:field(row,['候选池哈希','candidate_pool_hash']), raw:row};});
  }

  function parseYield(text){
    var out = {};
    String(text || '').split(/[，,;；]/).forEach(function(part){
      var m = part.trim().match(/^([^0-9+\-]+)\s*([+\-]?\d+)/);
      if(m) out[m[1].trim()] = num(m[2], 0);
    });
    return out;
  }

  function parseEnhanceGrowth(text){
    var out = {};
    String(text || '').split(/[，,]/).forEach(function(part){
      var m = part.trim().match(/^([^=]+)=每(?:(\d+))?级([+\-]?\d+)/);
      if(!m) return;
      out[statKey(m[1])] = {every:Math.max(1, num(m[2], 1)), delta:num(m[3], 0)};
    });
    return out;
  }

  function growthStats(catalog, level){
    var out = {}, growth = parseEnhanceGrowth(catalog && catalog.enhanceGrowth);
    Object.keys(growth).forEach(function(k){ out[k] = Math.floor(Math.max(0, num(level, 0)) / growth[k].every) * growth[k].delta; });
    return out;
  }

  function addStats(){
    var out = {};
    for(var i=0;i<arguments.length;i++){
      var stats = arguments[i] || {};
      Object.keys(stats).forEach(function(k){ out[k] = (out[k] || 0) + num(stats[k], 0); });
    }
    return out;
  }

  function recalculatedEquipmentStats(equipment, level, calibration){
    return addStats(equipment && equipment.baseStats, growthStats(equipment && equipment.catalog, level), calibration || parseStats(equipment && equipment.calibration));
  }

  function resourceEnough(resources, name, amount){ return num(resources && resources[name], 0) >= Math.max(0, num(amount, 0)); }
  function resourceUpdateSql(name, delta){ return 'UPDATE resource_status SET amount = amount + ' + sqlValue(num(delta, 0)) + ' WHERE resource_name = ' + sqlValue(name); }
  function baseResourceCostSql(cost){
    cost = cost || {};
    var names = {manpower:'人力', ammo:'弹药', ration:'口粮', parts:'零件'};
    return Object.keys(names).filter(function(key){ return num(cost[key], 0) > 0; }).map(function(key){ return resourceUpdateSql(names[key], -num(cost[key], 0)); });
  }

  function validateEquipmentForTdoll(tdollName, equipmentRowId, tables){
    var tdoll = null, equipment = null, occupied = null;
    ownedTdolls(tables).forEach(function(t){ if(t.name === tdollName) tdoll = t; });
    equipmentWarehouseRows(tables).forEach(function(e){ if(String(e.rowId) === String(equipmentRowId)) equipment = e; });
    equipmentRelationRows(tables).forEach(function(rel){ if(String(rel.equipmentRowId) === String(equipmentRowId)) occupied = rel; });
    if(!tdoll) return {ok:false, code:'TDOLL_NOT_FOUND', reason:'人形不存在或未获取：' + tdollName};
    if(!equipment) return {ok:false, code:'EQUIPMENT_NOT_FOUND', reason:'装备实例不存在：#' + equipmentRowId};
    if(!equipment.catalog) return {ok:false, code:'CATALOG_NOT_FOUND', reason:'装备图鉴缺失：' + equipment.equipmentId};
    if(occupied && occupied.tdollName !== tdollName) return {ok:false, code:'EQUIPMENT_OCCUPIED', reason:'该装备已装备给 ' + occupied.tdollName + '。'};
    var check = tdollCanEquip(tdoll, equipment);
    if(!check.ok) return {ok:false, code:check.reason.indexOf('指定') >= 0 ? 'TDOLL_NOT_ALLOWED' : 'WEAPON_TYPE_DENIED', reason:check.reason};
    return {ok:true, slotType:equipment.slotType, tdoll:tdoll, equipment:equipment, occupied:occupied};
  }

  function equipToTdoll(tdollName, equipmentRowId, options){
    var check = validateEquipmentForTdoll(tdollName, equipmentRowId);
    if(!check.ok) return Promise.resolve(check);
    var slotType = check.slotType;
    var statements = [
      'DELETE FROM tdoll_equipment WHERE tdoll_name = ' + sqlValue(tdollName) + ' AND slot_type = ' + sqlValue(slotType),
      'INSERT INTO tdoll_equipment (tdoll_name, slot_type, equipment_row_id) VALUES (' + [sqlValue(tdollName), sqlValue(slotType), sqlValue(equipmentRowId)].join(', ') + ')'
    ];
    return executeSqlBatch({sql:statements.join(';\n') + ';', targetSheetKeys:['sheet_tdoll_equipment']}, options || {}).then(function(){ return {ok:true, slotType:slotType}; });
  }

  function unequipFromTdoll(tdollName, slotType, options){
    return executeSqlBatch({sql:'DELETE FROM tdoll_equipment WHERE tdoll_name = ' + sqlValue(tdollName) + ' AND slot_type = ' + sqlValue(slotType) + ';', targetSheetKeys:['sheet_tdoll_equipment']}, options || {}).then(function(){ return {ok:true}; });
  }

  function enhanceEquipment(equipmentRowId, materials, options){
    materials = materials || {};
    var target = null, rowsEq = equipmentWarehouseRows(), resources = resourceState();
    rowsEq.forEach(function(e){ if(String(e.rowId) === String(equipmentRowId)) target = e; });
    if(!target) return Promise.resolve({ok:false, code:'EQUIPMENT_NOT_FOUND', reason:'装备实例不存在：#' + equipmentRowId});
    if(!target.catalog) return Promise.resolve({ok:false, code:'CATALOG_NOT_FOUND', reason:'装备图鉴缺失：' + target.equipmentId});
    var maxLevel = num(target.catalog && target.catalog.maxLevel, 10);
    if(target.level >= maxLevel) return Promise.resolve({ok:false, code:'MAX_LEVEL', reason:'装备已达到最高强化等级。'});
    var materialCount = Math.max(0, num(materials.enhanceMaterial, 0));
    if(!resourceEnough(resources, 'enhanceMaterial', materialCount)) return Promise.resolve({ok:false, code:'RESOURCE_NOT_ENOUGH', reason:'强化材料不足。'});
    var resourceCost = materials.resources || {};
    var resourceExpUnits = Math.floor(Math.min(num(resourceCost.manpower,0), num(resourceCost.ammo,0), num(resourceCost.ration,0), num(resourceCost.parts,0)) / 100);
    if(Object.keys(resourceCost).length && resourceExpUnits <= 0) return Promise.resolve({ok:false, code:'RESOURCE_NOT_ENOUGH', reason:'基础资源投入不足。'});
    if(num(resourceCost.manpower,0) > resources.manpower || num(resourceCost.ammo,0) > resources.ammo || num(resourceCost.ration,0) > resources.ration || num(resourceCost.parts,0) > resources.parts) return Promise.resolve({ok:false, code:'RESOURCE_NOT_ENOUGH', reason:'基础资源不足。'});
    var consumeIds = Array.isArray(materials.instances) ? materials.instances.slice() : [];
    var expGain = materialCount * 10 + resourceExpUnits * 10, statements = [];
    consumeIds.forEach(function(id){
      rowsEq.forEach(function(e){
        if(String(e.rowId) !== String(id) || e.rowId === target.rowId) return;
        if(e.locked || e.equippedBy) return;
        var base = e.stars >= 5 ? 50 : (e.stars === 4 ? 30 : (e.stars === 3 ? 18 : 10));
        expGain += e.category === target.category ? Math.floor(base * (1 + e.level * 0.15)) : Math.floor(base * 0.5);
        statements.push('DELETE FROM equipment_warehouse WHERE row_id = ' + sqlValue(e.rowId));
      });
    });
    if(expGain <= 0) return Promise.resolve({ok:false, code:'NO_MATERIAL', reason:'请选择强化材料或可消耗装备。'});
    var coef = target.stars >= 5 ? 50 : (target.stars === 4 ? 30 : (target.stars === 3 ? 18 : 10));
    var level = target.level, exp = target.exp + expGain;
    while(level < maxLevel && exp >= Math.max(1, (level + 1) * coef)){ exp -= Math.max(1, (level + 1) * coef); level++; }
    if(level >= maxLevel) exp = 0;
    var nextStats = recalculatedEquipmentStats(target, level, parseStats(target.calibration));
    if(materialCount) statements.push(resourceUpdateSql('强化材料', -materialCount));
    statements = statements.concat(baseResourceCostSql(resourceCost));
    statements.push('UPDATE equipment_warehouse SET level = ' + sqlValue(level) + ', exp = ' + sqlValue(exp) + ', stats = ' + sqlValue(statText(nextStats)) + ' WHERE row_id = ' + sqlValue(target.rowId));
    return executeSqlBatch({sql:statements.join(';\n') + ';', targetSheetKeys:['sheet_equipment_warehouse','sheet_resource_status']}, options || {}).then(function(){ return {ok:true, level:level, exp:exp, stats:nextStats}; });
  }

  function calibrateEquipment(equipmentRowId, input, options){
    input = input || {};
    var target = null, resources = resourceState();
    equipmentWarehouseRows().forEach(function(e){ if(String(e.rowId) === String(equipmentRowId)) target = e; });
    if(!target) return Promise.resolve({ok:false, code:'EQUIPMENT_NOT_FOUND', reason:'装备实例不存在：#' + equipmentRowId});
    if(!target.catalog) return Promise.resolve({ok:false, code:'CATALOG_NOT_FOUND', reason:'装备图鉴缺失：' + target.equipmentId});
    var key = statKey(input.field);
    if((target.catalog.calibrationFields || []).map(statKey).indexOf(key) < 0) return Promise.resolve({ok:false, code:'FIELD_DENIED', reason:'该属性不可校准。'});
    var cost = Math.max(1, num(target.stars, 0) - 2);
    var resourceCost = input.resources || {};
    var useTickets = input.useTickets !== false;
    if(useTickets && !resourceEnough(resources, 'calibrationTicket', cost)) return Promise.resolve({ok:false, code:'RESOURCE_NOT_ENOUGH', reason:'校准券不足。'});
    if(!useTickets && Math.min(num(resourceCost.manpower,0), num(resourceCost.ammo,0), num(resourceCost.ration,0), num(resourceCost.parts,0)) < cost * 200) return Promise.resolve({ok:false, code:'RESOURCE_NOT_ENOUGH', reason:'基础资源投入不足。'});
    if(!useTickets && (num(resourceCost.manpower,0) > resources.manpower || num(resourceCost.ammo,0) > resources.ammo || num(resourceCost.ration,0) > resources.ration || num(resourceCost.parts,0) > resources.parts)) return Promise.resolve({ok:false, code:'RESOURCE_NOT_ENOUGH', reason:'基础资源不足。'});
    var maxRange = parseStatsRange(target.catalog.statMax), currentCalibration = parseStats(target.calibration), currentStats = recalculatedEquipmentStats(target, target.level, currentCalibration);
    var cap = (maxRange[key] ? maxRange[key].max : num(target.baseStats[key], 0)) + num(growthStats(target.catalog, target.level)[key], 0);
    if(num(currentStats[key], 0) >= cap) return Promise.resolve({ok:false, code:'FIELD_MAX', reason:'该属性已达到当前校准上限。'});
    currentCalibration[key] = num(currentCalibration[key], 0) + 1;
    var nextStats = recalculatedEquipmentStats(target, target.level, currentCalibration);
    var statements = useTickets ? [resourceUpdateSql('校准券', -cost)] : baseResourceCostSql(resourceCost);
    statements.push('UPDATE equipment_warehouse SET calibration = ' + sqlValue(statText(currentCalibration)) + ', stats = ' + sqlValue(statText(nextStats)) + ' WHERE row_id = ' + sqlValue(target.rowId));
    var sql = statements.join(';\n') + ';';
    return executeSqlBatch({sql:sql, targetSheetKeys:['sheet_equipment_warehouse','sheet_resource_status']}, options || {}).then(function(){ return {ok:true, cost:cost, calibration:currentCalibration, stats:nextStats}; });
  }

  function dismantleEquipment(equipmentRowId, options){
    var target = null;
    equipmentWarehouseRows().forEach(function(e){ if(String(e.rowId) === String(equipmentRowId)) target = e; });
    if(!target) return Promise.resolve({ok:false, code:'EQUIPMENT_NOT_FOUND', reason:'装备实例不存在：#' + equipmentRowId});
    if(target.locked) return Promise.resolve({ok:false, code:'LOCKED', reason:'锁定装备不能分解。'});
    if(target.equippedBy) return Promise.resolve({ok:false, code:'EQUIPPED', reason:'已装备装备不能分解，必须先卸下。'});
    var yieldMap = parseYield(target.catalog && target.catalog.dismantleYield);
    if(target.level > 0) yieldMap['强化材料'] = num(yieldMap['强化材料'], 0) + Math.floor(target.level / 2);
    var statements = ['DELETE FROM equipment_warehouse WHERE row_id = ' + sqlValue(target.rowId)];
    if(yieldMap['强化材料']) statements.push(resourceUpdateSql('强化材料', yieldMap['强化材料']));
    if(yieldMap['校准券']) statements.push(resourceUpdateSql('校准券', yieldMap['校准券']));
    return executeSqlBatch({sql:statements.join(';\n') + ';', targetSheetKeys:['sheet_equipment_warehouse','sheet_resource_status']}, options || {}).then(function(){ return {ok:true, yield:yieldMap}; });
  }

  function currentStatus(tables){
    var row = rows('currentStatus', tables)[0] || {};
    return {
      rowIndex: row.__rowIndex__ || 1,
      location: field(row, ['当前位置','current_location']),
      currentTime: field(row, ['当前时间','cur_time']),
      dayCount: num(field(row, ['天数','day_count']), 1),
      raw: row
    };
  }

  function currentChapter(tables){
    var row = rows('currentChapter', tables)[0] || {};
    return {
      rowIndex: row.__rowIndex__ || 1,
      chapterName: field(row, ['章节名','chapter_name']),
      currentStage: field(row, ['当前阶段','current_stage']),
      sortieState: field(row, ['出击状态','sortie_state'], '未出击'),
      sortieArea: field(row, ['出击地区','sortie_area'], 'S09辖区'),
      raw: row
    };
  }

  function sortieActive(tables){
    return String(currentChapter(tables).sortieState || '').trim() === '出击中';
  }

  function setSortieActive(active, options){
    return updateCell('currentChapter', 1, '出击状态', active ? '出击中' : '未出击', options || {});
  }

  var SORTIE_AREAS = [
    'S09辖区',
    '贝尔格莱德',
    '不莱梅',
    '柏林',
    '爱沙尼亚',
    '死海阿佛那斯',
    '洲际列车',
    '红区无人区',
    '新苏联边境',
    '心智空间'
  ];

  function sortieAreas(tables){
    var current = currentChapter(tables);
    return SORTIE_AREAS.map(function(area){
      return {
        areaName: area,
        selected: area === current.sortieArea,
        selectable: true,
        lockReason: area === current.sortieArea ? '当前出击地区' : '可选择为出击地区'
      };
    });
  }

  function storyFlagRows(tables){
    return rows('storyFlags', tables).map(function(row){
      return {
        rowIndex: row.__rowIndex__,
        flagName: field(row, ['标记名称','flag_name']),
        isTriggered: field(row, ['是否触发','is_triggered'], '否'),
        raw: row
      };
    }).filter(function(row){ return row.flagName; });
  }

  function storyFlagTriggered(flagNames, tables){
    if(!Array.isArray(flagNames)) flagNames = [flagNames];
    var wanted = {};
    flagNames.forEach(function(name){ wanted[String(name || '').trim()] = true; });
    return storyFlagRows(tables).some(function(row){
      return wanted[String(row.flagName || '').trim()] && String(row.isTriggered || '').trim() === '是';
    });
  }

  var CHAPTER_ROUTE_RULES = {
    '急性期': {flag:['AR-15是否被植入伞病毒'], yes:'逆转录', no:'钳制反应'},
    '逆转录': {flag:['M4A1是否因为知道AR-15死亡而昏迷'], yes:'低灌注', no:'过补偿'},
    '钳制反应': {flag:['M4A1是否因为知道AR-15死亡而昏迷'], yes:'低灌注', no:'过补偿'},
    '低灌注': {flag:['M16A1是否注射了第二针伞病毒','M16A1是否因为注射了第二针伞病毒'], yes:'级联失效', no:'排异反应'},
    '过补偿': {flag:['M16A1是否注射了第二针伞病毒','M16A1是否因为注射了第二针伞病毒'], yes:'级联失效', no:'排异反应'},
    '排异反应': {flag:['格里芬是否因为军方的背叛而溃败'], yes:'低氧适应', no:'相变跃迁'},
    '级联失效': {flag:['格里芬是否因为军方的背叛而溃败'], yes:'低氧适应', no:'相变跃迁'},
    '相变跃迁': {flag:['格里芬是否因为军方的背叛而溃败'], yes:'逆向坍塌', no:'临界质量'},
    '低氧适应': {flag:['格里芬是否因为军方的背叛而溃败'], yes:'逆向坍塌', no:'临界质量'}
  };

  function routeNextChapterName(chapterName, tables){
    var rule = CHAPTER_ROUTE_RULES[chapterName];
    if(!rule) return '';
    return storyFlagTriggered(rule.flag, tables) ? rule.yes : rule.no;
  }

  function chapterRows(tables){
    return rows('totalChapters', tables).map(function(row){
      return {
        rowIndex: row.__rowIndex__,
        chapterName: field(row, ['章节名','chapter_name']),
        chapterType: field(row, ['类型','chapter_type'], '主线'),
        chapterStatus: field(row, ['状态','chapter_status'], '未开始'),
        raw: row
      };
    }).filter(function(row){ return row.chapterName; });
  }

  function enemyDataRows(tables){
    return rows('enemyData', tables).map(function(row){
      return {
        rowIndex: row.__rowIndex__,
        enemyName: field(row, ['敌人名称','enemy_name','name']),
        faction: field(row, ['阵营','faction']),
        enemyType: field(row, ['敌人类型','enemy_type'], '普通'),
        threatLevel: field(row, ['威胁等级','threat_level'], '中'),
        baseGrade: field(row, ['基础档位','base_grade'], ''),
        bossFlag: field(row, ['Boss标记','boss_flag'], '否'),
        chapterBinding: field(row, ['章节绑定','chapter_binding'], ''),
        tags: field(row, ['标签','tags'], ''),
        statTemplate: field(row, ['属性模板','stat_template'], ''),
        skillSummary: field(row, ['技能摘要','skill_summary'], ''),
        storyRole: field(row, ['剧情定位','story_role'], ''),
        dataSource: field(row, ['数据来源','data_source'], ''),
        raw: row
      };
    }).filter(function(row){ return row.enemyName; });
  }

  function enemyDataMap(tables){
    var map = {};
    enemyDataRows(tables).forEach(function(row){ map[String(row.enemyName).trim()] = row; });
    return map;
  }

  function selectableChapters(tables){
    var list = chapterRows(tables);
    var current = currentChapter(tables);
    var nextName = routeNextChapterName(current.chapterName, tables);
    return list.map(function(ch){
      var isCurrent = ch.chapterName === current.chapterName;
      var isNext = !!nextName && ch.chapterName === nextName;
      var selectable = !isCurrent && isNext && current.currentStage === '已完成';
      var reason = '';
      if(isCurrent){
        reason = current.currentStage === '已完成' ? '当前章节已完成，请选择下一章' : '当前章节正在进行，需先点击完成章节';
      } else if(isNext){
        reason = current.currentStage === '已完成' ? '剧情标记判定出的下一章' : '当前章节尚未完成，暂不能进入下一章';
      } else {
        reason = '只能选择当前章节或剧情标记判定出的下一章';
      }
      var out = clone(ch);
      out.selectable = selectable;
      out.lockReason = reason;
      out.current = isCurrent;
      out.routeNext = isNext;
      return out;
    }).filter(function(ch){ return ch.current || ch.routeNext; });
  }

  function setCurrentChapter(chapterName, stage, sortieState, options){
    var data = {'章节名':chapterName, '当前阶段':stage};
    if(sortieState != null) data['出击状态'] = sortieState;
    return updateRow('currentChapter', 1, data, options || {});
  }

  function setChapterStatus(chapterName, status, options){
    var found = chapterRows().filter(function(ch){ return ch.chapterName === chapterName; })[0];
    if(!found || !found.rowIndex) return Promise.reject(new Error('未找到章节：' + chapterName));
    return updateCell('totalChapters', found.rowIndex, '状态', status, options || {});
  }

  function selectChapter(chapterName, options){
    options = options || {};
    var current = currentChapter();
    var found = selectableChapters().filter(function(ch){ return ch.chapterName === chapterName; })[0];
    if(!found) return Promise.reject(new Error('未找到章节：' + chapterName));
    if(!found.selectable) return Promise.reject(new Error(found.lockReason || '章节尚未解锁'));
    if(chapterName === current.chapterName) return Promise.reject(new Error('当前所在章节不可重复选择'));
    if(current.currentStage !== '已完成') return Promise.reject(new Error('当前章节尚未完成，不能进入下一章'));
    if(found.rowIndex){
      var sql = '';
      sql += 'UPDATE total_chapters SET chapter_status = ' + sqlValue('进行中') + ' WHERE row_id = ' + sqlValue(found.rowIndex) + ';\n';
      sql += 'UPDATE current_chapter SET chapter_name = ' + sqlValue(chapterName) + ', current_stage = ' + sqlValue('进行中') + ' WHERE row_id = 1;';
      return executeSqlBatch({sql:sql, targetSheetKeys:['sheet_total_chapters','sheet_current_chapter']}, options);
    }
    return setCurrentChapter(chapterName, '进行中', null, options);
  }

  function setSortieArea(areaName, options){
    if(SORTIE_AREAS.indexOf(areaName) < 0) return Promise.reject(new Error('非法出击地区：' + areaName));
    return updateCell('currentChapter', 1, '出击地区', areaName, options || {});
  }

  function beginAreaSortie(areaName, options){
    options = options || {};
    if(SORTIE_AREAS.indexOf(areaName) < 0) return Promise.reject(new Error('非法出击地区：' + areaName));
    return executeSqlMutation('UPDATE current_chapter SET sortie_area = ?, sortie_state = ? WHERE row_id = 1', [areaName, '出击中'], options)
      .catch(function(error){ throw new Error('地区出击 SQL 写入失败：' + (error && error.message ? error.message : error)); });
  }

  function currentChapterProgress(tables){
    var current = currentChapter(tables);
    var chapter = chapterRows(tables).filter(function(ch){ return ch.chapterName === current.chapterName; })[0] || null;
    return {current:current, chapter:chapter};
  }

  function checkBossVictory(tables){
    var progress = currentChapterProgress(tables);
    var chapter = progress.chapter;
    return {victory:false, chapter:chapter, reason:'总章节表不再维护章节Boss列'};
  }

  function settleBossVictory(options){
    var result = checkBossVictory();
    if(!result.victory || !result.chapter) return Promise.resolve(result);
    return setChapterStatus(result.chapter.chapterName, '已完成', {skipNotify:true}).then(function(){
      return updateCell('currentChapter', 1, '当前阶段', '已完成', options || {});
    }).then(function(){
      result.settled = true;
      return result;
    });
  }

  function sendToTavern(message){
    var roots = rootWindows();
    for(var i=0;i<roots.length;i++){
      try{
        var doc = roots[i].document;
        var textarea = doc && doc.getElementById && doc.getElementById('send_textarea');
        if(textarea){
          textarea.value = message;
          try{ textarea.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
          try{ textarea.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
          return {success:true, filled:true};
        }
      }catch(e){}
    }
    return {success:false, message:'无法连接到酒馆输入框'};
  }

  function buildSortiePrompt(chapterName, areaName){
    var area = String(areaName || currentChapter().sortieArea || '').trim();
    if(String(chapterName || '').trim() === '终章'){
      return [
        '当前选择章节：终章',
        '当前出击地区：' + (area || '未指定'),
        '当前操作：出击。',
        '战场世界书要求：优先读取当前章节战役世界书中 <if> 条件已满足的 <战役>...</战役> 标签内容；该标签内容是本次主线战场、事件阶段、敌我态势与关键转折的硬依据。',
        '地区世界书要求：再读取当前出击地区对应的地区世界书，只用于补充地理环境、基地/城市/战区空间、行军路线和局部遭遇。',
        '这是慢休克之后由指挥官与 AI 共同书写的延续主线，不是后日谈、不是战后整备、不是自由刷图。',
        '请基于 <战役> 标签内的战场内容、少女前线既有世界观、当前表格状态、当前聊天上下文和玩家指令，写出下一阶段主线行动的开端或推进。',
        '剧情推演必须从已有剧情自然延伸，可以延续帕拉蒂斯、威廉、坍塌液、罗联、格里芬、铁血、安洁、AR小队、404小队等既有线索，也可以在玩家指令基础上发展新的主线冲突。',
        '不得宣称主线已经结束，不得把剧情写成养老式收束。',
        '不要直接宣告胜利。'
      ].join('\n');
    }
    return [
      '当前选择章节：' + chapterName,
      '当前出击地区：' + (area || '未指定'),
      '当前操作：出击。',
      '战场世界书要求：必须读取当前章节战役世界书中 <if> 条件已满足的 <战役>...</战役> 标签内容，并把它作为本次战场剧情的主依据。',
      '地区世界书要求：同时读取当前出击地区对应的地区世界书，但它只负责补充地理环境、战区空间、行军路线和局部遭遇，不得覆盖 <战役> 标签规定的主线阶段。',
      '请写出指挥官率队从基地进入对应战场后的第一段剧情。',
      '这是从基地/待机状态切换到战场状态的剧情推进，允许发生时间和空间的大跳转。',
      '不要直接宣告章节胜利，不要跳过 <战役> 标签内规定的关键战役阶段。'
    ].join('\n');
  }

  function buildRetreatPrompt(){
    var progress = currentChapterProgress();
    var chapterName = progress.current.chapterName || '当前章节';
    var stage = progress.current.currentStage || '进行中';
    var area = String(progress.current.sortieArea || '').trim();
    return [
      '当前章节：' + chapterName,
      '当前阶段：' + stage,
      '当前出击地区：' + (area || '未指定'),
      '当前操作：撤退。',
      '战场世界书要求：必须读取当前章节战役世界书中 <if> 条件已满足的 <战役>...</战役> 标签内容，并把它作为撤退发生前的战场态势依据。',
      '地区世界书要求：同时读取当前出击地区对应的地区世界书，只用于补充撤离路线、地理阻碍、临时据点和回基地路径。',
      '请写出队伍从当前战场撤回格里芬基地或临时据点的剧情。',
      '撤退不代表战役失败；保留当前章节进度。',
      '如果当前章节已完成，可以写成胜利后的撤离或战场收束；如果仍在进行中，可以写成战术撤退和回基地整备。'
    ].join('\n');
  }

  function constructionRows(tables){
    return rows('constructionQueue', tables).map(function(row, i){
      return {
        rowId: row.__rowIndex__,
        rowIndex: row.__rowIndex__,
        displayIndex: i + 1,
        cost:{
          manpower: num(field(row, ['消耗人力','cost_manpower']), 0),
          ammo: num(field(row, ['消耗弹药','cost_ammo']), 0),
          ration: num(field(row, ['消耗口粮','cost_ration']), 0),
          parts: num(field(row, ['消耗零件','cost_parts']), 0)
        },
        startTime: field(row, ['开始时间','start_time']),
        constructionTime: field(row, ['建造时间','construction_time']),
        raw: row
      };
    });
  }

  function parseGlobalDateTime(text){
    var m = String(text || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if(!m) return null;
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10), 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatGlobalDateTime(date){
    function pad(n){ return n < 10 ? '0' + n : '' + n; }
    if(!date || isNaN(date.getTime())) return '';
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function addMinutesToGlobalTime(text, minutes){
    var d = parseGlobalDateTime(text);
    var n = parseInt(minutes, 10);
    if(!d || isNaN(n)) return '';
    return formatGlobalDateTime(new Date(d.getTime() + n * 60000));
  }

  function currentTaskRows(tables){
    return rows('currentTasks', tables).map(function(row){
      return {
        rowIndex: row.__rowIndex__,
        taskName: field(row, ['任务名称','task_name']),
        taskSource: field(row, ['任务来源','task_source']),
        taskType: field(row, ['任务类型','task_type']),
        priority: field(row, ['优先级','priority']),
        description: field(row, ['描述','description']),
        triggerBasis: field(row, ['触发依据','trigger_basis']),
        completionCondition: field(row, ['完成条件','completion_condition']),
        failureCondition: field(row, ['失败条件','failure_condition']),
        status: field(row, ['状态','status']),
        raw: row
      };
    }).filter(function(row){ return row.taskName; });
  }

  function logisticsTaskRows(tables){
    return rows('logisticsTasks', tables).map(function(row){
      var startTime = field(row, ['开始时间','start_time']);
      var duration = num(field(row, ['任务时长','duration']), 0);
      var endTime = startTime ? addMinutesToGlobalTime(startTime, duration) : '';
      return {
        rowIndex: row.__rowIndex__,
        taskName: field(row, ['任务名称','task_name']),
        taskDifficulty: field(row, ['任务难度','task_difficulty']),
        required:{
          HG: num(field(row, ['HG数量要求','required_hg']), 0),
          SMG: num(field(row, ['SMG数量要求','required_smg']), 0),
          RF: num(field(row, ['RF数量要求','required_rf']), 0),
          AR: num(field(row, ['AR数量要求','required_ar']), 0),
          MG: num(field(row, ['MG数量要求','required_mg']), 0),
          SG: num(field(row, ['SG数量要求','required_sg']), 0)
        },
        assignedSquad: field(row, ['执行人形小队','assigned_squad']),
        startTime: startTime,
        duration: duration,
        endTime: endTime,
        reward:{
          manpower: num(field(row, ['奖励人力','reward_manpower']), 0),
          ammo: num(field(row, ['奖励弹药','reward_ammo']), 0),
          ration: num(field(row, ['奖励口粮','reward_ration']), 0),
          parts: num(field(row, ['奖励零件','reward_parts']), 0),
          memoryCore: num(field(row, ['奖励心智核心','reward_memory_core']), 0)
        },
        raw: row
      };
    }).filter(function(row){ return row.taskName; });
  }

  function logisticsSquadRows(tables){
    return rows('logisticsSquads', tables).map(function(row){
      return {
        rowIndex: row.__rowIndex__,
        squadName: field(row, ['小队名','squad_name']),
        tdollList: field(row, ['人形列表','tdoll_list']),
        totalStars: num(field(row, ['总星级','total_stars']), 0),
        counts:{
          HG: num(field(row, ['HG数量','hg_count']), 0),
          SMG: num(field(row, ['SMG数量','smg_count']), 0),
          RF: num(field(row, ['RF数量','rf_count']), 0),
          AR: num(field(row, ['AR数量','ar_count']), 0),
          MG: num(field(row, ['MG数量','mg_count']), 0),
          SG: num(field(row, ['SG数量','sg_count']), 0)
        },
        raw: row
      };
    }).filter(function(row){ return row.squadName; });
  }

  function logisticsTaskReady(task, tables){
    var current = parseGlobalDateTime(currentStatus(tables).currentTime);
    var end = parseGlobalDateTime(task && task.endTime);
    return !!(current && end && current.getTime() >= end.getTime());
  }

  function logisticsSquadAvailable(squadName, tables){
    var name = String(squadName || '').trim();
    if(!name) return false;
    return !logisticsTaskRows(tables).some(function(task){
      return task.assignedSquad === name && task.startTime;
    });
  }

  function squadMeetsLogisticsRequirement(squad, task){
    if(!squad || !task) return false;
    var types = ['HG','SMG','RF','AR','MG','SG'];
    return types.every(function(type){ return (squad.counts[type] || 0) >= (task.required[type] || 0); });
  }

  function assignLogisticsTask(taskRowIndex, squadName, options){
    options = options || {};
    var task = logisticsTaskRows().filter(function(row){ return String(row.rowIndex) === String(taskRowIndex); })[0];
    if(!task) return Promise.reject(new Error('未找到后勤任务行：' + taskRowIndex));
    if(task.assignedSquad || task.startTime) return Promise.reject(new Error('该后勤任务已经被派遣'));
    var squad = logisticsSquadRows().filter(function(row){ return row.squadName === squadName; })[0];
    if(!squad) return Promise.reject(new Error('未找到后勤小队：' + squadName));
    if(!logisticsSquadAvailable(squadName)) return Promise.reject(new Error('后勤小队正在执行其他任务：' + squadName));
    if(!squadMeetsLogisticsRequirement(squad, task)) return Promise.reject(new Error('后勤小队不满足该任务的枪种数量要求'));
    var startTime = currentStatus().currentTime;
    if(!parseGlobalDateTime(startTime)) return Promise.reject(new Error('全局数据表.当前时间无效，无法按剧情时间开始后勤任务'));
    return updateRow('logisticsTasks', task.rowIndex, {'执行人形小队':squadName, '开始时间':startTime}, options);
  }

  function resourceRowMap(tables){
    var map = {};
    rows('resourceStatus', tables).forEach(function(row){
      var name = String(field(row, ['资源项','resource_name','name'])).trim();
      if(name) map[name] = row;
    });
    return map;
  }

  function updateResourceAmounts(delta, options){
    options = options || {};
    var pairs = [
      ['人力', delta.manpower || 0],
      ['弹药', delta.ammo || 0],
      ['口粮', delta.ration || 0],
      ['零件', delta.parts || 0],
      ['心智核心', delta.memoryCore || 0]
    ];
    var changed = pairs.filter(function(pair){ return pair[1]; });
    if(!changed.length) return Promise.resolve(true);
    var sql = changed.map(function(pair){
      return 'UPDATE resource_status SET amount = MAX(0, CAST(COALESCE(amount, 0) AS INTEGER) + ' + sqlValue(pair[1]) + ') WHERE resource_name = ' + sqlValue(pair[0]);
    }).join(';\n') + ';';
    return executeSqlBatch({sql:sql, targetSheetKeys:['sheet_resource_status']}, options).then(function(){ return true; });
  }

  function completeLogisticsTask(taskRowIndex, options){
    options = options || {};
    var task = logisticsTaskRows().filter(function(row){ return String(row.rowIndex) === String(taskRowIndex); })[0];
    if(!task) return Promise.reject(new Error('未找到后勤任务行：' + taskRowIndex));
    if(!task.assignedSquad || !task.startTime) return Promise.reject(new Error('该后勤任务尚未领取'));
    if(!logisticsTaskReady(task)) return Promise.reject(new Error('剧情时间尚未达到完成时间：' + (task.endTime || '未知')));
    return updateResourceAmounts(task.reward, {skipNotify:true}).then(function(){
      return deleteRow('logisticsTasks', task.rowIndex, options);
    }).then(function(){
      return {completed:true, task:task};
    });
  }

  function getSkinImage(skinName, damaged){
    var cleanName = normalizeSkinName(skinName);
    if(!cleanName) return Promise.resolve('');
    return waitForApi(getBubbleCG, {label:'BubbleCG'}).then(function(api){
      if(!api || typeof api.getImage !== 'function') throw new Error('BubbleCG.getImage 不可用');
      return api.getImage(cleanName, damaged ? 2 : 1);
    }).then(function(url){ return url || ''; });
  }

  function applyImageFromSkin(img, skinName, damaged){
    if(!img) return Promise.resolve('');
    return getSkinImage(skinName, damaged).then(function(url){
      if(url) img.src = url;
      return url;
    }).catch(function(error){
      console.warn('皮肤图片获取失败:', skinName, damaged ? 2 : 1, error);
      return '';
    });
  }

  function mergeOptions(base, extra){
    var out = {};
    Object.keys(base || {}).forEach(function(key){ out[key] = base[key]; });
    Object.keys(extra || {}).forEach(function(key){ out[key] = extra[key]; });
    return out;
  }

  function executeSqlMutation(sqlOrOptions, params, options){
    var api = getApi();
    if(!api || typeof api.executeSqlMutation !== 'function') return Promise.reject(new Error('AutoCardUpdaterAPI.executeSqlMutation 不可用'));
    if(typeof sqlOrOptions === 'object') return api.executeSqlMutation(mergeOptions(sqlOrOptions, options || {}));
    return api.executeSqlMutation(sqlOrOptions, params || [], options || {});
  }

  function executeSqlBatch(sqlOrOptions, options){
    var api = getApi();
    if(!api || typeof api.executeSqlBatch !== 'function') return Promise.reject(new Error('AutoCardUpdaterAPI.executeSqlBatch 不可用'));
    if(typeof sqlOrOptions === 'object') return api.executeSqlBatch(mergeOptions(sqlOrOptions, options || {}));
    return api.executeSqlBatch(sqlOrOptions, options || {});
  }

  function updateCell(tableKey, rowIndex, colIdentifier, value, options){
    var tableName = tableNameForApi(tableKey);
    var columnName = columnNameForSql(tableKey, colIdentifier);
    var sheetKey = sheetKeyForTable(tableKey);
    if(typeof columnName !== 'string' || !columnName) return Promise.reject(new Error('非法 SQL 列名：' + colIdentifier));
    return executeSqlMutation('UPDATE ' + tableName + ' SET ' + columnName + ' = ? WHERE row_id = ?', [value, rowIndex], mergeOptions({targetSheetKeys: sheetKey ? [sheetKey] : undefined}, options || {}));
  }

  function updateRow(tableKey, rowIndex, data, options){
    var tableName = tableNameForApi(tableKey);
    var sqlData = normalizeSqlData(tableKey, data);
    var keys = Object.keys(sqlData);
    var sheetKey = sheetKeyForTable(tableKey);
    if(!keys.length) return Promise.reject(new Error('updateRow 缺少可写 SQL 字段'));
    return executeSqlMutation('UPDATE ' + tableName + ' SET ' + keys.map(function(key){ return key + ' = ?'; }).join(', ') + ' WHERE row_id = ?', keys.map(function(key){ return sqlData[key]; }).concat([rowIndex]), mergeOptions({targetSheetKeys: sheetKey ? [sheetKey] : undefined}, options || {}));
  }

  function insertRow(tableKey, data, options){
    var tableName = tableNameForApi(tableKey);
    var sqlData = normalizeSqlData(tableKey, data);
    var keys = Object.keys(sqlData);
    var sheetKey = sheetKeyForTable(tableKey);
    if(!keys.length) return Promise.reject(new Error('insertRow 缺少可写 SQL 字段'));
    return executeSqlMutation('INSERT INTO ' + tableName + ' (' + keys.join(', ') + ') VALUES (' + keys.map(function(){ return '?'; }).join(', ') + ')', keys.map(function(key){ return sqlData[key]; }), mergeOptions({targetSheetKeys: sheetKey ? [sheetKey] : undefined}, options || {}))
      .then(function(result){ return result && result.lastInsertRowid ? result.lastInsertRowid : result; });
  }

  function deleteRow(tableKey, rowIndex, options){
    var tableName = tableNameForApi(tableKey);
    var sheetKey = sheetKeyForTable(tableKey);
    return executeSqlMutation('DELETE FROM ' + tableName + ' WHERE row_id = ?', [rowIndex], mergeOptions({targetSheetKeys: sheetKey ? [sheetKey] : undefined}, options || {}));
  }

  function replaceRows(tableKey, dataRows, options){
    dataRows = Array.isArray(dataRows) ? dataRows : [];
    var tableName = tableNameForApi(tableKey);
    var sheetKey = sheetKeyForTable(tableKey);
    var statements = ['DELETE FROM ' + tableName];
    dataRows.forEach(function(data){
      var sqlData = normalizeSqlData(tableKey, data);
      var keys = Object.keys(sqlData);
      if(!keys.length) return;
      statements.push('INSERT INTO ' + tableName + ' (' + keys.join(', ') + ') VALUES (' + keys.map(function(key){ return sqlValue(sqlData[key]); }).join(', ') + ')');
    });
    return executeSqlBatch({sql: statements.join(';\n') + ';', targetSheetKeys: sheetKey ? [sheetKey] : undefined}, options || {});
  }

  function installGlobalClickFeedback(){
    if(!document || document.__gflClickFeedbackInstalled) return;
    document.__gflClickFeedbackInstalled = true;
    var style = document.createElement('style');
    style.id = 'gfl-global-click-feedback-style';
    style.textContent = [
      '.gfl-global-clicked{animation:gflGlobalClickPulse .26s ease-out!important}',
      '@keyframes gflGlobalClickPulse{0%{filter:brightness(1);box-shadow:0 0 0 rgba(232,200,64,0)}42%{filter:brightness(1.35);box-shadow:0 0 22px rgba(232,200,64,.42)}100%{filter:brightness(1);box-shadow:0 0 0 rgba(232,200,64,0)}}'
    ].join('\n');
    if(document.head) document.head.appendChild(style);
    document.addEventListener('click', function(e){
      var target = e.target && e.target.closest ? e.target.closest('button,[role="button"],.gfl-card,.gfl-slot,.gfl-queue-item,.gfl-entity,.gfl-skin-btn,.gfl-filter-btn,[data-action],[data-recipe]') : null;
      if(!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      target.classList.remove('gfl-global-clicked');
      void target.offsetWidth;
      target.classList.add('gfl-global-clicked');
      setTimeout(function(){ target.classList.remove('gfl-global-clicked'); }, 300);
    }, true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installGlobalClickFeedback, {once:true});
  else installGlobalClickFeedback();

  window.GFLDataBridge = {
    TABLES: TABLES,
    esc: esc,
    clone: clone,
    getApi: getApi,
    sqlApi: sqlApi,
    getBubbleCG: getBubbleCG,
    getBubbleAvatar: getBubbleAvatar,
    getBubbleLive2D: getBubbleLive2D,
    waitForApi: waitForApi,
    getSheet: getSheet,
    getTable: getTable,
    tableNameForApi: tableNameForApi,
    queryRows: queryRows,
    rowsOf: rowsOf,
    rows: rows,
    field: field,
    num: num,
    yes: yes,
    rarityNumber: rarityNumber,
    parseStats: parseStats,
    normalizeSkinName: normalizeSkinName,
    skinImageGroup: skinImageGroup,
    isLive2DSkinName: isLive2DSkinName,
    splitSkinList: splitSkinList,
    warehouseTdolls: warehouseTdolls,
    ownedTdolls: ownedTdolls,
    resourceState: resourceState,
    currentStatus: currentStatus,
    currentChapter: currentChapter,
    sortieActive: sortieActive,
    setSortieActive: setSortieActive,
    chapterRows: chapterRows,
    selectableChapters: selectableChapters,
    sortieAreas: sortieAreas,
    storyFlagRows: storyFlagRows,
    storyFlagTriggered: storyFlagTriggered,
    routeNextChapterName: routeNextChapterName,
    enemyDataRows: enemyDataRows,
    enemyDataMap: enemyDataMap,
    currentChapterProgress: currentChapterProgress,
    setCurrentChapter: setCurrentChapter,
    setChapterStatus: setChapterStatus,
    selectChapter: selectChapter,
    setSortieArea: setSortieArea,
    beginAreaSortie: beginAreaSortie,
    checkBossVictory: checkBossVictory,
    sendToTavern: sendToTavern,
    buildSortiePrompt: buildSortiePrompt,
    buildRetreatPrompt: buildRetreatPrompt,
    constructionRows: constructionRows,
    equipmentCatalogRows: equipmentCatalogRows,
    equipmentCatalogMap: equipmentCatalogMap,
    equipmentWarehouseRows: equipmentWarehouseRows,
    equipmentRelationRows: equipmentRelationRows,
    equipmentForTdoll: equipmentForTdoll,
    tdollCanEquip: tdollCanEquip,
    validateEquipmentForTdoll: validateEquipmentForTdoll,
    equipToTdoll: equipToTdoll,
    unequipFromTdoll: unequipFromTdoll,
    enhanceEquipment: enhanceEquipment,
    calibrateEquipment: calibrateEquipment,
    dismantleEquipment: dismantleEquipment,
    applyEquipmentStats: applyEquipmentStats,
    generateEquipmentStats: generateEquipmentStats,
    statText: statText,
    parseStatsRange: parseStatsRange,
    equipmentConstructionRows: equipmentConstructionRows,
    parseGlobalDateTime: parseGlobalDateTime,
    formatGlobalDateTime: formatGlobalDateTime,
    addMinutesToGlobalTime: addMinutesToGlobalTime,
    currentTaskRows: currentTaskRows,
    logisticsTaskRows: logisticsTaskRows,
    logisticsSquadRows: logisticsSquadRows,
    logisticsTaskReady: logisticsTaskReady,
    logisticsSquadAvailable: logisticsSquadAvailable,
    squadMeetsLogisticsRequirement: squadMeetsLogisticsRequirement,
    getSkinImage: getSkinImage,
    applyImageFromSkin: applyImageFromSkin,
    executeSqlMutation: executeSqlMutation,
    executeSqlBatch: executeSqlBatch,
    updateCell: updateCell,
    updateRow: updateRow,
    insertRow: insertRow,
    deleteRow: deleteRow,
    replaceRows: replaceRows
  };
})();
