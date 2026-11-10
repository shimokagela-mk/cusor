'use strict';

const { createAiResponder } = require('./fake-ai');

function createElement(tagName = 'div', ownerDocument = null) {
  const listeners = new Map();
  let innerHTMLValue = '';
  const element = {
    tagName: String(tagName).toUpperCase(),
    id: '',
    className: '',
    style: {},
    dataset: {},
    attributes: {},
    children: [],
    parentNode: null,
    ownerDocument,
    textContent: '',
    value: '',
    hidden: false,
    disabled: false,
    width: 300,
    height: 150,
    clientWidth: 300,
    clientHeight: 150,
    offsetWidth: 300,
    offsetHeight: 150,
    classList: {
      contains(name) {
        return String(element.className || '').split(/\s+/).includes(String(name));
      },
      add(...names) {
        const current = new Set(String(element.className || '').split(/\s+/).filter(Boolean));
        for (const name of names) current.add(String(name));
        element.className = Array.from(current).join(' ');
        element.attributes.class = element.className;
      },
      remove(...names) {
        const remove = new Set(names.map(String));
        element.className = String(element.className || '').split(/\s+/).filter((name) => name && !remove.has(name)).join(' ');
        element.attributes.class = element.className;
      },
      toggle(name, force) {
        const exists = element.classList.contains(name);
        const shouldAdd = force === undefined ? !exists : !!force;
        if (shouldAdd) element.classList.add(name);
        else element.classList.remove(name);
        return shouldAdd;
      }
    },
    appendChild(child) {
      if (child) {
        child.parentNode = element;
        element.children.push(child);
      }
      return child;
    },
    insertAdjacentHTML(_position, html) {
      element.innerHTML += String(html || '');
    },
    remove() {
      if (!element.parentNode) return;
      element.parentNode.children = element.parentNode.children.filter((child) => child !== element);
      element.parentNode = null;
    },
    setAttribute(name, value) {
      const key = String(name);
      element.attributes[key] = String(value);
      if (key === 'id') element.id = String(value);
      if (key === 'class') element.className = String(value);
      if (key.startsWith('data-')) {
        const dataKey = key.slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
        element.dataset[dataKey] = String(value);
      }
    },
    getAttribute(name) {
      return element.attributes[String(name)];
    },
    removeAttribute(name) {
      const key = String(name);
      delete element.attributes[key];
      if (key === 'id') element.id = '';
      if (key === 'class') element.className = '';
      if (key.startsWith('data-')) {
        const dataKey = key.slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
        delete element.dataset[dataKey];
      }
      if (key === 'hidden') element.hidden = false;
      if (key === 'disabled') element.disabled = false;
      if (key === 'src') element.src = '';
    },
    addEventListener(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) listeners.set(key, []);
      listeners.get(key).push(handler);
    },
    removeEventListener(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) return;
      listeners.set(key, listeners.get(key).filter((item) => item !== handler));
    },
    dispatchEvent(event) {
      const key = String(event && event.type ? event.type : event);
      for (const handler of listeners.get(key) || []) {
        handler.call(element, event);
      }
      return true;
    },
    click() {
      if (typeof element.onclick === 'function') element.onclick.call(element, { type: 'click', target: element });
      element.dispatchEvent({ type: 'click', target: element });
    },
    matches(selector) {
      return matchesSelector(element, selector);
    },
    closest(selector) {
      let current = element;
      while (current) {
        if (matchesSelector(current, selector)) return current;
        current = current.parentNode;
      }
      return null;
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const matches = [];
      function walk(current) {
        for (const child of current.children || []) {
          if (matchesSelector(child, selector)) matches.push(child);
          walk(child);
        }
      }
      walk(element);
      return matches;
    },
    getBoundingClientRect() {
      const width = Number(element.offsetWidth || element.clientWidth || element.width || 0);
      const height = Number(element.offsetHeight || element.clientHeight || element.height || 0);
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height
      };
    }
  };
  Object.defineProperty(element, 'innerHTML', {
    get() {
      if (!innerHTMLValue && element.textContent) {
        return String(element.textContent)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
      return innerHTMLValue;
    },
    set(value) {
      innerHTMLValue = String(value || '');
      if (ownerDocument && typeof ownerDocument.__registerHtmlFragment === 'function') {
        ownerDocument.__registerHtmlFragment(element, innerHTMLValue);
      }
    },
    enumerable: true
  });
  element.__setInnerHTMLRaw = (value) => {
    innerHTMLValue = String(value || '');
  };
  if (String(tagName).toLowerCase() === 'canvas') {
    element.getContext = () => ({
      canvas: element,
      setTransform() {},
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate() {},
      closePath() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      fillText() {},
      strokeText() {},
      measureText(text) { return { width: String(text || '').length * 8 }; }
    });
  }
  return element;
}

function matchesSelector(element, selector) {
  const text = String(selector || '').trim();
  if (!element || !text) return false;
  if (text.startsWith('#')) return element.id === text.slice(1);
  if (text.startsWith('.')) return String(element.className || '').split(/\s+/).includes(text.slice(1));
  const dataMatch = text.match(/^\[data-([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]$/);
  if (dataMatch) {
    const key = dataMatch[1].replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
    const expected = dataMatch[2] ?? dataMatch[3] ?? dataMatch[4];
    if (expected === undefined) return Object.prototype.hasOwnProperty.call(element.dataset || {}, key);
    return String((element.dataset || {})[key]) === String(expected);
  }
  return String(element.tagName || '').toLowerCase() === text.toLowerCase();
}

function createDocument() {
  const elementsById = new Map();
  const allElements = [];
  const listeners = new Map();
  function track(element) {
    if (element && !allElements.includes(element)) allElements.push(element);
    return element;
  }
  const document = {
    readyState: 'complete',
    location: { href: 'http://localhost/shujuku-local', hash: '', search: '', pathname: '/shujuku-local' },
    createElement(tagName) {
      return track(createElement(tagName, document));
    },
    createElementNS(_namespace, tagName) {
      return track(createElement(tagName, document));
    },
    getElementById(id) {
      return elementsById.get(String(id)) || null;
    },
    querySelector(selector) {
      if (String(selector).startsWith('#')) return document.getElementById(String(selector).slice(1));
      return document.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      if (String(selector).startsWith('#')) {
        const item = document.getElementById(String(selector).slice(1));
        return item ? [item] : [];
      }
      return allElements.filter((element) => matchesSelector(element, selector));
    },
    registerElement(id, element) {
      track(element);
      element.id = id;
      element.setAttribute('id', id);
      elementsById.set(id, element);
      return element;
    },
    __registerHtmlFragment(parent, html) {
      const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
      const stack = [parent || document.body];
      const elementPattern = /<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
      let match;
      while ((match = elementPattern.exec(String(html || ''))) !== null) {
        const fullMatch = match[0];
        const tagName = match[1];
        const lowerTag = tagName.toLowerCase();
        if (lowerTag === 'script' || tagName.startsWith('!')) continue;
        if (fullMatch.startsWith('</')) {
          for (let index = stack.length - 1; index > 0; index -= 1) {
            if (String(stack[index].tagName || '').toLowerCase() === lowerTag) {
              stack.length = index;
              break;
            }
          }
          continue;
        }
        const attrs = match[2] || '';
        const element = track(createElement(tagName, document));
        for (const attrMatch of attrs.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
          element.setAttribute(attrMatch[1], attrMatch[2]);
        }
        if (element.id) elementsById.set(element.id, element);
        const currentParent = stack[stack.length - 1];
        if (currentParent && currentParent.appendChild) currentParent.appendChild(element);
        if (!fullMatch.endsWith('/>') && !voidTags.has(lowerTag)) stack.push(element);
      }
    },
    addEventListener(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) listeners.set(key, []);
      listeners.get(key).push(handler);
    },
    removeEventListener(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) return;
      listeners.set(key, listeners.get(key).filter((item) => item !== handler));
    },
    dispatchEvent(event) {
      const key = String(event && event.type ? event.type : event);
      const results = [];
      for (const handler of listeners.get(key) || []) {
        results.push(handler.call(document, event));
      }
      return results;
    },
    __allElements: allElements
  };
  document.documentElement = track(createElement('html', document));
  document.head = track(createElement('head', document));
  document.body = track(createElement('body', document));
  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);

  for (const id of ['send_but', 'send_textarea', 'extensionsMenu', 'extensionsMenuButton', 'extensions_settings2']) {
    document.body.appendChild(document.registerElement(id, createElement(id === 'send_textarea' ? 'textarea' : 'div', document)));
  }

  return document;
}

function createJQueryCollection(items) {
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  const api = {
    length: arr.length,
    0: arr[0],
    each(callback) {
      arr.forEach((item, index) => callback.call(item, index, item));
      return api;
    },
    append(child) {
      return api.each(function appendEach() {
        if (typeof child === 'string') {
          this.innerHTML += child;
        } else if (child && child[0]) {
          this.appendChild(child[0]);
        } else if (child && child.tagName) {
          this.appendChild(child);
        }
      });
    },
    appendTo(target) {
      createJQueryCollection([target && target[0] ? target[0] : target]).append(api);
      return api;
    },
    find(selector) {
      if (!arr[0] || !arr[0].ownerDocument) return createJQueryCollection([]);
      return createJQueryCollection([arr[0].ownerDocument.querySelector(selector)]);
    },
    off() {
      return api;
    },
    on(eventName, handler) {
      return api.each(function onEach() {
        if (this.addEventListener) this.addEventListener(String(eventName).split('.')[0], handler);
      });
    },
    trigger(eventName) {
      return api.each(function triggerEach() {
        if (this.dispatchEvent) this.dispatchEvent({ type: String(eventName).split('.')[0], target: this });
      });
    },
    hide() {
      return api.each(function hideEach() { this.hidden = true; this.style.display = 'none'; });
    },
    show() {
      return api.each(function showEach() { this.hidden = false; this.style.display = ''; });
    },
    css(name, value) {
      if (typeof name === 'object') {
        return api.each(function cssEach() { Object.assign(this.style, name); });
      }
      if (typeof value === 'undefined') return arr[0] && arr[0].style ? arr[0].style[name] : undefined;
      return api.each(function cssEach() { this.style[name] = value; });
    },
    text(value) {
      if (typeof value === 'undefined') return arr[0] ? arr[0].textContent : '';
      return api.each(function textEach() { this.textContent = String(value); });
    },
    html(value) {
      if (typeof value === 'undefined') return arr[0] ? arr[0].innerHTML : '';
      return api.each(function htmlEach() { this.innerHTML = String(value); });
    },
    val(value) {
      if (typeof value === 'undefined') return arr[0] ? arr[0].value : '';
      return api.each(function valEach() { this.value = value; });
    },
    prop(name, value) {
      if (typeof value === 'undefined') return arr[0] ? arr[0][name] : undefined;
      return api.each(function propEach() { this[name] = value; });
    },
    empty() {
      return api.each(function emptyEach() { this.children = []; this.innerHTML = ''; });
    },
    is(selector) {
      if (selector === ':visible') return !!arr[0] && arr[0].style.display !== 'none' && !arr[0].hidden;
      return false;
    },
    remove() {
      return api.each(function removeEach() { if (this.remove) this.remove(); });
    }
  };
  return api;
}

function createJQuery(document) {
  function $(selector, context) {
    if (typeof selector === 'function') {
      setTimeout(selector, 0);
      return createJQueryCollection([document]);
    }
    if (selector && selector.tagName) {
      return createJQueryCollection([selector]);
    }
    if (typeof selector !== 'string' && selector && selector[0]) {
      return createJQueryCollection([selector[0]]);
    }
    const text = String(selector || '').trim();
    if (text.startsWith('<')) {
      const tag = (text.match(/^<([a-z0-9-]+)/i) || [null, 'div'])[1];
      const element = document.createElement(tag);
      const idMatch = text.match(/\sid=["']([^"']+)["']/i);
      if (idMatch) document.registerElement(idMatch[1], element);
      element.innerHTML = text;
      return createJQueryCollection([element]);
    }
    const doc = context && context.getElementById ? context : document;
    if (text.startsWith('#')) return createJQueryCollection([doc.getElementById(text.slice(1))]);
    return createJQueryCollection([]);
  }
  $.fn = {};
  return $;
}

function createEventSource() {
  const listeners = new Map();
  return {
    on(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) listeners.set(key, []);
      listeners.get(key).push(handler);
    },
    makeLast(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) listeners.set(key, []);
      const current = listeners.get(key).filter((item) => item !== handler);
      current.push(handler);
      listeners.set(key, current);
    },
    off(type, handler) {
      const key = String(type);
      if (!listeners.has(key)) return;
      listeners.set(key, listeners.get(key).filter((item) => item !== handler));
    },
    async emit(type, ...args) {
      const key = String(type);
      for (const handler of listeners.get(key) || []) {
        await handler(...args);
      }
    },
    listenerCount(type) {
      return (listeners.get(String(type)) || []).length;
    }
  };
}

function createResponse(payload, status = 200) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    async text() { return text; },
    async json() { return typeof payload === 'string' ? JSON.parse(payload) : payload; }
  };
}

function createMockSillyTavernHost(config = {}) {
  const document = createDocument();
  const $ = createJQuery(document);
  const aiMode = config.aiMode || 'fake';
  const ai = createAiResponder(aiMode, config.aiFixtures || {});
  const eventSource = createEventSource();
  const eventTypes = {
    APP_READY: 'APP_READY',
    CHAT_CHANGED: 'CHAT_CHANGED',
    CHAT_COMPLETION_SETTINGS_READY: 'CHAT_COMPLETION_SETTINGS_READY',
    GENERATION_STARTED: 'GENERATION_STARTED',
    GENERATION_ENDED: 'GENERATION_ENDED',
    GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
    MESSAGE_SENT: 'MESSAGE_SENT',
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    MESSAGE_UPDATED: 'MESSAGE_UPDATED',
    MESSAGE_DELETED: 'MESSAGE_DELETED',
    MESSAGE_SWIPED: 'MESSAGE_SWIPED'
  };

  const state = {
    chatId: config.chatId || 'shujuku-local-chat',
    name1: config.userName || '本地用户',
    characters: config.characters || [{ name: '本地测试角色', description: '用于 shujuku 本地测试。', data: {} }],
    this_chid: 0,
    chat: Array.isArray(config.chat) ? config.chat : [
      { message_id: 0, is_user: false, name: 'system', mes: '<start>本地测试开场</start>' },
      { message_id: 1, is_user: true, name: '本地用户', mes: '开始本地测试' },
      { message_id: 2, is_user: false, name: 'assistant', mes: '这是用于数据库测试的剧情上下文。' }
    ],
    extensionSettings: config.extensionSettings || { connectionManager: { profiles: [] } },
    worldbooks: new Map(Object.entries(config.worldbooks || { '本地测试世界书': [] })),
    savedChats: 0,
    savedSettings: 0,
    stopped: false
  };

  function nextMessageId() {
    return state.chat.reduce((max, item) => Math.max(max, Number(item.message_id) || 0), 0) + 1;
  }

  async function setChatMessages(messages) {
    for (const patch of messages || []) {
      const id = patch.message_id;
      const index = state.chat.findIndex((item) => item.message_id === id);
      if (index >= 0) {
        state.chat[index] = { ...state.chat[index], ...patch };
      } else {
        state.chat.push({ message_id: id || nextMessageId(), ...patch });
      }
    }
  }

  function getContext() {
    return {
      chatId: state.chatId,
      chat: state.chat,
      Chat: state.chat,
      name1: state.name1,
      characters: state.characters,
      this_chid: state.this_chid,
      characterId: state.this_chid,
      name2_description: state.characters[state.this_chid] && state.characters[state.this_chid].description,
      powerUserSettings: { persona_description: config.personaDescription || '' },
      eventSource,
      eventTypes,
      event_types: eventTypes,
      extensionSettings: state.extensionSettings,
      saveSettingsDebounced: () => { state.savedSettings += 1; },
      saveSettings: () => { state.savedSettings += 1; },
      saveChat: async () => { state.savedChats += 1; },
      setChatMessages,
      stopGeneration: () => { state.stopped = true; },
      deleteLastMessage: async () => { state.chat.pop(); },
      getWorldBooks: async () => Array.from(state.worldbooks.keys()),
      getRequestHeaders: () => ({ 'x-csrf-token': 'local-shujuku-test' }),
      ConnectionManagerRequestService: {
        sendRequest: async (_profileId, messages, maxTokens) => ({
          result: {
            choices: [
              {
                message: {
                  content: await ai(messages, { maxTokens })
                }
              }
            ]
          }
        })
      },
      Popup: function Popup() {},
      libs: { DOMPurify: { sanitize: (html) => String(html || '') } }
    };
  }

  const TavernHelper = {
    getLastMessageId: () => state.chat.length ? state.chat[state.chat.length - 1].message_id : 0,
    getChatMessages: async () => state.chat.slice(),
    getCharData: () => state.characters[state.this_chid] || null,
    getCharLorebooks: async () => ({ primary: ['本地测试世界书'], additional: [] }),
    getCurrentCharPrimaryLorebook: async () => '本地测试世界书',
    getLorebooks: async () => Array.from(state.worldbooks.keys()),
    getLorebookEntries: async (bookName) => (state.worldbooks.get(bookName) || []).map((item) => ({ ...item })),
    setLorebookEntries: async (bookName, entries) => { state.worldbooks.set(bookName, (entries || []).map((item) => ({ ...item }))); },
    createLorebookEntries: async (bookName, entries) => {
      const current = state.worldbooks.get(bookName) || [];
      state.worldbooks.set(bookName, current.concat((entries || []).map((item, index) => ({ uid: item.uid || Date.now() + index, ...item }))));
    },
    deleteLorebookEntries: async (bookName, uids) => {
      const remove = new Set(uids || []);
      state.worldbooks.set(bookName, (state.worldbooks.get(bookName) || []).filter((item) => !remove.has(item.uid)));
    },
    triggerSlash: async (command) => `slash:${command}`,
    generateRaw: async (options) => ai(options && options.ordered_prompts ? options.ordered_prompts : [], options || {}),
    generate: async (options) => {
      const mes = await ai([{ role: 'user', content: options && (options.prompt || options.user_input) || '' }], options || {});
      state.chat.push({ message_id: nextMessageId(), is_user: false, name: 'assistant', mes });
      await eventSource.emit(eventTypes.GENERATION_ENDED, state.chat[state.chat.length - 1].message_id);
      return mes;
    }
  };

  const window = {
    document,
    parent: null,
    top: null,
    self: null,
    location: document.location,
    navigator: { userAgent: 'shujuku-local-mock' },
    localStorage: new MapStorage(),
    sessionStorage: new MapStorage(),
    indexedDB: config.indexedDB === false ? null : (config.indexedDB || createIndexedDbStub()),
    Blob: globalThis.Blob,
    FileReader: globalThis.FileReader || function FileReader() {
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onerror = null;
      this.readAsText = async (blob) => {
        try {
          this.result = blob && typeof blob.text === 'function' ? await blob.text() : String(blob || '');
          if (typeof this.onload === 'function') this.onload({ target: this });
        } catch (error) {
          this.error = error;
          if (typeof this.onerror === 'function') this.onerror({ target: this });
        }
      };
    },
    URL: globalThis.URL,
    SillyTavern: { chat: state.chat, getContext, libs: { DOMPurify: { sanitize: (html) => String(html || '') } } },
    TavernHelper,
    toastr: createToastr(),
    $,
    jQuery: $,
    console,
    setTimeout: (...args) => {
      const id = setTimeout(...args);
      if (id && typeof id.unref === 'function') id.unref();
      return id;
    },
    clearTimeout,
    setInterval: (...args) => {
      const id = setInterval(...args);
      if (id && typeof id.unref === 'function') id.unref();
      return id;
    },
    clearInterval,
    TextEncoder,
    TextDecoder,
    atob: (value) => Buffer.from(String(value || ''), 'base64').toString('binary'),
    btoa: (value) => Buffer.from(String(value || ''), 'binary').toString('base64'),
    fetch: async (url, request = {}) => {
      const textUrl = String(url);
      if (textUrl.includes('/api/backends/chat-completions/status')) {
        return createResponse({ models: [{ id: process.env.OPENAI_COMPAT_MODEL || 'fake-local-model' }] });
      }
      if (textUrl.includes('/api/backends/chat-completions/generate')) {
        const body = request && request.body ? JSON.parse(String(request.body)) : {};
        const content = await ai(body.messages || body.ordered_prompts || [], body);
        return createResponse({ choices: [{ message: { content } }] });
      }
      return createResponse({ ok: true });
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (callback) => window.setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    matchMedia: () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    devicePixelRatio: 1,
    HTMLTextAreaElement: function HTMLTextAreaElement() {}
  };
  window.parent = window;
  window.top = window;
  window.self = window;

  return {
    window,
    document,
    $,
    state,
    ai,
    eventSource,
    eventTypes,
    getContext,
    snapshotWorldbooks() {
      return Object.fromEntries(Array.from(state.worldbooks.entries()).map(([name, entries]) => [name, entries.map((item) => ({ ...item }))]));
    }
  };
}

function createToastr() {
  const calls = [];
  const api = { calls };
  for (const level of ['info', 'success', 'warning', 'error']) {
    api[level] = (message, title, options) => {
      calls.push({ level, message, title, options });
      return null;
    };
  }
  api.clear = () => {};
  return api;
}

class MapStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }
  setItem(key, value) {
    this.map.set(String(key), String(value));
  }
  removeItem(key) {
    this.map.delete(String(key));
  }
  clear() {
    this.map.clear();
  }
}

function createIndexedDbStub() {
  const stores = new Map();
  function requestSuccess(result) {
    const request = { result };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ type: 'success', target: request });
    }, 0);
    return request;
  }
  function getStore(name) {
    const key = String(name || 'default');
    if (!stores.has(key)) stores.set(key, new Map());
    const store = stores.get(key);
    return {
      get(id) {
        return requestSuccess(store.get(String(id)));
      },
      put(value, id) {
        const keyValue = id == null && value && value.id != null ? value.id : id;
        store.set(String(keyValue), value);
        return requestSuccess(keyValue);
      },
      add(value, id) {
        const keyValue = id == null && value && value.id != null ? value.id : id;
        store.set(String(keyValue), value);
        return requestSuccess(keyValue);
      },
      delete(id) {
        store.delete(String(id));
        return requestSuccess(undefined);
      },
      openCursor() {
        return requestSuccess(null);
      }
    };
  }
  return {
    open() {
      const request = {};
      setTimeout(() => {
        request.result = {
          objectStoreNames: { contains: () => false },
          createObjectStore: (name) => getStore(name),
          transaction: (name) => ({ objectStore: (storeName) => getStore(storeName || name) })
        };
        const event = { type: 'success', target: request };
        if (request.onsuccess) request.onsuccess(event);
      }, 0);
      return request;
    }
  };
}

module.exports = {
  createMockSillyTavernHost,
  createEventSource,
  createJQuery,
  createDocument
};
