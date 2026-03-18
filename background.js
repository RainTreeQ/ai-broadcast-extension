const SELECTORS_BASE_URL = "https://raw.githubusercontent.com/RainTreeQ/sendol-selectors/main/selectors/";
const CACHE_KEY = "aib_dynamic_selectors";
const CACHE_TTL = 12 * 60 * 60 * 1000;
const SELECTOR_PLATFORMS = [
  'chatgpt', 'claude', 'gemini', 'grok', 'deepseek',
  'mistral', 'doubao', 'qianwen', 'yuanbao', 'kimi'
];
async function updateDynamicSelectors() {
  try {
    const existing = await chrome.storage.local.get(CACHE_KEY);
    const cached = existing?.[CACHE_KEY] || {};
    const data = cached.data && typeof cached.data === 'object' ? { ...cached.data } : {};
    const results = await Promise.allSettled(
      SELECTOR_PLATFORMS.map(async (platform) => {
        const res = await fetch(`${SELECTORS_BASE_URL}${platform}.json`);
        if (!res.ok) throw new Error(`fetch ${platform} failed: ${res.status}`);
        return { platform, selectors: await res.json() };
      })
    );
    let updated = false;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { platform, selectors } = result.value;
        data[platform] = selectors;
        updated = true;
      }
    }
    if (updated) {
      data._meta = { timestamp: Date.now(), version: 3 };
      await chrome.storage.local.set({ [CACHE_KEY]: { data, timestamp: Date.now() } });
    }
  } catch (err) {
    console.debug("[AIB] Failed to fetch dynamic selectors:", err);
  }
}

if (chrome.alarms?.create && chrome.alarms?.onAlarm?.addListener) {
  try {
    chrome.alarms.create("updateSelectors", { periodInMinutes: 12 * 60 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "updateSelectors") updateDynamicSelectors();
    });
  } catch (err) {
    console.debug("[AIB] Failed to init alarms:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  updateDynamicSelectors();
});

// Sendol - Background Service Worker v4

try {
  importScripts('shared/platform-registry.js');
} catch (err) {
  console.debug('[AIB][background] shared registry load failed', err);
}

const AIB_SHARED = globalThis.__AIB_SHARED__ || null;
const MESSAGE_TYPES = AIB_SHARED?.MESSAGE_TYPES || {
  GET_AI_TABS: 'GET_AI_TABS',
  BROADCAST_MESSAGE: 'BROADCAST_MESSAGE',
  BROADCAST_IMAGE: 'BROADCAST_IMAGE',
  LOCATE_UPLOAD_ENTRIES: 'LOCATE_UPLOAD_ENTRIES',
  BROADCAST_PROGRESS: 'BROADCAST_PROGRESS',
  PING: 'PING',
  INJECT_MESSAGE: 'INJECT_MESSAGE',
  INJECT_IMAGE: 'INJECT_IMAGE',
  SEND_NOW: 'SEND_NOW',
  HIGHLIGHT_UPLOAD_ENTRY: 'HIGHLIGHT_UPLOAD_ENTRY'
};

const FALLBACK_PLATFORM_DEFINITIONS = [
  { name: 'ChatGPT', domains: ['chatgpt.com', 'chat.openai.com'], newChatUrl: 'https://chatgpt.com/' },
  { name: 'Claude', domains: ['claude.ai'], newChatUrl: 'https://claude.ai/new' },
  { name: 'Gemini', domains: ['gemini.google.com'], newChatUrl: 'https://gemini.google.com/app' },
  { name: 'Grok', domains: ['grok.com'], newChatUrl: 'https://grok.com/' },
  { name: 'DeepSeek', domains: ['deepseek.com'], newChatUrl: 'https://chat.deepseek.com/' },
  { name: 'Mistral', domains: ['chat.mistral.ai'], newChatUrl: null },
  { name: 'Doubao', domains: ['doubao.com'], newChatUrl: 'https://www.doubao.com/chat' },
  { name: 'Qianwen', domains: ['tongyi.aliyun.com', 'qianwen.com'], newChatUrl: 'https://www.qianwen.com/' },
  { name: 'Yuanbao', domains: ['yuanbao.tencent.com'], newChatUrl: 'https://yuanbao.tencent.com/chat' },
  { name: 'Kimi', domains: ['moonshot.cn', 'kimi.ai', 'kimi.com'], newChatUrl: 'https://www.kimi.com/' }
];

function normalizeHostname(input) {
  return String(input || '').trim().toLowerCase().replace(/^www\./, '');
}

function getFallbackPlatformByHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  for (const platform of FALLBACK_PLATFORM_DEFINITIONS) {
    for (const domain of platform.domains) {
      if (normalized === domain || normalized.endsWith(`.${domain}`)) {
        return platform;
      }
    }
  }
  return null;
}

function getPlatformMetaFromUrl(url) {
  if (AIB_SHARED?.getPlatformByUrl) {
    return AIB_SHARED.getPlatformByUrl(url);
  }
  try {
    const hostname = new URL(url).hostname;
    return getFallbackPlatformByHostname(hostname);
  } catch (e) {
    return null;
  }
}

function getPlatformMetaByName(name) {
  if (AIB_SHARED?.getPlatformByName) {
    return AIB_SHARED.getPlatformByName(name);
  }
  return FALLBACK_PLATFORM_DEFINITIONS.find((platform) => platform.name === name) || null;
}

const DEFAULT_FLAGS = {
  debugLogs: false,
  perfFastPathEnabled: true,
  riskSafeMode: false,
  riskSafeModeLevel: 0,
  riskSafeModeUntilTs: 0,
  riskSafeModeActivatedAtTs: 0,
  riskTriggerHistoryTs: [],
  riskWindowStartTs: 0,
  riskWindowTargetCount: 0,
  riskWindowFailCount: 0,
  riskWindowRiskFailCount: 0,
  riskRecoveryCleanStreak: 0,
  guardMinDelayMs: 140,
  guardJitterMs: 260
};

function now() {
  return Date.now();
}

const BROADCAST_HARD_TIMEOUT_MS = 90000;
const SAFE_MODE_WINDOW_MS = 10 * 60 * 1000;
const SAFE_MODE_MIN_HOLD_MS = 10 * 60 * 1000;
const SAFE_MODE_TRIGGER_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SAFE_MODE_TRIGGER_DURATIONS_MS = [
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  8 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000
];
const SAFE_MODE_SOFT_RISK_FAIL_THRESHOLD = 2;
const SAFE_MODE_SOFT_FAIL_RATE_THRESHOLD = 0.4;
const SAFE_MODE_RECOVERY_REQUIRED_CLEAN_RUNS = 3;
const SAFE_MODE_RECOVERY_MAX_FAIL_RATE = 0.1;
const SAFE_MODE_RECOVERY_MIN_SUCCESSES = 2;
const SAFE_MODE_HARD_TRIGGER_PATTERN = /(captcha|verify you are human|security check|验证码|人机验证|安全验证|滑块验证|429|too many requests|forbidden|登录验证|sign[\s-]?in|log[\s-]?in)/i;
const SAFE_MODE_RISK_PATTERN = /(验证码|人机|captcha|verify|security|risk|登录|sign[\s-]?in|log[\s-]?in|429|too many requests|forbidden)/i;

function createLogger(scope, requestId, debug) {
  const prefix = `[AIB][${scope}][${requestId}]`;
  return {
    info(event, data = undefined) {
      if (!debug) return;
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

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function clampPositiveNumber(value, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Number(value));
}

function sanitizeTriggerHistory(value, nowTs) {
  if (!Array.isArray(value)) return [];
  return value
    .map((ts) => clampPositiveNumber(ts, 0))
    .filter((ts) => ts > 0 && ts >= nowTs - SAFE_MODE_TRIGGER_HISTORY_WINDOW_MS);
}

function normalizeRuntimeFlags(data, nowTs = now()) {
  const safeMode = typeof data.riskSafeMode === 'boolean' ? data.riskSafeMode : DEFAULT_FLAGS.riskSafeMode;
  const level = Math.max(0, Math.min(4, Math.floor(clampPositiveNumber(data.riskSafeModeLevel, DEFAULT_FLAGS.riskSafeModeLevel))));
  const untilTs = clampPositiveNumber(data.riskSafeModeUntilTs, DEFAULT_FLAGS.riskSafeModeUntilTs);
  const activatedAtTs = clampPositiveNumber(data.riskSafeModeActivatedAtTs, DEFAULT_FLAGS.riskSafeModeActivatedAtTs);
  const triggerHistoryTs = sanitizeTriggerHistory(data.riskTriggerHistoryTs, nowTs);
  const windowStartTs = clampPositiveNumber(data.riskWindowStartTs, DEFAULT_FLAGS.riskWindowStartTs);
  const windowTargetCount = clampPositiveNumber(data.riskWindowTargetCount, DEFAULT_FLAGS.riskWindowTargetCount);
  const windowFailCount = clampPositiveNumber(data.riskWindowFailCount, DEFAULT_FLAGS.riskWindowFailCount);
  const windowRiskFailCount = clampPositiveNumber(data.riskWindowRiskFailCount, DEFAULT_FLAGS.riskWindowRiskFailCount);
  const recoveryCleanStreak = Math.floor(clampPositiveNumber(data.riskRecoveryCleanStreak, DEFAULT_FLAGS.riskRecoveryCleanStreak));
  const debugLogs = typeof data.debugLogs === 'boolean' ? data.debugLogs : DEFAULT_FLAGS.debugLogs;
  const perfFastPathEnabled = typeof data.perfFastPathEnabled === 'boolean' ? data.perfFastPathEnabled : DEFAULT_FLAGS.perfFastPathEnabled;
  const guardMinDelayMs = clampPositiveNumber(data.guardMinDelayMs, DEFAULT_FLAGS.guardMinDelayMs);
  const guardJitterMs = clampPositiveNumber(data.guardJitterMs, DEFAULT_FLAGS.guardJitterMs);

  const expiredByTime = Boolean(safeMode && untilTs > 0 && nowTs >= untilTs);
  const normalizedSafeMode = expiredByTime ? false : safeMode;

  return {
    debugLogs,
    perfFastPathEnabled,
    riskSafeMode: normalizedSafeMode,
    riskSafeModeLevel: normalizedSafeMode ? level : 0,
    riskSafeModeUntilTs: normalizedSafeMode ? untilTs : 0,
    riskSafeModeActivatedAtTs: normalizedSafeMode ? activatedAtTs : 0,
    riskTriggerHistoryTs: triggerHistoryTs,
    riskWindowStartTs: windowStartTs,
    riskWindowTargetCount: windowTargetCount,
    riskWindowFailCount: windowFailCount,
    riskWindowRiskFailCount: windowRiskFailCount,
    riskRecoveryCleanStreak: normalizedSafeMode ? recoveryCleanStreak : 0,
    guardMinDelayMs,
    guardJitterMs,
  };
}

async function getRuntimeFlags() {
  const nowTs = now();
  const data = await chrome.storage.local.get([
    'debugLogs',
    'perfFastPathEnabled',
    'riskSafeMode',
    'riskSafeModeLevel',
    'riskSafeModeUntilTs',
    'riskSafeModeActivatedAtTs',
    'riskTriggerHistoryTs',
    'riskWindowStartTs',
    'riskWindowTargetCount',
    'riskWindowFailCount',
    'riskWindowRiskFailCount',
    'riskRecoveryCleanStreak',
    'guardMinDelayMs',
    'guardJitterMs'
  ]);
  const normalized = normalizeRuntimeFlags(data, nowTs);
  const expiredByTime = Boolean(data.riskSafeMode && !normalized.riskSafeMode);
  const historyNormalized = JSON.stringify(data.riskTriggerHistoryTs || []) !== JSON.stringify(normalized.riskTriggerHistoryTs);
  if (expiredByTime || historyNormalized) {
    await chrome.storage.local.set({
      riskSafeMode: normalized.riskSafeMode,
      riskSafeModeLevel: normalized.riskSafeModeLevel,
      riskSafeModeUntilTs: normalized.riskSafeModeUntilTs,
      riskSafeModeActivatedAtTs: normalized.riskSafeModeActivatedAtTs,
      riskTriggerHistoryTs: normalized.riskTriggerHistoryTs,
      riskRecoveryCleanStreak: normalized.riskRecoveryCleanStreak
    });
  }
  return normalized;
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    'debugLogs',
    'perfFastPathEnabled',
    'riskSafeMode',
    'riskSafeModeLevel',
    'riskSafeModeUntilTs',
    'riskSafeModeActivatedAtTs',
    'riskTriggerHistoryTs',
    'riskWindowStartTs',
    'riskWindowTargetCount',
    'riskWindowFailCount',
    'riskWindowRiskFailCount',
    'riskRecoveryCleanStreak',
    'guardMinDelayMs',
    'guardJitterMs'
  ]);
  const patch = {};
  if (typeof existing.debugLogs !== 'boolean') patch.debugLogs = DEFAULT_FLAGS.debugLogs;
  if (typeof existing.perfFastPathEnabled !== 'boolean') patch.perfFastPathEnabled = DEFAULT_FLAGS.perfFastPathEnabled;
  if (typeof existing.riskSafeMode !== 'boolean') patch.riskSafeMode = DEFAULT_FLAGS.riskSafeMode;
  if (!Number.isFinite(existing.riskSafeModeLevel)) patch.riskSafeModeLevel = DEFAULT_FLAGS.riskSafeModeLevel;
  if (!Number.isFinite(existing.riskSafeModeUntilTs)) patch.riskSafeModeUntilTs = DEFAULT_FLAGS.riskSafeModeUntilTs;
  if (!Number.isFinite(existing.riskSafeModeActivatedAtTs)) patch.riskSafeModeActivatedAtTs = DEFAULT_FLAGS.riskSafeModeActivatedAtTs;
  if (!Array.isArray(existing.riskTriggerHistoryTs)) patch.riskTriggerHistoryTs = DEFAULT_FLAGS.riskTriggerHistoryTs;
  if (!Number.isFinite(existing.riskWindowStartTs)) patch.riskWindowStartTs = DEFAULT_FLAGS.riskWindowStartTs;
  if (!Number.isFinite(existing.riskWindowTargetCount)) patch.riskWindowTargetCount = DEFAULT_FLAGS.riskWindowTargetCount;
  if (!Number.isFinite(existing.riskWindowFailCount)) patch.riskWindowFailCount = DEFAULT_FLAGS.riskWindowFailCount;
  if (!Number.isFinite(existing.riskWindowRiskFailCount)) patch.riskWindowRiskFailCount = DEFAULT_FLAGS.riskWindowRiskFailCount;
  if (!Number.isFinite(existing.riskRecoveryCleanStreak)) patch.riskRecoveryCleanStreak = DEFAULT_FLAGS.riskRecoveryCleanStreak;
  if (!Number.isFinite(existing.guardMinDelayMs)) patch.guardMinDelayMs = DEFAULT_FLAGS.guardMinDelayMs;
  if (!Number.isFinite(existing.guardJitterMs)) patch.guardJitterMs = DEFAULT_FLAGS.guardJitterMs;
  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
  if (existing.debugLogs === true) console.log('Sendol extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.GET_AI_TABS) {
    getAITabs()
      .then(tabs => sendResponse({ tabs }))
      .catch(err => {
        console.error('[AIB] getAITabs failed:', err);
        sendResponse({ tabs: [] });
      });
    return true;
  }
  if (message.type === MESSAGE_TYPES.BROADCAST_MESSAGE) {
    (async () => {
      const { text, autoSend, newChat, tabIds, requestId, clientTs } = message;
      const runtimeFlags = await getRuntimeFlags();
      const resolvedRequestId = requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const debug = typeof message.debug === 'boolean' ? message.debug : runtimeFlags.debugLogs;
      const payload = {
        text,
        autoSend: Boolean(autoSend),
        newChat: Boolean(newChat),
        tabIds: Array.isArray(tabIds) ? tabIds : [],
        requestId: resolvedRequestId,
        clientTs: Number.isFinite(clientTs) ? clientTs : now(),
        debug,
        fastPathEnabled: runtimeFlags.perfFastPathEnabled,
        safeMode: runtimeFlags.riskSafeMode,
        safeModeLevel: runtimeFlags.riskSafeModeLevel,
        safeModeUntilTs: runtimeFlags.riskSafeModeUntilTs,
        safeModeActivatedAtTs: runtimeFlags.riskSafeModeActivatedAtTs,
        triggerHistoryTs: runtimeFlags.riskTriggerHistoryTs,
        windowStartTs: runtimeFlags.riskWindowStartTs,
        windowTargetCount: runtimeFlags.riskWindowTargetCount,
        windowFailCount: runtimeFlags.riskWindowFailCount,
        windowRiskFailCount: runtimeFlags.riskWindowRiskFailCount,
        recoveryCleanStreak: runtimeFlags.riskRecoveryCleanStreak,
        guardMinDelayMs: runtimeFlags.guardMinDelayMs,
        guardJitterMs: runtimeFlags.guardJitterMs
      };
      const result = await broadcastToTabs(payload);
      sendResponse(result);
    })().catch((err) => {
      sendResponse({
        results: [],
        summary: {
          requestId: message.requestId || 'unknown',
          totalMs: 0,
          p95TabMs: 0,
          successCount: 0,
          failCount: 0,
          safety: {
            safeMode: false,
            effectiveAutoSend: false,
            riskEvents: 0,
            autoSendBlockedBySafeMode: false
          }
        },
        error: err.message
      });
    });
    return true;
  }
  if (message.type === MESSAGE_TYPES.BROADCAST_IMAGE) {
    (async () => {
      const { imageBase64, mimeType, text, autoSend, tabIds, requestId } = message;
      const runtimeFlags = await getRuntimeFlags();
      const resolvedRequestId = requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const debug = typeof message.debug === 'boolean' ? message.debug : runtimeFlags.debugLogs;
      const logger = createLogger('background', resolvedRequestId, debug);
      const ids = Array.isArray(tabIds) ? tabIds : [];
      const results = [];

      logger.info('broadcast-image-start', { tabCount: ids.length, hasText: Boolean(text), autoSend: Boolean(autoSend) });

      const timeoutAt = now() + 30000;
      for (let idx = 0; idx < ids.length; idx += 1) {
        if (now() >= timeoutAt) break;
        const tabId = ids[idx];
        try {
          await ensureContentReady(tabId, resolvedRequestId, debug, logger);
          const response = await chrome.tabs.sendMessage(tabId, {
            type: MESSAGE_TYPES.INJECT_IMAGE,
            imageBase64,
            mimeType: mimeType || 'image/png',
            text: text || '',
            autoSend: Boolean(autoSend),
            safeMode: false,
            requestId: resolvedRequestId,
            debug
          });
          results.push({ tabId, ...response });
        } catch (err) {
          logger.error('image-tab-failure', { tabId, error: err?.message });
          results.push({ tabId, success: false, sent: false, error: err?.message || '图片注入失败', platform: 'Unknown' });
        }
        if (idx < ids.length - 1) {
          await sleep(Math.max(80, runtimeFlags.guardMinDelayMs));
        }
      }

      if (results.length < ids.length) {
        for (const tabId of ids) {
          if (results.some((item) => item.tabId === tabId)) continue;
          results.push({ tabId, success: false, sent: false, error: '图片广播超时', platform: 'Unknown' });
        }
      }

      logger.info('broadcast-image-end', { resultCount: results.length });
      sendResponse({ results });
    })().catch((err) => {
      sendResponse({ results: [], error: err.message });
    });
    return true;
  }
  if (message.type === MESSAGE_TYPES.LOCATE_UPLOAD_ENTRIES) {
    (async () => {
      const runtimeFlags = await getRuntimeFlags();
      const resolvedRequestId = message.requestId || `req_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const debug = typeof message.debug === 'boolean' ? message.debug : runtimeFlags.debugLogs;
      const payload = {
        tabIds: Array.isArray(message.tabIds) ? message.tabIds : [],
        requestId: resolvedRequestId,
        clientTs: Number.isFinite(message.clientTs) ? message.clientTs : now(),
        debug
      };
      const result = await locateUploadEntries(payload);
      sendResponse(result);
    })().catch((err) => {
      sendResponse({
        results: [],
        summary: {
          requestId: message.requestId || 'unknown',
          totalMs: 0,
          p95TabMs: 0,
          foundCount: 0,
          notFoundCount: 0,
          errorCount: 0,
          timedOut: false
        },
        error: err.message
      });
    });
    return true;
  }
});

const GENERIC_TITLE_PATTERNS = {
  ChatGPT: [/^chatgpt$/i, /^new chat$/i],
  Claude: [/^claude$/i, /^new chat$/i],
  Gemini: [/^google gemini$/i, /^gemini$/i, /^new\s*chat$/i, /^gemini\s*[-–—|]/i, /[-–—|]\s*gemini$/i, /^gemini\s*[-–—|].*gemini$/i],
  Grok: [/^grok$/i, /^new chat$/i],
  DeepSeek: [/^deepseek$/i, /^new chat$/i],
  Mistral: [/^mistral ai$/i, /^mistral$/i, /^new chat$/i],
  Doubao: [/^豆包$/i, /^doubao$/i, /^new chat$/i],
  Qianwen: [/^通义千问$/i, /^千问$/i, /^qianwen$/i, /^new chat$/i],
  Yuanbao: [/^元宝$/i, /^yuanbao$/i, /^new chat$/i],
  Kimi: [/^kimi$/i, /^new chat$/i]
};

const NEW_CHAT_SETTLE_DELAY_MS = 260;

function getPlatformName(url) {
  const platform = getPlatformMetaFromUrl(url);
  return platform ? platform.name : null;
}

function getTabInjectionBlockReason(tab) {
  const url = String(tab?.url || '');
  if (!url) return '目标页面地址不可用';

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return '目标页面地址无效';
  }

  const protocol = parsed.protocol;
  if (protocol === 'chrome:' || protocol === 'edge:' || protocol === 'about:') {
    return '当前标签页是浏览器内部页面，无法注入，请切回 AI 对话页后重试';
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    return '当前标签页协议不受支持，无法注入';
  }
  if (!getPlatformName(url)) {
    return '当前标签页不是受支持的 AI 页面';
  }

  return null;
}

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isGenericTitle(platformName, title) {
  const normalized = normalizeTitle(title);
  if (!normalized) return true;
  const patterns = GENERIC_TITLE_PATTERNS[platformName] || [];
  return patterns.some((pattern) => pattern.test(normalized));
}

async function probeConversationTitle(tabId, platformName) {
  try {
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: (platform) => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const pick = (selectors) => {
          for (const selector of selectors) {
            const node = document.querySelector(selector);
            const text = normalize(node?.textContent || node?.innerText);
            if (text) return text;
          }
          return '';
        };
        const pickAll = (selectors) => {
          const out = [];
          for (const selector of selectors) {
            try {
              const nodes = document.querySelectorAll(selector);
              for (const node of nodes) {
                const text = normalize(node?.textContent || node?.innerText);
                if (text && text.length <= 120 && text.length > 0) out.push(text);
              }
            } catch (e) {}
          }
          return out;
        };
        const stripPatterns = {
          Gemini: [/\s*[-–—|]\s*(?:google\s*)?gemini\s*$/i, /^(?:google\s*)?gemini\s*[-–—|]\s*/i, /\s*[-–—|]\s*google\s*$/i],
          ChatGPT: [/\s*[-–—|]\s*chatgpt\s*$/i, /^chatgpt\s*[-–—|]\s*/i],
          Claude: [/\s*[-–—|]\s*claude\s*$/i, /^claude\s*[-–—|]\s*/i],
          Grok: [/\s*[-–—|]\s*grok\s*$/i, /^grok\s*[-–—|]\s*/i],
          DeepSeek: [/\s*[-–—|]\s*deepseek\s*$/i, /^deepseek\s*[-–—|]\s*/i],
          Doubao: [/\s*[-–—|]\s*豆包\s*$/i, /^豆包\s*[-–—|]\s*/i, /\s*[-–—|]\s*doubao\s*$/i, /^doubao\s*[-–—|]\s*/i],
          Qianwen: [/\s*[-–—|]\s*千问\s*$/i, /^千问\s*[-–—|]\s*/i, /\s*[-–—|]\s*通义\s*$/i, /^通义\s*[-–—|]\s*/i],
          Kimi: [/\s*[-–—|]\s*kimi\s*$/i, /^kimi\s*[-–—|]\s*/i]
        };
        const genericGemini = /^(?:google\s*)?gemini$|^new\s*chat$/i;

        if (platform === 'Gemini') {
          const byTitle = normalize(document.title);
          let stripped = byTitle;
          for (const re of (stripPatterns.Gemini || [])) stripped = stripped.replace(re, '').trim();
          if (stripped && !genericGemini.test(stripped) && stripped.length <= 120) return stripped;

          const domSelectors = [
            '[aria-current="page"]',
            '[aria-selected="true"]',
            'aside [aria-current="page"]',
            'aside [aria-selected="true"]',
            '[role="navigation"] [aria-current="page"]',
            '[role="navigation"] [aria-selected="true"]',
            'nav [aria-current="page"]',
            'nav [aria-selected="true"]',
            '[data-test-id="conversation-title"]',
            '[data-test-id="chat-history-item-active"]',
            '.mdc-list-item--activated',
            '.mdc-list-item--selected',
            'a[aria-current="page"]',
            'button[aria-current="page"]'
          ];
          const byDom = pick(domSelectors);
          if (byDom && !genericGemini.test(byDom)) return byDom;

          const candidates = pickAll(['[aria-current="page"]', '[aria-selected="true"]']);
          for (const c of candidates) {
            if (c && !genericGemini.test(c) && c.length <= 120) return c;
          }

          const firstMessageSelectors = [
            '[role="log"] [data-message-author="user"]',
            '[role="log"] [data-author="user"]',
            'main [role="log"] .message-content',
            'main [role="log"] [class*="message"]',
            'main [class*="chat"] [class*="content"]',
            'main [class*="turn"]',
            '[role="log"] > div',
            'main article',
            'main [class*="bubble"]'
          ];
          const maxSnippetLen = 32;
          const takeFirstMessage = (nodes) => {
            for (const node of nodes) {
              const text = normalize(node?.textContent || node?.innerText);
              if (!text || text.length < 2 || genericGemini.test(text)) continue;
              if (text.length > 400) continue;
              const snippet = text.length <= maxSnippetLen ? text : text.slice(0, maxSnippetLen) + '…';
              return snippet;
            }
            return '';
          };
          for (const sel of firstMessageSelectors) {
            try {
              const nodes = document.querySelectorAll(sel);
              const out = takeFirstMessage(nodes);
              if (out) return out;
            } catch (e) {}
          }
          const inputEl = document.querySelector('rich-textarea .ql-editor') || document.querySelector('.ql-editor[contenteditable="true"]') || document.querySelector('div[contenteditable="true"][role="textbox"]');
          if (inputEl) {
            let area = inputEl.closest('form')?.previousElementSibling || inputEl.closest('main')?.querySelector('[role="log"]') || inputEl.closest('section')?.previousElementSibling;
            if (area) {
              const text = normalize(area?.textContent || area?.innerText);
              if (text && text.length >= 2 && text.length <= 400 && !genericGemini.test(text)) {
                return text.length <= maxSnippetLen ? text : text.slice(0, maxSnippetLen) + '…';
              }
            }
          }

          return stripped && stripped.length <= 120 ? stripped : '';
        }

        const selectorMap = {
          ChatGPT: ['nav a[aria-current="page"]', 'nav [data-active="true"]', 'main h1'],
          Claude: ['nav a[aria-current="page"]', 'main h1'],
          Grok: ['nav a[aria-current="page"]', 'main h1'],
          DeepSeek: ['nav a[aria-current="page"]', 'main h1'],
          Mistral: ['nav a[aria-current="page"]', 'main h1'],
          Doubao: ['nav a[aria-current="page"]', 'main h1', 'header h1'],
          Qianwen: ['nav a[aria-current="page"]', 'main h1', 'header h1'],
          Yuanbao: ['nav a[aria-current="page"]', 'main h1', 'header h1'],
          Kimi: ['nav a[aria-current="page"]', 'main h1', 'header h1']
        };
        const platformSelectors = selectorMap[platform] || ['main h1', 'header h1'];
        const byDom = pick(platformSelectors);
        if (byDom && byDom.length <= 120) return byDom;

        const byTitle = normalize(document.title);
        const patterns = stripPatterns[platform] || [];
        let stripped = byTitle;
        for (const re of patterns) stripped = stripped.replace(re, '').trim();
        if (stripped && stripped !== byTitle && stripped.length <= 120) return stripped;

        return byTitle && byTitle.length <= 120 ? byTitle : '';
      },
      args: [platformName]
    });
    const candidate = normalizeTitle(execution?.[0]?.result || '');
    return candidate;
  } catch (err) {
    return '';
  }
}

async function getAITabs() {
  const allTabs = await chrome.tabs.query({});
  const seenPlatforms = new Map();

  for (const tab of allTabs) {
    if (!tab.url) continue;
    const platformName = getPlatformName(tab.url);
    if (!platformName) continue;

    const existing = seenPlatforms.get(platformName);
    const score = (tab.active ? 1e9 : 0) + (tab.lastAccessed || tab.index || 0);
    const existingScore = existing
      ? ((existing.active ? 1e9 : 0) + (existing.lastAccessed || existing.index || 0))
      : -1;

    if (!existing || score > existingScore) {
      seenPlatforms.set(platformName, {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        platformName,
        windowId: tab.windowId,
        favIconUrl: tab.favIconUrl,
        index: tab.index,
        active: tab.active
      });
    }
  }

  const tabs = [...seenPlatforms.values()];
  const resolved = await Promise.all(
    tabs.map(async (tab) => {
      const shouldProbe = isGenericTitle(tab.platformName, tab.title) || tab.platformName === 'Gemini';
      if (!shouldProbe) return tab;
      const domTitle = await probeConversationTitle(tab.id, tab.platformName);
      if (domTitle && !isGenericTitle(tab.platformName, domTitle)) {
        return { ...tab, title: domTitle };
      }
      return tab;
    })
  );
  return resolved;
}

// Wait for a tab to finish loading
function waitForTabLoad(tabId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('页面加载超时'));
    }, timeout);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pingContent(tabId, requestId, debug) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.PING,
      requestId,
      debug
    });
    return Boolean(response && response.success);
  } catch (err) {
    return false;
  }
}

function getContentScriptFiles(tabUrl) {
  const platform = getPlatformMetaFromUrl(tabUrl);
  if (!platform) return ['shared/platform-registry.js', 'content-core.js'];
  const platformId = (AIB_SHARED?.PLATFORM_DEFINITIONS || FALLBACK_PLATFORM_DEFINITIONS)
    .find(p => p.name === platform.name)?.id
    || platform.name.toLowerCase();
  return ['shared/platform-registry.js', 'content-core.js', `content-${platformId}.js`];
}

async function ensureContentReady(tabId, requestId, debug, logger) {
  let tabActive = false;
  let tabInfo = null;
  try {
    tabInfo = await chrome.tabs.get(tabId);
    const blockedReason = getTabInjectionBlockReason(tabInfo);
    if (blockedReason) throw new Error(blockedReason);

    const tab = tabInfo;
    tabActive = Boolean(tab.active);
    if (tab && tab.status !== 'complete') {
      logger.debug('content-wait-tab-load', { tabId, status: tab.status });
      try {
        await waitForTabLoad(tabId, tabActive ? 8000 : 15000);
      } catch (err) {
        logger.debug('content-wait-tab-load-timeout', { tabId, error: err?.message });
      }
      await sleep(80);
    }
  } catch (err) {
    logger.debug('content-get-tab-failed', { tabId, error: err?.message });
    throw err;
  }

  if (await pingContent(tabId, requestId, debug)) {
    logger.debug('content-ready', { tabId, via: 'ping' });
    return;
  }

  const scriptFiles = getContentScriptFiles(tabInfo?.url);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: scriptFiles
    });
  } catch (err) {
    logger.debug('execute-script-warning', { tabId, error: err.message });
  }

  if (await pingContent(tabId, requestId, debug)) {
    logger.debug('content-ready', { tabId, via: 'inject+ping' });
    return;
  }

  const backoffs = tabActive ? [60, 120, 220, 420, 800] : [120, 240, 480, 960, 1600];
  const reinjectThreshold = tabActive ? 220 : 480;
  logger.debug('content-retry-plan', { tabId, tabActive, backoffs });
  for (const delay of backoffs) {
    await sleep(delay);
    if (delay >= reinjectThreshold) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: scriptFiles
        });
      } catch (err) {
        logger.debug('execute-script-retry-warning', { tabId, delay, error: err?.message });
      }
    }
    if (await pingContent(tabId, requestId, debug)) {
      logger.debug('content-ready', { tabId, via: `retry-${delay}` });
      return;
    }
  }

  throw new Error('内容脚本未就绪');
}

function normalizeResultTimings(result, fallbackMs) {
  const raw = result.timings || {};
  const totalMs = Number.isFinite(raw.totalMs) ? raw.totalMs : fallbackMs;
  return {
    findInputMs: Number.isFinite(raw.findInputMs) ? raw.findInputMs : 0,
    injectMs: Number.isFinite(raw.injectMs) ? raw.injectMs : 0,
    sendMs: Number.isFinite(raw.sendMs) ? raw.sendMs : 0,
    totalMs: Number.isFinite(totalMs) ? totalMs : 0
  };
}

async function broadcastToTabs(payload) {
  const {
    text,
    autoSend,
    newChat,
    tabIds,
    requestId,
    clientTs,
    debug,
    fastPathEnabled,
    safeMode,
    safeModeLevel,
    safeModeUntilTs,
    safeModeActivatedAtTs,
    triggerHistoryTs,
    windowStartTs,
    windowTargetCount,
    windowFailCount,
    windowRiskFailCount,
    recoveryCleanStreak,
    guardMinDelayMs,
    guardJitterMs
  } = payload;
  // Safe mode disabled — always respect user's autoSend setting
  const effectiveAutoSend = Boolean(autoSend);
  const logger = createLogger('background', requestId, debug);
  const startedAt = now();
  const totalTabs = tabIds.length;
  const resultMap = new Map();
  let completedCount = 0;
  let successCount = 0;
  let failCount = 0;
  let finalized = false;

  const emitProgress = (extra = {}) => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.BROADCAST_PROGRESS,
      requestId,
      total: totalTabs,
      completed: completedCount,
      successCount,
      failCount,
      pendingCount: Math.max(0, totalTabs - completedCount),
      ...extra
    }).catch(() => {});
  };

  const composeDebugLog = (result) => {
    const timings = result?.timings || {};
    return result?.debugLog || [
      `platform=${result?.platform || 'Unknown'}`,
      `stage=${result?.stage || (result?.success ? 'done' : 'unknown')}`,
      `ok=${Boolean(result?.success)}`,
      `sent=${result?.sent === true}`,
      `strategy=${result?.strategy || 'n/a'}`,
      `fallback=${Boolean(result?.fallbackUsed || result?.sendFallbackUsed)}`,
      `find=${Number(timings.findInputMs || 0)}ms`,
      `inject=${Number(timings.injectMs || 0)}ms`,
      `send=${Number(timings.sendMs || 0)}ms`,
      `total=${Number(timings.totalMs || 0)}ms`,
      result?.error ? `error=${result.error}` : ''
    ].filter(Boolean).join(' | ');
  };

  const recordResult = (tabId, result) => {
    if (finalized || resultMap.has(tabId)) return;
    const normalizedResult = {
      ...result,
      debugLog: composeDebugLog(result)
    };
    resultMap.set(tabId, normalizedResult);
    completedCount += 1;
    if (normalizedResult.success) successCount += 1;
    else failCount += 1;
    logger.info('tab-debug', {
      tabId,
      platform: normalizedResult.platform || 'Unknown',
      success: Boolean(normalizedResult.success),
      debugLog: normalizedResult.debugLog
    });
    emitProgress({ done: false, timedOut: false });
  };

  logger.info('broadcast-start', {
    tabCount: totalTabs,
    autoSend: effectiveAutoSend,
    requestedAutoSend: autoSend,
    safeMode,
    newChat,
    fastPathEnabled,
    queueDelayMs: Math.max(0, startedAt - clientTs)
  });
  emitProgress({ done: false, timedOut: false });

  async function processTab(tabId) {
    const tabStartedAt = now();
    try {
      if (newChat) {
        const tab = await chrome.tabs.get(tabId);
        const platformName = getPlatformName(tab.url);
        const platformMeta = getPlatformMetaByName(platformName);
        const newUrl = platformMeta?.newChatUrl || null;
        if (newUrl) {
          await chrome.tabs.update(tabId, { url: newUrl });
          await waitForTabLoad(tabId);
          await sleep(NEW_CHAT_SETTLE_DELAY_MS);
        }
      }
      await ensureContentReady(tabId, requestId, debug, logger);
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.INJECT_MESSAGE,
        text,
        autoSend: effectiveAutoSend,
        newChat: false,
        requestId,
        debug,
        fastPathEnabled,
        safeMode
      });
      const merged = { tabId, ...response };
      merged.timings = normalizeResultTimings(merged, now() - tabStartedAt);

      if (effectiveAutoSend) {
        const needsSendFallback = merged.success ? merged.sent !== true : merged.stage === 'send';
        if (needsSendFallback) {
          const fallbackStartedAt = now();
          try {
            const sendRes = await chrome.tabs.sendMessage(tabId, {
              type: MESSAGE_TYPES.SEND_NOW,
              requestId,
              debug,
              safeMode,
              text
            });
            const sendMs = Number.isFinite(sendRes?.sendMs) ? sendRes.sendMs : (now() - fallbackStartedAt);
            const sendOk = Boolean(sendRes?.success);
            merged.sendFallbackUsed = true;
            merged.success = sendOk;
            merged.sent = sendOk;
            merged.stage = sendOk ? undefined : 'send';
            merged.error = sendOk ? undefined : (sendRes?.error || merged.error || '发送失败');
            merged.timings.sendMs = sendMs;
            merged.timings.totalMs = (merged.timings.findInputMs || 0) + (merged.timings.injectMs || 0) + sendMs;
            if (sendRes?.debugLog) {
              merged.debugLog = merged.debugLog
                ? `${merged.debugLog} | fallback=${sendRes.debugLog}`
                : `fallback=${sendRes.debugLog}`;
            }
          } catch (sendErr) {
            const sendMs = now() - fallbackStartedAt;
            merged.sendFallbackUsed = true;
            merged.success = false;
            merged.sent = false;
            merged.stage = 'send';
            merged.error = sendErr?.message || String(sendErr);
            merged.timings.sendMs = sendMs;
            merged.timings.totalMs = (merged.timings.findInputMs || 0) + (merged.timings.injectMs || 0) + sendMs;
            merged.debugLog = merged.debugLog
              ? `${merged.debugLog} | fallback=send_now_exception:${sendErr?.message || String(sendErr)}`
              : `fallback=send_now_exception:${sendErr?.message || String(sendErr)}`;
          }
        }
      }
      return merged;
    } catch (err) {
      logger.error('tab-failure', { tabId, error: err.message });
      return {
        tabId,
        success: false,
        error: err.message,
        stage: 'inject',
        strategy: 'n/a',
        fallbackUsed: false,
        timings: { findInputMs: 0, injectMs: 0, sendMs: 0, totalMs: now() - tabStartedAt }
      };
    }
  }

  let timedOut = false;
  const withTabTimeout = (tabId) => Promise.race([
    processTab(tabId),
    sleep(BROADCAST_HARD_TIMEOUT_MS).then(() => ({
      tabId,
      success: false,
      error: '广播超时',
      stage: 'timeout',
      strategy: 'n/a',
      fallbackUsed: false,
      timings: { findInputMs: 0, injectMs: 0, sendMs: 0, totalMs: BROADCAST_HARD_TIMEOUT_MS }
    }))
  ]);

  await Promise.allSettled(tabIds.map(async (tabId) => {
    try {
      const res = await withTabTimeout(tabId);
      if (res?.stage === 'timeout') timedOut = true;
      recordResult(tabId, res);
    } catch (err) {
      recordResult(tabId, {
        tabId,
        success: false,
        error: err?.message || String(err),
        stage: 'inject',
        strategy: 'n/a',
        fallbackUsed: false,
        timings: { findInputMs: 0, injectMs: 0, sendMs: 0, totalMs: 0 }
      });
    }
  }));

  for (const tabId of tabIds) {
    if (resultMap.has(tabId)) continue;
    timedOut = true;
    resultMap.set(tabId, {
      tabId,
      success: false,
      error: '广播超时',
      stage: 'timeout',
      strategy: 'n/a',
      fallbackUsed: false,
      timings: { findInputMs: 0, injectMs: 0, sendMs: 0, totalMs: BROADCAST_HARD_TIMEOUT_MS }
    });
    completedCount += 1;
    failCount += 1;
  }
  finalized = true;
  emitProgress({ done: true, timedOut });

  const results = tabIds.map((tabId) => resultMap.get(tabId) || {
    tabId,
    success: false,
    error: '未知错误',
    stage: 'inject',
    strategy: 'n/a',
    fallbackUsed: false,
    timings: { findInputMs: 0, injectMs: 0, sendMs: 0, totalMs: 0 }
  });

  const totalMs = now() - startedAt;
  const finalSuccessCount = results.filter(r => r.success).length;
  const finalFailCount = results.length - finalSuccessCount;
  const p95TabMs = Math.round(percentile(results.map(r => r.timings?.totalMs || 0), 95));
  const failedResults = results.filter((r) => !r?.success);
  const riskEvents = failedResults.filter((r) => {
    if (r?.stage === 'timeout') return true;
    return SAFE_MODE_RISK_PATTERN.test(String(r?.error || ''));
  }).length;
  const hardTriggerEvents = failedResults.filter((r) => SAFE_MODE_HARD_TRIGGER_PATTERN.test(String(r?.error || ''))).length;
  const hardTriggered = hardTriggerEvents > 0;

  const runTargetCount = results.length;
  const runFailRate = runTargetCount > 0 ? finalFailCount / runTargetCount : 0;
  const inWindow = windowStartTs > 0 && (startedAt - windowStartTs) <= SAFE_MODE_WINDOW_MS;
  const nextWindowStartTs = inWindow ? windowStartTs : startedAt;
  const nextWindowTargetCount = (inWindow ? windowTargetCount : 0) + runTargetCount;
  const nextWindowFailCount = (inWindow ? windowFailCount : 0) + finalFailCount;
  const nextWindowRiskFailCount = (inWindow ? windowRiskFailCount : 0) + riskEvents;
  const windowFailRate = nextWindowTargetCount > 0 ? nextWindowFailCount / nextWindowTargetCount : 0;

  const softTriggered = nextWindowRiskFailCount >= SAFE_MODE_SOFT_RISK_FAIL_THRESHOLD ||
    windowFailRate >= SAFE_MODE_SOFT_FAIL_RATE_THRESHOLD;
  const triggerMode = hardTriggered ? 'hard' : (softTriggered ? 'soft' : 'none');
  const triggered = triggerMode !== 'none';

  let nextRiskSafeMode = Boolean(safeMode);
  let nextRiskSafeModeLevel = Math.max(0, Math.min(4, Math.floor(clampPositiveNumber(safeModeLevel, 0))));
  let nextRiskSafeModeUntilTs = clampPositiveNumber(safeModeUntilTs, 0);
  let nextRiskSafeModeActivatedAtTs = clampPositiveNumber(safeModeActivatedAtTs, 0);
  let nextRiskRecoveryCleanStreak = Math.floor(clampPositiveNumber(recoveryCleanStreak, 0));
  let nextTriggerHistoryTs = sanitizeTriggerHistory(triggerHistoryTs, startedAt);

  if (triggered) {
    nextTriggerHistoryTs.push(startedAt);
    const triggerCount24h = nextTriggerHistoryTs.length;
    const escalatedLevel = Math.min(4, Math.max(nextRiskSafeModeLevel, triggerCount24h));
    const durationMs = SAFE_MODE_TRIGGER_DURATIONS_MS[Math.max(0, escalatedLevel - 1)];
    nextRiskSafeMode = true;
    nextRiskSafeModeLevel = escalatedLevel;
    nextRiskSafeModeUntilTs = Math.max(nextRiskSafeModeUntilTs, startedAt + durationMs);
    nextRiskSafeModeActivatedAtTs = nextRiskSafeModeActivatedAtTs > 0 && safeMode
      ? nextRiskSafeModeActivatedAtTs
      : startedAt;
    nextRiskRecoveryCleanStreak = 0;
  } else if (nextRiskSafeMode) {
    const cleanForRecovery = !hardTriggered &&
      runFailRate < SAFE_MODE_RECOVERY_MAX_FAIL_RATE &&
      finalSuccessCount >= SAFE_MODE_RECOVERY_MIN_SUCCESSES;
    nextRiskRecoveryCleanStreak = cleanForRecovery ? nextRiskRecoveryCleanStreak + 1 : 0;

    const holdSatisfied = startedAt >= (nextRiskSafeModeActivatedAtTs + SAFE_MODE_MIN_HOLD_MS);
    const earlyRecover = holdSatisfied && nextRiskRecoveryCleanStreak >= SAFE_MODE_RECOVERY_REQUIRED_CLEAN_RUNS;
    const expireByDuration = nextRiskSafeModeUntilTs > 0 && startedAt >= nextRiskSafeModeUntilTs;
    if (earlyRecover || expireByDuration) {
      nextRiskSafeMode = false;
      nextRiskSafeModeLevel = 0;
      nextRiskSafeModeUntilTs = 0;
      nextRiskSafeModeActivatedAtTs = 0;
      nextRiskRecoveryCleanStreak = 0;
    }
  } else {
    nextRiskRecoveryCleanStreak = 0;
  }

  await chrome.storage.local.set({
    riskSafeMode: nextRiskSafeMode,
    riskSafeModeLevel: nextRiskSafeModeLevel,
    riskSafeModeUntilTs: nextRiskSafeModeUntilTs,
    riskSafeModeActivatedAtTs: nextRiskSafeModeActivatedAtTs,
    riskTriggerHistoryTs: nextTriggerHistoryTs,
    riskWindowStartTs: nextWindowStartTs,
    riskWindowTargetCount: nextWindowTargetCount,
    riskWindowFailCount: nextWindowFailCount,
    riskWindowRiskFailCount: nextWindowRiskFailCount,
    riskRecoveryCleanStreak: nextRiskRecoveryCleanStreak
  });

  const summary = {
    requestId,
    totalMs,
    p95TabMs,
    successCount: finalSuccessCount,
    failCount: finalFailCount,
    timedOut,
    safety: {
      safeMode: Boolean(safeMode),
      effectiveAutoSend: Boolean(effectiveAutoSend),
      requestedAutoSend: Boolean(autoSend),
      autoSendBlockedBySafeMode: Boolean(autoSend && !effectiveAutoSend),
      riskEvents,
      hardTriggerEvents,
      triggerMode,
      nextSafeMode: nextRiskSafeMode,
      nextSafeModeLevel: nextRiskSafeModeLevel,
      nextSafeModeUntilTs: nextRiskSafeModeUntilTs
    }
  };
  logger.info('broadcast-end', summary);
  return { results, summary };
}

async function locateUploadEntries(payload) {
  const {
    tabIds,
    requestId,
    clientTs,
    debug
  } = payload;
  const logger = createLogger('background-upload', requestId, debug);
  const startedAt = now();
  const resultMap = new Map();
  let timedOut = false;

  logger.info('locate-upload-start', {
    tabCount: tabIds.length,
    queueDelayMs: Math.max(0, startedAt - clientTs)
  });

  for (const tabId of tabIds) {
    if (now() - startedAt >= BROADCAST_HARD_TIMEOUT_MS) {
      timedOut = true;
      break;
    }

    const tabStartedAt = now();
    try {
      const tab = await chrome.tabs.get(tabId);
      const platformName = getPlatformName(tab?.url) || 'Unknown';

      await ensureContentReady(tabId, requestId, debug, logger);
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.HIGHLIGHT_UPLOAD_ENTRY,
        requestId,
        debug
      });

      const success = Boolean(response?.success);
      const found = Boolean(response?.found);
      resultMap.set(tabId, {
        tabId,
        platform: response?.platform || platformName,
        success,
        found: success ? found : false,
        via: response?.via || 'unknown',
        error: success ? undefined : (response?.error || '定位失败'),
        totalMs: Number.isFinite(response?.totalMs) ? response.totalMs : (now() - tabStartedAt)
      });
    } catch (err) {
      logger.error('locate-upload-tab-failure', { tabId, error: err?.message || String(err) });
      resultMap.set(tabId, {
        tabId,
        platform: 'Unknown',
        success: false,
        found: false,
        via: 'n/a',
        error: err?.message || String(err),
        totalMs: now() - tabStartedAt
      });
    }
  }

  if (timedOut) {
    for (const tabId of tabIds) {
      if (resultMap.has(tabId)) continue;
      resultMap.set(tabId, {
        tabId,
        platform: 'Unknown',
        success: false,
        found: false,
        via: 'timeout',
        error: '定位上传入口超时',
        totalMs: BROADCAST_HARD_TIMEOUT_MS
      });
    }
  }

  const results = tabIds.map((tabId) => resultMap.get(tabId) || {
    tabId,
    platform: 'Unknown',
    success: false,
    found: false,
    via: 'n/a',
    error: '未知错误',
    totalMs: 0
  });
  const foundCount = results.filter((r) => r.success && r.found).length;
  const notFoundCount = results.filter((r) => r.success && !r.found).length;
  const errorCount = results.length - foundCount - notFoundCount;
  const totalMs = now() - startedAt;
  const p95TabMs = Math.round(percentile(results.map((r) => r.totalMs || 0), 95));

  const summary = {
    requestId,
    totalMs,
    p95TabMs,
    foundCount,
    notFoundCount,
    errorCount,
    timedOut
  };
  logger.info('locate-upload-end', summary);
  return { results, summary };
}

// ── Persistent popup window ──
const POPUP_PAGE_PATH = 'app/dist-extension/popup.html';
const POPUP_BOUNDS_KEY = 'popupWindowState';
const POPUP_WINDOW_ID_KEY = 'popupWindowId';
let boundsSaveTimer = null;
let popupClickInFlight = false;

function getPopupPageUrl() {
  return chrome.runtime.getURL(POPUP_PAGE_PATH);
}

async function findPopupWindowByUrl() {
  const popupUrl = getPopupPageUrl();
  const allWindows = await chrome.windows.getAll({ populate: true });
  for (const win of allWindows) {
    const matchedTab = win.tabs?.find((tab) => typeof tab?.url === 'string' && tab.url.startsWith(popupUrl));
    if (matchedTab) {
      return { windowId: win.id };
    }
  }
  return null;
}

async function closePopupWindow(windowId) {
  try {
    await chrome.windows.remove(windowId);
    return true;
  } catch {
    return false;
  }
}

chrome.action.onClicked.addListener(async () => {
  if (popupClickInFlight) return;
  popupClickInFlight = true;

  try {
    const stored = await chrome.storage.local.get(POPUP_WINDOW_ID_KEY);
    let popupWindowId = Number.isInteger(stored?.[POPUP_WINDOW_ID_KEY]) ? stored[POPUP_WINDOW_ID_KEY] : null;

    if (popupWindowId !== null) {
      await closePopupWindow(popupWindowId);
      popupWindowId = null;
      await chrome.storage.local.remove(POPUP_WINDOW_ID_KEY);
    }

    const discoveredPopup = await findPopupWindowByUrl();
    if (Number.isInteger(discoveredPopup?.windowId)) {
      await closePopupWindow(discoveredPopup.windowId);
      await chrome.storage.local.remove(POPUP_WINDOW_ID_KEY);
    }

    const savedState = await chrome.storage.local.get(POPUP_BOUNDS_KEY);
    const bounds = savedState?.[POPUP_BOUNDS_KEY] || {};
    const createOptions = {
      url: getPopupPageUrl(),
      type: 'popup',
      width: Number.isInteger(bounds.width) ? bounds.width : 420,
      height: Number.isInteger(bounds.height) ? bounds.height : 620,
      focused: true
    };
    if (Number.isInteger(bounds.left)) createOptions.left = bounds.left;
    if (Number.isInteger(bounds.top)) createOptions.top = bounds.top;

    const popupWindow = await chrome.windows.create(createOptions);
    if (Number.isInteger(popupWindow?.id)) {
      await chrome.storage.local.set({ [POPUP_WINDOW_ID_KEY]: popupWindow.id });
    }
  } catch (err) {
    console.error('[AIB] action.onClicked error:', err);
  } finally {
    popupClickInFlight = false;
  }
});

if (chrome.windows.onBoundsChanged) {
  chrome.windows.onBoundsChanged.addListener((window) => {
    const newBounds = {
      width: window.width,
      height: window.height,
      left: window.left,
      top: window.top,
      id: window.id
    };

    if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(async () => {
      boundsSaveTimer = null;
      try {
        const stored = await chrome.storage.local.get(POPUP_WINDOW_ID_KEY);
        const popupWindowId = stored?.[POPUP_WINDOW_ID_KEY];
        if (newBounds.id === popupWindowId) {
          await chrome.storage.local.set({ [POPUP_BOUNDS_KEY]: newBounds });
        }
      } catch (err) {
        console.debug('[AIB] Failed to save window bounds:', err);
      }
    }, 500);
  });
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  const stored = await chrome.storage.local.get(POPUP_WINDOW_ID_KEY);
  if (windowId === stored?.[POPUP_WINDOW_ID_KEY]) {
    await chrome.storage.local.remove(POPUP_WINDOW_ID_KEY);
  }
});
