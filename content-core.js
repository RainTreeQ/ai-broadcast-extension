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
        "textarea",
        'div.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]'
      ],
      findSendBtn: [
        'button[type="submit"]:not([disabled])',
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        'button[aria-label="Submit"]',
        'button[aria-label="\u63D0\u4EA4"]',
        '[role="button"][aria-label*="Send"]',
        '[role="button"][aria-label*="send"]',
        'button[type="submit"]'
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
        "textarea.message-input-textarea",
        "textarea[placeholder]",
        "textarea",
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
        "div.message-input-right-button-send button",
        "div.message-input-right-button-send",
        'button[aria-label*="\u53D1\u9001"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]:not([disabled])'
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
        // Kimi 2026: 发送按钮是 div.send-button-container，内部没有 button
        "div.send-button-container:not(.disabled)",
        ".send-button-container",
        'div[class*="send-button-container"]:not(.disabled)',
        // 向下兼容：旧版可能有内部 button
        "div.send-button-container:not(.disabled) button",
        'div[class*="send-button-container"]:not(.disabled) button',
        // Fallback
        'button[class*="send"]:not([disabled])',
        'button[type="submit"]:not([disabled])',
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
    if (cached && cached.isConnected && !cached.disabled && cached.getAttribute("aria-disabled") !== "true") {
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
      sleep: sleep2,
      waitForCheck: waitForCheck2,
      normalizeText: normalizeText2,
      getContent: getContent2
    } = deps;
    async function verifyContent(el, text, timeout = 120, interval = 20) {
      const expected = normalizeText2(text);
      const check = () => {
        const actual = normalizeText2(getContent2(el));
        if (!expected) return actual.length === 0;
        if (!actual) return false;
        if (actual === expected) return true;
        if (expected.length <= 8) return false;
        if (actual.length < expected.length * 0.9) return false;
        if (actual.length > expected.length * 1.35) return false;
        return actual.includes(expected.slice(0, Math.min(expected.length, 24)));
      };
      return waitForCheck2(check, timeout, interval);
    }
    async function verifyContentStrict(el, text, timeout = 120, interval = 20) {
      const expected = normalizeText2(text);
      const check = () => {
        const actual = normalizeText2(getContent2(el));
        if (!expected) return actual.length === 0;
        if (!actual) return false;
        if (actual === expected) return true;
        if (expected.length <= 8) return false;
        if (actual.length < expected.length * 0.95) return false;
        if (actual.length > expected.length * 1.2) return false;
        return actual.includes(expected) || expected.includes(actual);
      };
      return waitForCheck2(check, timeout, interval);
    }
    function setReactValue2(el, value) {
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
      await sleep2(8);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      document.execCommand("insertText", false, text);
      const verified = await verifyContent(el, text);
      if (verified) {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
      return verified;
    }
    async function tryClipboardPaste(el, text) {
      await navigator.clipboard.writeText(text);
      el.focus();
      await sleep2(8);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      document.execCommand("paste");
      return verifyContent(el, text);
    }
    async function tryDataTransferPaste(el, text) {
      el.focus();
      await sleep2(8);
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
      await sleep2(10);
      const sel = window.getSelection();
      if (sel && el.childNodes.length > 0) {
        try {
          sel.selectAllChildren(el);
          el.dispatchEvent(new InputEvent("beforeinput", {
            inputType: "deleteContentBackward",
            bubbles: true,
            cancelable: true
          }));
          await sleep2(8);
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
        if (i % 30 === 0) await sleep2(1);
      }
      el.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
      return verifyContent(el, text);
    }
    async function clearElement(el) {
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
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
          logger.debug("inject-strategy-error", { strategy: strategy.name, error: err.message });
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
    async function setContentEditable2(el, text, options) {
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
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
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
        document.execCommand("insertText", false, text.slice(i, i + GEMINI_CHUNK_SIZE));
        await sleep2(8);
      }
    }
    async function setGeminiInput2(el, text, options) {
      const { logger } = options;
      el.focus();
      await sleep2(20);
      const richTextarea = el.closest("rich-textarea") || el.parentElement;
      const quill = richTextarea?.__quill || el.__quill;
      if (quill) {
        quill.setText("");
        if (text.length <= GEMINI_CHUNK_SIZE) {
          quill.insertText(0, text, "user");
        } else {
          for (let i = 0; i < text.length; i += GEMINI_CHUNK_SIZE) {
            quill.insertText(i, text.slice(i, i + GEMINI_CHUNK_SIZE), "user");
            await sleep2(8);
          }
        }
        quill.setSelection(text.length, 0);
        notifyGeminiFramework(el, text);
        await sleep2(20);
        if (await verifyContentStrict(el, text, 200, 20)) {
          return { strategy: "gemini-quill", fallbackUsed: false };
        }
        quill.setText("");
      }
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await insertTextInChunks(el, text);
      if (await verifyContentStrict(el, text, 150, 20)) {
        notifyGeminiFramework(el, text);
        return { strategy: "gemini-insertText", fallbackUsed: Boolean(quill) };
      }
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await insertTextInChunks(el, text);
      if (await verifyContentStrict(el, text, 150, 20)) {
        notifyGeminiFramework(el, text);
        return { strategy: "gemini-insertText-retry", fallbackUsed: true };
      }
      el.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = text;
      el.appendChild(p);
      notifyGeminiFramework(el, text);
      if (await verifyContentStrict(el, text, 150, 20)) {
        return { strategy: "gemini-direct-dom", fallbackUsed: true };
      }
      logger.debug("gemini-inject-failed-after-fallbacks");
      throw new Error("Gemini \u8F93\u5165\u6CE8\u5165\u5931\u8D25");
    }
    async function setYuanbaoInput(el, text, options) {
      el.focus();
      await sleep2(16);
      const quill = el.__quill || el.closest(".ql-container")?.__quill || el.closest(".ql-editor")?.__quill;
      if (quill) {
        quill.setText("");
        quill.insertText(0, text, "user");
        quill.setSelection(text.length, 0);
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        if (await verifyContent(el, text, 150, 20)) {
          return { strategy: "yuanbao-quill", fallbackUsed: false };
        }
      }
      return setContentEditable2(el, text, options);
    }
    async function closeQianwenTaskAssistant2() {
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
      await sleep2(80);
    }
    async function setQianwenInput(el, text, options) {
      const { logger } = options || {};
      el.focus();
      await sleep2(16);
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
              await sleep2(60);
              const actual = normalizeText2(getContent2(el));
              const expected = normalizeText2(text);
              if (actual && (actual === expected || actual.includes(expected.slice(0, Math.min(expected.length, 20))))) {
                return { strategy: "qianwen-slate-api", fallbackUsed: false };
              }
              return { strategy: "qianwen-slate-api-best-effort", fallbackUsed: false };
            }
            fiber = fiber.return;
          }
        } catch (_) {
        }
      }
      const tryQianwenInsertTextStrict = async () => {
        el.focus();
        await sleep2(8);
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        document.execCommand("insertText", false, text);
        return verifyContentStrict(el, text, 220, 20);
      };
      const result = await runStrategies(el, [
        { name: "qw-insertText-strict", fallbackUsed: false, run: tryQianwenInsertTextStrict },
        { name: "qw-insertText", fallbackUsed: true, run: () => tryInsertText(el, text) },
        { name: "qw-datatransfer", fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: "qw-clipboard", fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
        { name: "qw-direct-dom", fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger, { skipClear: true });
      const strictOk = await verifyContentStrict(el, text, 220, 20);
      if (strictOk) return result;
      return result;
    }
    const qianwenInject2 = async (el, text, options) => {
      await closeQianwenTaskAssistant2();
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue2(el, text);
      return setQianwenInput(el, text, options);
    };
    const kimiInject2 = async (el, text, options) => {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue2(el, text);
      const { logger } = options || {};
      const tryKimiPaste = async () => {
        el.focus();
        await sleep2(16);
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        dt.setData("text/html", `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`);
        el.dispatchEvent(new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
          composed: true
        }));
        return verifyContent(el, text, 250, 20);
      };
      return runStrategies(el, [
        { name: "kimi-paste", fallbackUsed: false, run: tryKimiPaste },
        { name: "kimi-insertText", fallbackUsed: false, run: () => tryInsertText(el, text) },
        { name: "kimi-clipboard", fallbackUsed: true, run: () => tryClipboardPaste(el, text) },
        { name: "kimi-datatransfer", fallbackUsed: true, run: () => tryDataTransferPaste(el, text) },
        { name: "kimi-direct-dom", fallbackUsed: true, run: () => tryDirectDom(el, text) }
      ], logger);
    };
    const yuanbaoInject2 = async (el, text, options) => {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return setReactValue2(el, text);
      return setYuanbaoInput(el, text, options);
    };
    return {
      setReactValue: setReactValue2,
      setContentEditable: setContentEditable2,
      setGeminiInput: setGeminiInput2,
      closeQianwenTaskAssistant: closeQianwenTaskAssistant2,
      qianwenInject: qianwenInject2,
      kimiInject: kimiInject2,
      yuanbaoInject: yuanbaoInject2
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

  // src/content/core-entry.js
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var now = () => Date.now();
  var AIB_SHARED = globalThis.__AIB_SHARED__ || null;
  var MESSAGE_TYPES = AIB_SHARED?.MESSAGE_TYPES || {
    PING: "PING",
    SEND_NOW: "SEND_NOW",
    INJECT_MESSAGE: "INJECT_MESSAGE",
    INJECT_IMAGE: "INJECT_IMAGE",
    HIGHLIGHT_UPLOAD_ENTRY: "HIGHLIGHT_UPLOAD_ENTRY"
  };
  function formatLogData(data) {
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
  }
  function createLogger(requestId, debug) {
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
  }
  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function includesAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  }
  function getContent(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return (el.value || "").trim();
    }
    return (el.innerText || el.textContent || "").trim();
  }
  function isNodeDisabled(node) {
    if (!node) return true;
    if (node.disabled === true) return true;
    const ariaDisabled = String(node.getAttribute?.("aria-disabled") || "").toLowerCase();
    if (ariaDisabled === "true") return true;
    const className = node.className?.toString().toLowerCase() || "";
    if (className.includes("disabled") || className.includes("is-disabled")) return true;
    return false;
  }
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
  function pressEnterOn(el) {
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
  }
  var {
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
  function isDoubaoVerificationPage() {
    const hostname = window.location.hostname;
    const normalizedHostname = String(hostname || "").toLowerCase().replace(/^www\./, "");
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
  }
  function getHighRiskPageReason() {
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
  }
  function base64ToBlob(base64, mimeType) {
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    return new Blob([byteArray], { type: mimeType });
  }
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
  var UPLOAD_HIGHLIGHT_STYLE_ID = "aib-upload-highlight-style";
  var UPLOAD_HIGHLIGHT_ATTR = "data-aib-upload-highlight";
  var UPLOAD_HINT_KEYWORDS = [
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
  var UPLOAD_NEGATIVE_HINT_KEYWORDS = [
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
  var uploadHighlightTimer = null;
  function ensureUploadHighlightStyle() {
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
  }
  function isElementVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    if (!document.documentElement.contains(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (style.pointerEvents === "none") return false;
    const opacity = Number(style.opacity);
    if (Number.isFinite(opacity) && opacity <= 0.01) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 4 && rect.height >= 4;
  }
  function getElementHint(el) {
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
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }
  function getAssociatedLabel(input) {
    if (!input || input.tagName !== "INPUT" || String(input.type).toLowerCase() !== "file") return null;
    if (input.id) {
      const escaped = escapeCssIdentifier(input.id);
      const byFor = document.querySelector(`label[for="${escaped}"]`);
      if (byFor) return byFor;
    }
    return input.closest("label");
  }
  function findNearInputTrigger(input) {
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
  }
  function pushUploadCandidate(store, element, baseScore, via, linkedInput = null) {
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
  }
  var qianwenSend = async (el) => {
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
        const hint = `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${node.getAttribute("data-icon-type") || ""} ${(node.textContent || "").trim()}`.toLowerCase();
        if (hint.includes("\u767B\u5F55") || hint.includes("log in") || hint.includes("\u4E0A\u4F20") || hint.includes("attach") || hint.includes("\u641C\u7D22") || hint.includes("search")) continue;
        if (hint.includes("\u53D1\u9001") || hint.includes("send") || hint.includes("\u63D0\u4EA4") || hint.includes("submit") || hint.includes("sendchat")) return node;
      }
      if (el) {
        const rect = el.getBoundingClientRect();
        const allBtns = document.querySelectorAll('button:not([disabled]), [role="button"]');
        let best = null, bestScore = -Infinity;
        for (const b of allBtns) {
          if (isBtnDisabled(b)) continue;
          const br = b.getBoundingClientRect();
          const dx = br.left + br.width / 2 - (rect.left + rect.width);
          const dy = br.top + br.height / 2 - (rect.top + rect.height / 2);
          if (dx < -20 || dx > 300 || Math.abs(dy) > 120) continue;
          if (!b.querySelector("svg") && !(b.textContent || "").trim()) continue;
          const score = -Math.abs(dx) * 0.5 - Math.abs(dy) * 0.3;
          if (score > bestScore) {
            bestScore = score;
            best = b;
          }
        }
        if (best) return best;
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
      pressEnterOn(el);
    }
  };
  var kimiSend = async (el, options) => {
    const logger = options?.logger;
    const before = normalizeText(getContent(el));
    const selectorBtn = await findSendBtnForPlatform("kimi");
    if (selectorBtn) {
      const innerBtn = selectorBtn.tagName !== "BUTTON" ? selectorBtn.querySelector("button") : null;
      (innerBtn || selectorBtn).click();
      await sleep(400);
      const after = normalizeText(getContent(el));
      if (!before || after !== before) return true;
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
    logger?.debug?.("kimi-send-no-change");
    return false;
  };
  var yuanbaoSend = async (el, options) => {
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
    pressEnterOn(el);
    await sleep(220);
    const finalAfter = normalizeText(getContent(el));
    const sent = !before || finalAfter !== before;
    if (!sent) logger?.debug?.("yuanbao-send-no-change");
    return sent;
  };
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
    invalidateDomCache: invalidate,
    // Message types
    MESSAGE_TYPES
  };
})();
