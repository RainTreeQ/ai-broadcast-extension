import { checkNavigation, getCached, invalidate, setCache } from './core/dom-cache.js';

export const defaultSelectors = {
  chatgpt: {
    findInput: [
      '#prompt-textarea',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"][role="textbox"]'
    ],
    findSendBtn: [
      '[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]'
    ]
  },
  claude: {
    findInput: [
      'div.ProseMirror[contenteditable="true"]',
      '[data-testid="chat-input"] div[contenteditable]',
      'fieldset div[contenteditable="true"]',
      'div[contenteditable="true"]'
    ],
    findSendBtn: [
      'button[aria-label="Send Message"]',
      'button[aria-label*="Send"]'
    ]
  },
  gemini: {
    findInput: [
      '.ql-editor[contenteditable="true"]',
      'rich-textarea .ql-editor',
      'div[contenteditable="true"][role="textbox"]',
      'p[data-placeholder]'
    ],
    findSendBtn: [
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="提交"]',
      'button[aria-label="Submit"]',
      'button[aria-label*="Submit"]',
      'button.send-button',
      'button[data-test-id="send-button"]',
      'button[data-testid*="send"]',
      'button[mattooltip="Send message"]',
      'button[mattooltip="Send"]',
      'button[mattooltip*="Submit"]',
      'button[jsname="Qx7uuf"]'
    ]
  },
  grok: {
    findInput: [
      'textarea',
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ],
    findSendBtn: [
      'button[type="submit"]:not([disabled])',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[aria-label="Submit"]',
      'button[aria-label="提交"]',
      '[role="button"][aria-label*="Send"]',
      '[role="button"][aria-label*="send"]',
      'button[type="submit"]'
    ]
  },
  deepseek: {
    findInput: [
      'div#chat-input[contenteditable="true"]',
      'div[id*="chat-input"][contenteditable="true"]',
      'textarea#chat-input',
      'textarea[id*="chat-input"]',
      'div[contenteditable="true"][data-placeholder]',
      'textarea[placeholder*="Ask"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea'
    ],
    findSendBtn: [
      'button[type="submit"]',
      '[aria-label*="send" i]',
      '[aria-label*="Send"]',
      'button[data-testid*="send"]'
    ]
  },
  doubao: {
    findInput: [
      'textarea[placeholder]',
      'div[contenteditable="true"]',
      'textarea'
    ],
    findSendBtn: [
      'button[type="submit"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      'button[data-testid*="send"]'
    ]
  },
  qianwen: {
    findInput: [
      'textarea.message-input-textarea',
      'textarea[placeholder]',
      'textarea',
      'div[data-slate-editor="true"][contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]'
    ],
    findSendBtn: [
      'button[class*="send"]:not([disabled])',
      'button[class*="submit"]:not([disabled])',
      '[data-icon-type="qwpcicon-sendChat"]',
      'div[class*="operatebtn"]:not([class*="disabled"]) button',
      'div[class*="operatebtn"]:not([class*="disabled"])',
      'div.message-input-right-button-send button',
      'div.message-input-right-button-send',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]:not([disabled])'
    ]
  },
  yuanbao: {
    findInput: [
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea'
    ],
    findSendBtn: [
      'a#yuanbao-send-btn',
      'a[id*="send-btn"]',
      'span.icon-send',
      '[class*="send-btn"]:not([class*="disabled"])',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]'
    ]
  },
  kimi: {
    findInput: [
      'div.chat-input-editor[contenteditable="true"]',
      'div[class*="chat-input-editor"][contenteditable="true"]',
      'textarea[placeholder]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea'
    ],
    findSendBtn: [
      // Kimi 2026: 发送按钮是 div.send-button-container，内部没有 button
      'div.send-button-container:not(.disabled)',
      '.send-button-container',
      'div[class*="send-button-container"]:not(.disabled)',
      // 向下兼容：旧版可能有内部 button
      'div.send-button-container:not(.disabled) button',
      'div[class*="send-button-container"]:not(.disabled) button',
      // Fallback
      'button[class*="send"]:not([disabled])',
      'button[type="submit"]:not([disabled])',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]'
    ]
  },
  mistral: {
    findInput: [
      'textarea[placeholder]',
      'textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ],
    findSendBtn: [
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="Submit"]',
      'button[data-testid*="send"]'
    ]
  }
};

let cachedSelectors = null;

if (chrome.storage?.onChanged?.addListener) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes || !changes.aib_dynamic_selectors) return;
    cachedSelectors = null;
    invalidate();
  });
}

function normalizeSelectorConfig(config) {
  return {
    findInput: Array.isArray(config?.findInput) ? config.findInput : [],
    findSendBtn: Array.isArray(config?.findSendBtn) ? config.findSendBtn : [],
    mode: config?.mode || 'override'
  };
}

function mergeSelectors(localConfig, remoteConfig, mode) {
  const local = normalizeSelectorConfig(localConfig);
  const remote = normalizeSelectorConfig(remoteConfig);
  if (mode === 'disabled') {
    return { findInput: [], findSendBtn: [], mode: 'disabled' };
  }
  if (mode === 'merge') {
    return {
      findInput: [...remote.findInput, ...local.findInput],
      findSendBtn: [...remote.findSendBtn, ...local.findSendBtn],
      mode: 'merge'
    };
  }
  return {
    findInput: remote.findInput,
    findSendBtn: remote.findSendBtn,
    mode: 'override'
  };
}

export async function getDynamicSelectors() {
  if (cachedSelectors) return cachedSelectors;
  try {
    const store = await chrome.storage.local.get('aib_dynamic_selectors');
    const payload = store?.aib_dynamic_selectors?.data;
    if (!payload || typeof payload !== 'object') {
      cachedSelectors = defaultSelectors;
      return cachedSelectors;
    }

    const isV2 = Number(payload.version || 0) >= 2;
    const merged = {};
    const platformIds = new Set([
      ...Object.keys(defaultSelectors),
      ...Object.keys(payload).filter((key) => key !== 'version')
    ]);

    for (const platformId of platformIds) {
      const localConfig = defaultSelectors[platformId];
      const remoteConfig = payload[platformId];
      if (!remoteConfig) {
        merged[platformId] = normalizeSelectorConfig(localConfig);
        continue;
      }
      const mode = isV2 ? String(remoteConfig.mode || 'override') : 'merge';
      merged[platformId] = mergeSelectors(localConfig, remoteConfig, mode);
    }

    cachedSelectors = merged;
  } catch (err) {
    cachedSelectors = defaultSelectors;
  }
  return cachedSelectors;
}

export async function findInputForPlatform(platformId) {
  checkNavigation();
  const cacheKey = `${platformId}:input`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const selectors = await getDynamicSelectors();
  const list = selectors?.[platformId]?.findInput || [];
  for (const selector of list) {
    try {
      const found = document.querySelector(selector);
      if (found) {
        setCache(cacheKey, found);
        return found;
      }
    } catch (_) {}
  }
  return null;
}

export async function findSendBtnForPlatform(platformId) {
  checkNavigation();
  const cacheKey = `${platformId}:send`;
  const cached = getCached(cacheKey);
  // 检查缓存：元素必须仍在 DOM 中且未被禁用
  if (cached && cached.isConnected && !cached.disabled && cached.getAttribute('aria-disabled') !== 'true') {
    return cached;
  }

  const selectors = await getDynamicSelectors();
  const list = selectors?.[platformId]?.findSendBtn || [];
  for (const selector of list) {
    try {
      const found = document.querySelector(selector);
      if (found && !found.disabled && found.getAttribute('aria-disabled') !== 'true') {
        setCache(cacheKey, found);
        return found;
      }
    } catch (_) {}
  }
  return null;
}
