/* global chrome */
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, ArrowUp, Check, Zap, MessageSquarePlus } from 'lucide-react'
import { t } from '@/lib/i18n'
import {
  clearDraftFromStorage,
  getPopupBootstrapState,
  persistDraftToStorage as persistDraftToUnifiedStorage,
  readDraftFromLocalMirror,
  setPopupSettingsPatch,
  writeDraftToLocalMirror,
} from '@/lib/extension-storage'

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
  ChatGPT: "bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-300",
  Claude: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  Gemini: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  Grok: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  DeepSeek: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300",
  Mistral: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Doubao: "bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-300",
  Qianwen: "bg-violet-100 text-violet-700 dark:bg-violet-500/25 dark:text-violet-300",
  Yuanbao: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300",
  Kimi: "bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-300",
  Unknown: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
}

const HIDDEN_PLATFORMS = new Set(['Grok', 'Qianwen'])
const PRIMARY_PLATFORMS = ['ChatGPT', 'Gemini', 'Claude']
const PRIMARY_PLATFORM_SET = new Set(PRIMARY_PLATFORMS)
const PRIMARY_PLATFORM_PRIORITY = new Map(PRIMARY_PLATFORMS.map((name, index) => [name, index]))

function getTabSelectionKey(tab) {
  const platformName = String(tab?.platformName || '').trim()
  return platformName || null
}

function getPlatformPriority(name) {
  return PRIMARY_PLATFORM_PRIORITY.has(name) ? PRIMARY_PLATFORM_PRIORITY.get(name) : 999
}

function sortTabsByPriority(a, b) {
  const p = getPlatformPriority(a.platformName) - getPlatformPriority(b.platformName)
  if (p !== 0) return p
  return String(a.platformName || '').localeCompare(String(b.platformName || ''))
}

const SEND_LOADING_SOFT_TIMEOUT_MS = 25000
const DRAFT_SAVE_DEBOUNCE_MS = 400
const IMAGE_SUPPORTED_PLATFORMS = new Set(['ChatGPT', 'Claude'])
const CONTEXT_ERROR_PATTERNS = [
  'Extension context invalidated',
  'Could not establish connection. Receiving end does not exist.',
  'The message port closed before a response was received',
]

function isExtensionContextValid() {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime?.id)
  } catch {
    return false
  }
}

function isRuntimeContextError(error) {
  const message = String(error?.message || error || '')
  return CONTEXT_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

function closePopupSafely() {
  try {
    window.close()
  } catch {
    // noop
  }
  setTimeout(() => {
    try {
      window.close()
    } catch {
      // noop
    }
  }, 50)
}

export default function Popup() {
  const [aiTabs, setAiTabs] = useState([])
  const [selectedTabIds, setSelectedTabIds] = useState([])
  const [messageText, setMessageText] = useState('')
  const [autoSend, setAutoSend] = useState(false)
  const [newChat, setNewChat] = useState(false)
  const [popupSettingsReady, setPopupSettingsReady] = useState(false)
  const [statuses, setStatuses] = useState([])
  const [tabsLoading, setTabsLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [locatingUpload, setLocatingUpload] = useState(false)
  const [refreshSpinning, setRefreshSpinning] = useState(false)
  const [imageData, setImageData] = useState(null) // { base64, mimeType, preview }
  const [showImageConfirm, setShowImageConfirm] = useState(false)
  const messageInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const activeRequestIdRef = useRef(null)
  const draftHydratedRef = useRef(false)
  const draftSaveTimerRef = useRef(null)
  const latestMessageRef = useRef('')
  const latestProgressRef = useRef({ total: 0, completed: 0, ok: 0, fail: 0 })
  const savedSelectedPlatformsRef = useRef(null)
  const selectionHydratedRef = useRef(false)

  const selectedSet = new Set(selectedTabIds)
  const hasSelection = selectedTabIds.length > 0
  const hasText = messageText.trim().length > 0
  const hasImage = Boolean(imageData)
  const imageCapableTabIds = selectedTabIds.filter((id) => {
    const tab = aiTabs.find((item) => item.id === id)
    return tab && IMAGE_SUPPORTED_PLATFORMS.has(tab.platformName)
  })
  const anySelectedSupportImage = imageCapableTabIds.length > 0
  const imageEnabled = anySelectedSupportImage && !sending
  const sendDisabled = !(hasSelection && (hasText || hasImage)) || sending
  const locateUploadDisabled = !hasSelection || tabsLoading || sending || locatingUpload
  const selectAllLabel =
    aiTabs.length > 0 && selectedTabIds.length === aiTabs.length ? t('deselect_all') : t('select_all')

  const handleContextLoss = useCallback((error) => {
    if (!isRuntimeContextError(error) && isExtensionContextValid()) return false
    closePopupSafely()
    return true
  }, [])

  const persistDraftToStorage = useCallback(async (draftText) => {
    try {
      await persistDraftToUnifiedStorage(draftText)
    } catch (error) {
      if (!isRuntimeContextError(error) && isExtensionContextValid()) {
        console.warn('Draft storage sync failed:', error)
      }
    }
  }, [])

  const clearDraftEverywhere = useCallback(async () => {
    writeDraftToLocalMirror('')
    try {
      await clearDraftFromStorage()
    } catch (error) {
      if (!isRuntimeContextError(error) && isExtensionContextValid()) {
        console.warn('Draft clear failed:', error)
      }
    }
  }, [])

  // Load saved preferences + draft
  useEffect(() => {
    let cancelled = false
    const localDraft = readDraftFromLocalMirror()
    const hasLocalDraft = localDraft !== null
    if (hasLocalDraft) {
      latestMessageRef.current = localDraft
      setMessageText(localDraft)
    }

    ;(async () => {
      try {
        const { popupSettings, storageDraft } = await getPopupBootstrapState()
        if (cancelled) return
        setAutoSend(Boolean(popupSettings.autoSend))
        setNewChat(Boolean(popupSettings.newChat))
        savedSelectedPlatformsRef.current = Array.isArray(popupSettings.selectedPlatforms)
          ? popupSettings.selectedPlatforms
          : []

        if (!hasLocalDraft && storageDraft.length > 0) {
          latestMessageRef.current = storageDraft
          setMessageText(storageDraft)
          writeDraftToLocalMirror(storageDraft)
        }
      } catch (error) {
        if (cancelled) return
        if (!handleContextLoss(error)) {
          console.error('Error loading popup preferences:', error)
        }
      } finally {
        draftHydratedRef.current = true
        if (!cancelled) {
          setPopupSettingsReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [handleContextLoss])

  useEffect(() => {
    latestMessageRef.current = messageText
    if (!draftHydratedRef.current) return

    writeDraftToLocalMirror(messageText)
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current)
      draftSaveTimerRef.current = null
    }
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null
      void persistDraftToStorage(messageText)
    }, DRAFT_SAVE_DEBOUNCE_MS)

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
    }
  }, [messageText, persistDraftToStorage])

  useEffect(() => {
    const flushDraftNow = () => {
      if (!draftHydratedRef.current) return
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
      const latestDraft = latestMessageRef.current
      writeDraftToLocalMirror(latestDraft)
      void persistDraftToStorage(latestDraft)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDraftNow()
    }

    window.addEventListener('beforeunload', flushDraftNow)
    window.addEventListener('pagehide', flushDraftNow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', flushDraftNow)
      window.removeEventListener('pagehide', flushDraftNow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flushDraftNow()
    }
  }, [persistDraftToStorage])

  // When extension is uninstalled/disabled while popup is open, close popup to avoid orphaned blank frame
  useEffect(() => {
    const timerId = setInterval(() => {
      if (!isExtensionContextValid()) {
        clearInterval(timerId)
        closePopupSafely()
      }
    }, 500)
    return () => clearInterval(timerId)
  }, [])

  const loadTabs = useCallback(async () => {
    if (!isExtensionContextValid()) {
      setTabsLoading(false)
      closePopupSafely()
      return
    }
    setTabsLoading(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AI_TABS' })
      const tabs = (response.tabs || [])
        .filter((tab) => !HIDDEN_PLATFORMS.has(tab.platformName))
        .sort(sortTabsByPriority)
      setAiTabs(tabs)
      setSelectedTabIds((prev) => {
        if (!popupSettingsReady) {
          const currentTabIdSet = new Set(tabs.map((tab) => tab.id))
          return prev.filter((id) => currentTabIdSet.has(id))
        }

        const currentTabIdSet = new Set(tabs.map((tab) => tab.id))

        if (!selectionHydratedRef.current) {
          selectionHydratedRef.current = true

          const savedSelectedPlatforms = Array.isArray(savedSelectedPlatformsRef.current)
            ? savedSelectedPlatformsRef.current
            : []
          const savedSelectedPlatformSet = new Set(savedSelectedPlatforms)
          const restoredIds = tabs
            .filter((tab) => {
              const selectionKey = getTabSelectionKey(tab)
              return selectionKey ? savedSelectedPlatformSet.has(selectionKey) : false
            })
            .map((tab) => tab.id)

          if (restoredIds.length > 0) {
            return restoredIds
          }

          return tabs.map((tab) => tab.id)
        }

        const nextSelectedIds = prev.filter((id) => currentTabIdSet.has(id))
        if (nextSelectedIds.length > 0 || tabs.length === 0) {
          return nextSelectedIds
        }

        return tabs.map((tab) => tab.id)
      })
    } catch (error) {
      if (handleContextLoss(error)) return
      console.error('Error loading tabs:', error)
      setAiTabs([])
    } finally {
      setTabsLoading(false)
    }
  }, [handleContextLoss, popupSettingsReady])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
    loadTabs()
  }, [loadTabs])

  useEffect(() => {
    if (!popupSettingsReady || !selectionHydratedRef.current) return

    const selectedPlatforms = aiTabs
      .filter((tab) => selectedTabIds.includes(tab.id))
      .map((tab) => getTabSelectionKey(tab))
      .filter(Boolean)

    void setPopupSettingsPatch({ selectedPlatforms })
  }, [aiTabs, popupSettingsReady, selectedTabIds])

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

  const setProgressStatus = useCallback((completed, total, ok, fail, pending) => {
    setStatuses([{
      message: t('broadcast_progress_line', [String(completed), String(total), String(ok), String(fail), String(pending)]),
      type: 'pending',
    }])
  }, [])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return

    const handleProgress = (message) => {
      if (!message || message.type !== 'BROADCAST_PROGRESS') return false
      if (!activeRequestIdRef.current || message.requestId !== activeRequestIdRef.current) return false

      const total = Number(message.total) || 0
      const completed = Number(message.completed) || 0
      const ok = Number(message.successCount) || 0
      const fail = Number(message.failCount) || 0
      const pending = Number(message.pendingCount) || Math.max(0, total - completed)
      latestProgressRef.current = { total, completed, ok, fail }
      setProgressStatus(completed, total, ok, fail, pending)
      return false
    }

    chrome.runtime.onMessage.addListener(handleProgress)
    return () => chrome.runtime.onMessage.removeListener(handleProgress)
  }, [setProgressStatus])

  const handleLocateUpload = useCallback(async () => {
    if (selectedTabIds.length === 0 || locatingUpload || sending) return

    clearStatus()
    setLocatingUpload(true)
    const tabIds = [...selectedTabIds]
    const requestId = createRequestId()
    const clientTs = Date.now()
    addStatus(t('locate_upload_start', [String(tabIds.length)]), 'pending')

    let debug = false
    try {
      const runtimeFlags = await chrome.storage.local.get(['debugLogs'])
      debug = Boolean(runtimeFlags?.debugLogs)
    } catch (error) {
      if (handleContextLoss(error)) {
        setLocatingUpload(false)
        return
      }
      clearStatus()
      addStatus(t('locate_upload_failed_simple', [String(error?.message || t('unknown'))]), 'error')
      setLocatingUpload(false)
      return
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LOCATE_UPLOAD_ENTRIES',
        tabIds,
        requestId,
        clientTs,
        debug,
      })
      clearStatus()

      const results = Array.isArray(response?.results) ? response.results : []
      if (results.length === 0 && response?.error) {
        addStatus(t('locate_upload_failed_simple', [String(response.error)]), 'error')
      }

      results.forEach((result) => {
        const tabInfo = aiTabs.find((tab) => tab.id === result.tabId)
        const name = tabInfo ? tabInfo.platformName : t('tab_n', [String(result.tabId)])
        if (result.success && result.found) {
          addStatus(t('locate_upload_found', [name]), 'success')
          return
        }
        if (result.success) {
          addStatus(t('locate_upload_not_found', [name]), 'pending')
          return
        }
        addStatus(t('locate_upload_failed', [name, String(result.error || t('unknown'))]), 'error')
      })

      if (response?.summary?.timedOut) {
        addStatus(t('locate_upload_timed_out'), 'error')
      }
    } catch (error) {
      if (handleContextLoss(error)) return
      clearStatus()
      addStatus(t('locate_upload_failed_simple', [String(error?.message || t('unknown'))]), 'error')
    } finally {
      setLocatingUpload(false)
    }
  }, [selectedTabIds, locatingUpload, sending, clearStatus, addStatus, handleContextLoss, aiTabs])

  const handleImagePick = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      clearStatus()
      addStatus(t('image_too_large'), 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]
      setImageData({ base64, mimeType: file.type || 'image/png', preview: dataUrl })
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [clearStatus, addStatus])

  const handleRemoveImage = useCallback(() => {
    setImageData(null)
  }, [])

  const performSend = useCallback(async ({ bypassImageConfirm = false } = {}) => {
    const text = messageText.trim()
    const hasImage = Boolean(imageData)
    
    // Must have either text or image
    if (!text && !hasImage) return
    if (selectedTabIds.length === 0) return

    const prioritizedTabIds = [...selectedTabIds].sort((a, b) => {
      const tabA = aiTabs.find((item) => item.id === a)
      const tabB = aiTabs.find((item) => item.id === b)
      return sortTabsByPriority(tabA || { platformName: 'Unknown' }, tabB || { platformName: 'Unknown' })
    })

    const supportedImageTabIds = prioritizedTabIds.filter((id) => {
      const tab = aiTabs.find((item) => item.id === id)
      return tab && IMAGE_SUPPORTED_PLATFORMS.has(tab.platformName)
    })
    const unsupportedImageTabIds = prioritizedTabIds.filter((id) => !supportedImageTabIds.includes(id))

    if (hasImage && unsupportedImageTabIds.length > 0 && !bypassImageConfirm) {
      setShowImageConfirm(true)
      return
    }

    if (hasImage && supportedImageTabIds.length === 0 && !text) {
      clearStatus()
      addStatus(t('image_unsupported_platforms'), 'error')
      return
    }

    setShowImageConfirm(false)

    clearStatus()
    setSending(true)
    const tabIds = prioritizedTabIds
    const requestId = createRequestId()
    const clientTs = Date.now()
    let debug = false

    const finishWithResponse = (response) => {
      if (activeRequestIdRef.current !== requestId) return

      clearStatus()
      const results = response?.results || []
      const summary = response?.summary || {
        requestId,
        totalMs: 0,
        p95TabMs: 0,
        successCount: 0,
        failCount: 0,
      }
      const safety = summary?.safety || null
      let successCount = 0

      results.forEach((result) => {
        const tabInfo = aiTabs.find((t) => t.id === result.tabId)
        const name = tabInfo ? tabInfo.platformName : t('tab_n', [String(result.tabId)])
        if (result.success) {
          successCount++
          const msg = result.sent === true ? t('status_sent', [name]) : t('status_drafted', [name])
          addStatus(msg, 'success')
        } else {
          addStatus(t('status_failed', [name, String(result.error || t('unknown'))]), 'error')
        }
        const debugLine = String(result.debugLog || '')
        if (debugLine) {
          addStatus(`${name} 调试：${debugLine}`, 'pending')
        }
      })
      if (safety?.autoSendBlockedBySafeMode) {
        addStatus(t('safe_mode_auto_send_blocked'), 'pending')
      }

      const shouldClearDraft = results.length > 0 && (
        successCount === results.length ||
        (results.length >= 2 && successCount / results.length >= 0.5)
      )
      if (shouldClearDraft) {
        if (draftSaveTimerRef.current) {
          clearTimeout(draftSaveTimerRef.current)
          draftSaveTimerRef.current = null
        }
        latestMessageRef.current = ''
        setMessageText('')
        setImageData(null)
        void clearDraftEverywhere()
        if (messageInputRef.current) messageInputRef.current.value = ''
        if (newChat) {
          setTimeout(() => loadTabs(), 800)
        }
      }

      console.log(`[AIB][popup][${summary.requestId}] summary`, summary)
      activeRequestIdRef.current = null
      setSending(false)
    }

    const finishWithError = (err) => {
      if (activeRequestIdRef.current !== requestId) return
      clearStatus()
      addStatus(t('status_failed_simple', [String(err?.message || t('unknown'))]), 'error')
      activeRequestIdRef.current = null
      setSending(false)
      if (isRuntimeContextError(err) || !isExtensionContextValid()) {
        closePopupSafely()
      }
    }

    try {
      const runtimeFlags = await chrome.storage.local.get(['debugLogs'])
      debug = Boolean(runtimeFlags?.debugLogs)
    } catch (err) {
      setSending(false)
      if (handleContextLoss(err)) return
      addStatus(t('status_failed_simple', [String(err?.message || t('unknown'))]), 'error')
      return
    }

    activeRequestIdRef.current = requestId
    setProgressStatus(0, tabIds.length, 0, 0, tabIds.length)

    try {
      const responsePromise = (async () => {
        if (!hasImage) {
          return chrome.runtime.sendMessage({
            type: 'BROADCAST_MESSAGE',
            text,
            autoSend,
            newChat,
            tabIds,
            requestId,
            clientTs,
            debug,
          })
        }

        const responses = []

        if (supportedImageTabIds.length > 0) {
          const imageResponse = await chrome.runtime.sendMessage({
            type: 'BROADCAST_IMAGE',
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
            text,
            autoSend,
            tabIds: supportedImageTabIds,
            requestId,
            debug,
          })
          responses.push(imageResponse)
        }

        if (unsupportedImageTabIds.length > 0 && text) {
          const textResponse = await chrome.runtime.sendMessage({
            type: 'BROADCAST_MESSAGE',
            text,
            autoSend,
            newChat,
            tabIds: unsupportedImageTabIds,
            requestId,
            clientTs,
            debug,
          })
          responses.push(textResponse)
        }

        const mergedResults = responses.flatMap((item) => (Array.isArray(item?.results) ? item.results : []))
        return { results: mergedResults }
      })()
      const softTimeoutToken = Symbol('soft-timeout')
      const raced = await Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(() => resolve(softTimeoutToken), SEND_LOADING_SOFT_TIMEOUT_MS)),
      ])

      if (raced === softTimeoutToken) {
        if (activeRequestIdRef.current === requestId) {
          setSending(false)
          setStatuses([{
            message: t('broadcast_continues_background', [String(tabIds.length)]),
            type: 'pending',
          }])
          if (draftSaveTimerRef.current) {
            clearTimeout(draftSaveTimerRef.current)
            draftSaveTimerRef.current = null
          }
          latestMessageRef.current = ''
          setMessageText('')
          setImageData(null)
          void clearDraftEverywhere()
          if (messageInputRef.current) messageInputRef.current.value = ''
        }
        responsePromise.then(finishWithResponse).catch(finishWithError)
        return
      }

      finishWithResponse(raced)
    } catch (err) {
      finishWithError(err)
    }
  }, [messageText, imageData, selectedTabIds, autoSend, newChat, aiTabs, addStatus, clearStatus, loadTabs, setProgressStatus, handleContextLoss, clearDraftEverywhere])

  const handleSend = useCallback(() => {
    void performSend()
  }, [performSend])

  const handleConfirmSend = useCallback(() => {
    void performSend({ bypassImageConfirm: true })
  }, [performSend])

  const handleCancelSend = useCallback(() => {
    setShowImageConfirm(false)
  }, [])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (showImageConfirm) {
          handleConfirmSend()
          return
        }
        if (!sendDisabled) handleSend()
      }
    },
    [sendDisabled, handleSend, showImageConfirm, handleConfirmSend]
  )

  return (
    <div className="relative flex w-full h-full flex-col overflow-hidden bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-gray-100 font-sans">
      <div className="absolute inset-x-0 top-0 z-30">
        <header className="flex h-[60px] items-center justify-between border-b border-gray-200 bg-gray-50 px-5 dark:border-zinc-700/80 dark:bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] dark:bg-zinc-300 dark:text-zinc-900 [--logo-divider:#000] dark:[--logo-divider:theme(colors.zinc.300)]">
              <LogoIcon className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">{t('popup_title')}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            title={t('refresh')}
            aria-label={t('refresh')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
          >
            <RefreshCw className={`h-4 w-4 ${refreshSpinning ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="flex h-[44px] items-center justify-between bg-gray-50 px-5 dark:bg-zinc-950">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            {t('active_sessions')}
          </span>
          <button
            type="button"
            onClick={handleSelectAll}
            className="rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
          >
            {selectAllLabel}
          </button>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden">
        <div className="popup-scroll-area h-full space-y-3 overflow-y-auto px-4 pt-[114px] pb-[198px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-600">
          {tabsLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-8 text-sm text-gray-400 dark:text-zinc-500">
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-zinc-500 dark:border-t-transparent"
                aria-hidden
              />
              {t('scanning_sessions')}
            </div>
          ) : aiTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
              <span>{t('no_ai_tabs_detected')}</span>
              <span className="mt-1 text-xs opacity-70">{t('open_ai_tabs_hint')}</span>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {aiTabs.map((tab) => {
                const selected = selectedSet.has(tab.id)
                const platStyle = PLATFORM_STYLES[tab.platformName] || PLATFORM_STYLES.Unknown
                const isPrimary = PRIMARY_PLATFORM_SET.has(tab.platformName)

                return (
                  <li
                    key={tab.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTab(tab.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleTab(tab.id))}
                    className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 ${
                      selected
                        ? `bg-white shadow-sm ring-1 ${isPrimary ? 'ring-blue-300/80 dark:ring-blue-500/60' : 'ring-gray-200/90 dark:ring-zinc-600/55'} dark:bg-zinc-800`
                        : `border border-transparent ${isPrimary ? 'hover:bg-blue-50/70 dark:hover:bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50'}`
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

          {statuses.length > 0 && (
            <div className="space-y-1.5 px-1 pb-1">
              {statuses.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-gray-400 dark:text-zinc-500 animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      s.type === 'success' ? 'bg-emerald-500' : s.type === 'error' ? 'bg-red-500' : 'bg-gray-400 dark:bg-zinc-500'
                    } ${s.type === 'pending' || s.type === 'success' ? 'animate-pulse' : ''}`}
                  />
                  <span>{s.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-36 bg-gradient-to-t from-gray-50/98 via-gray-50/72 to-transparent dark:from-zinc-950/98 dark:via-zinc-950/72"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-4">
          <div className="pointer-events-auto rounded-2xl bg-zinc-50/92 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.3)] ring-1 ring-gray-200/95 backdrop-blur-xl transition-all focus-within:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.35)] dark:bg-zinc-700/70 dark:ring-zinc-500/70 dark:shadow-[0_10px_30px_-14px_rgba(0,0,0,0.65)] dark:focus-within:shadow-[0_14px_34px_-14px_rgba(0,0,0,0.7)]">
            <textarea
              ref={messageInputRef}
              className="min-h-[72px] w-full max-h-[160px] resize-none bg-transparent px-4 pt-3.5 text-[13px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-zinc-500"
              placeholder={t('message_placeholder')}
              rows={3}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const v = !autoSend
                    setAutoSend(v)
                    void setPopupSettingsPatch({ autoSend: v })
                  }}
                  title={t('auto_send')}
                  className={`flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 ${
                    autoSend
                      ? 'bg-zinc-200/80 text-zinc-900 px-2.5 py-1.5 dark:bg-zinc-700/80 dark:text-zinc-100'
                      : 'text-gray-500 hover:bg-gray-200/60 hover:text-gray-900 p-1.5 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  {autoSend && <span className="text-[11px] font-semibold">{t('auto_send')}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = !newChat
                    setNewChat(v)
                    void setPopupSettingsPatch({ newChat: v })
                  }}
                  title={t('new_chat')}
                  className={`flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 ${
                    newChat
                      ? 'bg-zinc-200/80 text-zinc-900 px-2.5 py-1.5 dark:bg-zinc-700/80 dark:text-zinc-100'
                      : 'text-gray-500 hover:bg-gray-200/60 hover:text-gray-900 p-1.5 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
                  }`}
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  {newChat && <span className="text-[11px] font-semibold">{t('new_chat')}</span>}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sendDisabled}
                  onClick={handleSend}
                  title={
                    hasSelection && hasText
                      ? t('send_to_n', [String(selectedTabIds.length)])
                      : t('select_tabs_and_enter_message')
                  }
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    !sendDisabled
                      ? 'bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)] hover:scale-105 hover:shadow-[0_4px_14px_rgba(0,0,0,0.35)] active:scale-95 dark:bg-white dark:text-black dark:shadow-[0_2px_8px_rgba(255,255,255,0.15)]'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-500'
                  }`}
                >
                  {sending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  ) : (
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
