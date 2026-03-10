// Sendol - Content Script v7
// Faster input path, structured timings, and guarded fallbacks

if (!window.__aiBroadcastLoaded) {
  window.__aiBroadcastLoaded = true;

  (function() {
    'use strict';

    const hostname = window.location.hostname;
    const normalizedHostname = String(hostname || '').toLowerCase().replace(/^www\./, '');
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

    function createLogger(requestId, debug) {
      const prefix = `[AIB][content][${requestId}]`;
      return {
        info(event, data = undefined) {
          if (data === undefined) console.log(`${prefix} ${event}`);
          else console.log(`${prefix} ${event}`, data);
        },
        error(event, data = undefined) {
          if (data === undefined) console.error(`${prefix} ${event}`);
          else console.error(`${prefix} ${event}`, data);
        },
        debug(event, data = undefined) {
          if (!debug) return;
          if (data === undefined) console.log(`${prefix} ${event}`);
          else console.log(`${prefix} ${event}`, data);
        }
      };
    }

    async function waitFor(fn, timeout = 6000, interval = 50) {
      const deadline = now() + timeout;
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

    function contentLooksInjected(el, text) {
      const expected = normalizeText(text);
      const actual = normalizeText(getContent(el));
      if (!expected) return actual.length === 0;
      if (!actual) return false;
      if (actual === expected) return true;
      return actual.includes(expected.slice(0, Math.min(expected.length, 24)));
    }

    /** Stricter check for Gemini: require nearly full text (avoid false success on partial insert). */
    function contentLooksInjectedStrict(el, text) {
      const expected = normalizeText(text);
      const actual = normalizeText(getContent(el));
      if (!expected) return actual.length === 0;
      if (!actual) return false;
      if (actual === expected) return true;
      if (actual.length < expected.length * 0.95) return false;
      return actual.includes(expected) || expected.includes(actual);
    }

    async function verifyContent(el, text, timeout = 280, interval = 25) {
      return waitForCheck(() => contentLooksInjected(el, text), timeout, interval);
    }

    async function verifyContentStrict(el, text, timeout = 200, interval = 25) {
      return waitForCheck(() => contentLooksInjectedStrict(el, text), timeout, interval);
    }

    // ── React textarea/input ─────────────────────────────────────────────────
    function setReactValue(el, value) {
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      // Invalidate React's internal value tracker so it detects the change
      const tracker = el._valueTracker;
      if (tracker) tracker.setValue('');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { strategy: 'react-value', fallbackUsed: false };
    }

    async function tryInsertText(el, text) {
      el.focus();
      await sleep(16);
      // Clear existing content
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await sleep(8);
      // Dispatch beforeinput so modern editors (Lexical, ProseMirror) can intercept
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      document.execCommand('insertText', false, text);
      const verified = await verifyContent(el, text);
      if (verified) {
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: text
        }));
      }
      return verified;
    }

    async function tryClipboardPaste(el, text) {
      await navigator.clipboard.writeText(text);
      el.focus();
      await sleep(12);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('paste');
      return verifyContent(el, text);
    }

    async function tryDataTransferPaste(el, text) {
      el.focus();
      await sleep(12);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      }));
      return verifyContent(el, text);
    }

    async function tryDirectDom(el, text) {
      el.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = text;
      el.appendChild(p);
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return verifyContent(el, text);
    }

    /** Slate editor: dispatch beforeinput insertText so React state updates. */
    async function trySlateBeforeInput(el, text) {
      el.focus();
      await sleep(20);
      const sel = window.getSelection();
      if (sel && el.childNodes.length > 0) {
        try {
          sel.selectAllChildren(el);
          el.dispatchEvent(new InputEvent('beforeinput', {
            inputType: 'deleteContentBackward',
            bubbles: true,
            cancelable: true
          }));
          await sleep(10);
        } catch (_) {}
      }
      const chunkSize = text.length > 30 ? 3 : 1;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        el.dispatchEvent(new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: chunk,
          bubbles: true,
          cancelable: true
        }));
        await sleep(chunkSize > 1 ? 2 : 1);
      }
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
      return verifyContent(el, text);
    }

    async function runStrategies(el, strategyList, logger) {
      for (const strategy of strategyList) {
        try {
          if (await strategy.run()) {
            logger.debug('inject-strategy-success', { strategy: strategy.name });
            return { strategy: strategy.name, fallbackUsed: Boolean(strategy.fallbackUsed) };
          }
          logger.debug('inject-strategy-miss', { strategy: strategy.name });
        } catch (err) {
          logger.debug('inject-strategy-error', {
            strategy: strategy.name,
            error: err.message
          });
        }
      }
      throw new Error('输入注入失败');
    }

    // ── Generic contenteditable injection (ChatGPT, Claude) ─────────────────
    async function setContentEditable(el, text, options) {
      const { fastPathEnabled, logger, safeMode } = options;

      if (safeMode) {
        return runStrategies(el, [
          { name: 'insertText-safe', fallbackUsed: false, run: () => tryInsertText(el, text) },
          { name: 'insertText-safe-retry', fallbackUsed: true, run: () => tryInsertText(el, text) }
        ], logger);
      }

      if (fastPathEnabled) {
        return runStrategies(el, [
          { name: 'insertText-fast', fallbackUsed: false, run: () => tryInsertText(el, text) },
          { name: 'clipboard-paste', fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
          { name: 'datatransfer-paste', fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
          { name: 'direct-dom', fallbackUsed: true, run: () => tryDirectDom(el, text) }
        ], logger);
      }

      return runStrategies(el, [
        { name: 'clipboard-legacy', fallbackUsed: false, run: () => tryClipboardPaste(el, text) },
        { name: 'insertText-legacy', fallbackUsed: true, run: () => tryInsertText(el, text) },
        { name: 'datatransfer-legacy', fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: 'direct-dom-legacy', fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger);
    }

    // ── Gemini-specific injection: no clipboard/paste events ────────────────
    const GEMINI_CHUNK_SIZE = 1200;

    function notifyGeminiFramework(el, text) {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const richTextarea = el.closest('rich-textarea');
      if (richTextarea) {
        richTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        richTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    /** Insert text in chunks to avoid execCommand/Quill truncation on long content. */
    async function insertTextInChunks(el, text, options) {
      const { logger } = options || {};
      const len = text.length;
      if (len <= 0) return;
      if (len <= GEMINI_CHUNK_SIZE) {
        document.execCommand('insertText', false, text);
        return;
      }
      for (let i = 0; i < len; i += GEMINI_CHUNK_SIZE) {
        const chunk = text.slice(i, i + GEMINI_CHUNK_SIZE);
        document.execCommand('insertText', false, chunk);
        await sleep(12);
      }
    }

    async function setGeminiInput(el, text, options) {
      const { logger } = options;

      el.focus();
      await sleep(40);

      const richTextarea = el.closest('rich-textarea') || el.parentElement;
      const quill = richTextarea?.__quill || el.__quill;

      if (quill) {
        quill.setText('');
        if (text.length <= GEMINI_CHUNK_SIZE) {
          quill.insertText(0, text, 'user');
        } else {
          for (let i = 0; i < text.length; i += GEMINI_CHUNK_SIZE) {
            const chunk = text.slice(i, i + GEMINI_CHUNK_SIZE);
            quill.insertText(i, chunk, 'user');
            await sleep(10);
          }
        }
        quill.setSelection(text.length, 0);
        notifyGeminiFramework(el, text);
        await sleep(30);
        if (await verifyContentStrict(el, text, 300, 30)) {
          return { strategy: 'gemini-quill', fallbackUsed: false };
        }
        quill.setText('');
        await sleep(16);
      }

      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await insertTextInChunks(el, text, options);
      if (await verifyContentStrict(el, text, 250, 25)) {
        notifyGeminiFramework(el, text);
        return { strategy: 'gemini-insertText', fallbackUsed: Boolean(quill) };
      }

      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await insertTextInChunks(el, text, options);
      if (await verifyContentStrict(el, text, 250, 25)) {
        notifyGeminiFramework(el, text);
        return { strategy: 'gemini-insertText-retry', fallbackUsed: true };
      }

      el.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = text;
      el.appendChild(p);
      notifyGeminiFramework(el, text);
      if (await verifyContentStrict(el, text, 200, 25)) {
        return { strategy: 'gemini-direct-dom', fallbackUsed: true };
      }

      logger.debug('gemini-inject-failed-after-fallbacks');
      throw new Error('Gemini 输入注入失败');
    }

    async function setYuanbaoInput(el, text, options) {
      const { logger } = options || {};
      el.focus();
      await sleep(28);

      const quill = el.__quill || el.closest('.ql-container')?.__quill || el.closest('.ql-editor')?.__quill;
      if (quill) {
        quill.setText('');
        quill.insertText(0, text, 'user');
        quill.setSelection(text.length, 0);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (await verifyContent(el, text, 260, 25)) {
          return { strategy: 'yuanbao-quill', fallbackUsed: false };
        }
      }

      return setContentEditable(el, text, options);
    }

    async function closeQianwenTaskAssistant() {
      // Find selected tag containing "任务助理" text (no hashed class dependency)
      const allTags = document.querySelectorAll('[class*="tagBtn"][class*="selected"], [class*="tag"][aria-selected="true"]');
      let tag = null;
      for (const node of allTags) {
        if (node.textContent && node.textContent.includes('任务助理')) {
          tag = node;
          break;
        }
      }
      if (!tag) return;
      const closeIcon = tag.querySelector('[data-icon-type*="close"]') || tag.querySelector('svg');
      const target = closeIcon || tag;
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      await sleep(120);
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
    // Qianwen: all selectors use stable attributes (no CSS module hashes)
    const qianwenFindInput = () => waitFor(() => {
      const candidates = [
        ...document.querySelectorAll('div[data-slate-editor="true"][contenteditable="true"]'),
        ...document.querySelectorAll('div[contenteditable="true"][role="textbox"]'),
        ...document.querySelectorAll('div[contenteditable="true"]'),
        ...document.querySelectorAll('textarea[placeholder]'),
        ...document.querySelectorAll('textarea')
      ];

      if (!candidates.length) return null;

      const unique = [];
      const seen = new Set();
      for (const candidate of candidates) {
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        unique.push(candidate);
      }

      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 120 && rect.height > 20 && rect.bottom > 0;
      };

      const hasSendButtonNearby = (node) => {
        const root = node.closest('form') || node.closest('section') || node.parentElement?.parentElement || document;
        if (!root?.querySelectorAll) return false;
        const buttons = root.querySelectorAll('button:not([disabled]), [role="button"]');
        for (const btn of buttons) {
          if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
          const hint = `${btn.getAttribute('aria-label') || ''} ${btn.getAttribute('title') || ''} ${(btn.textContent || '').trim()}`.toLowerCase();
          if (hint.includes('发送') || hint.includes('send') || hint.includes('提交') || hint.includes('submit')) return true;
        }
        return false;
      };

      const scoreInput = (node) => {
        if (!node || !isVisible(node)) return -1;
        if (node.getAttribute('contenteditable') !== 'true' && node.tagName !== 'TEXTAREA') return -1;
        if (node.getAttribute('aria-disabled') === 'true') return -1;

        const rect = node.getBoundingClientRect();
        const role = (node.getAttribute('role') || '').toLowerCase();
        const hasSlate = node.getAttribute('data-slate-editor') === 'true';

        let score = 0;
        if (hasSlate) score += 8;
        if (role === 'textbox') score += 4;
        if (node.tagName === 'TEXTAREA') score += 3;
        if (hasSendButtonNearby(node)) score += 5;
        if (rect.top > 0 && rect.top < window.innerHeight) score += 2;
        if (rect.bottom > window.innerHeight * 0.45) score += 2;
        score += Math.min(4, Math.round(rect.width / 300));
        return score;
      };

      let best = null;
      let bestScore = -1;
      for (const candidate of unique) {
        const score = scoreInput(candidate);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      return bestScore >= 0 ? best : null;
    });
    async function setQianwenInput(el, text, options) {
      const { logger } = options || {};
      el.focus();
      await sleep(20);

      // Try to access Slate editor instance via React fiber
      const slateNode = el.closest('[data-slate-editor="true"]') || el;
      const fiberKey = Object.keys(slateNode).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (fiberKey) {
        try {
          let fiber = slateNode[fiberKey];
          for (let i = 0; i < 15 && fiber; i++) {
            const editor = fiber.memoizedProps?.editor || fiber.stateNode?.editor;
            if (editor && typeof editor.insertText === 'function' && typeof editor.deleteFragment === 'function') {
              // Use Slate editor API directly
              try { editor.deleteFragment(); } catch (_) {}
              editor.insertText(text);
              el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
              if (await verifyContent(el, text)) {
                return { strategy: 'qianwen-slate-api', fallbackUsed: false };
              }
            }
            fiber = fiber.return;
          }
        } catch (_) {}
      }

      // Fallback: Slate-aware strategies
      return runStrategies(el, [
        { name: 'qw-insertText', fallbackUsed: false, run: () => tryInsertText(el, text) },
        { name: 'qw-beforeinput', fallbackUsed: true, run: () => trySlateBeforeInput(el, text) },
        { name: 'qw-datatransfer', fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: 'qw-clipboard', fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
        { name: 'qw-direct-dom', fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger);
    }

    const qianwenInject = async (el, text, options) => {
      await closeQianwenTaskAssistant();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
      return setQianwenInput(el, text, options);
    };
    const qianwenSend = async (el) => {
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

    const kimiFindInput = () => waitFor(() =>
      document.querySelector('textarea[placeholder]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea')
    );
    const kimiInject = async (el, text, options) => {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
      return setContentEditable(el, text, options);
    };
    const kimiSend = async (el) => {
      const container = el?.closest('form') || el?.closest('div[class*="input"]') || el?.closest('div[class*="chat"]') || document;
      const inContainer = (sel) => container.querySelector && container.querySelector(sel);
      const findSendBtn = () => {
        const explicit = inContainer('button[type="submit"]') || inContainer('button[aria-label*="发送"]') ||
          inContainer('button[aria-label*="Send"]') ||
          document.querySelector('button[type="submit"]') || document.querySelector('button[aria-label*="发送"]');
        if (explicit && !explicit.disabled) return explicit;
        // Heuristic: look for send-like buttons by text/aria
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

    const yuanbaoFindInput = () => waitFor(() =>
      document.querySelector('.ql-editor[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea')
    );
    const yuanbaoInject = async (el, text, options) => {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
      return setYuanbaoInput(el, text, options);
    };
    const yuanbaoSend = async (el, options) => {
      const logger = options?.logger;
      const before = normalizeText(getContent(el));
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

    const platformAdapters = {
      chatgpt: {
        name: 'ChatGPT',
        findInput: () => waitFor(() =>
          document.querySelector('#prompt-textarea') ||
          document.querySelector('div[contenteditable="true"][data-lexical-editor]') ||
          document.querySelector('div[contenteditable="true"][role="textbox"]')
        ),
        async inject(el, text, options) {
          if (el.tagName === 'TEXTAREA') return setReactValue(el, text);
          return setContentEditable(el, text, options);
        },
        async send(el) {
          const btn = await waitFor(() => {
            const found = document.querySelector('[data-testid="send-button"]') ||
                          document.querySelector('button[aria-label="Send prompt"]') ||
                          document.querySelector('button[aria-label="Send message"]') ||
                          document.querySelector('button[aria-label*="Send"]');
            return found && !found.disabled ? found : null;
          }, 4000, 40);
          if (btn) { btn.click(); return; }
          // Fallback: try clicking even a disabled-looking send button (some frameworks use aria-disabled)
          const anyBtn = document.querySelector('[data-testid="send-button"]') ||
                         document.querySelector('button[aria-label="Send prompt"]') ||
                         document.querySelector('button[aria-label="Send message"]') ||
                         document.querySelector('button[aria-label*="Send"]');
          if (anyBtn) { anyBtn.click(); return; }
          // Last resort: press Enter on the input element
          const target = el || document.querySelector('#prompt-textarea') || document.activeElement;
          if (target) { target.focus(); pressEnterOn(target); }
          else pressEnterOn(null);
        }
      },

      claude: {
        name: 'Claude',
        findInput: () => waitFor(() =>
          document.querySelector('div.ProseMirror[contenteditable="true"]') ||
          document.querySelector('[data-testid="chat-input"] div[contenteditable]') ||
          document.querySelector('fieldset div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]')
        ),
        inject: (el, text, options) => setContentEditable(el, text, options),
        async send(el) {
          const btn = await waitFor(() => {
            const candidates = [
              document.querySelector('button[aria-label="Send Message"]'),
              document.querySelector('button[aria-label*="Send"]'),
              ...[...document.querySelectorAll('fieldset button, form button')]
            ].filter(Boolean);
            for (const candidate of candidates) {
              if (candidate.disabled) continue;
              const label = (candidate.getAttribute('aria-label') || '').toLowerCase();
              if (label.includes('attach') || label.includes('file') || label.includes('upload')) continue;
              if (candidate.querySelector('svg')) return candidate;
            }
            return null;
          }, 4000, 40);
          if (btn) { btn.click(); return; }
          // Fallback: try any send-like button even if disabled
          const anyBtn = document.querySelector('button[aria-label="Send Message"]') ||
                         document.querySelector('button[aria-label*="Send"]');
          if (anyBtn) { anyBtn.click(); return; }
          const input = el || document.querySelector('div.ProseMirror[contenteditable="true"]');
          if (input) { input.focus(); pressEnterOn(input); }
        }
      },

      gemini: {
        name: 'Gemini',
        findInput: () => waitFor(() =>
          document.querySelector('.ql-editor[contenteditable="true"]') ||
          document.querySelector('rich-textarea .ql-editor') ||
          document.querySelector('div[contenteditable="true"][role="textbox"]') ||
          document.querySelector('p[data-placeholder]')?.closest('[contenteditable="true"]')
        ),
        inject: (el, text, options) => setGeminiInput(el, text, options),
        async send(el, options) {
          const logger = options?.logger;
          await sleep(80);
          const before = normalizeText(getContent(el));

          const keySend = async () => {
            const target = el || document.activeElement;
            if (!target) return false;

            target.focus();
            pressEnterOn(target);
            await sleep(220);
            let after = normalizeText(getContent(target));
            if (!before || after !== before) return true;

            target.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
              ctrlKey: true
            }));
            await sleep(220);
            after = normalizeText(getContent(target));
            if (!before || after !== before) return true;

            target.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
              metaKey: true
            }));
            await sleep(220);
            after = normalizeText(getContent(target));
            return !before || after !== before;
          };

          const btn = await waitFor(() => {
            for (const selector of [
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
            ]) {
              const found = document.querySelector(selector);
              if (found && !found.disabled) return found;
            }
            const container = el?.closest('rich-textarea')?.parentElement?.parentElement
                           || el?.closest('.input-area-container')
                           || el?.closest('[role="complementary"]')?.parentElement;
            if (container) {
              for (const b of container.querySelectorAll('button:not([disabled])')) {
                const hint = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('mattooltip') || ''} ${b.getAttribute('title') || ''}`.toLowerCase();
                if (hint.includes('send') || hint.includes('submit') || hint.includes('发送') || hint.includes('提交')) return b;
              }
            }
            return null;
          }, 6500, 50);

          if (btn) {
            btn.click();
            if (!before) return true;
            await sleep(220);
            const afterClick = normalizeText(getContent(el));
            if (afterClick !== before) return true;
            logger?.debug('gemini-send-click-no-change');
          } else {
            logger?.debug('gemini-send-button-not-found', { hasInput: Boolean(el) });
          }

          const keySendOk = await keySend();
          if (keySendOk) return true;

          logger?.debug('gemini-send-failed-after-key-fallback');
          return false;
        }
      },

      grok: {
        name: 'Grok',
        findInput: () => waitFor(() => {
          const candidates = [
            ...document.querySelectorAll('textarea[placeholder]'),
            ...document.querySelectorAll('textarea'),
            ...document.querySelectorAll('div[contenteditable="true"][role="textbox"]'),
            ...document.querySelectorAll('div[contenteditable="true"]')
          ];

          const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 120 && rect.height > 20 && rect.bottom > 0;
          };

          const scoreInput = (el) => {
            if (!el || el.disabled || el.readOnly || !isVisible(el)) return -1;
            const rect = el.getBoundingClientRect();
            const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
            const root = el.closest('form') || el.parentElement || document;
            let score = 0;
            if (placeholder.includes('ask') || placeholder.includes('mind') || placeholder.includes('message')) score += 6;
            if (el.closest('form')) score += 4;
            if (root.querySelector?.('button[type="submit"], button[aria-label*="Submit"], button[aria-label*="Send"], button[data-testid*="send"]')) score += 4;
            if (rect.top > 40 && rect.top < window.innerHeight) score += 2;
            score += Math.min(4, Math.round(rect.width / 300));
            return score;
          };

          let best = null;
          let bestScore = -1;
          for (const candidate of candidates) {
            const score = scoreInput(candidate);
            if (score > bestScore) {
              bestScore = score;
              best = candidate;
            }
          }
          return bestScore >= 0 ? best : null;
        }),
        async inject(el, text, options) {
          if (el.tagName === 'TEXTAREA') return setReactValue(el, text);
          return setContentEditable(el, text, options);
        },
        async send(el, options) {
          const logger = options?.logger;
          const selectors = [
            'button[type="submit"]:not([disabled])',
            'button[aria-label="Submit"]:not([disabled])',
            'button[aria-label*="Submit"]:not([disabled])',
            'button[aria-label*="Send"]:not([disabled])',
            'button[data-testid*="send"]:not([disabled])'
          ];

          const isVisible = (node) => {
            if (!node) return false;
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom > 0;
          };

          const roots = () => {
            const list = [
              el?.closest('form'),
              el?.parentElement,
              el?.closest('div[class*="input"]'),
              el?.closest('main'),
              document
            ].filter(Boolean);
            const uniq = [];
            const seen = new Set();
            for (const root of list) {
              if (seen.has(root)) continue;
              seen.add(root);
              uniq.push(root);
            }
            return uniq;
          };

          const tryFindBtn = () => {
            for (const root of roots()) {
              for (const selector of selectors) {
                const found = root.querySelector?.(selector);
                if (found && isVisible(found)) return found;
              }
              const buttons = root.querySelectorAll ? root.querySelectorAll('button:not([disabled])') : [];
              for (const button of buttons) {
                if (!isVisible(button)) continue;
                const hint = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.getAttribute('data-testid') || ''} ${(button.textContent || '').trim()}`.toLowerCase();
                if (hint.includes('submit') || hint.includes('send')) return button;
              }
            }
            return null;
          };

          const btn = await waitFor(tryFindBtn, 3500, 40);
          if (btn) {
            btn.click();
            return;
          }

          const target = el || document.activeElement;
          if (!target) {
            pressEnterOn(null);
            return;
          }
          const before = normalizeText(getContent(target));
          target.focus();
          pressEnterOn(target);
          await sleep(220);
          const after = normalizeText(getContent(target));
          if (before && after === before) {
            target.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
              ctrlKey: true
            }));
            logger?.debug('grok-send-ctrl-enter-fallback');
          }
        }
      },

      deepseek: {
        name: 'DeepSeek',
        findInput: () => waitFor(() =>
          document.querySelector('textarea#chat-input') ||
          document.querySelector('textarea[placeholder*="Ask"]') ||
          document.querySelector('textarea')
        ),
        inject: (el, text) => Promise.resolve(setReactValue(el, text)),
        async send(el) {
          const btn = await waitFor(() => {
            const found = document.querySelector('button[type="submit"]') ||
                          document.querySelector('[aria-label*="send" i]') ||
                          document.querySelector('[aria-label*="Send"]') ||
                          document.querySelector('button[data-testid*="send"]');
            return found && !found.disabled ? found : null;
          }, 3000, 40);
          if (btn) { btn.click(); return; }
          // Fallback: look for any send-ish button in the form/container
          const container = el?.closest('form') || el?.closest('div[class*="input"]') || document;
          const buttons = container.querySelectorAll('button:not([disabled])');
          for (const b of buttons) {
            const hint = `${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`.toLowerCase();
            if (hint.includes('send') || hint.includes('发送')) { b.click(); return; }
          }
          if (el) { el.focus(); pressEnterOn(el); }
        }
      },

      doubao: {
        name: 'Doubao',
        findInput: async () => {
          if (isDoubaoVerificationPage()) {
            const err = new Error('豆包当前处于人机验证页面，请先完成验证后再重试');
            err.stage = 'findInput';
            throw err;
          }
          return waitFor(() =>
            document.querySelector('textarea[placeholder]') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea')
          );
        },
        async inject(el, text, options) {
          if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
          return setContentEditable(el, text, options);
        },
        async send(el) {
          if (isDoubaoVerificationPage()) {
            const err = new Error('豆包当前处于人机验证页面，请先完成验证后再重试');
            err.stage = 'send';
            throw err;
          }
          const container = el?.closest('form') || el?.closest('div[class*="input"]') || el?.closest('div[class*="chat"]') || document;
          const inContainer = (sel) => container.querySelector && container.querySelector(sel);
          const tryBtn = () => {
            const c = inContainer('button[type="submit"]') || inContainer('button[aria-label*="发送"]') ||
              inContainer('button[aria-label*="Send"]') || inContainer('button[data-testid*="send"]');
            if (c && !c.disabled) return c;
            const d = document.querySelector('button[type="submit"]') || document.querySelector('button[aria-label*="发送"]');
            return d && !d.disabled ? d : null;
          };
          const btn = tryBtn() || await waitFor(tryBtn, 3000, 30);
          if (btn) { btn.click(); return; }
          // Fallback: press Enter on input
          if (el) { el.focus(); pressEnterOn(el); }
        }
      },

      qianwen: { name: 'Qianwen', findInput: qianwenFindInput, inject: qianwenInject, send: qianwenSend },
      yuanbao: { name: 'Yuanbao', findInput: yuanbaoFindInput, inject: yuanbaoInject, send: yuanbaoSend },
      kimi: { name: 'Kimi', findInput: kimiFindInput, inject: kimiInject, send: kimiSend }
    };

    const platformIdByDomainFallback = {
      'chatgpt.com': 'chatgpt',
      'chat.openai.com': 'chatgpt',
      'claude.ai': 'claude',
      'gemini.google.com': 'gemini',
      'grok.com': 'grok',
      'deepseek.com': 'deepseek',
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

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
            const input = await platform.findInput();
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
        const logger = createLogger(requestId, debug);
        const platform = getPlatform();
        if (!platform) {
          sendResponse({ success: false, sendMs: 0, error: '不支持的平台' });
          return true;
        }
        (async () => {
          const t0 = now();
          try {
            const riskReason = getHighRiskPageReason();
            if (riskReason) {
              sendResponse({ success: false, sendMs: now() - t0, error: riskReason });
              return;
            }
            const input = await platform.findInput();
            if (!input) {
              sendResponse({ success: false, sendMs: now() - t0, error: '找不到输入框' });
              return;
            }
            const sent = await platform.send(input, { logger, debug, safeMode });
            if (sent === false) {
              sendResponse({ success: false, sendMs: now() - t0, error: '发送动作未执行' });
              return;
            }
            sendResponse({ success: true, sendMs: now() - t0 });
          } catch (e) {
            logger.error('send-now-failure', { error: e?.message });
            sendResponse({ success: false, sendMs: now() - t0, error: e?.message || '发送失败' });
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
        const platform = getPlatform();

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

            if (autoSend) {
              stage = 'send';
              // Give the framework time to process the injected content and enable the send button
              await sleep(300);
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
              fallbackUsed
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
              fallbackUsed
            });
          }
        })();

        return true;
      }
    });
  })();
}
