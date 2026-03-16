import { findInputHeuristically, findSendBtnHeuristically } from './heuristics.js';
import { findInputForPlatform, findSendBtnForPlatform } from './selectors.js';
import { createChatgptAdapter } from './adapters/chatgpt.js';
import { createClaudeAdapter } from './adapters/claude.js';
import { createDeepseekAdapter } from './adapters/deepseek.js';
import { createMistralAdapter } from './adapters/mistral.js';
import { createGeminiAdapter } from './adapters/gemini.js';
import { createGrokAdapter } from './adapters/grok.js';
import { createDoubaoAdapter } from './adapters/doubao.js';
import { createQianwenAdapter } from './adapters/qianwen.js';
import { createYuanbaoAdapter } from './adapters/yuanbao.js';
import { createKimiAdapter } from './adapters/kimi.js';
import { waitForElementByMutation } from './core/observer.js';
import { createInjectionTools } from './core/injection.js';
import { onCleanup } from './core/lifecycle.js';
import { invalidate as invalidateDomCache } from './core/dom-cache.js';

// Sendol - Content Script v7
// Faster input path, structured timings, and guarded fallbacks

if (!window.__aiBroadcastLoaded) {
  window.__aiBroadcastLoaded = true;

  const hostname = window.location.hostname;
  const normalizedHostname = String(hostname || '').toLowerCase().replace(/^www\./, '');

    function isNodeDisabled(node) {
      if (!node) return true;
      if (node.disabled === true) return true;
      const ariaDisabled = String(node.getAttribute?.('aria-disabled') || '').toLowerCase();
      if (ariaDisabled === 'true') return true;
      const className = node.className?.toString().toLowerCase() || '';
      if (className.includes('disabled') || className.includes('is-disabled')) return true;
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

    function normalizeText(value) {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function includesAny(text, keywords) {
      return keywords.some((keyword) => text.includes(keyword));
    }

    function isDoubaoVerificationPage() {
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

    function getContent(el) {
      if (!el) return '';
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        return (el.value || '').trim();
      }
      return (el.innerText || el.textContent || '').trim();
    }

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

    // ── Platforms ────────────────────────────────────────────────────────────
    const qianwenSend = async (el) => {
      const selectorBtn = await findSendBtnForPlatform('qianwen');
      if (selectorBtn) {
        selectorBtn.click();
        return;
      }
      // Walk up from the input to find the nearest meaningful container (no hashed classes)
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
          const hint = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${(node.textContent || '').trim()}`.toLowerCase();
          if (hint.includes('登录') || hint.includes('log in') || hint.includes('上传') || hint.includes('attach') || hint.includes('搜索') || hint.includes('search')) continue;
          if (hint.includes('发送') || hint.includes('send') || hint.includes('提交') || hint.includes('submit')) return node;
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

    const kimiSend = async (el) => {
      const selectorBtn = await findSendBtnForPlatform('kimi');
      if (selectorBtn) {
        selectorBtn.click();
        return;
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
      if (btn) btn.click();
      else { el?.focus(); pressEnterOn(el); }
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

    const chatgptAdapter = createChatgptAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn,
      sleep,
      normalizeText,
      getContent
    });

    const claudeAdapter = createClaudeAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn
    });

    const deepseekAdapter = createDeepseekAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn
    });

    const geminiAdapter = createGeminiAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setGeminiInput,
      sleep,
      normalizeText,
      getContent,
      pressEnterOn,
      findSendBtnForPlatform
    });

    const grokAdapter = createGrokAdapter({
      findInputForPlatform,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      normalizeText,
      getContent,
      sleep,
      pressEnterOn,
      isNodeDisabled
    });

    const mistralAdapter = createMistralAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn
    });

    const doubaoAdapter = createDoubaoAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn,
      isDoubaoVerificationPage
    });

    const qianwenAdapter = createQianwenAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      qianwenInject,
      qianwenSend
    });

    const yuanbaoAdapter = createYuanbaoAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      yuanbaoInject,
      yuanbaoSend
    });

    const kimiAdapter = createKimiAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      kimiInject,
      kimiSend
    });

    const platformAdapters = {
      chatgpt: chatgptAdapter,
      claude: claudeAdapter,

      gemini: geminiAdapter,
      grok: grokAdapter,

      deepseek: deepseekAdapter,

      doubao: doubaoAdapter,
      qianwen: qianwenAdapter,
      yuanbao: yuanbaoAdapter,
      kimi: kimiAdapter,
      mistral: mistralAdapter
    };

    const platformIdByDomainFallback = {
      'chatgpt.com': 'chatgpt',
      'chat.openai.com': 'chatgpt',
      'claude.ai': 'claude',
      'gemini.google.com': 'gemini',
      'grok.com': 'grok',
      'deepseek.com': 'deepseek',
      'chat.mistral.ai': 'mistral',
      'doubao.com': 'doubao',
      'tongyi.aliyun.com': 'qianwen',
      'qianwen.com': 'qianwen',
      'yuanbao.tencent.com': 'yuanbao',
      'moonshot.cn': 'kimi',
      'kimi.ai': 'kimi',
      'kimi.com': 'kimi'
    };

    function resolvePlatformId() {
      const sharedPlatform = AIB_SHARED?.getPlatformByHostname
        ? AIB_SHARED.getPlatformByHostname(hostname)
        : null;
      if (sharedPlatform?.id) return sharedPlatform.id;

      for (const [domain, platformId] of Object.entries(platformIdByDomainFallback)) {
        if (normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`)) {
          return platformId;
        }
      }
      return null;
    }

    function getPlatform() {
      const platformId = resolvePlatformId();
      if (!platformId) return null;
      return platformAdapters[platformId] || null;
    }

    const UPLOAD_HIGHLIGHT_STYLE_ID = 'aib-upload-highlight-style';
    const UPLOAD_HIGHLIGHT_ATTR = 'data-aib-upload-highlight';
    const UPLOAD_HINT_KEYWORDS = [
      'upload',
      'attach',
      'attachment',
      'file',
      'image',
      'photo',
      'picture',
      'media',
      '上传',
      '附件',
      '文件',
      '图片',
      '照片',
      '图像',
      '素材'
    ];
    const UPLOAD_NEGATIVE_HINT_KEYWORDS = [
      'send',
      'submit',
      'search',
      'login',
      'log in',
      'sign in',
      'voice',
      'record',
      '发送',
      '提交',
      '搜索',
      '登录',
      '语音',
      '录音'
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

    const runtimeMessageListener = (message, sender, sendResponse) => {
      if (message.type === MESSAGE_TYPES.PING) {
        const platform = getPlatform();
        sendResponse({ success: true, platform: platform ? platform.name : 'Unknown' });
        return true;
      }

      if (message.type === MESSAGE_TYPES.INJECT_IMAGE) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const logger = createLogger(requestId, debug);
        const platform = getPlatform();
        if (!platform) {
          sendResponse({ success: false, error: '不支持的平台', platform: 'Unknown' });
          return true;
        }
        (async () => {
          const startedAt = now();
          try {
            const riskReason = getHighRiskPageReason();
            if (riskReason) {
              sendResponse({ success: false, error: riskReason, platform: platform.name });
              return;
            }
            let input = await platform.findInput();
            if (!input) {
              sendResponse({ success: false, error: `找不到 ${platform.name} 输入框`, platform: platform.name });
              return;
            }
            const result = await pasteImageToInput(input, message.imageBase64, message.mimeType || 'image/png', logger);
            const totalMs = now() - startedAt;
            sendResponse({
              success: result.success,
              platform: platform.name,
              strategy: result.strategy,
              totalMs,
              error: result.success ? undefined : '图片粘贴失败'
            });
          } catch (err) {
            logger.error('inject-image-failure', { error: err?.message });
            sendResponse({ success: false, error: err?.message || '图片注入失败', platform: platform.name });
          }
        })();
        return true;
      }

      if (message.type === MESSAGE_TYPES.HIGHLIGHT_UPLOAD_ENTRY) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const logger = createLogger(requestId, debug);
        const platformName = getPlatform()?.name || 'Unknown';
        (async () => {
          const startedAt = now();
          try {
            const target = await waitFor(() => findUploadEntryTarget(), 2200, 90);
            if (!target?.element) {
              sendResponse({
                success: true,
                found: false,
                platform: platformName,
                via: 'none',
                totalMs: now() - startedAt
              });
              return;
            }
            markUploadHighlight(target.element);
            logger.debug('upload-entry-highlighted', { platform: platformName, via: target.via, score: target.score });
            sendResponse({
              success: true,
              found: true,
              platform: platformName,
              via: target.via || 'unknown',
              totalMs: now() - startedAt
            });
          } catch (err) {
            logger.error('upload-entry-highlight-failure', { error: err?.message });
            sendResponse({
              success: false,
              found: false,
              platform: platformName,
              via: 'error',
              totalMs: now() - startedAt,
              error: err?.message || '定位上传入口失败'
            });
          }
        })();
        return true;
      }

      if (message.type === MESSAGE_TYPES.SEND_NOW) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const safeMode = Boolean(message.safeMode);
        const expectedText = normalizeText(message.text || '');
        const logger = createLogger(requestId, debug);
        const platformId = resolvePlatformId();
        const platform = getPlatform();
        if (!platform) {
          sendResponse({
            success: false,
            sendMs: 0,
            error: '不支持的平台',
            debugLog: 'send_now | platform=Unknown | error=不支持的平台'
          });
          return true;
        }
        (async () => {
          const t0 = now();
          try {
            const riskReason = getHighRiskPageReason();
            if (riskReason) {
              sendResponse({
                success: false,
                sendMs: now() - t0,
                error: riskReason,
                debugLog: `send_now | platform=${platform.name} | stage=risk | error=${riskReason}`
              });
              return;
            }
            let input = await platform.findInput();
            if (!input) {
              sendResponse({
                success: false,
                sendMs: now() - t0,
                error: '找不到输入框',
                debugLog: `send_now | platform=${platform.name} | stage=findInput | error=找不到输入框`
              });
              return;
            }
            if (expectedText) {
              let current = normalizeText(getContent(input));
              const expectedPrefix = expectedText.slice(0, Math.min(expectedText.length, 24));
              const matches = (value) => {
                if (!value) return false;
                return value.includes(expectedPrefix) || expectedText.includes(value);
              };

              if (!matches(current)) {
                await sleep(180);
                const refreshedInput = await platform.findInput();
                if (refreshedInput) {
                  input = refreshedInput;
                  current = normalizeText(getContent(input));
                }
              }

              if (!matches(current)) {
                const bodyText = normalizeText((document.body?.innerText || '').slice(0, 6000));
                const likelyAlreadySent = !current && expectedPrefix && bodyText.includes(expectedPrefix);
                if (likelyAlreadySent) {
                  sendResponse({
                    success: true,
                    sendMs: now() - t0,
                    debugLog: `send_now | platform=${platform.name} | stage=precheck | ok=already-sent | textLen=${expectedText.length} | inputLen=${current.length}`
                  });
                  return;
                }
                sendResponse({
                  success: false,
                  sendMs: now() - t0,
                  error: '发送前输入框内容不匹配',
                  debugLog: `send_now | platform=${platform.name} | stage=precheck | error=发送前输入框内容不匹配 | textLen=${expectedText.length} | inputLen=${current.length}`
                });
                return;
              }
            }
            const sent = await platform.send(input, { logger, debug, safeMode });
            if (sent === false) {
              sendResponse({
                success: false,
                sendMs: now() - t0,
                error: '发送动作未执行',
                debugLog: `send_now | platform=${platform.name} | platformId=${platformId || 'unknown'} | stage=send | error=发送动作未执行`
              });
              return;
            }
            sendResponse({
              success: true,
              sendMs: now() - t0,
              debugLog: `send_now | platform=${platform.name} | platformId=${platformId || 'unknown'} | stage=send | ok=true`
            });
          } catch (e) {
            logger.error('send-now-failure', { error: e?.message });
            sendResponse({
              success: false,
              sendMs: now() - t0,
              error: e?.message || '发送失败',
              debugLog: `send_now | platform=${platform.name} | stage=exception | error=${e?.message || '发送失败'}`
            });
          }
        })();
        return true;
      }

      if (message.type === MESSAGE_TYPES.INJECT_MESSAGE) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const fastPathEnabled = message.fastPathEnabled !== false;
        const safeMode = Boolean(message.safeMode);
        const text = message.text || '';
        const autoSend = Boolean(message.autoSend);
        const logger = createLogger(requestId, debug);
        const platformId = resolvePlatformId();
        const platform = platformId ? platformAdapters[platformId] : null;

        if (!platform) {
          sendResponse({
            success: false,
            platform: 'Unknown',
            error: '不支持的平台',
            stage: 'findInput',
            strategy: 'n/a',
            fallbackUsed: false,
            timings: { findInputMs: 0, injectMs: 0, sendMs: 0, totalMs: 0 }
          });
          return true;
        }

        (async () => {
          const timings = {
            findInputMs: 0,
            injectMs: 0,
            sendMs: 0,
            totalMs: 0
          };
          const normalizedPayload = normalizeText(text);
          const payloadLen = normalizedPayload.length;
          const payloadPreview = normalizedPayload.slice(0, 40).replace(/\|/g, '¦');
          let inputLenAfterInject = 0;
          let stage = 'findInput';
          let strategy = 'n/a';
          let fallbackUsed = false;
          let sent = false;
          const startedAt = now();

          logger.info('inject-start', {
            platform: platform.name,
            autoSend,
            fastPathEnabled,
            safeMode
          });

          try {
            const riskReason = getHighRiskPageReason();
            if (riskReason) {
              const err = new Error(riskReason);
              err.stage = 'findInput';
              throw err;
            }
            const findStartedAt = now();
            const input = await platform.findInput();
            timings.findInputMs = now() - findStartedAt;
            if (!input) {
              const err = new Error(`找不到 ${platform.name} 输入框`);
              err.stage = 'findInput';
              throw err;
            }

            stage = 'inject';
            const injectStartedAt = now();
            const injectMeta = await platform.inject(input, text, {
              fastPathEnabled,
              safeMode,
              logger,
              debug
            });
            timings.injectMs = now() - injectStartedAt;
            strategy = injectMeta?.strategy || strategy;
            fallbackUsed = Boolean(injectMeta?.fallbackUsed);
            inputLenAfterInject = normalizeText(getContent(input)).length;

            if (payloadLen > 0 && inputLenAfterInject === 0) {
              const injectErr = new Error('输入框内容为空');
              injectErr.stage = 'inject';
              throw injectErr;
            }

            if (autoSend) {
              stage = 'send';
              await waitForSendReady(platformId, input);
              const sendStartedAt = now();
              const sendResult = await platform.send(input, { logger, debug, text, safeMode });
              if (sendResult === false) {
                const sendErr = new Error('发送动作未执行');
                sendErr.stage = 'send';
                throw sendErr;
              }
              sent = true;
              timings.sendMs = now() - sendStartedAt;
            }

            timings.totalMs = now() - startedAt;
            logger.info('inject-end', {
              platform: platform.name,
              timings,
              strategy,
              fallbackUsed
            });
            sendResponse({
              success: true,
              platform: platform.name,
              sent,
              timings,
              strategy,
              fallbackUsed,
              debugLog: `inject | platform=${platform.name} | platformId=${platformId || 'unknown'} | stage=${autoSend ? 'send' : 'inject'} | sent=${sent} | strategy=${strategy} | fallback=${fallbackUsed} | textLen=${payloadLen} | inputLen=${inputLenAfterInject} | textHead=${payloadPreview} | ms=${timings.totalMs}`
            });
          } catch (err) {
            timings.totalMs = now() - startedAt;
            const failedStage = err.stage || stage || 'inject';
            logger.error('inject-failure', {
              platform: platform.name,
              stage: failedStage,
              error: err.message,
              timings,
              strategy,
              fallbackUsed
            });
            sendResponse({
              success: false,
              platform: platform.name,
              sent: false,
              error: err.message,
              stage: failedStage,
              timings,
              strategy,
              fallbackUsed,
              debugLog: `inject | platform=${platform.name} | platformId=${platformId || 'unknown'} | stage=${failedStage} | error=${err.message} | strategy=${strategy} | fallback=${fallbackUsed} | textLen=${payloadLen} | inputLen=${inputLenAfterInject} | textHead=${payloadPreview} | ms=${timings.totalMs}`
            });
          }
        })();

        return true;
      }
    };

    chrome.runtime.onMessage.addListener(runtimeMessageListener);
    onCleanup(() => {
      chrome.runtime.onMessage.removeListener(runtimeMessageListener);
      if (uploadHighlightTimer) {
        clearTimeout(uploadHighlightTimer);
        uploadHighlightTimer = null;
      }
      invalidateDomCache();
    });

    // Safety net when scripts are re-injected in long-lived SPA tabs.
    onCleanup(() => {
      try {
        window.__aiBroadcastLoaded = false;
      } catch (_) {}
    });
}
