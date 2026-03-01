/* global chrome */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { RefreshCw, Send, Check } from 'lucide-react'

/** Logo: 圆形竖着分三份 — 圆 + 两条竖线 */
function LogoIcon({ className }) {
  const cx = 12
  const cy = 12
  const r = 10
  const xLeft = cx - r / 3
  const xRight = cx + r / 3
  const dy = Math.sqrt(r * r - (r / 3) ** 2)
  const yTop = cy - dy
  const yBottom = cy + dy
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
      <line x1={xLeft} y1={yTop} x2={xLeft} y2={yBottom} stroke="var(--logo-divider, #000)" />
      <line x1={xRight} y1={yTop} x2={xRight} y2={yBottom} stroke="var(--logo-divider, #000)" />
    </svg>
  )
}

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const PLATFORM_STYLES = {
  ChatGPT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  Claude: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  Gemini: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  Grok: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  DeepSeek: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  Copilot: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
  Mistral: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Unknown: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
}

export default function Popup() {
  const [aiTabs, setAiTabs] = useState([])
  const [selectedTabIds, setSelectedTabIds] = useState([])
  const [messageText, setMessageText] = useState('')
  const [autoSend, setAutoSend] = useState(false)
  const [newChat, setNewChat] = useState(false)
  const [statuses, setStatuses] = useState([])
  const [tabsLoading, setTabsLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [refreshSpinning, setRefreshSpinning] = useState(false)
  const messageInputRef = useRef(null)

  const selectedSet = new Set(selectedTabIds)
  const hasSelection = selectedTabIds.length > 0
  const hasText = messageText.trim().length > 0
  const sendDisabled = !(hasSelection && hasText) || sending
  const selectAllLabel = aiTabs.length > 0 && selectedTabIds.length === aiTabs.length ? 'Deselect All' : 'Select All'

  // Load saved preferences
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    chrome.storage.local.get(['autoSend', 'newChat'], (data) => {
      if (data.autoSend) setAutoSend(true)
      if (data.newChat) setNewChat(true)
    })
  }, [])

  // When extension is uninstalled/disabled while popup is open, close popup to avoid orphaned blank frame
  useEffect(() => {
    function isExtensionContextValid() {
      try {
        return typeof chrome !== 'undefined' && chrome.runtime?.id
      } catch (_) {
        return false
      }
    }
    const t = setInterval(() => {
      if (!isExtensionContextValid()) {
        clearInterval(t)
        try {
          window.close()
        } catch (_) {}
      }
    }, 500)
    return () => clearInterval(t)
  }, [])

  const loadTabs = useCallback(async () => {
    setTabsLoading(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AI_TABS' })
      const tabs = response.tabs || []
      setAiTabs(tabs)
      setSelectedTabIds((prev) => {
        if (tabs.length > 0 && prev.length === 0) return tabs.map((t) => t.id)
        const tabIdSet = new Set(tabs.map((t) => t.id))
        return prev.filter((id) => tabIdSet.has(id))
      })
    } catch (error) {
      console.error('Error loading tabs:', error)
      setAiTabs([])
    } finally {
      setTabsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
    loadTabs()
  }, [loadTabs])

  const handleRefresh = useCallback(() => {
    setRefreshSpinning(true)
    loadTabs().finally(() => setTimeout(() => setRefreshSpinning(false), 500))
  }, [loadTabs])

  const toggleTab = useCallback((tabId) => {
    setSelectedTabIds((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedTabIds.length === aiTabs.length) {
      setSelectedTabIds([])
    } else {
      setSelectedTabIds(aiTabs.map((t) => t.id))
    }
  }, [aiTabs, selectedTabIds.length])

  const addStatus = useCallback((message, type = 'pending') => {
    setStatuses((s) => [...s, { message, type }])
  }, [])

  const clearStatus = useCallback(() => setStatuses([]), [])

  const handleSend = useCallback(async () => {
    const text = messageText.trim()
    if (!text || selectedTabIds.length === 0) return

    clearStatus()
    setSending(true)
    const tabIds = [...selectedTabIds]
    const requestId = createRequestId()
    const clientTs = Date.now()
    const runtimeFlags = await chrome.storage.local.get(['debugLogs'])
    const debug = Boolean(runtimeFlags?.debugLogs)

    addStatus(`Broadcasting to ${tabIds.length} AI(s)...`, 'pending')

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BROADCAST_MESSAGE',
        text,
        autoSend,
        newChat,
        tabIds,
        requestId,
        clientTs,
        debug,
      })

      clearStatus()
      const results = response.results || []
      const summary = response.summary || {
        requestId,
        totalMs: 0,
        p95TabMs: 0,
        successCount: 0,
        failCount: 0,
      }
      let successCount = 0

      results.forEach((result) => {
        const tabInfo = aiTabs.find((t) => t.id === result.tabId)
        const name = tabInfo ? tabInfo.platformName : `Tab ${result.tabId}`
        if (result.success) {
          successCount++
          const msg = autoSend ? `${name} — Sent` : `${name} — Drafted`
          addStatus(msg, 'success')
        } else {
          addStatus(`${name} — Failed: ${result.error || 'Unknown'}`, 'error')
        }
      })

      if (successCount === results.length && results.length > 0) {
        setMessageText('')
        if (messageInputRef.current) messageInputRef.current.value = ''
        // 新建窗口后同步刷新会话列表标题（给新页面一点时间更新 DOM 标题）
        if (newChat) {
          setTimeout(() => loadTabs(), 800)
        }
      }

      console.log(`[AIB][popup][${summary.requestId}] summary`, summary)
    } catch (err) {
      clearStatus()
      addStatus(`Failed: ${err.message}`, 'error')
    } finally {
      setSending(false)
    }
  }, [messageText, selectedTabIds, autoSend, newChat, aiTabs, addStatus, clearStatus, loadTabs])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (!sendDisabled) handleSend()
      }
    },
    [sendDisabled, handleSend]
  )

  return (
    <div className="flex min-h-[520px] w-[380px] flex-col overflow-x-hidden bg-gray-50 text-gray-900 dark:bg-zinc-900 dark:text-gray-100 font-sans">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200/50 bg-white/80 px-5 py-4 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-900/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] dark:bg-zinc-300 dark:text-zinc-900 [--logo-divider:#000] dark:[--logo-divider:theme(colors.zinc.300)]">
            <LogoIcon className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Broadcast</span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          title="Refresh"
          aria-label="Refresh"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
        >
          <RefreshCw className={`h-4 w-4 ${refreshSpinning ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          Active Sessions
        </span>
        <button
          type="button"
          onClick={handleSelectAll}
          className="rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
        >
          {selectAllLabel}
        </button>
      </div>

      <div className="max-h-[190px] space-y-1.5 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700">
        {tabsLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-8 text-sm text-gray-400 dark:text-zinc-500">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-zinc-500 dark:border-t-transparent"
              aria-hidden
            />
            Scanning sessions...
          </div>
        ) : aiTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
            <span>No AI tabs detected.</span>
            <span className="mt-1 text-xs opacity-70">Open ChatGPT, Claude, Gemini, etc.</span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {aiTabs.map((tab) => {
              const selected = selectedSet.has(tab.id)
              const platStyle = PLATFORM_STYLES[tab.platformName] || PLATFORM_STYLES.Unknown
              
              return (
                <li
                  key={tab.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTab(tab.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleTab(tab.id))}
                  className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 ${
                    selected 
                      ? 'bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10' 
                      : 'border border-transparent hover:bg-gray-100 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    selected 
                      ? 'bg-black text-white dark:bg-white dark:text-black' 
                      : 'border border-gray-300 group-hover:border-gray-400 dark:border-zinc-600 dark:group-hover:border-zinc-500'
                  }`}>
                    {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </div>
                  
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${platStyle}`}
                  >
                    {tab.platformName}
                  </span>
                  
                  <span
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-700 dark:text-gray-300"
                    title={tab.title || tab.url}
                  >
                    {tab.title || tab.url}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="max-h-20 space-y-1.5 overflow-y-auto px-5 pb-4">
        {statuses.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-[11px] font-medium tracking-wide animate-in fade-in slide-in-from-bottom-1 duration-300 ${
              s.type === 'success' ? 'text-emerald-500' : s.type === 'error' ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${s.type === 'pending' || s.type === 'success' ? 'animate-pulse' : ''}`}
            />
            <span>{s.message}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto bg-white px-4 py-4 dark:bg-zinc-900">
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] ring-1 ring-gray-100 transition-all focus-within:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] dark:bg-zinc-800 dark:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)] dark:ring-zinc-700/50 dark:focus-within:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
          <textarea
            ref={messageInputRef}
            className="min-h-[72px] w-full max-h-[160px] resize-none bg-transparent px-4 pt-3.5 text-[13px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-zinc-500"
            placeholder="Message AI Agents... (Ctrl+Enter to send)"
            rows={3}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                <Switch checked={autoSend} onCheckedChange={(v) => { setAutoSend(v); chrome.storage?.local?.set({ autoSend: v }); }} />
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Auto Send</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                <Switch checked={newChat} onCheckedChange={(v) => { setNewChat(v); chrome.storage?.local?.set({ newChat: v }); }} />
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">New Chat</span>
              </label>
            </div>
            <button
              type="button"
              disabled={sendDisabled}
              onClick={handleSend}
              title={hasSelection && hasText ? `Send to ${selectedTabIds.length} AI(s)` : 'Select tabs and enter message'}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                !sendDisabled 
                  ? 'bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)] hover:scale-105 hover:shadow-[0_4px_14px_rgba(0,0,0,0.35)] active:scale-95 dark:bg-white dark:text-black dark:shadow-[0_2px_8px_rgba(255,255,255,0.15)]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600'
              }`}
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
