export function createInjectionTools(deps) {
  const {
    sleep,
    waitForCheck,
    normalizeText,
    getContent
  } = deps;

  async function verifyContent(el, text, timeout = 280, interval = 25) {
    const contentLooksInjected = (node, value) => {
      const expected = normalizeText(value);
      const actual = normalizeText(getContent(node));
      if (!expected) return actual.length === 0;
      if (!actual) return false;
      if (actual === expected) return true;
      if (expected.length <= 8) return false;
      if (actual.length < expected.length * 0.9) return false;
      if (actual.length > expected.length * 1.35) return false;
      return actual.includes(expected.slice(0, Math.min(expected.length, 24)));
    };
    return waitForCheck(() => contentLooksInjected(el, text), timeout, interval);
  }

  async function verifyContentStrict(el, text, timeout = 200, interval = 25) {
    const contentLooksInjectedStrict = (node, value) => {
      const expected = normalizeText(value);
      const actual = normalizeText(getContent(node));
      if (!expected) return actual.length === 0;
      if (!actual) return false;
      if (actual === expected) return true;
      if (expected.length <= 8) return false;
      if (actual.length < expected.length * 0.95) return false;
      if (actual.length > expected.length * 1.2) return false;
      return actual.includes(expected) || expected.includes(actual);
    };
    return waitForCheck(() => contentLooksInjectedStrict(el, text), timeout, interval);
  }

  function setReactValue(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    const tracker = el._valueTracker;
    if (tracker) tracker.setValue('');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { strategy: 'react-value', fallbackUsed: false };
  }

  async function tryInsertText(el, text) {
    el.focus();
    await sleep(16);
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(8);
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

  async function clearElement(el) {
    el.focus();
    await sleep(8);
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(8);
  }

  async function runStrategies(el, strategyList, logger) {
    for (const strategy of strategyList) {
      try {
        if (await strategy.run()) {
          logger.debug('inject-strategy-success', { strategy: strategy.name });
          return { strategy: strategy.name, fallbackUsed: Boolean(strategy.fallbackUsed) };
        }
        logger.debug('inject-strategy-miss', { strategy: strategy.name });
        await clearElement(el);
      } catch (err) {
        logger.debug('inject-strategy-error', {
          strategy: strategy.name,
          error: err.message
        });
        try { await clearElement(el); } catch (_) {}
      }
    }
    throw new Error('输入注入失败');
  }

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

  async function insertTextInChunks(el, text) {
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
    await insertTextInChunks(el, text);
    if (await verifyContentStrict(el, text, 250, 25)) {
      notifyGeminiFramework(el, text);
      return { strategy: 'gemini-insertText', fallbackUsed: Boolean(quill) };
    }

    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await insertTextInChunks(el, text);
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

  async function setQianwenInput(el, text, options) {
    const { logger } = options || {};
    el.focus();
    await sleep(20);

    const slateNode = el.closest('[data-slate-editor="true"]') || el;
    const fiberKey = Object.keys(slateNode).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (fiberKey) {
      try {
        let fiber = slateNode[fiberKey];
        for (let i = 0; i < 15 && fiber; i++) {
          const editor = fiber.memoizedProps?.editor || fiber.stateNode?.editor;
          if (editor && typeof editor.insertText === 'function' && typeof editor.deleteFragment === 'function') {
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

  const kimiInject = async (el, text, options) => {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
    const { logger } = options || {};

    const tryKimiPaste = async () => {
      el.focus();
      await sleep(20);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await sleep(16);
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      dt.setData('text/html', `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`);
      el.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      return verifyContent(el, text, 400, 30);
    };

    return runStrategies(el, [
      { name: 'kimi-paste', fallbackUsed: false, run: tryKimiPaste },
      { name: 'kimi-insertText', fallbackUsed: false, run: () => tryInsertText(el, text) },
      { name: 'kimi-clipboard', fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
      { name: 'kimi-datatransfer', fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
      { name: 'kimi-direct-dom', fallbackUsed: true, run: () => tryDirectDom(el, text) }
    ], logger);
  };

  const yuanbaoInject = async (el, text, options) => {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);
    return setYuanbaoInput(el, text, options);
  };

  return {
    setReactValue,
    setContentEditable,
    setGeminiInput,
    closeQianwenTaskAssistant,
    qianwenInject,
    kimiInject,
    yuanbaoInject
  };
}
