(() => {
  // src/content/heuristics.js
  function findInputHeuristically() {
    const candidates = [
      ...document.querySelectorAll('div[data-slate-editor="true"][contenteditable="true"]'),
      ...document.querySelectorAll('div[contenteditable="true"][role="textbox"]'),
      ...document.querySelectorAll('div[contenteditable="true"]'),
      ...document.querySelectorAll("textarea[placeholder]"),
      ...document.querySelectorAll("textarea")
    ];
    if (!candidates.length) return null;
    const unique = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of candidates) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      unique.push(candidate);
    }
    const isVisible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 120 && rect.height > 20 && rect.bottom > 0;
    };
    const hasSendButtonNearby = (node) => {
      const root = node.closest("form") || node.closest("section") || node.parentElement?.parentElement || document;
      if (!root?.querySelectorAll) return false;
      const buttons = root.querySelectorAll('button:not([disabled]), [role="button"]');
      for (const btn of buttons) {
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
        const hint = `${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""} ${(btn.textContent || "").trim()}`.toLowerCase();
        if (hint.includes("\u53D1\u9001") || hint.includes("send") || hint.includes("\u63D0\u4EA4") || hint.includes("submit")) return true;
      }
      return false;
    };
    const scoreInput = (node) => {
      if (!node || !isVisible(node)) return -1;
      if (node.getAttribute("contenteditable") !== "true" && node.tagName !== "TEXTAREA") return -1;
      if (node.getAttribute("aria-disabled") === "true") return -1;
      const rect = node.getBoundingClientRect();
      const role = (node.getAttribute("role") || "").toLowerCase();
      const hasSlate = node.getAttribute("data-slate-editor") === "true";
      let score = 0;
      if (hasSlate) score += 8;
      if (role === "textbox") score += 4;
      if (node.tagName === "TEXTAREA") score += 3;
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
  }
  function findSendBtnHeuristically(el) {
    const container = el?.closest("form") || el?.closest("section") || el?.parentElement?.parentElement || document;
    const roots = [container, document].filter(Boolean);
    for (const root of roots) {
      if (!root?.querySelectorAll) continue;
      const nodes = root.querySelectorAll('button:not([disabled]), [role="button"]');
      for (const node of nodes) {
        if (node.disabled || node.getAttribute("aria-disabled") === "true") continue;
        const klass = node.className?.toString() || "";
        if (klass.includes("is-disabled") || klass.includes("disabled")) continue;
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const hint = `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${node.getAttribute("data-testid") || ""} ${(node.textContent || "").trim()}`.toLowerCase();
        if (hint.includes("\u767B\u5F55") || hint.includes("log in") || hint.includes("\u4E0A\u4F20") || hint.includes("attach") || hint.includes("\u641C\u7D22") || hint.includes("search")) continue;
        if (hint.includes("\u53D1\u9001") || hint.includes("send") || hint.includes("\u63D0\u4EA4") || hint.includes("submit")) {
          return node;
        }
      }
    }
    return null;
  }

  // src/content/core/dom-cache.js
  var cache = /* @__PURE__ */ new Map();
  var lastUrl = location.href;
  function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (!entry.node || !entry.node.isConnected) {
      cache.delete(key);
      return null;
    }
    return entry.node;
  }
  function setCache(key, node) {
    if (!node) return;
    cache.set(key, { node, cachedAt: Date.now() });
  }
  function invalidate(key) {
    if (key) cache.delete(key);
    else cache.clear();
  }
  function checkNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      cache.clear();
      return true;
    }
    return false;
  }

  // src/content/selectors.js
  var defaultSelectors = {
    chatgpt: {
      findInput: [
        "#prompt-textarea",
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
        "rich-textarea .ql-editor",
        'div[contenteditable="true"][role="textbox"]',
        "p[data-placeholder]"
      ],
      findSendBtn: [
        'button[aria-label="Send message"]',
        'button[aria-label="Send"]',
        'button[aria-label*="\u53D1\u9001"]',
        'button[aria-label*="\u63D0\u4EA4"]',
        'button[aria-label="Submit"]',
        'button[aria-label*="Submit"]',
        "button.send-button",
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
        'div.ProseMirror[contenteditable="true"]',
        'div.tiptap[contenteditable="true"]',
        "textarea[placeholder]",
        "textarea",
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]'
      ],
      findSendBtn: [
        'button[type="submit"][aria-label="\u63D0\u4EA4"]',
        'button[type="submit"][aria-label="Submit"]',
        'button[type="submit"]:not([disabled])',
        'button[aria-label="Submit"]:not([disabled])',
        'button[aria-label="\u63D0\u4EA4"]:not([disabled])',
        'button[aria-label*="Submit"]:not([disabled])',
        'button[aria-label*="Send"]:not([disabled])',
        'button[data-testid*="send"]:not([disabled])',
        '[role="button"][aria-label*="Send"]:not([aria-disabled="true"])',
        '[role="button"][aria-label*="Submit"]:not([aria-disabled="true"])',
        '[data-testid*="send"]',
        '[data-testid*="submit"]'
      ]
    },
    deepseek: {
      findInput: [
        'div#chat-input[contenteditable="true"]',
        'div[id*="chat-input"][contenteditable="true"]',
        "textarea#chat-input",
        'textarea[id*="chat-input"]',
        'div[contenteditable="true"][data-placeholder]',
        'textarea[placeholder*="Ask"]',
        'div[contenteditable="true"][role="textbox"]',
        "textarea"
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
        "textarea[placeholder]",
        'div[contenteditable="true"]',
        "textarea"
      ],
      findSendBtn: [
        'button[type="submit"]',
        'button[aria-label*="\u53D1\u9001"]',
        'button[aria-label*="Send"]',
        'button[data-testid*="send"]'
      ]
    },
    qianwen: {
      findInput: [
        'div[data-slate-editor="true"][contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        "textarea.message-input-textarea",
        'div[contenteditable="true"]',
        "textarea[placeholder]",
        "textarea"
      ],
      findSendBtn: [
        '[data-icon-type="qwpcicon-sendChat"]',
        'div[class*="operatebtn"]:not([class*="disabled"])',
        "div.message-input-right-button-send button",
        "div.message-input-right-button-send",
        'button[aria-label*="\u53D1\u9001"]',
        'button[aria-label*="Send"]'
      ]
    },
    yuanbao: {
      findInput: [
        '.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        "textarea"
      ],
      findSendBtn: [
        "a#yuanbao-send-btn",
        'a[id*="send-btn"]',
        "span.icon-send",
        '[class*="send-btn"]:not([class*="disabled"])',
        'button[aria-label*="\u53D1\u9001"]',
        'button[aria-label*="Send"]'
      ]
    },
    kimi: {
      findInput: [
        'div.chat-input-editor[contenteditable="true"]',
        'div[class*="chat-input-editor"][contenteditable="true"]',
        "textarea[placeholder]",
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        "textarea"
      ],
      findSendBtn: [
        "div.send-button-container:not(.disabled)",
        'div[class*="send-button-container"]:not(.disabled)',
        'button[type="submit"]',
        'button[aria-label*="\u53D1\u9001"]',
        'button[aria-label*="Send"]'
      ]
    },
    mistral: {
      findInput: [
        "textarea[placeholder]",
        "textarea",
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
  var cachedSelectors = null;
  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes || !changes.aib_dynamic_selectors) return;
      cachedSelectors = null;
      invalidate();
    });
  }
  function normalizeSelectorConfig(config) {
    return {
      findInput: Array.isArray(config?.findInput) ? config.findInput : [],
      findSendBtn: Array.isArray(config?.findSendBtn) ? config.findSendBtn : [],
      mode: config?.mode || "override"
    };
  }
  function mergeSelectors(localConfig, remoteConfig, mode) {
    const local = normalizeSelectorConfig(localConfig);
    const remote = normalizeSelectorConfig(remoteConfig);
    if (mode === "disabled") {
      return { findInput: [], findSendBtn: [], mode: "disabled" };
    }
    if (mode === "merge") {
      return {
        findInput: [...remote.findInput, ...local.findInput],
        findSendBtn: [...remote.findSendBtn, ...local.findSendBtn],
        mode: "merge"
      };
    }
    return {
      findInput: remote.findInput,
      findSendBtn: remote.findSendBtn,
      mode: "override"
    };
  }
  async function getDynamicSelectors() {
    if (cachedSelectors) return cachedSelectors;
    try {
      const store = await chrome.storage.local.get("aib_dynamic_selectors");
      const payload = store?.aib_dynamic_selectors?.data;
      if (!payload || typeof payload !== "object") {
        cachedSelectors = defaultSelectors;
        return cachedSelectors;
      }
      const isV2 = Number(payload.version || 0) >= 2;
      const merged = {};
      const platformIds = /* @__PURE__ */ new Set([
        ...Object.keys(defaultSelectors),
        ...Object.keys(payload).filter((key) => key !== "version")
      ]);
      for (const platformId of platformIds) {
        const localConfig = defaultSelectors[platformId];
        const remoteConfig = payload[platformId];
        if (!remoteConfig) {
          merged[platformId] = normalizeSelectorConfig(localConfig);
          continue;
        }
        const mode = isV2 ? String(remoteConfig.mode || "override") : "merge";
        merged[platformId] = mergeSelectors(localConfig, remoteConfig, mode);
      }
      cachedSelectors = merged;
    } catch (err) {
      cachedSelectors = defaultSelectors;
    }
    return cachedSelectors;
  }
  async function findInputForPlatform(platformId) {
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
      } catch (_) {
      }
    }
    return null;
  }
  async function findSendBtnForPlatform(platformId) {
    checkNavigation();
    const cacheKey = `${platformId}:send`;
    const cached = getCached(cacheKey);
    if (cached && !cached.disabled && cached.getAttribute("aria-disabled") !== "true") {
      return cached;
    }
    const selectors = await getDynamicSelectors();
    const list = selectors?.[platformId]?.findSendBtn || [];
    for (const selector of list) {
      try {
        const found = document.querySelector(selector);
        if (found && !found.disabled && found.getAttribute("aria-disabled") !== "true") {
          setCache(cacheKey, found);
          return found;
        }
      } catch (_) {
      }
    }
    return null;
  }

  // src/content/adapters/chatgpt.js
  function createChatgptAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform: findSendBtnForPlatform2,
      findSendBtnHeuristically: findSendBtnHeuristically2,
      pressEnterOn: pressEnterOn2,
      sleep,
      normalizeText,
      getContent
    } = deps;
    return {
      name: "ChatGPT",
      findInput: async () => {
        return await findInputForPlatform2("chatgpt") || waitFor(() => findInputHeuristically2());
      },
      async inject(el, text, options) {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
          setReactValue(el, text);
          return { strategy: "chatgpt-react-value", fallbackUsed: false };
        }
        const isLexical = el.hasAttribute("data-lexical-editor") || el.closest("[data-lexical-editor]");
        if (isLexical) {
          el.focus();
          await sleep(30);
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
          await sleep(16);
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          el.dispatchEvent(new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          await sleep(200);
          const actual = normalizeText(getContent(el));
          const expected = normalizeText(text);
          if (actual && (actual.includes(expected.slice(0, 24)) || expected.includes(actual.slice(0, 24)))) {
            return { strategy: "chatgpt-lexical-paste", fallbackUsed: false };
          }
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
          await sleep(16);
          document.execCommand("insertText", false, text);
          await sleep(200);
          const actual2 = normalizeText(getContent(el));
          if (actual2 && (actual2.includes(expected.slice(0, 24)) || expected.includes(actual2.slice(0, 24)))) {
            return { strategy: "chatgpt-lexical-insertText", fallbackUsed: true };
          }
          return setContentEditable(el, text, options);
        }
        return setContentEditable(el, text, options);
      },
      async send(el) {
        const btn = await findSendBtnForPlatform2("chatgpt") || await waitFor(() => findSendBtnHeuristically2(el), 4e3, 40);
        if (btn) {
          btn.click();
          return;
        }
        const target = el || document.activeElement;
        if (target) {
          target.focus();
          pressEnterOn2(target);
        } else {
          pressEnterOn2(null);
        }
      }
    };
  }

  // src/content/adapters/claude.js
  function createClaudeAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      setContentEditable,
      findSendBtnForPlatform: findSendBtnForPlatform2,
      findSendBtnHeuristically: findSendBtnHeuristically2,
      pressEnterOn: pressEnterOn2
    } = deps;
    return {
      name: "Claude",
      findInput: async () => {
        return await findInputForPlatform2("claude") || waitFor(() => findInputHeuristically2());
      },
      inject: (el, text, options) => setContentEditable(el, text, options),
      async send(el) {
        const btn = await findSendBtnForPlatform2("claude") || await waitFor(() => findSendBtnHeuristically2(el) || (() => {
          const candidates = [
            ...[...document.querySelectorAll("fieldset button, form button")]
          ].filter(Boolean);
          for (const candidate of candidates) {
            if (candidate.disabled) continue;
            const label = (candidate.getAttribute("aria-label") || "").toLowerCase();
            if (label.includes("attach") || label.includes("file") || label.includes("upload")) continue;
            if (candidate.querySelector("svg")) return candidate;
          }
          return null;
        })(), 4e3, 40);
        if (btn) {
          btn.click();
          return;
        }
        const input = el || document.activeElement;
        if (input) {
          input.focus();
          pressEnterOn2(input);
        }
      }
    };
  }

  // src/content/adapters/deepseek.js
  function createDeepseekAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform: findSendBtnForPlatform2,
      findSendBtnHeuristically: findSendBtnHeuristically2,
      pressEnterOn: pressEnterOn2
    } = deps;
    return {
      name: "DeepSeek",
      findInput: async () => await findInputForPlatform2("deepseek") || waitFor(() => findInputHeuristically2()),
      inject: async (el, text, options) => {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue(el, text);
        return setContentEditable(el, text, options);
      },
      async send(el) {
        const selectorBtn = await findSendBtnForPlatform2("deepseek");
        const btn = selectorBtn || await waitFor(() => findSendBtnHeuristically2(el), 3e3, 40);
        if (btn) {
          btn.click();
          return;
        }
        if (el) {
          el.focus();
          pressEnterOn2(el);
        }
      }
    };
  }

  // src/content/adapters/mistral.js
  function createMistralAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform: findSendBtnForPlatform2,
      findSendBtnHeuristically: findSendBtnHeuristically2,
      pressEnterOn: pressEnterOn2
    } = deps;
    return {
      name: "Mistral",
      findInput: async () => await findInputForPlatform2("mistral") || waitFor(() => findInputHeuristically2()),
      inject: async (el, text, options) => {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue(el, text);
        return setContentEditable(el, text, options);
      },
      async send(el) {
        const btn = await findSendBtnForPlatform2("mistral") || await waitFor(() => findSendBtnHeuristically2(el), 4e3, 40);
        if (btn) {
          btn.click();
          return;
        }
        if (el) {
          el.focus();
          pressEnterOn2(el);
        }
      }
    };
  }

  // src/content/adapters/gemini.js
  function createGeminiAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      setGeminiInput,
      sleep,
      normalizeText,
      getContent,
      pressEnterOn: pressEnterOn2,
      findSendBtnForPlatform: findSendBtnForPlatform2
    } = deps;
    return {
      name: "Gemini",
      findInput: async () => await findInputForPlatform2("gemini") || waitFor(() => findInputHeuristically2()),
      inject: (el, text, options) => setGeminiInput(el, text, options),
      async send(el, options) {
        const logger = options?.logger;
        await sleep(80);
        const before = normalizeText(getContent(el));
        const keySend = async () => {
          const target = el || document.activeElement;
          if (!target) return false;
          target.focus();
          pressEnterOn2(target);
          await sleep(220);
          let after = normalizeText(getContent(target));
          if (!before || after !== before) return true;
          target.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
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
          target.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
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
        const directBtn = await findSendBtnForPlatform2("gemini");
        const btn = directBtn || await waitFor(() => {
          const container = el?.closest("rich-textarea")?.parentElement?.parentElement || el?.closest(".input-area-container") || el?.closest('[role="complementary"]')?.parentElement;
          if (container) {
            for (const b of container.querySelectorAll("button:not([disabled])")) {
              const hint = `${b.getAttribute("aria-label") || ""} ${b.getAttribute("mattooltip") || ""} ${b.getAttribute("title") || ""}`.toLowerCase();
              if (hint.includes("send") || hint.includes("submit") || hint.includes("\u53D1\u9001") || hint.includes("\u63D0\u4EA4")) return b;
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
          logger?.debug("gemini-send-click-no-change");
        } else {
          logger?.debug("gemini-send-button-not-found", { hasInput: Boolean(el) });
        }
        const keySendOk = await keySend();
        if (keySendOk) return true;
        logger?.debug("gemini-send-failed-after-key-fallback");
        return false;
      }
    };
  }

  // src/content/adapters/grok.js
  function createGrokAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform: findSendBtnForPlatform2,
      normalizeText,
      getContent,
      sleep,
      isNodeDisabled
    } = deps;
    return {
      name: "Grok",
      findInput: async () => {
        const isVisibleInput = (el) => {
          if (!el || el.disabled || el.readOnly) return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 60 && rect.height > 1 && rect.bottom > 0;
        };
        const collectRoots = () => {
          const roots = [document];
          const queue = [document.documentElement];
          const seen = /* @__PURE__ */ new Set();
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
          const seen = /* @__PURE__ */ new Set();
          for (const c of candidates) {
            if (!c || seen.has(c)) continue;
            seen.add(c);
            unique.push(c);
          }
          const scoreInput = (el) => {
            if (!isVisibleInput(el)) return -1;
            const rect = el.getBoundingClientRect();
            const cls = String(el.className || "").toLowerCase();
            const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
            const root = el.closest("form") || el.parentElement || document;
            let score = 0;
            if (el.matches?.('div.ProseMirror[contenteditable="true"]') || cls.includes("prosemirror") || cls.includes("tiptap")) score += 8;
            if (placeholder.includes("ask") || placeholder.includes("mind") || placeholder.includes("message")) score += 4;
            if (el.closest("form")) score += 3;
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
        const bySelectors = await findInputForPlatform2("grok");
        if (isVisibleInput(bySelectors)) return bySelectors;
        if (bySelectors && bySelectors.tagName === "TEXTAREA") return bySelectors;
        const found = await waitFor(() => pickBestInput(), 7e3, 60);
        if (found) return found;
        const fallbackTextarea = document.querySelector("textarea");
        if (fallbackTextarea) return fallbackTextarea;
        return null;
      },
      async inject(el, text, options) {
        const expected = normalizeText(text);
        const verifyAfterFlush = async (waitMs = 300) => {
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
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
          await sleep(16);
        };
        const tryPasteEvent = async () => {
          await clearEditor();
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          dt.setData("text/html", `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`);
          el.dispatchEvent(new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          return verifyAfterFlush(300);
        };
        const tryRealClipboardPaste = async () => {
          await clearEditor();
          try {
            await navigator.clipboard.writeText(text);
          } catch (_) {
            return false;
          }
          document.execCommand("paste");
          return verifyAfterFlush(300);
        };
        const tryInputEventPaste = async () => {
          await clearEditor();
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          try {
            el.dispatchEvent(new InputEvent("beforeinput", {
              inputType: "insertFromPaste",
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
        const tryExecInsert = async () => {
          await clearEditor();
          document.execCommand("insertText", false, text);
          return verifyAfterFlush(400);
        };
        if (el.tagName === "TEXTAREA") {
          el.focus();
          await sleep(20);
          el.select();
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true, bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: "a", code: "KeyA", ctrlKey: true, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", code: "Delete", bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: "Delete", code: "Delete", bubbles: true }));
          await sleep(16);
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
          if (nativeSetter) nativeSetter.call(el, text);
          else el.value = text;
          const tracker = el._valueTracker;
          if (tracker) tracker.setValue("");
          el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep(60);
          if (await verifyAfterFlush(200)) return { strategy: "grok-react-value", fallbackUsed: false };
          setReactValue(el, text);
          await sleep(80);
          if (await verifyAfterFlush(200)) return { strategy: "grok-react-value-retry", fallbackUsed: true };
          throw new Error("Grok textarea \u6CE8\u5165\u5931\u8D25");
        }
        try {
          if (await tryPasteEvent()) return { strategy: "grok-paste-event", fallbackUsed: false };
        } catch (_) {
        }
        try {
          if (await tryRealClipboardPaste()) return { strategy: "grok-clipboard-paste", fallbackUsed: true };
        } catch (_) {
        }
        try {
          if (await tryInputEventPaste()) return { strategy: "grok-input-paste", fallbackUsed: true };
        } catch (_) {
        }
        try {
          if (await tryExecInsert()) return { strategy: "grok-exec-insert", fallbackUsed: true };
        } catch (_) {
        }
        const meta = await setContentEditable(el, text, options);
        await sleep(300);
        if (await verifyAfterFlush(200)) return meta;
        throw new Error("Grok \u8F93\u5165\u6CE8\u5165\u5931\u8D25\uFF1A\u6240\u6709\u7B56\u7565\u5747\u672A\u751F\u6548");
      },
      async send(el, options) {
        const logger = options?.logger;
        const sendTrace = {
          matchedBy: "none",
          clicked: false,
          formSubmitted: false,
          keyAttempts: []
        };
        const isVisible = (node) => {
          if (!node) return false;
          const style = window.getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom > 0;
        };
        const triggerClick = (node) => {
          if (!node) return;
          for (const evt of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
            try {
              node.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, composed: true }));
            } catch (_) {
            }
          }
          try {
            node.click?.();
          } catch (_) {
          }
        };
        const roots = () => {
          const list = [
            el?.closest("form"),
            el?.closest(".ProseMirror")?.parentElement,
            el?.closest(".ProseMirror")?.parentElement?.parentElement,
            el?.closest('[class*="composer"]'),
            el?.closest('[class*="editor"]'),
            el?.parentElement,
            el?.closest("main"),
            document
          ].filter(Boolean);
          const uniq = [];
          const seen = /* @__PURE__ */ new Set();
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
            const buttons = root.querySelectorAll ? root.querySelectorAll('button, [role="button"], div[role="button"], span[role="button"], [data-testid*="send"], [data-testid*="submit"], [class*="send"][class*="button"], [class*="submit"][class*="button"]') : [];
            let fallbackCandidate = null;
            let proximityCandidate = null;
            let proximityScore = -Infinity;
            for (const button of buttons) {
              if (!isVisible(button) || isNodeDisabled(button)) continue;
              const hint = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""} ${button.getAttribute("data-testid") || ""} ${button.className || ""} ${(button.textContent || "").trim()}`.toLowerCase();
              if (hint.includes("upload") || hint.includes("attach") || hint.includes("mic") || hint.includes("voice") || hint.includes("search") || hint.includes("plus")) continue;
              if (hint.includes("submit") || hint.includes("send") || hint.includes("\u53D1\u9001") || hint.includes("\u63D0\u4EA4")) {
                sendTrace.matchedBy = "hint:sendish";
                return button;
              }
              if (!fallbackCandidate && (hint.includes("composer") || hint.includes("arrow") || hint.includes("paper-plane"))) {
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
              if (button.querySelector?.("svg")) score += 8;
              if ((button.textContent || "").trim().length === 0) score += 6;
              if ((button.getAttribute("aria-label") || "").trim()) score += 4;
              if (score > proximityScore) {
                proximityScore = score;
                proximityCandidate = button;
              }
            }
            if (fallbackCandidate) {
              sendTrace.matchedBy = "hint:fallback-candidate";
              return fallbackCandidate;
            }
            if (proximityCandidate) {
              sendTrace.matchedBy = "proximity";
              return proximityCandidate;
            }
          }
          return null;
        };
        const GROK_SEND_SVG_PATH = "M6 11L12 5";
        const findGrokSubmitBtn = () => {
          const allSubmits = document.querySelectorAll('button[type="submit"]');
          for (const b of allSubmits) {
            const ariaLabel = (b.getAttribute("aria-label") || "").toLowerCase();
            if (ariaLabel === "submit" || ariaLabel === "\u63D0\u4EA4") return b;
            const svgPath = b.querySelector("svg path")?.getAttribute("d") || "";
            if (svgPath.startsWith(GROK_SEND_SVG_PATH)) return b;
          }
          return null;
        };
        const forceEnableBtn = (b) => {
          if (!b) return;
          b.disabled = false;
          b.removeAttribute("disabled");
          let parent = b.parentElement;
          for (let i = 0; i < 3 && parent; i++) {
            if (parent.classList?.contains("hidden")) {
              parent.classList.remove("hidden");
              parent.style.display = "";
            }
            parent = parent.parentElement;
          }
        };
        const selectorBtn = await findSendBtnForPlatform2("grok");
        let btn = selectorBtn || await waitFor(tryFindBtn, 2e3, 40);
        if (!btn) {
          const grokBtn = findGrokSubmitBtn();
          if (grokBtn) {
            forceEnableBtn(grokBtn);
            await sleep(50);
            btn = grokBtn;
            sendTrace.matchedBy = "grok-force-enable";
          }
        }
        const target = el || document.activeElement;
        const expected = normalizeText(options?.text || "");
        const before = normalizeText(getContent(target)) || expected;
        const confirmSendCheck = () => {
          const after = normalizeText(getContent(target));
          if (before && after !== before) return true;
          return false;
        };
        const waitForConfirm = async (maxMs = 2e3) => {
          const interval = 100;
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
          if (target.tagName === "TEXTAREA") {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            const currentVal = target.value;
            if (nativeSetter) nativeSetter.call(target, currentVal);
            const tracker = target._valueTracker;
            if (tracker) tracker.setValue("");
            target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: currentVal }));
            target.dispatchEvent(new Event("change", { bubbles: true }));
            await sleep(60);
          }
          const attempts = [
            { ctrlKey: false, metaKey: false, tag: "enter" },
            { ctrlKey: true, metaKey: false, tag: "ctrl-enter" },
            { ctrlKey: false, metaKey: true, tag: "meta-enter" }
          ];
          for (const attempt of attempts) {
            const kOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true, ctrlKey: attempt.ctrlKey, metaKey: attempt.metaKey };
            target.dispatchEvent(new KeyboardEvent("keydown", kOpts));
            target.dispatchEvent(new KeyboardEvent("keypress", kOpts));
            target.dispatchEvent(new KeyboardEvent("keyup", kOpts));
            await sleep(220);
            sendTrace.keyAttempts.push(attempt.tag);
            if (confirmSendCheck()) return true;
            logger?.debug("grok-send-key-no-change", { mode: attempt.tag });
          }
          return false;
        };
        const tryFormSubmit = async () => {
          const form = target?.closest?.("form");
          if (!form) return false;
          try {
            if (typeof form.requestSubmit === "function") form.requestSubmit();
            else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          } catch (_) {
          }
          sendTrace.formSubmitted = true;
          await sleep(220);
          return confirmSendCheck();
        };
        if (btn) {
          triggerClick(btn);
          sendTrace.clicked = true;
          await sleep(220);
          if (confirmSendCheck()) return true;
          logger?.debug("grok-send-click-no-confirm");
          if (await tryFormSubmit()) return true;
          if (await tryKeySend()) return true;
          throw new Error(`Grok\u53D1\u9001\u672A\u6267\u884C matched=${sendTrace.matchedBy} clicked=${sendTrace.clicked} form=${sendTrace.formSubmitted} keys=${sendTrace.keyAttempts.join(",") || "none"}`);
        }
        if (await tryKeySend()) return true;
        pressEnterOn(target);
        await sleep(180);
        if (confirmSendCheck()) return true;
        throw new Error(`Grok\u53D1\u9001\u672A\u6267\u884C matched=${sendTrace.matchedBy} clicked=${sendTrace.clicked} form=${sendTrace.formSubmitted} keys=${sendTrace.keyAttempts.join(",") || "none"}`);
      }
    };
  }

  // src/content/adapters/doubao.js
  function createDoubaoAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform: findSendBtnForPlatform2,
      findSendBtnHeuristically: findSendBtnHeuristically2,
      pressEnterOn: pressEnterOn2,
      isDoubaoVerificationPage
    } = deps;
    return {
      name: "Doubao",
      findInput: async () => {
        if (isDoubaoVerificationPage()) {
          const err = new Error("\u8C46\u5305\u5F53\u524D\u5904\u4E8E\u4EBA\u673A\u9A8C\u8BC1\u9875\u9762\uFF0C\u8BF7\u5148\u5B8C\u6210\u9A8C\u8BC1\u540E\u518D\u91CD\u8BD5");
          err.stage = "findInput";
          throw err;
        }
        return await findInputForPlatform2("doubao") || waitFor(() => findInputHeuristically2());
      },
      async inject(el, text, options) {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue(el, text);
        return setContentEditable(el, text, options);
      },
      async send(el) {
        if (isDoubaoVerificationPage()) {
          const err = new Error("\u8C46\u5305\u5F53\u524D\u5904\u4E8E\u4EBA\u673A\u9A8C\u8BC1\u9875\u9762\uFF0C\u8BF7\u5148\u5B8C\u6210\u9A8C\u8BC1\u540E\u518D\u91CD\u8BD5");
          err.stage = "send";
          throw err;
        }
        const btn = await findSendBtnForPlatform2("doubao") || await waitFor(() => findSendBtnHeuristically2(el), 3e3, 30);
        if (btn) {
          btn.click();
          return;
        }
        if (el) {
          el.focus();
          pressEnterOn2(el);
        }
      }
    };
  }

  // src/content/adapters/qianwen.js
  function createQianwenAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      qianwenInject,
      qianwenSend
    } = deps;
    return {
      name: "Qianwen",
      findInput: async () => await findInputForPlatform2("qianwen") || waitFor(() => findInputHeuristically2()),
      inject: qianwenInject,
      send: qianwenSend
    };
  }

  // src/content/adapters/yuanbao.js
  function createYuanbaoAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      yuanbaoInject,
      yuanbaoSend
    } = deps;
    return {
      name: "Yuanbao",
      findInput: async () => await findInputForPlatform2("yuanbao") || waitFor(() => findInputHeuristically2()),
      inject: yuanbaoInject,
      send: yuanbaoSend
    };
  }

  // src/content/adapters/kimi.js
  function createKimiAdapter(deps) {
    const {
      findInputForPlatform: findInputForPlatform2,
      findInputHeuristically: findInputHeuristically2,
      waitFor,
      kimiInject,
      kimiSend
    } = deps;
    return {
      name: "Kimi",
      findInput: async () => await findInputForPlatform2("kimi") || waitFor(() => findInputHeuristically2()),
      inject: kimiInject,
      send: kimiSend
    };
  }

  // src/content/core/observer.js
  function waitForElementByMutation(matchFn, options = {}) {
    const timeout = Number.isFinite(options.timeout) ? options.timeout : 6e3;
    const root = options.root || document.body || document.documentElement;
    return new Promise((resolve) => {
      try {
        const immediate = matchFn();
        if (immediate) {
          resolve(immediate);
          return;
        }
      } catch (_) {
      }
      let done = false;
      let observer = null;
      let timer = null;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        if (observer) observer.disconnect();
        resolve(value || null);
      };
      timer = setTimeout(() => finish(null), timeout);
      try {
        observer = new MutationObserver(() => {
          try {
            const next = matchFn();
            if (next) finish(next);
          } catch (_) {
          }
        });
        observer.observe(root, { childList: true, subtree: true });
      } catch (_) {
        finish(null);
      }
    });
  }

  // src/content/core/injection.js
  function createInjectionTools(deps) {
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
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      const tracker = el._valueTracker;
      if (tracker) tracker.setValue("");
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { strategy: "react-value", fallbackUsed: false };
    }
    async function tryInsertText(el, text) {
      el.focus();
      await sleep(16);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await sleep(8);
      document.execCommand("insertText", false, text);
      const verified = await verifyContent(el, text);
      if (verified) {
        el.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text
        }));
      }
      return verified;
    }
    async function tryClipboardPaste(el, text) {
      await navigator.clipboard.writeText(text);
      el.focus();
      await sleep(12);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      document.execCommand("paste");
      return verifyContent(el, text);
    }
    async function tryDataTransferPaste(el, text) {
      el.focus();
      await sleep(12);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      el.dispatchEvent(new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      }));
      return verifyContent(el, text);
    }
    async function tryDirectDom(el, text) {
      el.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = text;
      el.appendChild(p);
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return verifyContent(el, text);
    }
    async function trySlateBeforeInput(el, text) {
      el.focus();
      await sleep(20);
      const sel = window.getSelection();
      if (sel && el.childNodes.length > 0) {
        try {
          sel.selectAllChildren(el);
          el.dispatchEvent(new InputEvent("beforeinput", {
            inputType: "deleteContentBackward",
            bubbles: true,
            cancelable: true
          }));
          await sleep(10);
        } catch (_) {
        }
      }
      const chunkSize = text.length > 30 ? 3 : 1;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        el.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertText",
          data: chunk,
          bubbles: true,
          cancelable: true
        }));
        await sleep(chunkSize > 1 ? 2 : 1);
      }
      el.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
      return verifyContent(el, text);
    }
    async function clearElement(el) {
      el.focus();
      await sleep(8);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await sleep(8);
    }
    async function runStrategies(el, strategyList, logger, opts = {}) {
      const skipClear = Boolean(opts.skipClear);
      for (const strategy of strategyList) {
        try {
          if (await strategy.run()) {
            logger.debug("inject-strategy-success", { strategy: strategy.name });
            return { strategy: strategy.name, fallbackUsed: Boolean(strategy.fallbackUsed) };
          }
          logger.debug("inject-strategy-miss", { strategy: strategy.name });
          if (!skipClear) await clearElement(el);
        } catch (err) {
          logger.debug("inject-strategy-error", {
            strategy: strategy.name,
            error: err.message
          });
          if (!skipClear) {
            try {
              await clearElement(el);
            } catch (_) {
            }
          }
        }
      }
      throw new Error("\u8F93\u5165\u6CE8\u5165\u5931\u8D25");
    }
    async function setContentEditable(el, text, options) {
      const { fastPathEnabled, logger, safeMode } = options;
      if (safeMode) {
        return runStrategies(el, [
          { name: "insertText-safe", fallbackUsed: false, run: () => tryInsertText(el, text) },
          { name: "insertText-safe-retry", fallbackUsed: true, run: () => tryInsertText(el, text) }
        ], logger);
      }
      if (fastPathEnabled) {
        return runStrategies(el, [
          { name: "insertText-fast", fallbackUsed: false, run: () => tryInsertText(el, text) },
          { name: "clipboard-paste", fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
          { name: "datatransfer-paste", fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
          { name: "direct-dom", fallbackUsed: true, run: () => tryDirectDom(el, text) }
        ], logger);
      }
      return runStrategies(el, [
        { name: "clipboard-legacy", fallbackUsed: false, run: () => tryClipboardPaste(el, text) },
        { name: "insertText-legacy", fallbackUsed: true, run: () => tryInsertText(el, text) },
        { name: "datatransfer-legacy", fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: "direct-dom-legacy", fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger);
    }
    const GEMINI_CHUNK_SIZE = 1200;
    function notifyGeminiFramework(el, text) {
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      const richTextarea = el.closest("rich-textarea");
      if (richTextarea) {
        richTextarea.dispatchEvent(new Event("input", { bubbles: true }));
        richTextarea.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    async function insertTextInChunks(el, text) {
      const len = text.length;
      if (len <= 0) return;
      if (len <= GEMINI_CHUNK_SIZE) {
        document.execCommand("insertText", false, text);
        return;
      }
      for (let i = 0; i < len; i += GEMINI_CHUNK_SIZE) {
        const chunk = text.slice(i, i + GEMINI_CHUNK_SIZE);
        document.execCommand("insertText", false, chunk);
        await sleep(12);
      }
    }
    async function setGeminiInput(el, text, options) {
      const { logger } = options;
      el.focus();
      await sleep(40);
      const richTextarea = el.closest("rich-textarea") || el.parentElement;
      const quill = richTextarea?.__quill || el.__quill;
      if (quill) {
        quill.setText("");
        if (text.length <= GEMINI_CHUNK_SIZE) {
          quill.insertText(0, text, "user");
        } else {
          for (let i = 0; i < text.length; i += GEMINI_CHUNK_SIZE) {
            const chunk = text.slice(i, i + GEMINI_CHUNK_SIZE);
            quill.insertText(i, chunk, "user");
            await sleep(10);
          }
        }
        quill.setSelection(text.length, 0);
        notifyGeminiFramework(el, text);
        await sleep(30);
        if (await verifyContentStrict(el, text, 300, 30)) {
          return { strategy: "gemini-quill", fallbackUsed: false };
        }
        quill.setText("");
        await sleep(16);
      }
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await insertTextInChunks(el, text);
      if (await verifyContentStrict(el, text, 250, 25)) {
        notifyGeminiFramework(el, text);
        return { strategy: "gemini-insertText", fallbackUsed: Boolean(quill) };
      }
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await insertTextInChunks(el, text);
      if (await verifyContentStrict(el, text, 250, 25)) {
        notifyGeminiFramework(el, text);
        return { strategy: "gemini-insertText-retry", fallbackUsed: true };
      }
      el.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = text;
      el.appendChild(p);
      notifyGeminiFramework(el, text);
      if (await verifyContentStrict(el, text, 200, 25)) {
        return { strategy: "gemini-direct-dom", fallbackUsed: true };
      }
      logger.debug("gemini-inject-failed-after-fallbacks");
      throw new Error("Gemini \u8F93\u5165\u6CE8\u5165\u5931\u8D25");
    }
    async function setYuanbaoInput(el, text, options) {
      el.focus();
      await sleep(28);
      const quill = el.__quill || el.closest(".ql-container")?.__quill || el.closest(".ql-editor")?.__quill;
      if (quill) {
        quill.setText("");
        quill.insertText(0, text, "user");
        quill.setSelection(text.length, 0);
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        if (await verifyContent(el, text, 260, 25)) {
          return { strategy: "yuanbao-quill", fallbackUsed: false };
        }
      }
      return setContentEditable(el, text, options);
    }
    async function closeQianwenTaskAssistant() {
      const allTags = document.querySelectorAll('[class*="tagBtn"][class*="selected"], [class*="tag"][aria-selected="true"]');
      let tag = null;
      for (const node of allTags) {
        if (node.textContent && node.textContent.includes("\u4EFB\u52A1\u52A9\u7406")) {
          tag = node;
          break;
        }
      }
      if (!tag) return;
      const closeIcon = tag.querySelector('[data-icon-type*="close"]') || tag.querySelector("svg");
      const target = closeIcon || tag;
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await sleep(120);
    }
    async function setQianwenInput(el, text, options) {
      const { logger } = options || {};
      el.focus();
      await sleep(20);
      const slateNode = el.closest('[data-slate-editor="true"]') || el;
      const fiberKey = Object.keys(slateNode).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
      if (fiberKey) {
        try {
          let fiber = slateNode[fiberKey];
          for (let i = 0; i < 15 && fiber; i++) {
            const editor = fiber.memoizedProps?.editor || fiber.stateNode?.editor;
            if (editor && typeof editor.insertText === "function" && typeof editor.deleteFragment === "function") {
              try {
                editor.deleteFragment();
              } catch (_) {
              }
              editor.insertText(text);
              el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
              const ok = await verifyContent(el, text);
              if (ok) return { strategy: "qianwen-slate-api", fallbackUsed: false };
              break;
            }
            fiber = fiber.return;
          }
        } catch (_) {
        }
      }
      return runStrategies(el, [
        { name: "qw-insertText", fallbackUsed: false, run: () => tryInsertText(el, text) },
        { name: "qw-beforeinput", fallbackUsed: true, run: () => trySlateBeforeInput(el, text) },
        { name: "qw-datatransfer", fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: "qw-clipboard", fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
        { name: "qw-direct-dom", fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger, { skipClear: true });
    }
    const qianwenInject = async (el, text, options) => {
      await closeQianwenTaskAssistant();
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue(el, text);
      return setQianwenInput(el, text, options);
    };
    const kimiInject = async (el, text, options) => {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue(el, text);
      const { logger } = options || {};
      const tryKimiPaste = async () => {
        el.focus();
        await sleep(20);
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        await sleep(16);
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        dt.setData("text/html", `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`);
        el.dispatchEvent(new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
        return verifyContent(el, text, 400, 30);
      };
      return runStrategies(el, [
        { name: "kimi-paste", fallbackUsed: false, run: tryKimiPaste },
        { name: "kimi-insertText", fallbackUsed: false, run: () => tryInsertText(el, text) },
        { name: "kimi-clipboard", fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
        { name: "kimi-datatransfer", fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: "kimi-direct-dom", fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger);
    };
    const yuanbaoInject = async (el, text, options) => {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue(el, text);
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

  // src/content/core/lifecycle.js
  var cleanupFns = [];
  function onCleanup(fn) {
    if (typeof fn === "function") cleanupFns.push(fn);
  }
  function runCleanup() {
    while (cleanupFns.length) {
      try {
        cleanupFns.pop()();
      } catch (e) {
      }
    }
  }
  window.addEventListener("pagehide", runCleanup, { once: true });
  window.addEventListener("beforeunload", runCleanup, { once: true });

  // src/content/index.js
  if (!window.__aiBroadcastLoaded) {
    let isNodeDisabled = function(node) {
      if (!node) return true;
      if (node.disabled === true) return true;
      const ariaDisabled = String(node.getAttribute?.("aria-disabled") || "").toLowerCase();
      if (ariaDisabled === "true") return true;
      const className = node.className?.toString().toLowerCase() || "";
      if (className.includes("disabled") || className.includes("is-disabled")) return true;
      return false;
    }, formatLogData = function(data) {
      if (data === void 0 || data === null) return "";
      if (typeof data !== "object") return String(data);
      try {
        const parts = [];
        for (const [k, v] of Object.entries(data)) {
          if (v === void 0) continue;
          parts.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
        }
        return parts.join(" | ");
      } catch (_) {
        return String(data);
      }
    }, createLogger = function(requestId, debug) {
      const prefix = `[AIB][content][${requestId}]`;
      return {
        info(event, data = void 0) {
          if (!debug) return;
          if (data === void 0) console.log(`${prefix} ${event}`);
          else console.log(`${prefix} ${event} | ${formatLogData(data)}`);
        },
        error(event, data = void 0) {
          if (data === void 0) console.error(`${prefix} ${event}`);
          else console.error(`${prefix} ${event} | ${formatLogData(data)}`);
        },
        debug(event, data = void 0) {
          if (!debug) return;
          if (data === void 0) console.log(`${prefix} ${event}`);
          else console.log(`${prefix} ${event} | ${formatLogData(data)}`);
        }
      };
    }, normalizeText = function(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }, includesAny = function(text, keywords) {
      return keywords.some((keyword) => text.includes(keyword));
    }, isDoubaoVerificationPage = function() {
      if (!(normalizedHostname === "doubao.com" || normalizedHostname.endsWith(".doubao.com"))) return false;
      const urlHint = `${window.location.pathname || ""} ${window.location.search || ""}`.toLowerCase();
      if (includesAny(urlHint, ["captcha", "verify", "verification", "security", "risk", "waf", "bot"])) {
        return true;
      }
      const title = normalizeText(document.title || "").toLowerCase();
      if (includesAny(title, ["\u4EBA\u673A\u9A8C\u8BC1", "\u5B89\u5168\u9A8C\u8BC1", "\u9A8C\u8BC1\u7801", "captcha", "verify", "security check"])) {
        return true;
      }
      const bodyText = normalizeText((document.body?.innerText || "").slice(0, 6e3)).toLowerCase();
      return includesAny(bodyText, [
        "\u4EBA\u673A\u9A8C\u8BC1",
        "\u5B89\u5168\u9A8C\u8BC1",
        "\u9A8C\u8BC1\u7801",
        "\u6ED1\u5757\u9A8C\u8BC1",
        "\u8BF7\u5148\u5B8C\u6210\u9A8C\u8BC1",
        "\u884C\u4E3A\u9A8C\u8BC1",
        "security check",
        "verify you are human",
        "captcha"
      ]);
    }, getHighRiskPageReason = function() {
      const title = normalizeText(document.title || "").toLowerCase();
      const urlHint = `${window.location.pathname || ""} ${window.location.search || ""}`.toLowerCase();
      const bodyText = normalizeText((document.body?.innerText || "").slice(0, 7e3)).toLowerCase();
      const text = `${title} ${urlHint} ${bodyText}`;
      if (includesAny(text, [
        "captcha",
        "verify you are human",
        "security check",
        "waf",
        "risk control",
        "\u4EBA\u673A\u9A8C\u8BC1",
        "\u5B89\u5168\u9A8C\u8BC1",
        "\u9A8C\u8BC1\u7801",
        "\u6ED1\u5757\u9A8C\u8BC1",
        "\u8BF7\u5148\u5B8C\u6210\u9A8C\u8BC1"
      ])) {
        return "\u68C0\u6D4B\u5230\u98CE\u63A7/\u9A8C\u8BC1\u9875\u9762";
      }
      return "";
    }, getContent = function(el) {
      if (!el) return "";
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        return (el.value || "").trim();
      }
      return (el.innerText || el.textContent || "").trim();
    }, pressEnterOn2 = function(el) {
      const target = el || document.activeElement;
      if (!target) return;
      const opts = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true
      };
      target.dispatchEvent(new KeyboardEvent("keydown", opts));
      target.dispatchEvent(new KeyboardEvent("keypress", opts));
      target.dispatchEvent(new KeyboardEvent("keyup", opts));
    }, base64ToBlob = function(base64, mimeType) {
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      return new Blob([byteArray], { type: mimeType });
    }, resolvePlatformId = function() {
      const sharedPlatform = AIB_SHARED?.getPlatformByHostname ? AIB_SHARED.getPlatformByHostname(hostname) : null;
      if (sharedPlatform?.id) return sharedPlatform.id;
      for (const [domain, platformId] of Object.entries(platformIdByDomainFallback)) {
        if (normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`)) {
          return platformId;
        }
      }
      return null;
    }, getPlatform = function() {
      const platformId = resolvePlatformId();
      if (!platformId) return null;
      return platformAdapters[platformId] || null;
    }, ensureUploadHighlightStyle = function() {
      if (document.getElementById(UPLOAD_HIGHLIGHT_STYLE_ID)) return;
      const style = document.createElement("style");
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
    }, clearUploadHighlight = function() {
      if (uploadHighlightTimer) {
        clearTimeout(uploadHighlightTimer);
        uploadHighlightTimer = null;
      }
      const prev = document.querySelectorAll(`[${UPLOAD_HIGHLIGHT_ATTR}="1"]`);
      for (const node of prev) {
        node.removeAttribute(UPLOAD_HIGHLIGHT_ATTR);
      }
    }, markUploadHighlight = function(target) {
      if (!target || !target.setAttribute) return;
      ensureUploadHighlightStyle();
      clearUploadHighlight();
      target.setAttribute(UPLOAD_HIGHLIGHT_ATTR, "1");
      try {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch (err) {
        target.scrollIntoView({ block: "center", inline: "center" });
      }
      uploadHighlightTimer = setTimeout(() => {
        if (!target.isConnected) return;
        target.removeAttribute(UPLOAD_HIGHLIGHT_ATTR);
      }, 8e3);
    }, isElementVisible = function(el) {
      if (!el || !(el instanceof Element)) return false;
      if (!document.documentElement.contains(el)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
      if (style.pointerEvents === "none") return false;
      const opacity = Number(style.opacity);
      if (Number.isFinite(opacity) && opacity <= 0.01) return false;
      const rect = el.getBoundingClientRect();
      return rect.width >= 4 && rect.height >= 4;
    }, getElementHint = function(el) {
      if (!el || !(el instanceof Element)) return "";
      const parts = [
        el.getAttribute("aria-label"),
        el.getAttribute("title"),
        el.getAttribute("data-testid"),
        el.getAttribute("data-test-id"),
        el.getAttribute("name"),
        el.getAttribute("placeholder"),
        el.getAttribute("id"),
        el.getAttribute("class"),
        el.textContent
      ];
      if (el.tagName === "INPUT") {
        parts.push(el.getAttribute("accept"));
      }
      return normalizeText(parts.filter(Boolean).join(" ")).toLowerCase();
    }, scoreUploadHint = function(hintText) {
      if (!hintText) return 0;
      let score = 0;
      for (const keyword of UPLOAD_HINT_KEYWORDS) {
        if (hintText.includes(keyword)) score += 8;
      }
      for (const keyword of UPLOAD_NEGATIVE_HINT_KEYWORDS) {
        if (hintText.includes(keyword)) score -= 8;
      }
      return score;
    }, escapeCssIdentifier = function(value) {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
      }
      return String(value).replace(/["\\]/g, "\\$&");
    }, getAssociatedLabel = function(input) {
      if (!input || input.tagName !== "INPUT" || String(input.type).toLowerCase() !== "file") return null;
      if (input.id) {
        const escaped = escapeCssIdentifier(input.id);
        const byFor = document.querySelector(`label[for="${escaped}"]`);
        if (byFor) return byFor;
      }
      return input.closest("label");
    }, findNearInputTrigger = function(input) {
      if (!input || !(input instanceof Element)) return null;
      const direct = input.closest('button,[role="button"],label');
      if (direct && direct !== input) return direct;
      const root = input.closest("form") || input.closest("section") || input.closest("article") || input.parentElement || document;
      const candidates = root.querySelectorAll ? root.querySelectorAll('button,[role="button"],label,a[role="button"],div[role="button"],span[role="button"]') : [];
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
    }, pushUploadCandidate = function(store, element, baseScore, via, linkedInput = null) {
      if (!element || !(element instanceof Element)) return;
      const hint = getElementHint(element);
      const hintScore = scoreUploadHint(hint);
      const isFileInput = element.tagName === "INPUT" && String(element.getAttribute("type") || "").toLowerCase() === "file";
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
    }, resolveVisibleUploadCandidate = function(candidate) {
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
    }, findUploadEntryTarget = function() {
      const store = /* @__PURE__ */ new Map();
      const fileInputs = document.querySelectorAll('input[type="file"]');
      for (const input of fileInputs) {
        const accept = String(input.getAttribute("accept") || "").toLowerCase();
        const base = accept.includes("image") ? 34 : 28;
        pushUploadCandidate(store, input, base, "file-input", input);
        const label = getAssociatedLabel(input);
        if (label) pushUploadCandidate(store, label, 30, "file-input-label", input);
        const near = findNearInputTrigger(input);
        if (near) pushUploadCandidate(store, near, 24, "file-input-nearby", input);
      }
      const clickables = document.querySelectorAll('button,[role="button"],label,a[role="button"],div[role="button"],span[role="button"]');
      for (const node of clickables) {
        const hintScore = scoreUploadHint(getElementHint(node));
        if (hintScore < 10) continue;
        pushUploadCandidate(store, node, 10, "keyword-button", null);
      }
      const ranked = [...store.values()].sort((a, b) => b.score - a.score);
      for (const candidate of ranked) {
        const resolved = resolveVisibleUploadCandidate(candidate);
        if (resolved) return resolved;
      }
      return null;
    };
    window.__aiBroadcastLoaded = true;
    const hostname = window.location.hostname;
    const normalizedHostname = String(hostname || "").toLowerCase().replace(/^www\./, "");
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
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const now = () => Date.now();
    const AIB_SHARED = globalThis.__AIB_SHARED__ || null;
    const MESSAGE_TYPES = AIB_SHARED?.MESSAGE_TYPES || {
      PING: "PING",
      SEND_NOW: "SEND_NOW",
      INJECT_MESSAGE: "INJECT_MESSAGE",
      INJECT_IMAGE: "INJECT_IMAGE",
      HIGHLIGHT_UPLOAD_ENTRY: "HIGHLIGHT_UPLOAD_ENTRY"
    };
    async function waitFor(fn, timeout = 6e3, interval = 50) {
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
      const deadline = now() + Math.min(400, timeout);
      while (now() < deadline) {
        try {
          const result = fn();
          if (result) return result;
        } catch (err) {
        }
        await sleep(interval);
      }
      return null;
    }
    async function waitForCheck(check, timeout = 280, interval = 25) {
      const deadline = now() + timeout;
      while (now() < deadline) {
        try {
          if (check()) return true;
        } catch (err) {
        }
        await sleep(interval);
      }
      return false;
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
    async function pasteImageToInput(el, base64, mimeType, logger) {
      const blob = base64ToBlob(base64, mimeType);
      const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const file = new File([blob], `image.${ext}`, { type: mimeType, lastModified: Date.now() });
      el.focus();
      await sleep(50);
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        const pasteEvt = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
        el.dispatchEvent(pasteEvt);
        logger?.debug?.("image-paste-strategy", { strategy: "clipboardEvent" });
        await sleep(300);
        return { success: true, strategy: "clipboardEvent" };
      } catch (e) {
        logger?.debug?.("image-paste-clipboardEvent-failed", { error: e?.message });
      }
      try {
        const dt2 = new DataTransfer();
        dt2.items.add(file);
        const dropEvt = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt2 });
        el.dispatchEvent(dropEvt);
        logger?.debug?.("image-paste-strategy", { strategy: "drop" });
        await sleep(300);
        return { success: true, strategy: "drop" };
      } catch (e) {
        logger?.debug?.("image-paste-drop-failed", { error: e?.message });
      }
      try {
        const container = el.closest("form") || el.closest("section") || el.parentElement?.parentElement || document;
        const fileInput = container.querySelector('input[type="file"]') || document.querySelector('input[type="file"]');
        if (fileInput) {
          const dt3 = new DataTransfer();
          dt3.items.add(file);
          fileInput.files = dt3.files;
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          logger?.debug?.("image-paste-strategy", { strategy: "fileInput" });
          await sleep(300);
          return { success: true, strategy: "fileInput" };
        }
      } catch (e) {
        logger?.debug?.("image-paste-fileInput-failed", { error: e?.message });
      }
      return { success: false, strategy: "none" };
    }
    const qianwenSend = async (el) => {
      const selectorBtn = await findSendBtnForPlatform("qianwen");
      if (selectorBtn) {
        selectorBtn.click();
        return;
      }
      const container = el?.closest("form") || el?.closest("section") || el?.parentElement?.parentElement || document;
      const isBtnDisabled = (node) => {
        if (!node) return true;
        if (node.disabled) return true;
        if (node.getAttribute("aria-disabled") === "true") return true;
        const klass = node.className?.toString() || "";
        return klass.includes("is-disabled") || klass.includes("disabled");
      };
      const findSendBtn = (root) => {
        if (!root?.querySelectorAll) return null;
        const nodes = root.querySelectorAll('button, [role="button"]');
        for (const node of nodes) {
          if (isBtnDisabled(node)) continue;
          const hint = `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${(node.textContent || "").trim()}`.toLowerCase();
          if (hint.includes("\u767B\u5F55") || hint.includes("log in") || hint.includes("\u4E0A\u4F20") || hint.includes("attach") || hint.includes("\u641C\u7D22") || hint.includes("search")) continue;
          if (hint.includes("\u53D1\u9001") || hint.includes("send") || hint.includes("\u63D0\u4EA4") || hint.includes("submit")) return node;
        }
        return null;
      };
      let btn = await waitFor(() => {
        const byContainer = findSendBtn(container);
        if (byContainer) return byContainer;
        return findSendBtn(document);
      }, 3e3, 40);
      if (!btn) {
        await closeQianwenTaskAssistant();
        await sleep(120);
        btn = await waitFor(() => findSendBtn(document), 2e3, 40);
      }
      if (btn) btn.click();
      else {
        el?.focus();
        pressEnterOn2(el);
      }
    };
    const kimiSend = async (el) => {
      const selectorBtn = await findSendBtnForPlatform("kimi");
      if (selectorBtn) {
        selectorBtn.click();
        return;
      }
      const container = el?.closest("form") || el?.closest('div[class*="input"]') || el?.closest('div[class*="chat"]') || document;
      const findSendBtn = () => {
        const buttons = container.querySelectorAll ? container.querySelectorAll('button:not([disabled]), [role="button"]') : [];
        for (const b of buttons) {
          const hint = `${b.getAttribute("aria-label") || ""} ${b.getAttribute("title") || ""} ${(b.textContent || "").trim()}`.toLowerCase();
          if (hint.includes("\u53D1\u9001") || hint.includes("send") || hint.includes("submit") || hint.includes("\u63D0\u4EA4")) return b;
        }
        return null;
      };
      const btn = await waitFor(findSendBtn, 3500, 40);
      if (btn) btn.click();
      else {
        el?.focus();
        pressEnterOn2(el);
      }
    };
    const yuanbaoSend = async (el, options) => {
      const logger = options?.logger;
      const before = normalizeText(getContent(el));
      const selectorBtn = await findSendBtnForPlatform("yuanbao");
      if (selectorBtn) {
        selectorBtn.click();
        await sleep(240);
        const selectorAfter = normalizeText(getContent(el));
        if (!before || selectorAfter !== before) return true;
      }
      const container = el?.closest("form") || el?.closest(".agent-dialogue") || el?.closest(".dialogue") || el?.parentElement || document;
      const roots = [container, document].filter(Boolean);
      const pickButton = () => {
        for (const root of roots) {
          if (!root?.querySelectorAll) continue;
          const nodes = root.querySelectorAll('button, [role="button"]');
          for (const node of nodes) {
            if (node.disabled || node.getAttribute("aria-disabled") === "true") continue;
            const hint = `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${(node.textContent || "").trim()} ${node.className || ""}`.toLowerCase();
            if (hint.includes("log in") || hint.includes("\u767B\u5F55") || hint.includes("tool") || hint.includes("\u4E0A\u4F20")) continue;
            if (hint.includes("send") || hint.includes("\u53D1\u9001") || hint.includes("\u63D0\u4EA4") || hint.includes("submit")) {
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
      pressEnterOn2(el);
      await sleep(220);
      const finalAfter = normalizeText(getContent(el));
      const sent = !before || finalAfter !== before;
      if (!sent) logger?.debug?.("yuanbao-send-no-change");
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
      pressEnterOn: pressEnterOn2,
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
      pressEnterOn: pressEnterOn2
    });
    const deepseekAdapter = createDeepseekAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn: pressEnterOn2
    });
    const geminiAdapter = createGeminiAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setGeminiInput,
      sleep,
      normalizeText,
      getContent,
      pressEnterOn: pressEnterOn2,
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
      pressEnterOn: pressEnterOn2,
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
      pressEnterOn: pressEnterOn2
    });
    const doubaoAdapter = createDoubaoAdapter({
      findInputForPlatform,
      findInputHeuristically,
      waitFor,
      setReactValue,
      setContentEditable,
      findSendBtnForPlatform,
      findSendBtnHeuristically,
      pressEnterOn: pressEnterOn2,
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
      "chatgpt.com": "chatgpt",
      "chat.openai.com": "chatgpt",
      "claude.ai": "claude",
      "gemini.google.com": "gemini",
      "grok.com": "grok",
      "deepseek.com": "deepseek",
      "chat.mistral.ai": "mistral",
      "doubao.com": "doubao",
      "tongyi.aliyun.com": "qianwen",
      "qianwen.com": "qianwen",
      "yuanbao.tencent.com": "yuanbao",
      "moonshot.cn": "kimi",
      "kimi.ai": "kimi",
      "kimi.com": "kimi"
    };
    const UPLOAD_HIGHLIGHT_STYLE_ID = "aib-upload-highlight-style";
    const UPLOAD_HIGHLIGHT_ATTR = "data-aib-upload-highlight";
    const UPLOAD_HINT_KEYWORDS = [
      "upload",
      "attach",
      "attachment",
      "file",
      "image",
      "photo",
      "picture",
      "media",
      "\u4E0A\u4F20",
      "\u9644\u4EF6",
      "\u6587\u4EF6",
      "\u56FE\u7247",
      "\u7167\u7247",
      "\u56FE\u50CF",
      "\u7D20\u6750"
    ];
    const UPLOAD_NEGATIVE_HINT_KEYWORDS = [
      "send",
      "submit",
      "search",
      "login",
      "log in",
      "sign in",
      "voice",
      "record",
      "\u53D1\u9001",
      "\u63D0\u4EA4",
      "\u641C\u7D22",
      "\u767B\u5F55",
      "\u8BED\u97F3",
      "\u5F55\u97F3"
    ];
    let uploadHighlightTimer = null;
    const runtimeMessageListener = (message, sender, sendResponse) => {
      if (message.type === MESSAGE_TYPES.PING) {
        const platform = getPlatform();
        sendResponse({ success: true, platform: platform ? platform.name : "Unknown" });
        return true;
      }
      if (message.type === MESSAGE_TYPES.INJECT_IMAGE) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const logger = createLogger(requestId, debug);
        const platform = getPlatform();
        if (!platform) {
          sendResponse({ success: false, error: "\u4E0D\u652F\u6301\u7684\u5E73\u53F0", platform: "Unknown" });
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
              sendResponse({ success: false, error: `\u627E\u4E0D\u5230 ${platform.name} \u8F93\u5165\u6846`, platform: platform.name });
              return;
            }
            const result = await pasteImageToInput(input, message.imageBase64, message.mimeType || "image/png", logger);
            const totalMs = now() - startedAt;
            sendResponse({
              success: result.success,
              platform: platform.name,
              strategy: result.strategy,
              totalMs,
              error: result.success ? void 0 : "\u56FE\u7247\u7C98\u8D34\u5931\u8D25"
            });
          } catch (err) {
            logger.error("inject-image-failure", { error: err?.message });
            sendResponse({ success: false, error: err?.message || "\u56FE\u7247\u6CE8\u5165\u5931\u8D25", platform: platform.name });
          }
        })();
        return true;
      }
      if (message.type === MESSAGE_TYPES.HIGHLIGHT_UPLOAD_ENTRY) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const logger = createLogger(requestId, debug);
        const platformName = getPlatform()?.name || "Unknown";
        (async () => {
          const startedAt = now();
          try {
            const target = await waitFor(() => findUploadEntryTarget(), 2200, 90);
            if (!target?.element) {
              sendResponse({
                success: true,
                found: false,
                platform: platformName,
                via: "none",
                totalMs: now() - startedAt
              });
              return;
            }
            markUploadHighlight(target.element);
            logger.debug("upload-entry-highlighted", { platform: platformName, via: target.via, score: target.score });
            sendResponse({
              success: true,
              found: true,
              platform: platformName,
              via: target.via || "unknown",
              totalMs: now() - startedAt
            });
          } catch (err) {
            logger.error("upload-entry-highlight-failure", { error: err?.message });
            sendResponse({
              success: false,
              found: false,
              platform: platformName,
              via: "error",
              totalMs: now() - startedAt,
              error: err?.message || "\u5B9A\u4F4D\u4E0A\u4F20\u5165\u53E3\u5931\u8D25"
            });
          }
        })();
        return true;
      }
      if (message.type === MESSAGE_TYPES.SEND_NOW) {
        const requestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const debug = Boolean(message.debug);
        const safeMode = Boolean(message.safeMode);
        const expectedText = normalizeText(message.text || "");
        const logger = createLogger(requestId, debug);
        const platformId = resolvePlatformId();
        const platform = getPlatform();
        if (!platform) {
          sendResponse({
            success: false,
            sendMs: 0,
            error: "\u4E0D\u652F\u6301\u7684\u5E73\u53F0",
            debugLog: "send_now | platform=Unknown | error=\u4E0D\u652F\u6301\u7684\u5E73\u53F0"
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
                error: "\u627E\u4E0D\u5230\u8F93\u5165\u6846",
                debugLog: `send_now | platform=${platform.name} | stage=findInput | error=\u627E\u4E0D\u5230\u8F93\u5165\u6846`
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
                const bodyText = normalizeText((document.body?.innerText || "").slice(0, 6e3));
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
                  error: "\u53D1\u9001\u524D\u8F93\u5165\u6846\u5185\u5BB9\u4E0D\u5339\u914D",
                  debugLog: `send_now | platform=${platform.name} | stage=precheck | error=\u53D1\u9001\u524D\u8F93\u5165\u6846\u5185\u5BB9\u4E0D\u5339\u914D | textLen=${expectedText.length} | inputLen=${current.length}`
                });
                return;
              }
            }
            const sent = await platform.send(input, { logger, debug, safeMode });
            if (sent === false) {
              sendResponse({
                success: false,
                sendMs: now() - t0,
                error: "\u53D1\u9001\u52A8\u4F5C\u672A\u6267\u884C",
                debugLog: `send_now | platform=${platform.name} | platformId=${platformId || "unknown"} | stage=send | error=\u53D1\u9001\u52A8\u4F5C\u672A\u6267\u884C`
              });
              return;
            }
            sendResponse({
              success: true,
              sendMs: now() - t0,
              debugLog: `send_now | platform=${platform.name} | platformId=${platformId || "unknown"} | stage=send | ok=true`
            });
          } catch (e) {
            logger.error("send-now-failure", { error: e?.message });
            sendResponse({
              success: false,
              sendMs: now() - t0,
              error: e?.message || "\u53D1\u9001\u5931\u8D25",
              debugLog: `send_now | platform=${platform.name} | stage=exception | error=${e?.message || "\u53D1\u9001\u5931\u8D25"}`
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
        const text = message.text || "";
        const autoSend = Boolean(message.autoSend);
        const logger = createLogger(requestId, debug);
        const platformId = resolvePlatformId();
        const platform = platformId ? platformAdapters[platformId] : null;
        if (!platform) {
          sendResponse({
            success: false,
            platform: "Unknown",
            error: "\u4E0D\u652F\u6301\u7684\u5E73\u53F0",
            stage: "findInput",
            strategy: "n/a",
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
          const payloadPreview = normalizedPayload.slice(0, 40).replace(/\|/g, "\xA6");
          let inputLenAfterInject = 0;
          let stage = "findInput";
          let strategy = "n/a";
          let fallbackUsed = false;
          let sent = false;
          const startedAt = now();
          logger.info("inject-start", {
            platform: platform.name,
            autoSend,
            fastPathEnabled,
            safeMode
          });
          try {
            const riskReason = getHighRiskPageReason();
            if (riskReason) {
              const err = new Error(riskReason);
              err.stage = "findInput";
              throw err;
            }
            const findStartedAt = now();
            const input = await platform.findInput();
            timings.findInputMs = now() - findStartedAt;
            if (!input) {
              const err = new Error(`\u627E\u4E0D\u5230 ${platform.name} \u8F93\u5165\u6846`);
              err.stage = "findInput";
              throw err;
            }
            stage = "inject";
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
              const injectErr = new Error("\u8F93\u5165\u6846\u5185\u5BB9\u4E3A\u7A7A");
              injectErr.stage = "inject";
              throw injectErr;
            }
            if (autoSend) {
              stage = "send";
              await waitForSendReady(platformId, input);
              const sendStartedAt = now();
              const sendResult = await platform.send(input, { logger, debug, text, safeMode });
              if (sendResult === false) {
                const sendErr = new Error("\u53D1\u9001\u52A8\u4F5C\u672A\u6267\u884C");
                sendErr.stage = "send";
                throw sendErr;
              }
              sent = true;
              timings.sendMs = now() - sendStartedAt;
            }
            timings.totalMs = now() - startedAt;
            logger.info("inject-end", {
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
              debugLog: `inject | platform=${platform.name} | platformId=${platformId || "unknown"} | stage=${autoSend ? "send" : "inject"} | sent=${sent} | strategy=${strategy} | fallback=${fallbackUsed} | textLen=${payloadLen} | inputLen=${inputLenAfterInject} | textHead=${payloadPreview} | ms=${timings.totalMs}`
            });
          } catch (err) {
            timings.totalMs = now() - startedAt;
            const failedStage = err.stage || stage || "inject";
            logger.error("inject-failure", {
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
              debugLog: `inject | platform=${platform.name} | platformId=${platformId || "unknown"} | stage=${failedStage} | error=${err.message} | strategy=${strategy} | fallback=${fallbackUsed} | textLen=${payloadLen} | inputLen=${inputLenAfterInject} | textHead=${payloadPreview} | ms=${timings.totalMs}`
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
      invalidate();
    });
    onCleanup(() => {
      try {
        window.__aiBroadcastLoaded = false;
      } catch (_) {
      }
    });
  }
})();
