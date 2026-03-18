// Sendol - Content Core Entry
// Shared utilities exposed via globalThis.__AIB_CORE__ for per-platform content scripts.
// Manifest injection order guarantees this loads BEFORE any content-{platform}.js.

import { findInputHeuristically, findSendBtnHeuristically } from './heuristics.js';
import { findInputForPlatform, findSendBtnForPlatform } from './selectors.js';
import { waitForElementByMutation } from './core/observer.js';
import { createInjectionTools } from './core/injection.js';
import { onCleanup } from './core/lifecycle.js';
import { invalidate as invalidateDomCache } from './core/dom-cache.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();

const AIB_SHARED = globalThis.__AIB_SHARED__ || null;
const MESSAGE_TYPES = AIB_SHARED?.MESSAGE_TYPES || {
  PING: 'PING',
  SEND_NOW: 'SEND_NOW',
  INJECT_MESSAGE: 'INJECT_MESSAGE',
  INJECT_IMAGE: 'INJECT_IMAGE',
  HIGHLIGHT_UPLOAD_ENTRY: 'HIGHLIGHT_UPLOAD_ENTRY'
};

function formatLogData(data) {
  if (data === undefined || data === null) return '';
  if (typeof data !== 'object') return String(data);
  try {
    const parts = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      parts.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
    return parts.join(' | ');
  } catch (_) {
    return String(data);
  }
}

function createLogger(requestId, debug) {
  const prefix = `[AIB][content][${requestId}]`;
  return {
    info(event, data = undefined) {
      if (!debug) return;
      if (data === undefined) console.log(`${prefix} ${event}`);
      else console.log(`${prefix} ${event} | ${formatLogData(data)}`);
    },
    error(event, data = undefined) {
      if (data === undefined) console.error(`${prefix} ${event}`);
      else console.error(`${prefix} ${event} | ${formatLogData(data)}`);
    },
    debug(event, data = undefined) {
      if (!debug) return;
      if (data === undefined) console.log(`${prefix} ${event}`);
      else console.log(`${prefix} ${event} | ${formatLogData(data)}`);
    }
  };
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getContent(el) {
  if (!el) return '';
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    return (el.value || '').trim();
  }
  return (el.innerText || el.textContent || '').trim();
}

function isNodeDisabled(node) {
  if (!node) return true;
  if (node.disabled === true) return true;
  const ariaDisabled = String(node.getAttribute?.('aria-disabled') || '').toLowerCase();
  if (ariaDisabled === 'true') return true;
  const className = node.className?.toString().toLowerCase() || '';
  if (className.includes('disabled') || className.includes('is-disabled')) return true;
  return false;
}

async function waitFor(fn, timeout = 6000, interval = 50) {
  const immediate = (() => {
    try {
      return fn();
    } catch (err) {
      return null;
    }
  })();
  if (immediate) return immediate;

  const observed = await waitForElementByMutation(() => {
    try {
      return fn();
    } catch (err) {
      return null;
    }
  }, { timeout });
  if (observed) return observed;

  // Last-chance fallback for pages with limited DOM mutation signals.
  const deadline = now() + Math.min(400, timeout);
  while (now() < deadline) {
    try {
      const result = fn();
      if (result) return result;
    } catch (err) {}
    await sleep(interval);
  }
  return null;
}

async function waitForCheck(check, timeout = 280, interval = 25) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    try {
      if (check()) return true;
    } catch (err) {}
    await sleep(interval);
  }
  return false;
}

async function waitForSendReady(platformId, input, timeout = 260) {
  if (!platformId) return false;
  const startedAt = now();
  while (now() - startedAt < timeout) {
    const bySelector = await findSendBtnForPlatform(platformId);
    if (bySelector && !isNodeDisabled(bySelector)) return true;
    const heuristic = await findSendBtnHeuristically(input);
    if (heuristic && !isNodeDisabled(heuristic)) return true;
    await sleep(20);
  }
  return false;
}

// ── Enter — full keydown + keypress + keyup cycle ───────────────────────
function pressEnterOn(el) {
  const target = el || document.activeElement;
  if (!target) return;
  const opts = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  };
  target.dispatchEvent(new KeyboardEvent('keydown', opts));
  target.dispatchEvent(new KeyboardEvent('keypress', opts));
  target.dispatchEvent(new KeyboardEvent('keyup', opts));
}

// ── Injection tools ─────────────────────────────────────────────────────
const {
  setReactValue,
  setContentEditable,
  setGeminiInput,
  closeQianwenTaskAssistant,
  qianwenInject,
  kimiInject,
  yuanbaoInject
} = createInjectionTools({
  sleep,
  waitForCheck,
  normalizeText,
  getContent
});

// ── Verification page detection ─────────────────────────────────────────
function isDoubaoVerificationPage() {
  const hostname = window.location.hostname;
  const normalizedHostname = String(hostname || '').toLowerCase().replace(/^www\./, '');
  if (!(normalizedHostname === 'doubao.com' || normalizedHostname.endsWith('.doubao.com'))) return false;

  const urlHint = `${window.location.pathname || ''} ${window.location.search || ''}`.toLowerCase();
  if (includesAny(urlHint, ['captcha', 'verify', 'verification', 'security', 'risk', 'waf', 'bot'])) {
    return true;
  }

  const title = normalizeText(document.title || '').toLowerCase();
  if (includesAny(title, ['人机验证', '安全验证', '验证码', 'captcha', 'verify', 'security check'])) {
    return true;
  }

  const bodyText = normalizeText((document.body?.innerText || '').slice(0, 6000)).toLowerCase();
  return includesAny(bodyText, [
    '人机验证',
    '安全验证',
    '验证码',
    '滑块验证',
    '请先完成验证',
    '行为验证',
    'security check',
    'verify you are human',
    'captcha'
  ]);
}

function getHighRiskPageReason() {
  const title = normalizeText(document.title || '').toLowerCase();
  const urlHint = `${window.location.pathname || ''} ${window.location.search || ''}`.toLowerCase();
  const bodyText = normalizeText((document.body?.innerText || '').slice(0, 7000)).toLowerCase();
  const text = `${title} ${urlHint} ${bodyText}`;
  if (includesAny(text, [
    'captcha',
    'verify you are human',
    'security check',
    'waf',
    'risk control',
    '人机验证',
    '安全验证',
    '验证码',
    '滑块验证',
    '请先完成验证'
  ])) {
    return '检测到风控/验证页面';
  }
  return '';
}

// ── Image paste ────────────────────────────────────────────────────────
function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  return new Blob([byteArray], { type: mimeType });
}

async function pasteImageToInput(el, base64, mimeType, logger) {
  const blob = base64ToBlob(base64, mimeType);
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const file = new File([blob], `image.${ext}`, { type: mimeType, lastModified: Date.now() });

  el.focus();
  await sleep(50);

  // Strategy 1: Construct paste event with clipboardData
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    const pasteEvt = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
    el.dispatchEvent(pasteEvt);
    logger?.debug?.('image-paste-strategy', { strategy: 'clipboardEvent' });
    await sleep(300);
    return { success: true, strategy: 'clipboardEvent' };
  } catch (e) {
    logger?.debug?.('image-paste-clipboardEvent-failed', { error: e?.message });
  }

  // Strategy 2: Fallback — dispatch drop event
  try {
    const dt2 = new DataTransfer();
    dt2.items.add(file);
    const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt2 });
    el.dispatchEvent(dropEvt);
    logger?.debug?.('image-paste-strategy', { strategy: 'drop' });
    await sleep(300);
    return { success: true, strategy: 'drop' };
  } catch (e) {
    logger?.debug?.('image-paste-drop-failed', { error: e?.message });
  }

  // Strategy 3: Fallback — trigger file input directly
  try {
    const container = el.closest('form') || el.closest('section') || el.parentElement?.parentElement || document;
    const fileInput = container.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
    if (fileInput) {
      const dt3 = new DataTransfer();
      dt3.items.add(file);
      fileInput.files = dt3.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      logger?.debug?.('image-paste-strategy', { strategy: 'fileInput' });
      await sleep(300);
      return { success: true, strategy: 'fileInput' };
    }
  } catch (e) {
    logger?.debug?.('image-paste-fileInput-failed', { error: e?.message });
  }

  return { success: false, strategy: 'none' };
}

// ── Upload highlight ───────────────────────────────────────────────────
const UPLOAD_HIGHLIGHT_STYLE_ID = 'aib-upload-highlight-style';
const UPLOAD_HIGHLIGHT_ATTR = 'data-aib-upload-highlight';
const UPLOAD_HINT_KEYWORDS = [
  'upload', 'attach', 'attachment', 'file', 'image', 'photo', 'picture', 'media',
  '上传', '附件', '文件', '图片', '照片', '图像', '素材'
];
const UPLOAD_NEGATIVE_HINT_KEYWORDS = [
  'send', 'submit', 'search', 'login', 'log in', 'sign in', 'voice', 'record',
  '发送', '提交', '搜索', '登录', '语音', '录音'
];
let uploadHighlightTimer = null;

function ensureUploadHighlightStyle() {
  if (document.getElementById(UPLOAD_HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = UPLOAD_HIGHLIGHT_STYLE_ID;
  style.textContent = `
    [${UPLOAD_HIGHLIGHT_ATTR}="1"] {
      outline: 3px solid #22c55e !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.26) !important;
      border-radius: 10px !important;
      animation: aib-upload-highlight-pulse 1s ease-in-out 2;
    }
    @keyframes aib-upload-highlight-pulse {
      0%, 100% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.22); }
      50% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0.36); }
    }
  `;
  document.documentElement.appendChild(style);
}

function clearUploadHighlight() {
  if (uploadHighlightTimer) {
    clearTimeout(uploadHighlightTimer);
    uploadHighlightTimer = null;
  }
  const prev = document.querySelectorAll(`[${UPLOAD_HIGHLIGHT_ATTR}="1"]`);
  for (const node of prev) {
    node.removeAttribute(UPLOAD_HIGHLIGHT_ATTR);
  }
}

function markUploadHighlight(target) {
  if (!target || !target.setAttribute) return;
  ensureUploadHighlightStyle();
  clearUploadHighlight();
  target.setAttribute(UPLOAD_HIGHLIGHT_ATTR, '1');
  try {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  } catch (err) {
    target.scrollIntoView({ block: 'center', inline: 'center' });
  }
  uploadHighlightTimer = setTimeout(() => {
    if (!target.isConnected) return;
    target.removeAttribute(UPLOAD_HIGHLIGHT_ATTR);
  }, 8000);
}

function isElementVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  if (!document.documentElement.contains(el)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  if (style.pointerEvents === 'none') return false;
  const opacity = Number(style.opacity);
  if (Number.isFinite(opacity) && opacity <= 0.01) return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= 4 && rect.height >= 4;
}

function getElementHint(el) {
  if (!el || !(el instanceof Element)) return '';
  const parts = [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('data-testid'),
    el.getAttribute('data-test-id'),
    el.getAttribute('name'),
    el.getAttribute('placeholder'),
    el.getAttribute('id'),
    el.getAttribute('class'),
    el.textContent
  ];
  if (el.tagName === 'INPUT') {
    parts.push(el.getAttribute('accept'));
  }
  return normalizeText(parts.filter(Boolean).join(' ')).toLowerCase();
}

function scoreUploadHint(hintText) {
  if (!hintText) return 0;
  let score = 0;
  for (const keyword of UPLOAD_HINT_KEYWORDS) {
    if (hintText.includes(keyword)) score += 8;
  }
  for (const keyword of UPLOAD_NEGATIVE_HINT_KEYWORDS) {
    if (hintText.includes(keyword)) score -= 8;
  }
  return score;
}

function escapeCssIdentifier(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}

function getAssociatedLabel(input) {
  if (!input || input.tagName !== 'INPUT' || String(input.type).toLowerCase() !== 'file') return null;
  if (input.id) {
    const escaped = escapeCssIdentifier(input.id);
    const byFor = document.querySelector(`label[for="${escaped}"]`);
    if (byFor) return byFor;
  }
  return input.closest('label');
}

function findNearInputTrigger(input) {
  if (!input || !(input instanceof Element)) return null;
  const direct = input.closest('button,[role="button"],label');
  if (direct && direct !== input) return direct;

  const root = input.closest('form') || input.closest('section') || input.closest('article') || input.parentElement || document;
  const candidates = root.querySelectorAll
    ? root.querySelectorAll('button,[role="button"],label,a[role="button"],div[role="button"],span[role="button"]')
    : [];
  let best = null;
  let bestScore = -1;
  for (const node of candidates) {
    if (!node || node === input) continue;
    const hintScore = scoreUploadHint(getElementHint(node));
    if (hintScore <= 0) continue;
    const visibleScore = isElementVisible(node) ? 3 : 0;
    const score = hintScore + visibleScore;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best;
}

function pushUploadCandidate(store, element, baseScore, via, linkedInput = null) {
  if (!element || !(element instanceof Element)) return;
  const hint = getElementHint(element);
  const hintScore = scoreUploadHint(hint);
  const isFileInput = element.tagName === 'INPUT' && String(element.getAttribute('type') || '').toLowerCase() === 'file';
  const visible = isElementVisible(element);
  const interactive = element.matches('button,[role="button"],label,input,a,[tabindex]') ? 4 : 0;
  const score = baseScore + hintScore + interactive + (isFileInput ? 10 : 0) + (visible ? 8 : -6);
  const existing = store.get(element);
  if (existing && existing.score >= score) return;
  store.set(element, {
    element,
    linkedInput,
    via,
    visible,
    score
  });
}

function resolveVisibleUploadCandidate(candidate) {
  if (!candidate) return null;
  if (candidate.visible) return candidate;
  const linked = candidate.linkedInput || null;
  if (!linked) return null;

  const label = getAssociatedLabel(linked);
  if (label && isElementVisible(label)) {
    return { ...candidate, element: label, via: `${candidate.via}->label`, visible: true };
  }
  const near = findNearInputTrigger(linked);
  if (near && isElementVisible(near)) {
    return { ...candidate, element: near, via: `${candidate.via}->nearby`, visible: true };
  }
  return null;
}

function findUploadEntryTarget() {
  const store = new Map();
  const fileInputs = document.querySelectorAll('input[type="file"]');
  for (const input of fileInputs) {
    const accept = String(input.getAttribute('accept') || '').toLowerCase();
    const base = accept.includes('image') ? 34 : 28;
    pushUploadCandidate(store, input, base, 'file-input', input);
    const label = getAssociatedLabel(input);
    if (label) pushUploadCandidate(store, label, 30, 'file-input-label', input);
    const near = findNearInputTrigger(input);
    if (near) pushUploadCandidate(store, near, 24, 'file-input-nearby', input);
  }

  const clickables = document.querySelectorAll('button,[role="button"],label,a[role="button"],div[role="button"],span[role="button"]');
  for (const node of clickables) {
    const hintScore = scoreUploadHint(getElementHint(node));
    if (hintScore < 10) continue;
    pushUploadCandidate(store, node, 10, 'keyword-button', null);
  }

  const ranked = [...store.values()].sort((a, b) => b.score - a.score);
  for (const candidate of ranked) {
    const resolved = resolveVisibleUploadCandidate(candidate);
    if (resolved) return resolved;
  }
  return null;
}

// ── Platform-specific send helpers ──────────────────────────────────────
const qianwenSend = async (el) => {
  const selectorBtn = await findSendBtnForPlatform('qianwen');
  if (selectorBtn) {
    selectorBtn.click();
    return;
  }
  const container = el?.closest('form') || el?.closest('section') || el?.parentElement?.parentElement || document;
  const isBtnDisabled = (node) => {
    if (!node) return true;
    if (node.disabled) return true;
    if (node.getAttribute('aria-disabled') === 'true') return true;
    const klass = node.className?.toString() || '';
    return klass.includes('is-disabled') || klass.includes('disabled');
  };
  const findSendBtn = (root) => {
    if (!root?.querySelectorAll) return null;
    const nodes = root.querySelectorAll('button, [role="button"]');
    for (const node of nodes) {
      if (isBtnDisabled(node)) continue;
      const hint = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.getAttribute('data-icon-type') || ''} ${(node.textContent || '').trim()}`.toLowerCase();
      if (hint.includes('登录') || hint.includes('log in') || hint.includes('上传') || hint.includes('attach') || hint.includes('搜索') || hint.includes('search')) continue;
      if (hint.includes('发送') || hint.includes('send') || hint.includes('提交') || hint.includes('submit') || hint.includes('sendchat')) return node;
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      const allBtns = document.querySelectorAll('button:not([disabled]), [role="button"]');
      let best = null, bestScore = -Infinity;
      for (const b of allBtns) {
        if (isBtnDisabled(b)) continue;
        const br = b.getBoundingClientRect();
        const dx = (br.left + br.width / 2) - (rect.left + rect.width);
        const dy = (br.top + br.height / 2) - (rect.top + rect.height / 2);
        if (dx < -20 || dx > 300 || Math.abs(dy) > 120) continue;
        if (!b.querySelector('svg') && !(b.textContent || '').trim()) continue;
        const score = -Math.abs(dx) * 0.5 - Math.abs(dy) * 0.3;
        if (score > bestScore) { bestScore = score; best = b; }
      }
      if (best) return best;
    }
    return null;
  };
  let btn = await waitFor(() => {
    const byContainer = findSendBtn(container);
    if (byContainer) return byContainer;
    return findSendBtn(document);
  }, 3000, 40);
  if (!btn) {
    await closeQianwenTaskAssistant();
    await sleep(120);
    btn = await waitFor(() => findSendBtn(document), 2000, 40);
  }
  if (btn) btn.click();
  else { el?.focus(); pressEnterOn(el); }
};

const kimiSend = async (el, options) => {
  const logger = options?.logger;
  const before = normalizeText(getContent(el));
  const selectorBtn = await findSendBtnForPlatform('kimi');
  if (selectorBtn) {
    const innerBtn = selectorBtn.tagName !== 'BUTTON' ? selectorBtn.querySelector('button') : null;
    (innerBtn || selectorBtn).click();
    await sleep(400);
    const after = normalizeText(getContent(el));
    if (!before || after !== before) return true;
  }
  const container = el?.closest('form') || el?.closest('div[class*="input"]') || el?.closest('div[class*="chat"]') || document;
  const findSendBtn = () => {
    const buttons = container.querySelectorAll ? container.querySelectorAll('button:not([disabled]), [role="button"]') : [];
    for (const b of buttons) {
      const hint = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''} ${(b.textContent || '').trim()}`.toLowerCase();
      if (hint.includes('发送') || hint.includes('send') || hint.includes('submit') || hint.includes('提交')) return b;
    }
    return null;
  };
  const btn = await waitFor(findSendBtn, 3500, 40);
  if (btn) {
    btn.click();
    await sleep(400);
    const after = normalizeText(getContent(el));
    if (!before || after !== before) return true;
  } else {
    el?.focus();
    pressEnterOn(el);
    await sleep(400);
    const after = normalizeText(getContent(el));
    if (!before || after !== before) return true;
  }
  logger?.debug?.('kimi-send-no-change');
  return false;
};

const yuanbaoSend = async (el, options) => {
  const logger = options?.logger;
  const before = normalizeText(getContent(el));
  const selectorBtn = await findSendBtnForPlatform('yuanbao');
  if (selectorBtn) {
    selectorBtn.click();
    await sleep(240);
    const selectorAfter = normalizeText(getContent(el));
    if (!before || selectorAfter !== before) return true;
  }
  const container = el?.closest('form') || el?.closest('.agent-dialogue') || el?.closest('.dialogue') || el?.parentElement || document;
  const roots = [container, document].filter(Boolean);
  const pickButton = () => {
    for (const root of roots) {
      if (!root?.querySelectorAll) continue;
      const nodes = root.querySelectorAll('button, [role="button"]');
      for (const node of nodes) {
        if (node.disabled || node.getAttribute('aria-disabled') === 'true') continue;
        const hint = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${(node.textContent || '').trim()} ${node.className || ''}`.toLowerCase();
        if (hint.includes('log in') || hint.includes('登录') || hint.includes('tool') || hint.includes('上传')) continue;
        if (hint.includes('send') || hint.includes('发送') || hint.includes('提交') || hint.includes('submit')) {
          return node;
        }
      }
    }
    return null;
  };
  const btn = await waitFor(pickButton, 2600, 35);
  if (btn) {
    btn.click();
    await sleep(240);
    const after = normalizeText(getContent(el));
    if (!before || after !== before) return true;
  }
  el?.focus();
  pressEnterOn(el);
  await sleep(220);
  const finalAfter = normalizeText(getContent(el));
  const sent = !before || finalAfter !== before;
  if (!sent) logger?.debug?.('yuanbao-send-no-change');
  return sent;
};

// ── Expose core API ─────────────────────────────────────────────────────
globalThis.__AIB_CORE__ = {
  // Utilities
  sleep,
  now,
  normalizeText,
  includesAny,
  getContent,
  isNodeDisabled,
  waitFor,
  waitForCheck,
  waitForSendReady,
  pressEnterOn,
  createLogger,
  formatLogData,

  // Selectors & heuristics
  findInputForPlatform,
  findSendBtnForPlatform,
  findInputHeuristically,
  findSendBtnHeuristically,

  // Injection tools
  setReactValue,
  setContentEditable,
  setGeminiInput,
  closeQianwenTaskAssistant,
  qianwenInject,
  kimiInject,
  yuanbaoInject,

  // Image paste
  pasteImageToInput,

  // Upload highlight
  findUploadEntryTarget,
  markUploadHighlight,
  clearUploadHighlight,

  // Risk detection
  isDoubaoVerificationPage,
  getHighRiskPageReason,

  // Platform-specific send helpers
  qianwenSend,
  kimiSend,
  yuanbaoSend,

  // Lifecycle
  onCleanup,
  invalidateDomCache,

  // Message types
  MESSAGE_TYPES
};
