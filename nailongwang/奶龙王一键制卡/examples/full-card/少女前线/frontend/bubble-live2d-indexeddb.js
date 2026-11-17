/* BubbleLive2D IndexedDB package API.
 *
 * Public contract:
 *   window.BubbleLive2D.writeLive2DPackage(input)
 *   window.BubbleLive2D.getModelPackage(dir)
 *   window.BubbleLive2D.createRuntimeState(modelPackage)
 *
 * Storage contract:
 *   database: gfl-live2d-assets
 *   object store: assets
 *   key: <dir>/<state>/<relativePath>
 */
(function(){
  'use strict';

  var DB_NAME = 'gfl-live2d-assets';
  var STORE_NAME = 'assets';
  var STATES = ['normal', 'destroy'];
  var objectUrlRegistry = [];

  function openDatabase(){
    return new Promise(function(resolve, reject){
      if(!window.indexedDB){ reject(new Error('当前环境不支持 IndexedDB')); return; }
      var req = window.indexedDB.open(DB_NAME);
      req.onerror = function(){ reject(req.error || new Error('IndexedDB 打开失败')); };
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function(){ resolve(req.result); };
    });
  }

  function buildKey(dir, state, relativePath){
    return [dir, state, relativePath].join('/');
  }

  function metaKey(dir){
    return 'meta/' + dir + '/version';
  }

  function manifestKey(dir){
    return 'meta/' + dir + '/manifest';
  }

  function readValue(db, key){
    return new Promise(function(resolve, reject){
      var tx;
      try{ tx = db.transaction(STORE_NAME, 'readonly'); }
      catch(e){ reject(e); return; }
      var req = tx.objectStore(STORE_NAME).get(key);
      req.onerror = function(){ reject(req.error || new Error('IndexedDB 读取失败: ' + key)); };
      req.onsuccess = function(){ resolve(req.result !== undefined ? req.result : null); };
    });
  }

  function putMany(db, entries){
    return new Promise(function(resolve, reject){
      var tx;
      try{ tx = db.transaction(STORE_NAME, 'readwrite'); }
      catch(e){ reject(e); return; }
      tx.onerror = function(){ reject(tx.error || new Error('IndexedDB 写入失败')); };
      tx.onabort = function(){ reject(tx.error || new Error('IndexedDB 写入中止')); };
      tx.oncomplete = function(){ resolve(); };
      var store = tx.objectStore(STORE_NAME);
      entries.forEach(function(entry){ store.put(entry.value, entry.key); });
    });
  }

  function valueToBlob(value, mime){
    if(value instanceof Blob) return value;
    if(value instanceof ArrayBuffer) return new Blob([value], {type:mime || 'application/octet-stream'});
    if(ArrayBuffer.isView(value)) return new Blob([value.buffer], {type:mime || 'application/octet-stream'});
    if(typeof value === 'string') return new Blob([value], {type:mime || 'text/plain'});
    if(value && value.blob instanceof Blob) return value.blob;
    if(value && value.data instanceof Blob) return value.data;
    if(value && value.data instanceof ArrayBuffer) return new Blob([value.data], {type:mime || 'application/octet-stream'});
    if(value && ArrayBuffer.isView(value.data)) return new Blob([value.data.buffer], {type:mime || 'application/octet-stream'});
    if(value && typeof value.data === 'string') return new Blob([value.data], {type:value.mime || mime || 'text/plain'});
    if(value && typeof value.content === 'string') return new Blob([value.content], {type:value.mime || mime || 'text/plain'});
    if(value && value.buffer instanceof ArrayBuffer) return new Blob([value.buffer], {type:mime || 'application/octet-stream'});
    throw new Error('IndexedDB 资源格式不支持');
  }

  function readTextBlob(blob){
    return blob.text ? blob.text() : new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onerror = function(){ reject(reader.error || new Error('读取 Blob 文本失败')); };
      reader.onload = function(){ resolve(String(reader.result || '')); };
      reader.readAsText(blob);
    });
  }

  function inferMime(relativePath){
    var lower = String(relativePath || '').toLowerCase();
    if(lower.slice(-5) === '.json') return 'application/json';
    if(lower.slice(-4) === '.exp') return 'application/json';
    if(lower.slice(-4) === '.png') return 'image/png';
    if(lower.slice(-4) === '.moc') return 'application/octet-stream';
    if(lower.slice(-4) === '.mtn') return 'application/octet-stream';
    return 'application/octet-stream';
  }

  function kindFor(relativePath){
    var lower = String(relativePath || '').toLowerCase();
    if(relativePath === 'model.json') return 'model-json';
    if(lower.slice(-4) === '.moc') return 'moc';
    if(lower.slice(-4) === '.png') return 'texture';
    if(lower.slice(-4) === '.mtn') return 'motion';
    if(lower === 'physics.json' || /(^|\/)physics\.json$/.test(lower)) return 'physics';
    if(lower === 'pose.json' || /(^|\/)pose\.json$/.test(lower)) return 'pose';
    if(lower.slice(-4) === '.exp' || lower.indexOf('expression') >= 0) return 'expression';
    return 'other';
  }

  function mergeReferencedFile(files, path, kind, mime){
    if(typeof path !== 'string' || !path) return;
    for(var i=0;i<files.length;i++){
      if(files[i].path === path) return;
    }
    files.push({path:path, mime:mime || inferMime(path), kind:kind || kindFor(path)});
  }

  function collectRelativeFiles(modelJson){
    var files = [];
    function add(path, kind){
      mergeReferencedFile(files, path, kind, inferMime(path));
    }
    add('model.json', 'model-json');
    if(modelJson.model) add(modelJson.model, 'moc');
    (modelJson.textures || []).forEach(function(path){ add(path, 'texture'); });
    if(Array.isArray(modelJson.expressions)){
      modelJson.expressions.forEach(function(expression){ if(expression && expression.file) add(expression.file, 'expression'); });
    }
    if(modelJson.physics && typeof modelJson.physics === 'string') add(modelJson.physics, 'physics');
    if(modelJson.pose && typeof modelJson.pose === 'string') add(modelJson.pose, 'pose');
    if(modelJson.gfl_touch_motions && typeof modelJson.gfl_touch_motions === 'object'){
      Object.keys(modelJson.gfl_touch_motions).forEach(function(area){
        var mappedFiles = modelJson.gfl_touch_motions[area];
        if(!Array.isArray(mappedFiles)) return;
        mappedFiles.forEach(function(path){ add(path, 'motion'); });
      });
    }
    if(modelJson.motions){
      Object.keys(modelJson.motions).forEach(function(group){
        var motions = modelJson.motions[group];
        if(!Array.isArray(motions)) return;
        motions.forEach(function(motion){ if(motion && motion.file) add(motion.file, 'motion'); });
      });
    }
    return files;
  }

  function mergeManifestAssets(files, stateManifest){
    if(!stateManifest || !Array.isArray(stateManifest.assets)) return files;
    stateManifest.assets.forEach(function(asset){
      if(!asset || !asset.relativePath) return;
      mergeReferencedFile(files, asset.relativePath, asset.kind, asset.mime);
    });
    return files;
  }

  async function readManifest(db, dir){
    var raw = await readValue(db, manifestKey(dir));
    if(!raw) return null;
    try{
      if(typeof raw === 'string') return JSON.parse(raw);
      var blob = valueToBlob(raw, 'application/json');
      return JSON.parse(await readTextBlob(blob));
    }catch(e){
      console.warn('BubbleLive2D manifest 解析失败:', dir, e);
      return null;
    }
  }

  function createObjectUrl(blob){
    var url = URL.createObjectURL(blob);
    objectUrlRegistry.push(url);
    return url;
  }

  function normalizeTouchMotionMap(json, assetUrls){
    var map = json.gfl_touch_motions;
    if(!map || typeof map !== 'object' || Array.isArray(map)) return;
    Object.keys(map).forEach(function(area){
      var files = map[area];
      if(!Array.isArray(files)){ delete map[area]; return; }
      map[area] = files.filter(function(file){ return typeof file === 'string' && !!assetUrls.files[file]; })
        .map(function(file){ return assetUrls.files[file]; });
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
      json.motions.idle.forEach(function(motion){ if(motion && motion.file) seen[motion.file] = true; });
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
        motions.forEach(function(motion){ if(motion && motion.file && !index[motion.file]) index[motion.file] = motion; });
      });
      return index;
    }
    function addAreaMotion(area, motion){
      addMotion(motionGroupForArea(area), motion);
      if(area !== 'body' && area !== 'shake') addMotion('tap_body', motion);
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

  function patchModelJsonForRuntime(modelJson, assetUrls){
    var next = JSON.parse(JSON.stringify(modelJson));
    next.model = assetUrls.model;
    next.textures = (next.textures || []).map(function(file){ return assetUrls.files[file] || file; });
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
    if(next.physics && typeof next.physics === 'string' && assetUrls.files[next.physics]) next.physics = assetUrls.files[next.physics];
    if(next.pose && typeof next.pose === 'string' && assetUrls.files[next.pose]) next.pose = assetUrls.files[next.pose];
    return next;
  }

  async function parseModelJsonBlob(blob, dir, state){
    try{ return JSON.parse(await readTextBlob(blob)); }
    catch(e){ throw new Error('Live2D model.json 解析失败: ' + dir + '/' + state); }
  }

  async function readStatePackage(db, dir, state, stateManifest){
    var modelKey = buildKey(dir, state, 'model.json');
    var modelRaw = await readValue(db, modelKey);
    if(modelRaw === null) return null;
    var modelBlob = valueToBlob(modelRaw, 'application/json');
    var modelJson = await parseModelJsonBlob(modelBlob, dir, state);
    var refs = collectRelativeFiles(modelJson);
    mergeManifestAssets(refs, stateManifest);
    var files = Object.create(null);
    var assets = [];

    for(var i=0;i<refs.length;i++){
      var ref = refs[i];
      var raw = ref.path === 'model.json' ? modelRaw : await readValue(db, buildKey(dir, state, ref.path));
      if(raw === null){
        if(ref.kind === 'moc' || ref.kind === 'texture') throw new Error('缺少关键 Live2D 资源: ' + dir + '/' + state + '/' + ref.path);
        continue;
      }
      var blob = valueToBlob(raw, ref.mime);
      files[ref.path] = blob;
      assets.push({
        key: buildKey(dir, state, ref.path),
        state: state,
        relativePath: ref.path,
        kind: ref.kind,
        mime: blob.type || ref.mime,
        size: blob.size,
        blob: blob
      });
    }

    return {state:state, files:files, modelJson:modelJson, assets:assets};
  }

  async function getModelPackage(dir){
    if(!dir || typeof dir !== 'string') throw new Error('getModelPackage 缺少 dir');
    var db = await openDatabase();
    try{
      var manifest = await readManifest(db, dir);
      var normal = await readStatePackage(db, dir, 'normal', manifest && manifest.states && manifest.states.normal);
      if(!normal) throw new Error('缺少 normal 状态: ' + dir);
      var destroy = await readStatePackage(db, dir, 'destroy', manifest && manifest.states && manifest.states.destroy);
      var version = await readValue(db, metaKey(dir));
      var states = {normal: normal};
      if(destroy) states.destroy = destroy;
      return {
        dir: dir,
        version: typeof version === 'string' ? version : '',
        hasDestroy: !!destroy,
        jsonPath: 'indexeddb://' + dir + '/normal/model.json',
        states: states
      };
    }finally{
      db.close();
    }
  }

  async function blobSha256(blob){
    if(window.crypto && window.crypto.subtle && blob.arrayBuffer){
      var buffer = await blob.arrayBuffer();
      var digest = await window.crypto.subtle.digest('SHA-256', buffer);
      var bytes = Array.prototype.slice.call(new Uint8Array(digest));
      return bytes.map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
    }
    return 'size-' + blob.size;
  }

  async function versionFromAssets(assets){
    var parts = assets.slice().sort(function(a,b){ return a.key.localeCompare(b.key); })
      .map(function(asset){ return asset.key + ':' + asset.sha256; }).join('\n');
    if(window.crypto && window.crypto.subtle){
      var encoded = new TextEncoder().encode(parts);
      var digest = await window.crypto.subtle.digest('SHA-256', encoded);
      var bytes = Array.prototype.slice.call(new Uint8Array(digest));
      return bytes.map(function(b){ return b.toString(16).padStart(2, '0'); }).join('').slice(0, 16);
    }
    return String(parts.length) + '-' + String(assets.length);
  }

  async function normalizeInputState(dir, state, inputState){
    if(!inputState || !inputState.files || typeof inputState.files !== 'object') throw new Error('缺少 ' + state + ' 状态 files');
    if(!inputState.files['model.json']) throw new Error('缺少 ' + state + '/model.json');
    var modelBlob = valueToBlob(inputState.files['model.json'], 'application/json');
    var modelJson = await parseModelJsonBlob(modelBlob, dir, state);
    var refs = collectRelativeFiles(modelJson);
    Object.keys(inputState.files).forEach(function(relativePath){
      mergeReferencedFile(refs, relativePath, kindFor(relativePath), inferMime(relativePath));
    });
    var files = Object.create(null);
    var assets = [];

    for(var i=0;i<refs.length;i++){
      var ref = refs[i];
      var value = inputState.files[ref.path];
      if(!value){
        if(ref.kind === 'moc' || ref.kind === 'texture' || ref.kind === 'model-json'){
          throw new Error('缺少关键 Live2D 资源: ' + dir + '/' + state + '/' + ref.path);
        }
        continue;
      }
      var blob = valueToBlob(value, ref.mime);
      var sha256 = await blobSha256(blob);
      files[ref.path] = blob;
      assets.push({
        key: buildKey(dir, state, ref.path),
        state: state,
        relativePath: ref.path,
        kind: ref.kind,
        mime: blob.type || ref.mime,
        size: blob.size,
        sha256: sha256,
        blob: blob
      });
    }
    return {state:state, files:files, modelJson:modelJson, assets:assets};
  }

  async function writeLive2DPackage(input){
    if(!input || !input.dir) throw new Error('writeLive2DPackage 缺少 dir');
    if(!input.states || !input.states.normal) throw new Error('writeLive2DPackage 缺少 states.normal');
    var dir = input.dir;
    var normalizedStates = {};
    var allAssets = [];
    normalizedStates.normal = await normalizeInputState(dir, 'normal', input.states.normal);
    allAssets = allAssets.concat(normalizedStates.normal.assets);
    if(input.states.destroy){
      normalizedStates.destroy = await normalizeInputState(dir, 'destroy', input.states.destroy);
      allAssets = allAssets.concat(normalizedStates.destroy.assets);
    }
    var version = await versionFromAssets(allAssets);
    var statesManifest = {};
    Object.keys(normalizedStates).forEach(function(state){
      statesManifest[state] = {
        state: state,
        files: normalizedStates[state].assets.length,
        assets: normalizedStates[state].assets.map(function(asset){
          return {
            key: asset.key,
            relativePath: asset.relativePath,
            kind: asset.kind,
            mime: asset.mime,
            size: asset.size
          };
        })
      };
    });
    var manifest = {
      dir: dir,
      name: input.name,
      version: version,
      databaseName: DB_NAME,
      storeName: STORE_NAME,
      states: statesManifest
    };
    var db = await openDatabase();
    try{
      var entries = allAssets.map(function(asset){ return {key:asset.key, value:asset.blob}; });
      if(!input.options || input.options.writeMeta !== false){
        entries.push({key:metaKey(dir), value:version});
        entries.push({key:manifestKey(dir), value:JSON.stringify(manifest)});
      }
      await putMany(db, entries);
    }finally{
      db.close();
    }
    return {
      ok: true,
      dir: dir,
      version: version,
      adjutant: {
        name: input.name,
        live2d: {
          dir: dir,
          jsonPath: 'indexeddb://' + dir + '/normal/model.json',
          version: version,
          hasDestroy: !!normalizedStates.destroy
        }
      },
      manifest: manifest
    };
  }

  function createRuntimeJsonUrl(statePackage){
    var modelJson = statePackage.modelJson;
    var refs = collectRelativeFiles(modelJson);
    var assetUrls = {model:null, files:Object.create(null)};
    refs.forEach(function(ref){
      if(ref.path === 'model.json') return;
      var blob = statePackage.files[ref.path];
      if(!blob) return;
      var url = createObjectUrl(blob);
      assetUrls.files[ref.path] = url;
      if(ref.kind === 'moc') assetUrls.model = url;
    });
    if(!assetUrls.model) throw new Error('Live2D runtime 缺少 moc: ' + statePackage.state);
    var patchedJson = patchModelJsonForRuntime(modelJson, assetUrls);
    return createObjectUrl(new Blob([JSON.stringify(patchedJson)], {type:'application/json'}));
  }

  function createRuntimeState(modelPackage){
    if(!modelPackage || !modelPackage.states || !modelPackage.states.normal) throw new Error('Live2D package 缺少 normal 状态');
    var normalUrl = createRuntimeJsonUrl(modelPackage.states.normal);
    var destroyUrl = modelPackage.states.destroy ? createRuntimeJsonUrl(modelPackage.states.destroy) : normalUrl;
    return {
      dir: modelPackage.dir,
      version: modelPackage.version,
      hasDestroy: !!modelPackage.states.destroy,
      source: 'bubble-indexeddb-package',
      jsonPath: normalUrl,
      damagedJsonPath: destroyUrl,
      package: modelPackage
    };
  }

  function revokeObjectUrls(){
    objectUrlRegistry.splice(0).forEach(function(url){
      try{ URL.revokeObjectURL(url); }catch(e){}
    });
  }

  window.BubbleLive2D = {
    writeLive2DPackage: writeLive2DPackage,
    getModelPackage: getModelPackage,
    createRuntimeState: createRuntimeState,
    revokeObjectUrls: revokeObjectUrls,
    databaseName: DB_NAME,
    storeName: STORE_NAME
  };
})();
