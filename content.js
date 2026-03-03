// 广发 - Content Script v7
// Faster input path, structured timings, and guarded fallbacks

if (!window.__aiBroadcastLoaded) {
  window.__aiBroadcastLoaded = true;

  (function() {
    'use strict';

    const hostname = window.location.hostname;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const now = () => Date.now();

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

    async function waitForCheck(check, timeout = 120, interval = 20) {
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

    async function verifyContent(el, text, timeout = 120, interval = 20) {
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
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { strategy: 'react-value', fallbackUsed: false };
    }

    async function tryInsertText(el, text) {
      el.focus();
      await sleep(12);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const ok = document.execCommand('insertText', false, text);
      const verified = await verifyContent(el, text);
      if (verified && ok) {
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
      const { fastPathEnabled, logger } = options;

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

    async function closeQianwenTaskAssistant() {
      const tag = document.querySelector('.tagBtn-OADWVI.selected-OsA38F') ||
        document.querySelector('.operateLine-jbfAd6 .tagBtn-OADWVI.selected-OsA38F');
      if (tag && tag.textContent && tag.textContent.includes('任务助理')) {
        const closeIcon = tag.querySelector('[data-icon-type="qwpcicon-close2"]');
        const target = closeIcon || tag;
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        await sleep(120);
      }
    }

    // ── Enter — only keydown, no keypress/keyup ─────────────────────────────
    function pressEnterOn(el) {
      const target = el || document.activeElement;
      if (!target) return;
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    }

    // ── Platforms ────────────────────────────────────────────────────────────
    const qianwenFindInput = () => waitFor(() => {
      const input = document.querySelector('.chatTextarea-DVN_3Y div[contenteditable="true"][data-slate-editor="true"]') ||
        document.querySelector('.chatInput-dXdYNh [contenteditable="true"]') ||
        document.querySelector('.inputContainer-SHGMBo [contenteditable="true"]') ||
        document.querySelector('div[contenteditable="true"][data-slate-editor="true"]');
      return input || null;
    });
    const qianwenInject = async (el, text, options) => {
      await closeQianwenTaskAssistant();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
      const { logger } = options || {};
      try {
        if (await trySlateBeforeInput(el, text)) return { strategy: 'slate-beforeinput', fallbackUsed: false };
      } catch (e) {
        logger?.debug?.('slate-beforeinput-fail', { error: e?.message });
      }
      return setContentEditable(el, text, options);
    };
    const qianwenSend = async (el) => {
      const container = el?.closest('.inputContainer-SHGMBo') || el?.closest('.functionArea-ZVlxpM') || el?.closest('.inputOutWrap-fg2bG9') || document;
      let btn = await waitFor(() => {
        const enabled = container.querySelector?.('.operateBtn-JsB9e2:not(.disabled-ZaDDJC)') ||
          document.querySelector('.operateBtn-JsB9e2:not(.disabled-ZaDDJC)');
        return enabled || null;
      }, 3000, 40);
      if (!btn) {
        await closeQianwenTaskAssistant();
        await sleep(120);
        btn = await waitFor(() => document.querySelector('.operateBtn-JsB9e2:not(.disabled-ZaDDJC)'), 2000, 40);
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
      const btn = await waitFor(() => {
        const found = inContainer('button[type="submit"]') || inContainer('button[aria-label*="发送"]') ||
          inContainer('button[aria-label*="Send"]') || inContainer('button') ||
          document.querySelector('button[type="submit"]') || document.querySelector('button[aria-label*="发送"]');
        return found && !found.disabled ? found : null;
      }, 3500, 40);
      if (btn) btn.click();
      else { el?.focus(); pressEnterOn(el); }
    };

    const platforms = {
      'chatgpt.com': {
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
        async send() {
          const btn = await waitFor(() => {
            const found = document.querySelector('[data-testid="send-button"]') ||
                          document.querySelector('button[aria-label="Send prompt"]') ||
                          document.querySelector('button[aria-label="Send message"]');
            return found && !found.disabled ? found : null;
          }, 4000, 40);
          if (btn) btn.click();
          else pressEnterOn(null);
        }
      },

      'claude.ai': {
        name: 'Claude',
        findInput: () => waitFor(() =>
          document.querySelector('div.ProseMirror[contenteditable="true"]') ||
          document.querySelector('[data-testid="chat-input"] div[contenteditable]') ||
          document.querySelector('fieldset div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]')
        ),
        inject: (el, text, options) => setContentEditable(el, text, options),
        async send() {
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
          if (btn) btn.click();
          else {
            const input = document.querySelector('div.ProseMirror[contenteditable="true"]');
            pressEnterOn(input);
          }
        }
      },

      'gemini.google.com': {
        name: 'Gemini',
        findInput: () => waitFor(() =>
          document.querySelector('.ql-editor[contenteditable="true"]') ||
          document.querySelector('rich-textarea .ql-editor') ||
          document.querySelector('div[contenteditable="true"][role="textbox"]') ||
          document.querySelector('p[data-placeholder]')?.closest('[contenteditable="true"]')
        ),
        inject: (el, text, options) => setGeminiInput(el, text, options),
        async send(el, options) {
          await sleep(50);
          const btn = await waitFor(() => {
            for (const selector of [
              'button[aria-label="Send message"]',
              'button[aria-label="Send"]',
              'button.send-button',
              'button[data-test-id="send-button"]',
              'button[mattooltip="Send message"]',
              'button[mattooltip="Send"]',
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
                const hint = (b.getAttribute('aria-label') || b.getAttribute('mattooltip') || '').toLowerCase();
                if (hint.includes('send')) return b;
              }
            }
            return null;
          }, 5000, 50);
          if (btn) {
            btn.click();
          } else {
            options.logger.debug('gemini-send-button-not-found', { hasInput: Boolean(el) });
          }
        }
      },

      'grok.com': {
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

      'deepseek.com': {
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
                          document.querySelector('[aria-label*="send"]') ||
                          document.querySelector('[aria-label*="Send"]');
            return found && !found.disabled ? found : null;
          }, 2000, 40);
          if (btn) btn.click();
          else { el?.focus(); pressEnterOn(el); }
        }
      },

      'doubao.com': {
        name: 'Doubao',
        findInput: () => waitFor(() =>
          document.querySelector('textarea[placeholder]') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector('textarea')
        ),
        async inject(el, text, options) {
          if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
          return setContentEditable(el, text, options);
        },
        async send(el) {
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
          if (btn) btn.click();
          else { el?.focus(); pressEnterOn(el); }
        }
      },

      'tongyi.aliyun.com': { name: 'Qianwen', findInput: qianwenFindInput, inject: qianwenInject, send: qianwenSend },
      'qianwen.com': { name: 'Qianwen', findInput: qianwenFindInput, inject: qianwenInject, send: qianwenSend },
      'moonshot.cn': { name: 'Kimi', findInput: kimiFindInput, inject: kimiInject, send: kimiSend },
      'kimi.ai': { name: 'Kimi', findInput: kimiFindInput, inject: kimiInject, send: kimiSend },
      'kimi.com': { name: 'Kimi', findInput: kimiFindInput, inject: kimiInject, send: kimiSend }
    };

    function getPlatform() {
      for (const [domain, platform] of Object.entries(platforms)) {
        if (hostname.includes(domain)) return platform;
      }
      return null;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PING') {
        const platform = getPlatform();
        sendResponse({ success: true, platform: platform ? platform.name : 'Unknown' });
        return true;
      }

      if (message.type === 'SEND_NOW') {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const logger = createLogger(requestId, debug);
        const platform = getPlatform();
        if (!platform) {
          sendResponse({ success: false, sendMs: 0, error: '不支持的平台' });
          return true;
        }
        (async () => {
          const t0 = now();
          try {
            const input = await platform.findInput();
            if (!input) {
              sendResponse({ success: false, sendMs: now() - t0, error: '找不到输入框' });
              return;
            }
            await platform.send(input, { logger, debug });
            sendResponse({ success: true, sendMs: now() - t0 });
          } catch (e) {
            logger.error('send-now-failure', { error: e?.message });
            sendResponse({ success: false, sendMs: now() - t0, error: e?.message || '发送失败' });
          }
        })();
        return true;
      }

      if (message.type === 'INJECT_MESSAGE') {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const fastPathEnabled = message.fastPathEnabled !== false;
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
          const startedAt = now();

          logger.info('inject-start', {
            platform: platform.name,
            autoSend,
            fastPathEnabled
          });

          try {
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
              logger,
              debug
            });
            timings.injectMs = now() - injectStartedAt;
            strategy = injectMeta?.strategy || strategy;
            fallbackUsed = Boolean(injectMeta?.fallbackUsed);

            if (autoSend) {
              stage = 'send';
              const sendStartedAt = now();
              await platform.send(input, { logger, debug });
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
              sent: autoSend,
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
