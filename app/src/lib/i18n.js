const FALLBACK_MESSAGES = {
  en: {
    popup_title: 'Sendol',
    refresh: 'Refresh',
    active_sessions: 'Available AI Tabs',
    select_all: 'Select All',
    deselect_all: 'Deselect All',
    scanning_sessions: 'Scanning AI tabs...',
    no_ai_tabs_detected: 'No AI tabs detected.',
    open_ai_tabs_hint: 'Please open ChatGPT, Claude, Gemini, etc.',
    message_placeholder: 'Type your message to all selected AI... (Ctrl/⌘+Enter to send)',
    auto_send: 'Auto Send',
    new_chat: 'New Chat',
    safe_mode: 'Safe Mode',
    send_to_n: 'Send to $1 AI(s)',
    select_tabs_and_enter_message: 'Select AI tabs and enter your message',
    select_tabs_first: 'Select AI tabs first',
    broadcasting_to_n: 'Broadcasting to $1 AI(s)...',
    broadcast_progress_line: 'Progress $1/$2 · Success $3 · Failed $4 · Pending $5',
    broadcast_continues_background: 'Sending continues in background... ($1 tabs left)',
    locate_upload: 'Locate Upload',
    locating_upload: 'Locating...',
    locate_upload_start: 'Locating upload entries in $1 tab(s)...',
    locate_upload_found: '$1 — Upload entry highlighted',
    locate_upload_not_found: '$1 — Upload entry not found',
    locate_upload_failed: '$1 — Locate failed: $2',
    locate_upload_failed_simple: 'Locate failed: $1',
    locate_upload_timed_out: 'Locate upload timed out',
    status_sent: '$1 — Sent',
    status_drafted: '$1 — Drafted',
    status_failed: '$1 — Failed: $2',
    status_failed_simple: 'Failed: $1',
    safe_mode_auto_send_blocked: 'Safe mode enabled: Auto Send was skipped.',
    unknown: 'Unknown',
    tab_n: 'Tab $1',
    paste_image: 'Paste Image',
    sending_image: 'Sending...',
    image_sending_to_n: 'Pasting image to $1 tab(s)...',
    image_sent: '$1 — Image pasted',
    image_failed: '$1 — Image failed: $2',
    image_failed_simple: 'Image paste failed: $1',
    image_too_large: 'Image too large (max 4MB)',
    remove_image: 'Remove',
  },
  zh_CN: {
    popup_title: 'Sendol',
    refresh: '刷新',
    active_sessions: '可用的 AI 页面',
    select_all: '全选',
    deselect_all: '取消全选',
    scanning_sessions: '正在扫描 AI 页面…',
    no_ai_tabs_detected: '未检测到 AI 标签页。',
    open_ai_tabs_hint: '请先打开 ChatGPT、Claude、Gemini 等页面。',
    message_placeholder: '输入要发送给各个 AI 的内容… (⌘/Ctrl+Enter 发送)',
    auto_send: '自动发送',
    new_chat: '新对话',
    safe_mode: '安全模式',
    send_to_n: '发送给 $1 个 AI',
    select_tabs_and_enter_message: '请选择目标 AI 页面并输入内容',
    select_tabs_first: '请先选择目标 AI 页面',
    broadcasting_to_n: '正在发送到 $1 个 AI…',
    broadcast_progress_line: '进度 $1/$2 · 成功 $3 · 失败 $4 · 等待中 $5',
    broadcast_continues_background: '发送正在后台继续…（剩余 $1 个页面）',
    locate_upload: '定位上传',
    locating_upload: '定位中…',
    locate_upload_start: '正在定位 $1 个页面的上传入口…',
    locate_upload_found: '$1 — 已高亮上传入口',
    locate_upload_not_found: '$1 — 未找到上传入口',
    locate_upload_failed: '$1 — 定位失败：$2',
    locate_upload_failed_simple: '定位失败：$1',
    locate_upload_timed_out: '定位上传入口超时',
    status_sent: '$1 — 已发送',
    status_drafted: '$1 — 已填入草稿箱',
    status_failed: '$1 — 发送失败：$2',
    status_failed_simple: '发送失败：$1',
    safe_mode_auto_send_blocked: '安全模式已开启：本次未执行自动发送。',
    unknown: '未知错误',
    tab_n: '标签页 $1',
    paste_image: '粘贴图片',
    sending_image: '发送中…',
    image_sending_to_n: '正在粘贴图片到 $1 个页面…',
    image_sent: '$1 — 图片已粘贴',
    image_failed: '$1 — 图片失败：$2',
    image_failed_simple: '图片粘贴失败：$1',
    image_too_large: '图片过大（最大 4MB）',
    remove_image: '移除',
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
