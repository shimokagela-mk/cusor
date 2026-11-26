/* Pixi-backed Live2D runtime adapter for Girls' Frontline standby PoC.
 *
 * This is intentionally a static-page adapter: the project currently has no
 * frontend build chain. Vendor scripts are inlined by the Tavern Helper console
 * generator, or can be overridden with window.GFL_PIXI_LIVE2D_VENDOR_URLS.
 */
(function(){
  'use strict';

  var DEFAULT_VENDOR_URLS = {
    pixi: '',
    live2dCore: '',
    live2d: ''
  };

  var runtimePromise = null;
  var current = null;

  function vendorUrls(){
    var override = window.GFL_PIXI_LIVE2D_VENDOR_URLS || {};
    return {
      pixi: override.pixi || DEFAULT_VENDOR_URLS.pixi,
      live2dCore: override.live2dCore || DEFAULT_VENDOR_URLS.live2dCore,
      live2d: override.live2d || DEFAULT_VENDOR_URLS.live2d
    };
  }

  function loadScriptOnce(src, globalCheck){
    if(globalCheck && globalCheck()) return Promise.resolve();
    return new Promise(function(resolve, reject){
      var existing = document.querySelector('script[data-gfl-pixi-live2d-src="'+src.replace(/"/g, '&quot;')+'"]');
      if(existing){
        existing.addEventListener('load', function(){ resolve(); }, {once:true});
        existing.addEventListener('error', function(){ reject(new Error('脚本加载失败: '+src)); }, {once:true});
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.gflPixiLive2dSrc = src;
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error('脚本加载失败: '+src)); };
      document.head.appendChild(script);
    });
  }

  function getLive2DModelClass(){
    if(window.PIXI && window.PIXI.live2d && window.PIXI.live2d.Live2DModel) return window.PIXI.live2d.Live2DModel;
    if(window.Live2DModel) return window.Live2DModel;
    return null;
  }

  function ensureRuntime(){
    if(runtimePromise) return runtimePromise;
    runtimePromise = (async function(){
      var urls = vendorUrls();
      if(!window.PIXI && urls.pixi) await loadScriptOnce(urls.pixi, function(){ return !!window.PIXI; });
      if(!window.Live2D && urls.live2dCore) await loadScriptOnce(urls.live2dCore, function(){ return !!window.Live2D; });
      if(!getLive2DModelClass() && urls.live2d) await loadScriptOnce(urls.live2d, function(){ return !!getLive2DModelClass(); });
      var Live2DModel = getLive2DModelClass();
      if(!window.PIXI) throw new Error('PixiJS 未加载');
      if(!window.Live2D) throw new Error('Live2D Cubism2 core 未加载');
      if(!Live2DModel) throw new Error('pixi-live2d-display 未暴露 Live2DModel');
      return { PIXI: window.PIXI, Live2DModel: Live2DModel };
    })();
    return runtimePromise;
  }

  function ensureMountNode(container){
    var node = document.getElementById('gfl-pixi-live2d');
    if(!node){
      node = document.createElement('div');
      node.id = 'gfl-pixi-live2d';
      node.setAttribute('aria-hidden', 'true');
      node.style.position = 'absolute';
      node.style.inset = '0';
      node.style.zIndex = '3';
      node.style.pointerEvents = 'none';
      node.style.overflow = 'hidden';
      container.appendChild(node);
    }
    return node;
  }

  function destroy(){
    if(!current) return;
    try{
      if(current.model && current.model.parent) current.model.parent.removeChild(current.model);
    }catch(e){}
    try{
      if(current.app) current.app.destroy(true, {children:true, texture:true, baseTexture:true});
    }catch(e){}
    try{
      if(current.mountNode && current.mountNode.parentNode) current.mountNode.parentNode.removeChild(current.mountNode);
    }catch(e){}
    current = null;
  }

  function getMotionGroups(model){
    var settings = model && model.internalModel && model.internalModel.settings;
    var json = settings && (settings.json || settings._json || settings.rawJson);
    if(json && json.motions) return json.motions;
    if(settings&& settings.motions) return settings.motions;
    return {};
  }

  function hasMotionGroup(model, group){
    var groups = getMotionGroups(model);
    if(!groups || !Object.keys(groups).length) return true;
    return !!(Array.isArray(groups[group]) && groups[group].length);
  }

  function playMotion(model, group){
    if(!model || !group || !hasMotionGroup(model, group)) return false;
    try{
      if(typeof model.motion === 'function'){
        model.motion(group);
        return true;
      }
    }catch(e){
      console.warn('Live2D motion 播放失败:', group, e);
    }
    return false;
  }

  function fitModel(model, width, height){
    if(!model) return;
    if(model.scale && model.scale.set) model.scale.set(1);
    if(model.position && model.position.set) model.position.set(0, 0);
    else { model.x = 0; model.y = 0; }

    var bounds = null;
    try{
      if(typeof model.getLocalBounds === 'function') bounds = model.getLocalBounds();
    }catch(e){ bounds = null; }

    var rawWidth = bounds && isFinite(bounds.width) && bounds.width > 0 ? bounds.width : Math.max(1, model.width || width);
    var rawHeight = bounds && isFinite(bounds.height) && bounds.height > 0 ? bounds.height : Math.max(1, model.height || height);
    var rawX = bounds && isFinite(bounds.x) ? bounds.x : 0;
    var rawY = bounds && isFinite(bounds.y) ? bounds.y : 0;
    var scale = Math.min(width / rawWidth, height / rawHeight);
    if(!isFinite(scale) || scale <= 0) scale = 1;

    if(model.scale && model.scale.set) model.scale.set(scale);
    var fittedWidth = rawWidth * scale;
    var fittedHeight = rawHeight * scale;
    model.x = (width - fittedWidth) / 2 - rawX * scale;
    model.y = height - fittedHeight - rawY * scale;
  }

  function resize(width, height){
    if(!current) return;
    current.width = Math.max(1, Math.round(width || current.width || 300));
    current.height = Math.max(1, Math.round(height || current.height || 560));
    current.mountNode.style.width = current.width + 'px';
    current.mountNode.style.height = current.height + 'px';
    if(current.app && current.app.renderer) current.app.renderer.resize(current.width, current.height);
    fitModel(current.model, current.width, current.height);
  }

  function hitAreasAt(model, x, y){
    if(!model) return [];
    try{
      if(typeof model.hitTest === 'function'){
        var result = model.hitTest(x, y);
        if(Array.isArray(result)) return result.filter(Boolean);
        if(result) return [String(result)];
      }
    }catch(e){}
    try{
      if(typeof model.tap === 'function') model.tap(x, y);
    }catch(e){}
    return [];
  }

  function tap(clientX, clientY){
    if(!current || !current.model || !current.mountNode) return false;
    var rect = current.mountNode.getBoundingClientRect();
    if(!rect.width || !rect.height) return false;
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    if(x < 0 || y < 0 || x > rect.width || y > rect.height) return false;

    var hits = hitAreasAt(current.model, x, y);
    var played = false;
    for(var i=0;i<hits.length;i++){
      var group = hits[i] === 'body' ? 'tap_body' : 'tap_' + hits[i];
      if(playMotion(current.model, group)){ played = true; break; }
    }
    if(!played) played = playMotion(current.model, 'tap_body');
    return played;
  }

  async function mount(options){
    if(!options || !options.container) throw new Error('缺少 Live2D 挂载容器');
    if(!options.jsonPath) throw new Error('缺少 Live2D model.json 路径');
    destroy();
    var runtime = await ensureRuntime();
    var container = options.container;
    var width = Math.max(1, Math.round(options.width || container.clientWidth || 300));
    var height = Math.max(1, Math.round(options.height || container.clientHeight || 560));
    var mountNode = ensureMountNode(container);
    mountNode.style.width = width + 'px';
    mountNode.style.height = height + 'px';

    var app = new runtime.PIXI.Application({
      width: width,
      height: height,
      transparent: true,
      autoStart: true,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    app.view.id = 'gfl-pixi-live2d-canvas';
    app.view.style.width = '100%';
    app.view.style.height = '100%';
    app.view.style.display = 'block';
    mountNode.appendChild(app.view);

    var model = await runtime.Live2DModel.from(options.jsonPath);
    app.stage.addChild(model);
    fitModel(model, width, height);
    current = {app:app, model:model, mountNode:mountNode, container:container, width:width, height:height, jsonPath:options.jsonPath};
    return current;
  }

  window.GFLPixiLive2D = {
    ensureRuntime: ensureRuntime,
    mount: mount,
    destroy: destroy,
    resize: resize,
    tap: tap,
    getCurrent: function(){ return current; },
    vendorUrls: vendorUrls
  };
})();
