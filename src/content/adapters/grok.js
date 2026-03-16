export function createGrokAdapter(deps) {
  const {
    findInputForPlatform,
    waitFor,
    setReactValue,
    setContentEditable,
    findSendBtnForPlatform,
    normalizeText,
    getContent,
    sleep,
    isNodeDisabled
  } = deps;

  return {
    name: 'Grok',
    findInput: async () => {
      const isVisibleInput = (el) => {
        if (!el || el.disabled || el.readOnly) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 60 && rect.height > 1 && rect.bottom > 0;
      };

      const collectRoots = () => {
        const roots = [document];
        const queue = [document.documentElement];
        const seen = new Set();
        while (queue.length) {
          const node = queue.shift();
          if (!node || seen.has(node)) continue;
          seen.add(node);
          if (node.shadowRoot) roots.push(node.shadowRoot);
          if (node.children) {
            for (const child of node.children) queue.push(child);
          }
        }
        return roots;
      };

      const pickBestInput = () => {
        const candidates = [];
        for (const root of collectRoots()) {
          candidates.push(...root.querySelectorAll('div.ProseMirror[contenteditable="true"], div.tiptap[contenteditable="true"], textarea[placeholder], textarea, div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'));
        }

        const unique = [];
        const seen = new Set();
        for (const c of candidates) {
          if (!c || seen.has(c)) continue;
          seen.add(c);
          unique.push(c);
        }

        const scoreInput = (el) => {
          if (!isVisibleInput(el)) return -1;
          const rect = el.getBoundingClientRect();
          const cls = String(el.className || '').toLowerCase();
          const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
          const root = el.closest('form') || el.parentElement || document;
          let score = 0;
          if (el.matches?.('div.ProseMirror[contenteditable="true"]') || cls.includes('prosemirror') || cls.includes('tiptap')) score += 8;
          if (placeholder.includes('ask') || placeholder.includes('mind') || placeholder.includes('message')) score += 4;
          if (el.closest('form')) score += 3;
          if (root.querySelector?.('button[type="submit"], button[aria-label*="Submit"], button[aria-label*="Send"], button[data-testid*="send"], [role="button"][aria-label*="Send"], [data-testid*="send"]')) score += 3;
          if (rect.top > 40 && rect.top < window.innerHeight) score += 2;
          score += Math.min(4, Math.round(rect.width / 320));
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
      };

      const bySelectors = await findInputForPlatform('grok');
      if (isVisibleInput(bySelectors)) return bySelectors;
      if (bySelectors && bySelectors.tagName === 'TEXTAREA') return bySelectors;
      const found = await waitFor(() => pickBestInput(), 7000, 60);
      if (found) return found;
      const fallbackTextarea = document.querySelector('textarea');
      if (fallbackTextarea) return fallbackTextarea;
      return null;
    },

    async inject(el, text, options) {
      const expected = normalizeText(text);
      // Verify after a generous delay so ProseMirror has time to flush
      // its EditorState back to DOM. Checking too early gives false positives
      // because execCommand writes to DOM before PM overwrites it.
      const verifyAfterFlush = async (waitMs = 150) => {
        await sleep(waitMs);
        const actual = normalizeText(getContent(el));
        if (!expected) return actual.length === 0;
        if (!actual) return false;
        if (actual === expected) return true;
        if (actual.length < Math.floor(expected.length * 0.8)) return false;
        return actual.includes(expected) || expected.includes(actual);
      };

      const clearEditor = async () => {
        el.focus();
        await sleep(20);
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(16);
      };

      // Strategy 1: ClipboardEvent paste with DataTransfer
      // Tiptap/ProseMirror listens for paste events and reads clipboardData
      // to update its internal EditorState. This is the most reliable path.
      const tryPasteEvent = async () => {
        await clearEditor();
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        dt.setData('text/html', `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`);
        el.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
        return verifyAfterFlush(300);
      };

      // Strategy 2: Write to real clipboard + execCommand paste
      // Some ProseMirror setups only trust the real system clipboard.
      const tryRealClipboardPaste = async () => {
        await clearEditor();
        try {
          await navigator.clipboard.writeText(text);
        } catch (_) {
          return false;
        }
        document.execCommand('paste');
        return verifyAfterFlush(300);
      };

      // Strategy 3: InputEvent beforeinput with insertFromPaste + dataTransfer
      // This is the Input Events Level 2 paste path that some PM versions use.
      const tryInputEventPaste = async () => {
        await clearEditor();
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        try {
          el.dispatchEvent(new InputEvent('beforeinput', {
            inputType: 'insertFromPaste',
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
        } catch (_) {
          return false;
        }
        return verifyAfterFlush(300);
      };

      // Strategy 4: execCommand insertText (least reliable for ProseMirror)
      const tryExecInsert = async () => {
        await clearEditor();
        document.execCommand('insertText', false, text);
        return verifyAfterFlush(400);
      };

      if (el.tagName === 'TEXTAREA') {
        el.focus();
        await sleep(20);

        el.select();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }));
        await sleep(16);

        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, text);
        else el.value = text;
        const tracker = el._valueTracker;
        if (tracker) tracker.setValue('');

        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(60);

        if (await verifyAfterFlush(200)) return { strategy: 'grok-react-value', fallbackUsed: false };

        setReactValue(el, text);
        await sleep(80);
        if (await verifyAfterFlush(200)) return { strategy: 'grok-react-value-retry', fallbackUsed: true };

        throw new Error('Grok textarea 注入失败');
      }

      // ProseMirror / contenteditable path
      // Try paste strategies first — they update PM's EditorState.
      // execCommand insertText is last resort — it only updates DOM.
      try { if (await tryPasteEvent()) return { strategy: 'grok-paste-event', fallbackUsed: false }; } catch (_) {}
      try { if (await tryRealClipboardPaste()) return { strategy: 'grok-clipboard-paste', fallbackUsed: true }; } catch (_) {}
      try { if (await tryInputEventPaste()) return { strategy: 'grok-input-paste', fallbackUsed: true }; } catch (_) {}
      try { if (await tryExecInsert()) return { strategy: 'grok-exec-insert', fallbackUsed: true }; } catch (_) {}

      // Final fallback: generic contenteditable injection
      const meta = await setContentEditable(el, text, options);
      await sleep(300);
      if (await verifyAfterFlush(200)) return meta;
      throw new Error('Grok 输入注入失败：所有策略均未生效');
    },

    async send(el, options) {
      const logger = options?.logger;
      const sendTrace = {
        matchedBy: 'none',
        clicked: false,
        formSubmitted: false,
        keyAttempts: []
      };

      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0;
      };

      const triggerClick = (node) => {
        if (!node) return;
        for (const evt of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          try {
            node.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, composed: true }));
          } catch (_) {}
        }
        try { node.click?.(); } catch (_) {}
      };

      const roots = () => {
        const list = [
          el?.closest('form'),
          el?.closest('.ProseMirror')?.parentElement,
          el?.closest('.ProseMirror')?.parentElement?.parentElement,
          el?.closest('[class*="composer"]'),
          el?.closest('[class*="editor"]'),
          el?.parentElement,
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
        const inputRect = el?.getBoundingClientRect ? el.getBoundingClientRect() : null;
        for (const root of roots()) {
          const buttons = root.querySelectorAll
            ? root.querySelectorAll('button, [role="button"], div[role="button"], span[role="button"], [data-testid*="send"], [data-testid*="submit"], [class*="send"][class*="button"], [class*="submit"][class*="button"]')
            : [];
          let fallbackCandidate = null;
          let proximityCandidate = null;
          let proximityScore = -Infinity;
          for (const button of buttons) {
            if (!isVisible(button) || isNodeDisabled(button)) continue;
            const hint = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.getAttribute('data-testid') || ''} ${button.className || ''} ${(button.textContent || '').trim()}`.toLowerCase();
            if (hint.includes('upload') || hint.includes('attach') || hint.includes('mic') || hint.includes('voice') || hint.includes('search') || hint.includes('plus')) continue;
            if (hint.includes('submit') || hint.includes('send') || hint.includes('发送') || hint.includes('提交')) {
              sendTrace.matchedBy = 'hint:sendish';
              return button;
            }
            if (!fallbackCandidate && (hint.includes('composer') || hint.includes('arrow') || hint.includes('paper-plane'))) {
              fallbackCandidate = button;
            }

            if (!inputRect || !button.getBoundingClientRect) continue;
            const r = button.getBoundingClientRect();
            const centerX = r.left + r.width / 2;
            const centerY = r.top + r.height / 2;
            const dx = centerX - (inputRect.left + inputRect.width);
            const dy = centerY - (inputRect.top + inputRect.height / 2);
            const nearHorizontally = dx >= -80 && dx <= 420;
            const nearVertically = Math.abs(dy) <= 240;
            if (!nearHorizontally || !nearVertically) continue;

            let score = 0;
            score -= Math.abs(dx) * 0.3;
            score -= Math.abs(dy) * 0.2;
            if (r.width >= 18 && r.width <= 84 && r.height >= 18 && r.height <= 84) score += 12;
            if (button.querySelector?.('svg')) score += 8;
            if ((button.textContent || '').trim().length === 0) score += 6;
            if ((button.getAttribute('aria-label') || '').trim()) score += 4;
            if (score > proximityScore) {
              proximityScore = score;
              proximityCandidate = button;
            }
          }
          if (fallbackCandidate) {
            sendTrace.matchedBy = 'hint:fallback-candidate';
            return fallbackCandidate;
          }
          if (proximityCandidate) {
            sendTrace.matchedBy = 'proximity';
            return proximityCandidate;
          }
        }
        return null;
      };

      // Grok's submit button is hidden+disabled when React state hasn't registered
      // the injected text. Find it by SVG path signature or aria-label regardless
      // of disabled/hidden state, then force-enable before clicking.
      const GROK_SEND_SVG_PATH = 'M6 11L12 5';
      const findGrokSubmitBtn = () => {
        const allSubmits = document.querySelectorAll('button[type="submit"]');
        for (const b of allSubmits) {
          const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
          if (ariaLabel === 'submit' || ariaLabel === '提交') return b;
          const svgPath = b.querySelector('svg path')?.getAttribute('d') || '';
          if (svgPath.startsWith(GROK_SEND_SVG_PATH)) return b;
        }
        return null;
      };

      const forceEnableBtn = (b) => {
        if (!b) return;
        b.disabled = false;
        b.removeAttribute('disabled');
        // Unhide parent container (Grok wraps it in a div with class "hidden")
        let parent = b.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
          if (parent.classList?.contains('hidden')) {
            parent.classList.remove('hidden');
            parent.style.display = '';
          }
          parent = parent.parentElement;
        }
      };

      const selectorBtn = await findSendBtnForPlatform('grok');
      let btn = selectorBtn || await waitFor(tryFindBtn, 2000, 40);
      // If normal search failed, find the hidden submit button and force-enable it
      if (!btn) {
        const grokBtn = findGrokSubmitBtn();
        if (grokBtn) {
          forceEnableBtn(grokBtn);
          await sleep(50);
          btn = grokBtn;
          sendTrace.matchedBy = 'grok-force-enable';
        }
      }
      const target = el || document.activeElement;
      const expected = normalizeText(options?.text || '');
      const before = normalizeText(getContent(target)) || expected;
      const threadSel = 'main, [class*="conversation"], [class*="messages"], [class*="chat-content"]';
      const threadSnapshotBefore = expected.length >= 4
        ? normalizeText((document.querySelector(threadSel)?.innerText || document.body.innerText || '').slice(0, 6000))
        : '';

      const confirmSendCheck = () => {
        const after = normalizeText(getContent(target));
        if (before && after !== before) return true;
        if (expected.length >= 4 && threadSnapshotBefore) {
          const threadNow = normalizeText((document.querySelector(threadSel)?.innerText || document.body.innerText || '').slice(0, 6000));
          if (threadNow !== threadSnapshotBefore && threadNow.includes(expected.slice(0, Math.min(expected.length, 20)))) return true;
        }
        return false;
      };

      const waitForConfirm = async (maxMs = 2000) => {
        const interval = 50;
        const maxAttempts = Math.ceil(maxMs / interval);
        for (let i = 0; i < maxAttempts; i++) {
          if (confirmSendCheck()) return true;
          await sleep(interval);
        }
        return false;
      };

      const tryKeySend = async () => {
        if (!target) return false;
        target.focus();
        if (target.tagName === 'TEXTAREA' && expected) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(target, expected);
          else target.value = expected;
          const tracker = target._valueTracker;
          if (tracker) tracker.setValue('');
          target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: expected }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(80);
        }
        const attempts = [
          { ctrlKey: false, metaKey: false, tag: 'enter' },
          { ctrlKey: true, metaKey: false, tag: 'ctrl-enter' },
          { ctrlKey: false, metaKey: true, tag: 'meta-enter' }
        ];
        for (const attempt of attempts) {
          const kOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true, ctrlKey: attempt.ctrlKey, metaKey: attempt.metaKey };
          target.dispatchEvent(new KeyboardEvent('keydown', kOpts));
          target.dispatchEvent(new KeyboardEvent('keypress', kOpts));
          target.dispatchEvent(new KeyboardEvent('keyup', kOpts));
          await sleep(220);
          sendTrace.keyAttempts.push(attempt.tag);
          if (confirmSendCheck()) return true;
          logger?.debug('grok-send-key-no-change', { mode: attempt.tag });
        }
        return false;
      };

      const tryFormSubmit = async () => {
        const form = target?.closest?.('form');
        if (!form) return false;
        try {
          if (typeof form.requestSubmit === 'function') form.requestSubmit();
          else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } catch (_) {}
        sendTrace.formSubmitted = true;
        await sleep(220);
        return confirmSendCheck();
      };

      if (btn) {
        if (target?.tagName === 'TEXTAREA' && expected) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(target, expected);
          else target.value = expected;
          const tracker = target._valueTracker;
          if (tracker) tracker.setValue('');
          target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: expected }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(80);
        }
        triggerClick(btn);
        sendTrace.clicked = true;
        await sleep(220);
        if (confirmSendCheck()) return true;
        logger?.debug('grok-send-click-no-confirm');
        if (await tryFormSubmit()) return true;
        if (await tryKeySend()) return true;
        throw new Error(`Grok发送未执行 matched=${sendTrace.matchedBy} clicked=${sendTrace.clicked} form=${sendTrace.formSubmitted} keys=${sendTrace.keyAttempts.join(',') || 'none'}`);
      }

      if (await tryKeySend()) return true;
      pressEnterOn(target);
      await sleep(180);
      if (confirmSendCheck()) return true;
      throw new Error(`Grok发送未执行 matched=${sendTrace.matchedBy} clicked=${sendTrace.clicked} form=${sendTrace.formSubmitted} keys=${sendTrace.keyAttempts.join(',') || 'none'}`);
    }
  };
}
