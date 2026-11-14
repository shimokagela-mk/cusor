/* IndexedDB-backed Live2D resource resolver for Girls' Frontline preview pages.
 *
 * Expected IndexedDB contract:
 *   database: gfl-live2d-assets
 *   object store: assets
 *   key: <dir>/<state>/<relativePath>
 *
 * Example keys for 79type_1402:
 *   79type_1402/normal/model.json
 *   79type_1402/normal/model.moc
 *   79type_1402/normal/model.1024/texture_00.png
 *   79type_1402/normal/daiji_idle_01.mtn
 *   79type_1402/destroy/model.json
 *
 * Stored value may be one of:
 *   Blob
 *   ArrayBuffer
 *   string
 *   { blob }
 *   { data }
 *   { content }
 *   { buffer }
 */
(function(){
  'use strict';

  var DB_NAME = 'gfl-live2d-assets';
  var STORE_NAME = 'assets';
  var objectUrlRegistry = [];

  function openDatabase(){
    return new Promise(function(resolve, reject){
      if(!window.indexedDB){
        reject(new Error('当前环境不支持 IndexedDB'));
        return;
      }
      var req = window.indexedDB.open(DB_NAME);
      req.onerror = function(){ reject(req.error || new Error('IndexedDB 打开失败')); };
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function(){ resolve(req.result); };
    });
  }

  function readValue(db, key){
    return new Promise(function(resolve, reject){
      var tx;
      try{
        tx = db.transaction(STORE_NAME, 'readonly');
      }catch(e){
        reject(e);
        return;
      }
      var store = tx.objectStore(STORE_NAME);
      var req = store.get(key);
      req.onerror = function(){ reject(req.error || new Error('IndexedDB 读取失败: '+key)); };
      req.onsuccess = function(){
        resolve(req.result !== undefined ? req.result : null);
      };
    });
  }

  function isBlobLike(value){
    return !!(value && typeof value === 'object' && typeof value.arrayBuffer === 'function' && typeof value.size === 'number');
  }

  function describeUnsupportedValue(value){
    if(value == null) return String(value);
    var tag = Object.prototype.toString.call(value);
    var keys = [];
    try{ keys = Object.keys(value).slice(0, 12); }catch(e){}
    return tag + ' keys=' + keys.join(',');
  }

  function valueToBlob(value, mime){
    if(value instanceof Blob || isBlobLike(value)) return value;
    if(value instanceof ArrayBuffer) return new Blob([value], {type:mime || 'application/octet-stream'});
    if(ArrayBuffer.isView(value)) return new Blob([value.buffer], {type:mime || 'application/octet-stream'});
    if(typeof value === 'string') return new Blob([value], {type:mime || 'text/plain'});
    if(value && (value.blob instanceof Blob || isBlobLike(value.blob))) return value.blob;
    if(value && (value.data instanceof Blob || isBlobLike(value.data))) return value.data;
    if(value && value.data instanceof ArrayBuffer) return new Blob([value.data], {type:mime || 'application/octet-stream'});
    if(value && typeof value.data === 'string') return new Blob([value.data], {type:mime || 'text/plain'});
    if(value && typeof value.content === 'string') return new Blob([value.content], {type:mime || 'text/plain'});
    if(value && value.buffer instanceof ArrayBuffer) return new Blob([value.buffer], {type:mime || 'application/octet-stream'});
    throw new Error('IndexedDB 资源格式不支持: ' + describeUnsupportedValue(value));
  }

  function createObjectUrl(blob){
    var url = URL.createObjectURL(blob);
    objectUrlRegistry.push(url);
    return url;
  }

  function blobToDataUrl(blob){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onerror = function(){ reject(reader.error || new Error('读取 Blob Data URL 失败')); };
      reader.onload = function(){ resolve(String(reader.result || '')); };
      reader.readAsDataURL(blob);
    });
  }

  function readTextBlob(blob){
    return blob.text ? blob.text() : new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onerror = function(){ reject(reader.error || new Error('读取 Blob 文本失败')); };
      reader.onload = function(){ resolve(String(reader.result || '')); };
      reader.readAsText(blob);
    });
  }

  function normalizeAssetBlob(value, relativePath){
    return valueToBlob(value, inferMime(relativePath));
  }

  function inferMime(relativePath){
    var path = String(relativePath || '').toLowerCase();
    if(/\.json$/.test(path)) return 'application/json';
    if(/\.png$/.test(path)) return 'image/png';
    if(/\.jpe?g$/.test(path)) return 'image/jpeg';
    if(/\.webp$/.test(path)) return 'image/webp';
    return 'application/octet-stream';
  }

  function normalizeModelJson(modelJson, assetUrls){
    var next = JSON.parse(JSON.stringify(modelJson));
    next.model = assetUrls.model;
    next.textures = (next.textures || []).map(function(file){
      return assetUrls.files[file] || file;
    });
    if(Array.isArray(next.expressions)){
      next.expressions = next.expressions.filter(function(expression){
        if(!expression || !expression.file) return false;
        if(assetUrls.files[expression.file]){ expression.file = assetUrls.files[expression.file]; return true; }
        return false;
      });
    }
    if(next.motions){
      Object.keys(next.motions).forEach(function(group){
        var motions = next.motions[group];
        if(!Array.isArray(motions)) return;
        next.motions[group] = motions.filter(function(motion){
          if(!motion || !motion.file) return false;
          if(assetUrls.files[motion.file]){ motion.file = assetUrls.files[motion.file]; return true; }
          return false;
        });
      });
    }
    normalizeTouchMotionMap(next, assetUrls);
    applyExplicitTouchMotionGroups(next);
    if(next.physics && typeof next.physics === 'string' && assetUrls.files[next.physics]){
      next.physics = assetUrls.files[next.physics];
    }
    if(next.pose && typeof next.pose === 'string' && assetUrls.files[next.pose]){
      next.pose = assetUrls.files[next.pose];
    }
    return next;
  }

  function normalizeTouchMotionMap(json, assetUrls){
    var map = json.gfl_touch_motions;
    if(!map || typeof map !== 'object' || Array.isArray(map)) return;
    Object.keys(map).forEach(function(area){
      var files = map[area];
      if(!Array.isArray(files)){
        delete map[area];
        return;
      }
      map[area] = files.filter(function(file){
        return typeof file === 'string' && !!assetUrls.files[file];
      }).map(function(file){
        return assetUrls.files[file];
      });
      if(!map[area].length) delete map[area];
    });
  }

  function applyExplicitTouchMotionGroups(json){
    if(!json.motions) return;
    var map = json.gfl_touch_motions;
    function cloneMotion(motion){ return JSON.parse(JSON.stringify(motion)); }
    function mergeIdleWaitMotions(){
      var unnamed = json.motions[''];
      if(!Array.isArray(unnamed) || !Array.isArray(json.motions.idle)) return;
      var seen = Object.create(null);
      json.motions.idle.forEach(function(motion){
        if(motion && motion.file) seen[motion.file] = true;
      });
      unnamed.forEach(function(motion){
        if(!motion || !motion.file) return;
        if(!/wait/i.test(String(motion.file))) return;
        if(seen[motion.file]) return;
        seen[motion.file] = true;
        json.motions.idle.push(cloneMotion(motion));
      });
    }
    function motionGroupForArea(area){
      if(area === 'shake') return 'shake';
      if(area === 'body') return 'tap_body';
      return 'tap_' + area;
    }
    function addMotion(group, motion){
      if(!json.motions[group]) json.motions[group] = [];
      var file = motion && motion.file;
      if(file){
        for(var i=0;i<json.motions[group].length;i++){
          if(json.motions[group][i] && json.motions[group][i].file === file) return;
        }
      }
      json.motions[group].push(cloneMotion(motion));
    }
    function indexMotionsByFile(){
      var index = Object.create(null);
      Object.keys(json.motions).forEach(function(group){
        var motions = json.motions[group];
        if(!Array.isArray(motions)) return;
        motions.forEach(function(motion){
          if(motion && motion.file && !index[motion.file]) index[motion.file] = motion;
        });
      });
      return index;
    }
    function addAreaMotion(area,motion){
      var group = motionGroupForArea(area);
      addMotion(group, motion);
      if(area !== 'body' && area !== 'shake'){
        /* This bundled Live2D runtime only starts tap_body on click; keep area groups for data visibility, but mirror click motions into tap_body. */
        addMotion('tap_body', motion);
      }
    }
    mergeIdleWaitMotions();
    if(!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length){
      if(!json.motions.tap_body && Array.isArray(json.motions.idle) && json.motions.idle.length){
        json.motions.tap_body = JSON.parse(JSON.stringify(json.motions.idle));
      }
      return;
    }
    var indexedMotions = indexMotionsByFile();
    Object.keys(map).forEach(function(area){
      var group = motionGroupForArea(area);
      var files = map[area];
      if(!Array.isArray(files)) return;
      files.forEach(function(file){
        var motion = indexedMotions[file];
        if(motion) addAreaMotion(area, motion);
      });
    });
    if(!json.motions.tap_body && Array.isArray(json.motions.idle) && json.motions.idle.length){
      json.motions.tap_body = JSON.parse(JSON.stringify(json.motions.idle));
    }
  }

  function collectRelativeFiles(modelJson){
    var files = [];
    if(modelJson.model) files.push({path:modelJson.model, mime:'application/octet-stream', kind:'model'});
    (modelJson.textures || []).forEach(function(path){ files.push({path:path, mime:'image/png'}); });
    if(Array.isArray(modelJson.expressions)){
      modelJson.expressions.forEach(function(expression){
        if(expression && expression.file) files.push({path:expression.file, mime:'application/json'});
      });
    }
    if(modelJson.physics && typeof modelJson.physics === 'string') files.push({path:modelJson.physics, mime:'application/json'});
    if(modelJson.pose && typeof modelJson.pose === 'string') files.push({path:modelJson.pose, mime:'application/json'});
    if(modelJson.gfl_touch_motions && typeof modelJson.gfl_touch_motions === 'object'){
      Object.keys(modelJson.gfl_touch_motions).forEach(function(area){
        var mappedFiles = modelJson.gfl_touch_motions[area];
        if(!Array.isArray(mappedFiles)) return;
        mappedFiles.forEach(function(path){ if(path) files.push({path:path, mime:'application/octet-stream'}); });
      });
    }
    if(modelJson.motions){
      Object.keys(modelJson.motions).forEach(function(group){
        var motions = modelJson.motions[group];
        if(!Array.isArray(motions)) return;
        motions.forEach(function(motion){
          if(motion && motion.file) files.push({path:motion.file, mime:'application/octet-stream'});
        });
      });
    }
    var seen = Object.create(null);
    return files.filter(function(file){
      if(seen[file.path]) return false;
      seen[file.path] = true;
      return true;
    });
  }

  function buildKey(dir, state, relativePath){
    return [dir, state, relativePath].join('/');
  }

  async function resolveState(db, dir, state){
    var modelKey = buildKey(dir, state, 'model.json');
    var modelBlob = valueToBlob(await readValue(db, modelKey), 'application/json');
    var modelJson = JSON.parse(await readTextBlob(modelBlob));
    var files = collectRelativeFiles(modelJson);
    var assetUrls = {model:null, files:Object.create(null)};

    for(var i=0;i<files.length;i++){
      var file = files[i];
      var raw = await readValue(db, buildKey(dir, state, file.path));
      if(raw === undefined || raw === null){
        if(file.kind === 'model') throw new Error('缺少关键资源: '+file.path);
        continue;
      }
      var blob = valueToBlob(raw, file.mime);
      var url  = await blobToDataUrl(blob);
      assetUrls.files[file.path] = url;
      if(file.kind === 'model') assetUrls.model = url;
    }

    if(!assetUrls.model) throw new Error('Live2D model.json 缺少 model 字段: '+dir+'/'+state);

    var patchedJson = normalizeModelJson(modelJson, assetUrls);
    var patchedBlob = new Blob([JSON.stringify(patchedJson)], {type:'application/json'});
    return blobToDataUrl(patchedBlob);
  }

  async function resolvePackageState(modelPackage, state){
    if(!modelPackage || !modelPackage.states || !modelPackage.states[state]) throw new Error('Live2D package 缺少状态: '+state);
    var stateData = modelPackage.states[state];
    var files = stateData.files || {};
    var modelBlob = files['model.json'] ? normalizeAssetBlob(files['model.json'], 'model.json') : null;
    if(!modelBlob) throw new Error('Live2D package 缺少 '+state+'/model.json');
    var modelJson = stateData.modelJson || JSON.parse(await readTextBlob(modelBlob));
    var refs = collectRelativeFiles(modelJson);
    var assetUrls = {model:null, files:Object.create(null)};
    for(var i=0;i<refs.length;i++){
      var file = refs[i];
      var raw = files[file.path];
      if(raw === undefined || raw === null){
        if(file.kind === 'model') throw new Error('Live2D package 缺少关键资源: '+state+'/'+file.path);
        continue;
      }
      var blob = normalizeAssetBlob(raw, file.path);
      var url = await blobToDataUrl(blob);
      assetUrls.files[file.path] = url;
      if(file.kind === 'model') assetUrls.model = url;
    }
    if(!assetUrls.model) throw new Error('Live2D package model.json 缺少 model 字段: '+modelPackage.dir+'/'+state);
    var patchedJson = normalizeModelJson(modelJson, assetUrls);
    var patchedBlob = new Blob([JSON.stringify(patchedJson)], {type:'application/json'});
    return blobToDataUrl(patchedBlob);
  }

  async function resolveLive2DPackage(modelPackage){
    if(!modelPackage || !modelPackage.dir) throw new Error('Live2D package 缺少 dir');
    var normalUrl = await resolvePackageState(modelPackage, 'normal');
    var destroyUrl = normalUrl;
    if(modelPackage.states && modelPackage.states.destroy){
      try{ destroyUrl = await resolvePackageState(modelPackage, 'destroy'); }catch(e){ destroyUrl = normalUrl; }
    }
    return {
      dir: modelPackage.dir,
      name: modelPackage.name || modelPackage.dir,
      jsonPath: normalUrl,
      damagedJsonPath: destroyUrl,
      version: modelPackage.version || '',
      hasDestroy: !!(modelPackage.states && modelPackage.states.destroy),
      source: 'BubbleLive2D.getModelPackage'
    };
  }

  async function resolveLive2DState(state){
    if(!state || !state.dir) throw new Error('Live2D 状态缺少 dir');
    var db = await openDatabase();
    try{
      var normalUrl = await resolveState(db, state.dir, 'normal');
      var destroyUrl = null;
      try{
        destroyUrl = await resolveState(db, state.dir, 'destroy');
      }catch(e){
        destroyUrl = normalUrl;
      }
      var next = {};
      Object.keys(state).forEach(function(key){ next[key] = state[key]; });
      next.jsonPath = normalUrl;
      next.damagedJsonPath = destroyUrl;
      next.source = 'indexeddb';
      return next;
    }finally{
      db.close();
    }
  }

  function revokeObjectUrls(){
    objectUrlRegistry.splice(0).forEach(function(url){
      try{ URL.revokeObjectURL(url); }catch(e){}
    });
  }

  window.GFLIndexedDBLive2D = {
    resolveLive2DState: resolveLive2DState,
    resolveLive2DPackage: resolveLive2DPackage,
    revokeObjectUrls: revokeObjectUrls,
    databaseName: DB_NAME,
    storeName: STORE_NAME
  };
})();
