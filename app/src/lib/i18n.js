const FALLBACK_MESSAGES = {
  en: {
    popup_title: 'Broadcast',
    refresh: 'Refresh',
    active_sessions: 'Active Sessions',
    select_all: 'Select All',
    deselect_all: 'Deselect All',
    scanning_sessions: 'Scanning sessions...',
    no_ai_tabs_detected: 'No AI tabs detected.',
    open_ai_tabs_hint: 'Open ChatGPT, Claude, Gemini, etc.',
    message_placeholder: 'Message AI Agents... (Ctrl+Enter to send)',
    auto_send: 'Auto Send',
    new_chat: 'New Chat',
    send_to_n: 'Send to $1 AI(s)',
    select_tabs_and_enter_message: 'Select tabs and enter message',
    broadcasting_to_n: 'Broadcasting to $1 AI(s)...',
    status_sent: '$1 — Sent',
    status_drafted: '$1 — Drafted',
    status_failed: '$1 — Failed: $2',
    status_failed_simple: 'Failed: $1',
    unknown: 'Unknown',
    tab_n: 'Tab $1',
  },
  zh_CN: {
    popup_title: '广播',
    refresh: '刷新',
    active_sessions: '活跃会话',
    select_all: '全选',
    deselect_all: '取消全选',
    scanning_sessions: '正在扫描会话…',
    no_ai_tabs_detected: '未检测到 AI 标签页。',
    open_ai_tabs_hint: '请先打开 ChatGPT、Claude、Gemini 等页面。',
    message_placeholder: '输入要广播的消息…（Ctrl+Enter 发送）',
    auto_send: '自动发送',
    new_chat: '新对话',
    send_to_n: '发送给 $1 个 AI',
    select_tabs_and_enter_message: '请选择标签页并输入消息',
    broadcasting_to_n: '正在广播到 $1 个 AI…',
    status_sent: '$1 — 已发送',
    status_drafted: '$1 — 已填入草稿',
    status_failed: '$1 — 失败：$2',
    status_failed_simple: '失败：$1',
    unknown: '未知',
    tab_n: '标签页 $1',
  },
}

const SUPPORTED_LOCALES = ['zh_CN', 'en']

function normalizeLocale(raw) {
  const value = String(raw || '').toLowerCase()
  if (value.startsWith('zh')) return 'zh_CN'
  return 'en'
}

/** 按浏览器「首选语言」列表的第一顺位决定 locale（与设置页 Preferred languages 一致） */
function getPreferredLocale() {
  if (typeof navigator === 'undefined') return 'en'
  const list = navigator.languages && navigator.languages.length > 0
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : ['en']
  for (const lang of list) {
    const locale = normalizeLocale(lang)
    if (SUPPORTED_LOCALES.includes(locale)) return locale
  }
  return 'en'
}

function applySubstitutions(template, substitutions) {
  if (!substitutions) return template
  const subs = Array.isArray(substitutions) ? substitutions : [substitutions]
  return subs.reduce((acc, s, idx) => acc.replaceAll(`$${idx + 1}`, String(s)), template)
}

/** 使用浏览器第一顺位首选语言（navigator.languages[0]），与设置页 Preferred languages 一致 */
export function t(key, substitutions) {
  const locale = getPreferredLocale()
  const dict = FALLBACK_MESSAGES[locale] || FALLBACK_MESSAGES.en
  const template = dict[key] || FALLBACK_MESSAGES.en[key] || String(key)
  return applySubstitutions(template, substitutions)
}

