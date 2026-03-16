export function createChatgptAdapter(deps) {
  const {
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
  } = deps;

  return {
    name: 'ChatGPT',
    findInput: async () => {
      return await findInputForPlatform('chatgpt') || waitFor(() => findInputHeuristically());
    },
    async inject(el, text, options) {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return setReactValue(el, text);

      const isLexical = el.hasAttribute('data-lexical-editor') || el.closest('[data-lexical-editor]');
      if (isLexical) {
        el.focus();
        await sleep(30);
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(16);

        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
        await sleep(200);
        const actual = normalizeText(getContent(el));
        const expected = normalizeText(text);
        if (actual && (actual.includes(expected.slice(0, 24)) || expected.includes(actual.slice(0, 24)))) {
          return { strategy: 'chatgpt-lexical-paste', fallbackUsed: false };
        }

        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(16);
        document.execCommand('insertText', false, text);
        await sleep(200);
        const actual2 = normalizeText(getContent(el));
        if (actual2 && (actual2.includes(expected.slice(0, 24)) || expected.includes(actual2.slice(0, 24)))) {
          return { strategy: 'chatgpt-lexical-insertText', fallbackUsed: true };
        }
      }

      return setContentEditable(el, text, options);
    },
    async send(el) {
      const btn = await findSendBtnForPlatform('chatgpt') || await waitFor(() => findSendBtnHeuristically(el), 4000, 40);
      if (btn) {
        btn.click();
        return;
      }
      const target = el || document.activeElement;
      if (target) {
        target.focus();
        pressEnterOn(target);
      } else {
        pressEnterOn(null);
      }
    }
  };
}
