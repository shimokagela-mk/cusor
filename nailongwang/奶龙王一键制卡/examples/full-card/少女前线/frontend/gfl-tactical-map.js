/* Shared tactical map SVG renderer for Girls' Frontline frontend pages.
 * Keep map.html and battle.html on the same drawing contract.
 */
(function(){
  'use strict';

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function num(v, def){
    var n = parseInt(v, 10);
    return isNaN(n) ? def : n;
  }

  function isUnitType(t){
    return ['友方','敌方','NPC','npc','ally','enemy','主角'].indexOf(t) >= 0;
  }

  function typeClass(t){
    if(['友方','ally','主角','protagonist'].indexOf(t) >= 0) return 'ally';
    if(['敌方','enemy'].indexOf(t) >= 0) return 'enemy';
    if(['NPC','npc'].indexOf(t) >= 0) return 'npc';
    if(['地形','环境','火力','交互','部署','事件','出口','地标','障碍物','terrain','environment','fire','interactive','deployment','event','exit','landmark','obstacle'].indexOf(t) >= 0) return 'land';
    return 'base';
  }

  function colorOf(t){
    var c = typeClass(t);
    return {ally:'#6bb7ff', enemy:'#e74c3c', npc:'#f39c12', land:'#8b7355', base:'#78e0d0'}[c] || '#78e0d0';
  }

  function renderUnitMarker(it, i, compact){
    var x = Math.max(45, Math.min(755, num(it['X坐标'], 100 + i * 80)));
    var y = Math.max(55, Math.min(545, num(it['Y坐标'], 220)));
    var t = it['元素类型'];
    var col = colorOf(t);
    var name = it['元素名称'];
    var av = it['头像'];
    var hpText = it['血量文本'] || '';
    var r = compact ? 22 : 28;
    var img = compact ? 36 : 48;
    var labelY = y + (compact ? 37 : 44);
    var clip = 'clip-' + i;
    var body = av
      ? '<circle class="marker-core" cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#111" stroke="'+col+'" stroke-width="3"/>'
        + '<clipPath id="'+clip+'"><circle cx="'+x+'" cy="'+y+'" r="'+(r-3)+'"/></clipPath>'
        + '<image href="'+esc(av)+'" x="'+(x-img/2)+'" y="'+(y-img/2)+'" width="'+img+'" height="'+img+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+clip+')"/>'
        + '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="1.5"/>'
      : '<circle class="marker-core" cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+col+'" stroke="#fff" stroke-width="2.5"/>'
        + '<text x="'+x+'" y="'+(y+5)+'" text-anchor="middle" fill="#fff" font-size="13" font-weight="900">'+esc(String(name).charAt(0))+'</text>';
    var hp = hpText ? '<text x="'+x+'" y="'+(labelY+14)+'" text-anchor="middle" fill="#ddd" font-size="9" font-weight="700">'+esc(hpText)+'</text>' : '';
    return '<g class="cm" data-idx="'+i+'" data-x="'+x+'" data-y="'+y+'">'+body
      + '<rect x="'+(x-42)+'" y="'+(labelY-12)+'" width="84" height="17" rx="4" fill="rgba(0,0,0,.62)" stroke="'+col+'" stroke-width=".8"/>'
      + '<text x="'+x+'" y="'+labelY+'" text-anchor="middle" fill="'+col+'" font-size="10" font-weight="900">'+esc(name)+'</text>'
      + hp
      + '</g>';
  }

  function renderBaseSvg(items){
    var marks = items.map(function(it, i){
      var x = num(it['X坐标'], 0), y = num(it['Y坐标'], 0), w = 150, h = 82, t = it['元素类型'];
      if(isUnitType(t)) return renderUnitMarker(it, i, true);
      if(t === '出口'){
        return '<g class="cm" data-idx="'+i+'" data-x="400" data-y="572"><polygon points="360,545 440,545 470,590 330,590" fill="#203a34" stroke="#78e0d0" stroke-width="2"/><text x="400" y="572" text-anchor="middle" fill="#78e0d0" font-size="15" font-weight="900">'+esc(it['元素名称'])+'</text></g>';
      }
      return '<g class="cm" data-idx="'+i+'" data-x="'+x+'" data-y="'+y+'"><rect x="'+(x-w/2)+'" y="'+(y-h/2)+'" width="'+w+'" height="'+h+'" rx="8" fill="rgba(20,24,24,.96)" stroke="'+colorOf(t)+'" stroke-width="2"/><text x="'+x+'" y="'+(y-8)+'" text-anchor="middle" fill="'+colorOf(t)+'" font-size="15" font-weight="900">'+esc(it['元素名称'])+'</text><text x="'+x+'" y="'+(y+18)+'" text-anchor="middle" fill="#aaa" font-size="10">'+esc(it['所属区域'])+'</text></g>';
    }).join('');
    return '<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(232,200,64,.09)" stroke-width="1"/></pattern></defs><rect width="800" height="600" fill="#101314"/><rect width="800" height="600" fill="url(#grid)"/><path d="M400 126V540M185 216H615M165 375H620M225 458H535" stroke="rgba(232,200,64,.24)" stroke-width="8" stroke-linecap="round"/><path d="M150 245C255 210 322 340 440 270S555 232 650 392M292 362C360 420 452 420 535 438M380 525C455 490 565 510 650 392" fill="none" stroke="rgba(107,183,255,.15)" stroke-width="6" stroke-linecap="round" stroke-dasharray="10 10"/><text x="400" y="35" text-anchor="middle" fill="#e8c840" font-size="22" font-weight="900">格里芬前线基地</text><text x="400" y="58" text-anchor="middle" fill="#888" font-size="11">未出击状态 · 基地设施与人形自由活动</text>'+marks+'</svg>';
  }

  function combatPoint(it, i){
    return {
      x: Math.max(45, Math.min(755, num(it['X坐标'], 100 + i * 80))),
      y: Math.max(95, Math.min(545, num(it['Y坐标'], 220))),
      type: it['元素类型'],
      name: it['元素名称'],
      status: it['状态'] || '',
      region: it['所属区域'] || '',
      legend: it['战术背景'] || it['描述'] || ''
    };
  }

  function isTerrainType(t){
    return ['地形','环境','火力','交互','部署','事件','出口','地标','障碍物','terrain','environment','fire','interactive','deployment','event','exit','landmark','obstacle'].indexOf(t) >= 0;
  }

  function isObstacleType(t){
    return ['障碍物','地形','环境','obstacle','terrain','environment'].indexOf(t) >= 0;
  }

  function isExitType(t){
    return ['出口','exit'].indexOf(t) >= 0;
  }

  function terrainIntent(p){
    var text = String((p && (p.status + ' ' + p.name + ' ' + p.legend)) || '');
    var tag = String((p && p.status) || '').match(/^\s*[\[【]([^\]】]+)[\]】]/);
    if(tag){
      var map = {
        '掩体':'cover',
        '重掩体':'heavyCover',
        '封锁':'block',
        '火力点':'fire',
        '高地':'highground',
        '危险地形':'hazard',
        '烟雾':'smoke',
        '火焰':'flame',
        '积水':'water',
        '毒雾':'toxic',
        '电磁干扰':'emp',
        '塌陷区':'collapse',
        '辐射区':'radiation',
        '建筑':'building',
        '载具残骸':'wreck',
        '狭窄通道':'narrow',
        '火力覆盖区':'fireZone',
        '狙击线':'sniperLine',
        '压制区':'suppression',
        '爆炸范围':'blast',
        '自动炮塔':'turret',
        '物资':'supply',
        '终端':'terminal',
        '门禁':'gate',
        '控制台':'console',
        '电源':'power',
        '通信装置':'comms',
        '数据核心':'dataCore',
        '爆破点':'breach',
        '开关':'switch',
        '锁定目标':'target',
        '我方部署点':'allyDeploy',
        '敌方部署点':'enemyDeploy',
        '增援点':'reinforce',
        '伏击点':'ambush',
        '巡逻路线':'patrol',
        '警戒装置':'alarm',
        '陷阱':'trap',
        '地雷':'mine',
        '倒计时事件':'timer',
        '集结点':'rally',
        '撤离点':'evac',
        '入口':'entry',
        '通路':'route',
        '突破口':'breachExit'
      };
      if(map[tag[1]]) return map[tag[1]];
    }
    if(/撤离|出口|入口|突破|离开|撤退/.test(text)) return 'exit';
    if(/终端|主机|服务器|控制台|核心/.test(text)) return 'terminal';
    if(/烟雾|烟幕|粉尘/.test(text)) return 'smoke';
    if(/火焰|燃烧|火海/.test(text)) return 'flame';
    if(/积水|水洼|机油/.test(text)) return 'water';
    if(/毒雾|毒气|污染雾/.test(text)) return 'toxic';
    if(/电磁|干扰|EMP/.test(text)) return 'emp';
    if(/塌陷|坍塌|崩落/.test(text)) return 'collapse';
    if(/辐射|污染区/.test(text)) return 'radiation';
    if(/炮塔|自动炮/.test(text)) return 'turret';
    if(/地雷|雷区/.test(text)) return 'mine';
    if(/陷阱|绊线/.test(text)) return 'trap';
    if(/增援/.test(text)) return 'reinforce';
    if(/伏击/.test(text)) return 'ambush';
    if(/巡逻/.test(text)) return 'patrol';
    if(/警戒|警报/.test(text)) return 'alarm';
    if(/电源|供电|发电/.test(text)) return 'power';
    if(/通信|信号|天线/.test(text)) return 'comms';
    if(/数据核心|核心数据/.test(text)) return 'dataCore';
    if(/爆破|炸点|破门/.test(text)) return 'breach';
    if(/物资|补给|弹药|维修|医疗|箱/.test(text)) return 'supply';
    if(/车辆|装甲|坦克|运输车|机甲|机械残骸/.test(text)) return 'wreck';
    if(/建筑|厂房|哨所|房间|设施/.test(text)) return 'building';
    if(/高地|楼顶|制高|观察/.test(text)) return 'highground';
    if(/火焰|毒|辐射|积水|机油|塌陷|危险/.test(text)) return 'hazard';
    if(/重掩体|工事|货柜|墙|屏障|防线/.test(text)) return 'heavyCover';
    if(/掩体|遮蔽|废墟|残骸|沙袋/.test(text)) return 'cover';
    if(/封锁|阻断|路障|不可通行|塌陷|断桥|火海/.test(text)) return 'block';
    if(/火力|狙击|炮|机枪|高地|控制/.test(text)) return 'fire';
    if(/目标|任务|设施|核心|终端|闸门|指挥/.test(text)) return 'objective';
    return 'landmark';
  }

  function terrainIcon(intent){
    var icons = {
      cover: {label:'COV', fill:'rgba(107,183,255,.10)', glyph:'M-18 3L-12-8H12L18 3L13 10H-13Z'},
      heavyCover: {label:'HVY', fill:'rgba(107,183,255,.13)', glyph:'M-19-10H19V10H-19ZM-12-3H12V3H-12Z'},
      block: {label:'BLK', fill:'rgba(224,64,64,.12)', glyph:'M-19-6H19V6H-19ZM-14-14L14 14M14-14L-14 14'},
      fire: {label:'FIRE', fill:'rgba(224,64,64,.10)', glyph:'M0-18L16 9H-16ZM0-6L6 6H-6Z'},
      highground: {label:'HIGH', fill:'rgba(232,200,64,.10)', glyph:'M-18 13L0-18L18 13ZM-8 13L0 0L8 13'},
      hazard: {label:'HAZ', fill:'rgba(224,120,64,.10)', glyph:'M-19 7C-10-10-3 12 5-4C11-15 20-2 17 9C8 15-9 15-19 7Z'},
      smoke: {label:'SMK', fill:'rgba(170,180,175,.10)', glyph:'M-18 5C-23-8-9-16-2-8C5-19 22-10 15 2C25 8 13 18 3 11C-6 19-21 16-18 5Z'},
      flame: {label:'FIRE', fill:'rgba(224,90,40,.12)', glyph:'M0 18C-14 8-5-3-8-16C0-9 3-18 4-23C13-12 18-3 12 9C8 17 2 18 0 18Z'},
      water: {label:'WTR', fill:'rgba(80,160,220,.10)', glyph:'M-19 6C-9-10 9-10 19 6C9 16-9 16-19 6ZM-10 4C-4 0 4 0 10 4'},
      toxic: {label:'TOX', fill:'rgba(90,220,110,.10)', glyph:'M0-17L16 10H-16ZM-7-1H7M0-8V6'},
      emp: {label:'EMP', fill:'rgba(150,120,240,.11)', glyph:'M-16-8H-3L-8-18L15 0H3L8 18Z'},
      collapse: {label:'COL', fill:'rgba(170,120,70,.10)', glyph:'M-18 12L-10-14L-2 4L5-16L18 12ZM-12 12H13'},
      radiation: {label:'RAD', fill:'rgba(200,230,80,.10)', glyph:'M0 0L0-18M0 0L16 9M0 0L-16 9M0 0m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0'},
      building: {label:'BLDG', fill:'rgba(160,170,185,.09)', glyph:'M-16-17H16V17H-16ZM-7-7H-2M4-7H9M-7 4H-2M4 4H9'},
      wreck: {label:'WREK', fill:'rgba(180,120,70,.10)', glyph:'M-20-4L-10-13H9L20-2L13 12H-13ZM-12 12L-4 4M5 5L14 12'},
      narrow: {label:'NAR', fill:'rgba(232,200,64,.07)', glyph:'M-18-14V14M18-14V14M-8 0H8M3-6L9 0L3 6M-3-6L-9 0L-3 6'},
      fireZone: {label:'F-ZN', fill:'rgba(224,64,64,.10)', glyph:'M-18-12C-2-21 12-15 19-2M-18 0C-2-9 12-3 19 10M-18 12C-4 4 8 8 16 17'},
      sniperLine: {label:'SNP', fill:'rgba(224,64,64,.08)', glyph:'M-20 0H20M10-7L20 0L10 7M0-9V9'},
      suppression: {label:'SUPR', fill:'rgba(224,64,64,.10)', glyph:'M-19-10H19M-19 0H19M-19 10H19M11-16L19-10L11-4'},
      blast: {label:'BLS', fill:'rgba(224,120,40,.11)', glyph:'M0-19L5-6L18-12L10 0L18 12L5 6L0 19L-5 6L-18 12L-10 0L-18-12L-5-6Z'},
      turret: {label:'TUR', fill:'rgba(224,64,64,.11)', glyph:'M-14 8H14V17H-14ZM0 8V-16M0-16L16-6M0-16L-16-6'},
      supply: {label:'SUP', fill:'rgba(120,224,208,.10)', glyph:'M-15-14H15V14H-15ZM-15-2H15M0-14V14'},
      terminal: {label:'TERM', fill:'rgba(120,224,208,.11)', glyph:'M-17-14H17V8H-17ZM-9 14H9M-4 8V14M-7-3H7'},
      gate: {label:'GATE', fill:'rgba(232,200,64,.09)', glyph:'M-16 17V-15H16V17M-6 17V-2H6V17M-16-15H16'},
      console: {label:'CONS', fill:'rgba(120,224,208,.10)', glyph:'M-18-10H18V9H-18ZM-10 15H10M-5 9V15M-9-3H-2M4-3H11'},
      power: {label:'PWR', fill:'rgba(232,200,64,.10)', glyph:'M0-18V-2M-8-10C-15-3-11 12 0 15C11 12 15-3 8-10'},
      comms: {label:'COM', fill:'rgba(120,224,208,.09)', glyph:'M0 15V-15M-12-2C-5-8 5-8 12-2M-18-9C-8-19 8-19 18-9'},
      dataCore: {label:'DATA', fill:'rgba(120,224,208,.12)', glyph:'M0-18L16-9V9L0 18L-16 9V-9ZM0-7L7-3V5L0 9L-7 5V-3Z'},
      breach: {label:'BRCH', fill:'rgba(224,120,40,.11)', glyph:'M-16-14H16V14H-16ZM-6-14L-12-4L-5 0L-12 12M7-14L12-5L5 1L12 14'},
      switch: {label:'SW', fill:'rgba(120,224,208,.09)', glyph:'M-18 0H18M-6 0m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0'},
      target: {label:'TGT', fill:'rgba(232,200,64,.10)', glyph:'M0-18V-10M0 10V18M-18 0H-10M10 0H18M0 0m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0'},
      allyDeploy: {label:'A-DEP', fill:'rgba(107,183,255,.10)', glyph:'M0-18L18 14H-18ZM0-6V9M-7 2H7'},
      enemyDeploy: {label:'E-DEP', fill:'rgba(224,64,64,.10)', glyph:'M0-18L18 14H-18ZM-7-2L7 8M7-2L-7 8'},
      reinforce: {label:'REIN', fill:'rgba(180,136,224,.10)', glyph:'M-18-10H4V-18L18 0L4 18V10H-18Z'},
      ambush: {label:'AMB', fill:'rgba(180,136,224,.10)', glyph:'M-18 12L0-16L18 12M-9 5H9M-4-2H4'},
      patrol: {label:'PAT', fill:'rgba(180,136,224,.08)', glyph:'M-18 0C-8-12 8-12 18 0C8 12-8 12-18 0ZM10-6L18 0L10 6'},
      alarm: {label:'ALM', fill:'rgba(224,64,64,.10)', glyph:'M-12 12H12L7-8C5-16-5-16-7-8ZM-5 17H5M-16-10L-9-16M16-10L9-16'},
      trap: {label:'TRP', fill:'rgba(224,120,40,.10)', glyph:'M-18 13L0-17L18 13ZM-9 8H9M0-6V5'},
      mine: {label:'MINE', fill:'rgba(224,64,64,.10)', glyph:'M0 0m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M0-18V-10M0 10V18M-18 0H-10M10 0H18'},
      timer: {label:'TIME', fill:'rgba(232,200,64,.10)', glyph:'M0 2m-13 0a13 13 0 1 0 26 0a13 13 0 1 0-26 0M0 2V-7M0 2L7 6M-7-17H7'},
      rally: {label:'RLY', fill:'rgba(107,183,255,.10)', glyph:'M0-18V18M0-14L16-8L0-2'},
      evac: {label:'EVAC', fill:'rgba(120,224,208,.12)', glyph:'M-18-12H6L18 0L6 12H-18ZM-4-6L5 0L-4 6'},
      entry: {label:'IN', fill:'rgba(107,183,255,.10)', glyph:'M18-12H-6L-18 0L-6 12H18ZM4-6L-5 0L4 6'},
      breachExit: {label:'BRK', fill:'rgba(120,224,208,.11)', glyph:'M-17-15H17V15H-17ZM-4-15L-11-2L-4 3L-10 15M8-15L13-5L6 1L13 15'},
      route: {label:'RTE', fill:'rgba(232,200,64,.07)', glyph:'M-20 0H20M10-9L20 0L10 9'},
      exit: {label:'EXIT', fill:'rgba(120,224,208,.11)', glyph:'M-16-16H16V16H-16ZM-4-7L6 0L-4 7'},
      objective: {label:'OBJ', fill:'rgba(232,200,64,.10)', glyph:'M0-18L16-8L16 8L0 18L-16 8L-16-8Z'},
      landmark: {label:'SITE', fill:'rgba(232,200,64,.08)', glyph:'M0-16L14-6L14 9L0 17L-14 9L-14-6Z'}
    };
    return icons[intent] || icons.landmark;
  }

  function regionColor(name, index){
    var palette = [
      ['rgba(107,183,255,.06)','rgba(107,183,255,.28)'],
      ['rgba(224,64,64,.065)','rgba(224,64,64,.3)'],
      ['rgba(232,200,64,.055)','rgba(232,200,64,.26)'],
      ['rgba(120,224,208,.045)','rgba(120,224,208,.24)'],
      ['rgba(180,136,224,.05)','rgba(180,136,224,.24)']
    ];
    var seed = String(name || '').split('').reduce(function(n, ch){ return n + ch.charCodeAt(0); }, index || 0);
    return palette[seed % palette.length];
  }

  function renderCombatRegions(points){
    var groups = {};
    points.forEach(function(p){
      var region = String(p.region || '').trim();
      if(!region) return;
      if(!groups[region]) groups[region] = [];
      groups[region].push(p);
    });
    return Object.keys(groups).map(function(region, index){
      var list = groups[region];
      if(list.length < 2) return '';
      var minX = list[0].x, maxX = list[0].x, minY = list[0].y, maxY = list[0].y;
      list.forEach(function(p){ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); });
      var padX = 58, padY = 42;
      minX = Math.max(70, minX - padX); maxX = Math.min(740, maxX + padX);
      minY = Math.max(95, minY - padY); maxY = Math.min(505, maxY + padY);
      var colors = regionColor(region, index);
      return '<g opacity=".96"><path d="M'+minX+' '+minY+'H'+maxX+'L'+(maxX+12)+' '+((minY+maxY)/2)+'L'+maxX+' '+maxY+'H'+minX+'L'+(minX-12)+' '+((minY+maxY)/2)+'Z" fill="'+colors[0]+'" stroke="'+colors[1]+'" stroke-width="1.2"/><text x="'+(minX+10)+'" y="'+(minY+16)+'" fill="'+colors[1]+'" font-size="10" font-weight="900" letter-spacing="1">'+esc(region)+'</text></g>';
    }).join('');
  }

  function renderTerrainConnections(points){
    var byRegion = {};
    points.forEach(function(p){
      var region = String(p.region || '').trim();
      if(!region) return;
      if(!byRegion[region]) byRegion[region] = [];
      byRegion[region].push(p);
    });
    return Object.keys(byRegion).map(function(region){
      var list = byRegion[region].filter(function(p){ return isTerrainType(p.type); });
      if(list.length < 2) return '';
      list.sort(function(a,b){ return a.x === b.x ? a.y - b.y : a.x - b.x; });
      var d = 'M'+list[0].x+' '+list[0].y;
      for(var i=1;i<list.length;i++) d += 'L'+list[i].x+' '+list[i].y;
      return '<path d="'+d+'" fill="none" stroke="rgba(232,200,64,.18)" stroke-width="3" stroke-linecap="round" stroke-dasharray="12 10"/>';
    }).join('');
  }

  function renderCombatLandMarker(it, i){
    var p = combatPoint(it, i), col = colorOf(p.type), name = p.name, t = p.type;
    var intent = terrainIntent(p);
    if(isExitType(t) && intent === 'landmark') intent = 'exit';
    if(isObstacleType(t) && intent === 'landmark') intent = 'cover';
    var icon = terrainIcon(intent);
    return '<g class="cm" data-idx="'+i+'" data-x="'+p.x+'" data-y="'+p.y+'" filter="url(#marker-glow)">'
      + '<rect x="'+(p.x-22)+'" y="'+(p.y-22)+'" width="44" height="44" rx="6" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.055)" stroke-width="1"/>'
      + '<path transform="translate('+p.x+' '+p.y+')" d="'+icon.glyph+'" fill="'+icon.fill+'" stroke="'+col+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<circle cx="'+p.x+'" cy="'+p.y+'" r="2.8" fill="'+col+'"/>'
      + '<text x="'+p.x+'" y="'+(p.y-25)+'" text-anchor="middle" fill="#777" font-size="7" font-weight="900" letter-spacing=".8">'+icon.label+'</text>'
      + '<text x="'+p.x+'" y="'+(p.y+34)+'" text-anchor="middle" fill="'+col+'" font-size="9" font-weight="900" letter-spacing=".7">'+esc(name)+'</text>'
      + '</g>';
  }

  function renderCombatSvg(items, source){
    var points = items.map(combatPoint);
    var unitCount = points.filter(function(p){ return isUnitType(p.type); }).length;
    var terrainCount = points.filter(function(p){ return isTerrainType(p.type); }).length;
    var marks = items.map(function(it, i){
      return isUnitType(it['元素类型']) ? renderUnitMarker(it, i, false) : renderCombatLandMarker(it, i);
    }).join('');
    return '<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">'
      + '<defs>'
      + '<radialGradient id="combat-rad" cx="50%" cy="45%"><stop offset="0" stop-color="#202323"/><stop offset="1" stop-color="#050606"/></radialGradient>'
      + '<pattern id="combat-fine-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="rgba(232,200,64,.045)" stroke-width="1"/></pattern>'
      + '<pattern id="combat-major-grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="rgba(232,200,64,.13)" stroke-width="1.2"/></pattern>'
      + '<filter id="marker-glow"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#e8c840" flood-opacity=".22"/></filter>'
      + '<linearGradient id="combat-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.08)"/><stop offset=".5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,.28)"/></linearGradient>'
      + '</defs>'
      + '<rect width="800" height="600" fill="url(#combat-rad)"/>'
      + '<rect width="800" height="600" fill="url(#combat-fine-grid)"/>'
      + '<rect width="800" height="600" fill="url(#combat-major-grid)"/>'
      + '<path d="M70 95H740V505H70Z" fill="rgba(232,200,64,.015)" stroke="#b89820" stroke-width="2" stroke-dasharray="14 8"/>'
      + '<path d="M70 95H740M70 177H740M70 259H740M70 341H740M70 423H740M70 505H740M70 95V505M204 95V505M338 95V505M472 95V505M606 95V505M740 95V505" fill="none" stroke="rgba(232,200,64,.08)" stroke-width="1"/>'
      + renderCombatRegions(points)
      + renderTerrainConnections(points)
      + (terrainCount ? '' : '<g opacity=".7"><rect x="282" y="272" width="236" height="42" rx="4" fill="rgba(0,0,0,.42)" stroke="rgba(232,200,64,.2)"/><text x="400" y="298" text-anchor="middle" fill="#777" font-size="11" font-weight="800" letter-spacing="1">暂无地形层：仅显示单位坐标</text></g>')
      + '<g opacity=".72"><text x="82" y="86" fill="#e8c840" font-size="10" font-weight="900">GRID 00-ALPHA</text><text x="718" y="525" fill="#e04040" font-size="10" font-weight="900" text-anchor="end">THREAT LEVEL // ACTIVE</text></g>'
      + '<text x="400" y="38" text-anchor="middle" fill="#e8c840" font-size="21" font-weight="900" letter-spacing="4">TACTICAL COMBAT GRID</text>'
      + '<text x="400" y="63" text-anchor="middle" fill="#909090" font-size="11" letter-spacing="1">前线交战区域 · '+esc(source || '战场模拟')+' · UNIT '+unitCount+' · TERRAIN '+terrainCount+'</text>'
      + marks
      + '<rect width="800" height="600" fill="url(#combat-scan)" pointer-events="none"/>'
      + '<path d="M18 18H118M18 18V118M782 18H682M782 18V118M18 582H118M18 582V482M782 582H682M782 582V482" fill="none" stroke="rgba(232,200,64,.55)" stroke-width="3"/>'
      + '</svg>';
  }

  window.GFLTacticalMap = {
    esc: esc,
    num: num,
    isUnitType: isUnitType,
    typeClass: typeClass,
    colorOf: colorOf,
    renderUnitMarker: renderUnitMarker,
    renderBaseSvg: renderBaseSvg,
    renderCombatSvg: renderCombatSvg
  };
})();
