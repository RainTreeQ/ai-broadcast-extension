export function createGrokAdapter(deps) {
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
    name: 'Grok',
    findInput: async () => {
      const bySelectors = await findInputForPlatform('grok');
      if (bySelectors) return bySelectors;
      return waitFor(() => findInputHeuristically(), 7000, 60);
    },

    async inject(el, text, options) {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        setReactValue(el, text);
        return { strategy: 'grok-react-value', fallbackUsed: false };
      }
      return setContentEditable(el, text, options);
    },

    async send(el, options) {
      const expected = normalizeText(options?.text || '');

      const btn = await findSendBtnForPlatform('grok')
        || await waitFor(() => findSendBtnHeuristically(el), 3000, 40);

      if (btn) {
        if (el?.tagName === 'TEXTAREA' && expected) {
          setReactValue(el, expected);
          await sleep(60);
        }
        btn.click();
        return;
      }

      const target = el || document.activeElement;
      if (!target) { pressEnterOn(null); return; }

      if (target.tagName === 'TEXTAREA' && expected) {
        setReactValue(target, expected);
        await sleep(60);
      }

      target.focus();
      pressEnterOn(target);
    }
  };
}
