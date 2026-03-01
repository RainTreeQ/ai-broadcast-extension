// AI Broadcast - Popup Script

// When extension is uninstalled/disabled while popup is open, close popup to avoid orphaned blank frame
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  } catch (_) {
    return false;
  }
}
const extensionHeartbeat = setInterval(() => {
  if (!isExtensionContextValid()) {
    clearInterval(extensionHeartbeat);
    try {
      window.close();
    } catch (_) {}
  }
}, 500);

let aiTabs = [];
let selectedTabIds = new Set();
let debugLogs = false;

const tabsContainer = document.getElementById('tabsContainer');
const statusArea = document.getElementById('statusArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const autoSendCb = document.getElementById('autoSendCb');
const newChatCb = document.getElementById('newChatCb');
const selectAllBtn = document.getElementById('selectAllBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Send button icon
const sendIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const spinnerSVG = `<div class="spinner"></div>`;

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Load saved preferences
chrome.storage.local.get(['autoSend', 'newChat', 'debugLogs'], (data) => {
  if (data.autoSend) autoSendCb.checked = true;
  if (data.newChat) newChatCb.checked = true;
  debugLogs = Boolean(data.debugLogs);
});

// Toggle handlers
autoSendCb.addEventListener('change', () => {
  chrome.storage.local.set({ autoSend: autoSendCb.checked });
});

newChatCb.addEventListener('change', () => {
  chrome.storage.local.set({ newChat: newChatCb.checked });
});

function updateSendButton() {
  const hasSelection = selectedTabIds.size > 0;
  const hasText = messageInput.value.trim().length > 0;
  sendBtn.disabled = !(hasSelection && hasText);
  
  if (!sendBtn.disabled) {
    sendBtn.title = `Send to ${selectedTabIds.size} AI(s)`;
  } else {
    sendBtn.title = "Select tabs and enter message";
  }

  // Update select all button text
  if (aiTabs.length > 0 && selectedTabIds.size === aiTabs.length) {
    selectAllBtn.textContent = 'Deselect All';
  } else {
    selectAllBtn.textContent = 'Select All';
  }
}

messageInput.addEventListener('input', updateSendButton);

function renderTabs() {
  if (aiTabs.length === 0) {
    tabsContainer.innerHTML = `
      <div class="no-tabs">
        No AI tabs detected.<br>
        <small style="opacity:0.6; display:block; margin-top:4px;">Open ChatGPT, Claude, Gemini, etc.</small>
      </div>`;
    updateSendButton();
    return;
  }

  tabsContainer.innerHTML = '';
  aiTabs.forEach(tab => {
    const item = document.createElement('div');
    item.className = `tab-item ${selectedTabIds.has(tab.id) ? 'selected' : ''}`;
    
    item.innerHTML = `
      <div class="custom-checkbox">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <span class="tab-platform platform-${tab.platformName}">${tab.platformName}</span>
      <span class="tab-title" title="${tab.title || tab.url}">${tab.title || tab.url}</span>
    `;
    
    item.addEventListener('click', () => {
      const isSelected = selectedTabIds.has(tab.id);
      if (isSelected) {
        selectedTabIds.delete(tab.id);
        item.classList.remove('selected');
      } else {
        selectedTabIds.add(tab.id);
        item.classList.add('selected');
      }
      updateSendButton();
    });

    tabsContainer.appendChild(item);
  });
  
  updateSendButton();
}

async function loadTabs() {
  tabsContainer.innerHTML = '<div class="no-tabs"><div class="spinner" style="border-color:var(--text-muted); border-top-color:transparent; display:inline-block; margin-right:8px; width:12px; height:12px;"></div>Scanning...</div>';
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AI_TABS' });
    aiTabs = response.tabs || [];
    
    // Auto-select all found tabs initially, or clean up dead tabs
    if (aiTabs.length > 0 && selectedTabIds.size === 0) {
      aiTabs.forEach(t => selectedTabIds.add(t.id));
    } else {
      const tabIdSet = new Set(aiTabs.map(t => t.id));
      for (const id of selectedTabIds) {
        if (!tabIdSet.has(id)) selectedTabIds.delete(id);
      }
    }
    
    renderTabs();
  } catch (error) {
    tabsContainer.innerHTML = '<div class="no-tabs" style="color:var(--error)">Error loading tabs. Make sure extension is reloaded.</div>';
    console.error("Error loading tabs:", error);
  }
}

selectAllBtn.addEventListener('click', () => {
  if (selectedTabIds.size === aiTabs.length) {
    selectedTabIds.clear();
  } else {
    aiTabs.forEach(t => selectedTabIds.add(t.id));
  }
  renderTabs();
});

refreshBtn.addEventListener('click', () => {
  const icon = refreshBtn.querySelector('svg');
  icon.style.animation = 'spin 1s linear infinite';
  loadTabs().finally(() => { 
    setTimeout(() => { icon.style.animation = ''; }, 500);
  });
});

function addStatus(message, type = 'pending') {
  const item = document.createElement('div');
  item.className = `status-item ${type}`;
  item.innerHTML = `<div class="status-dot"></div><span>${message}</span>`;
  statusArea.appendChild(item);
  statusArea.scrollTop = statusArea.scrollHeight;
  return item;
}

function clearStatus() {
  statusArea.innerHTML = '';
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();
  if (!text || selectedTabIds.size === 0) return;

  clearStatus();
  sendBtn.disabled = true;
  sendBtn.innerHTML = spinnerSVG;

  const tabIds = [...selectedTabIds];
  const autoSend = autoSendCb.checked;
  const newChat = newChatCb.checked;
  const requestId = createRequestId();
  const clientTs = Date.now();
  const runtimeFlags = await chrome.storage.local.get(['debugLogs']);
  const debug = Boolean(runtimeFlags.debugLogs);
  debugLogs = debug;

  addStatus(`Broadcasting to ${tabIds.length} AI(s)...`, 'pending');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'BROADCAST_MESSAGE',
      text,
      autoSend,
      newChat,
      tabIds,
      requestId,
      clientTs,
      debug
    });

    clearStatus();
    const results = response.results || [];
    const summary = response.summary || {
      requestId,
      totalMs: 0,
      p95TabMs: 0,
      successCount: 0,
      failCount: 0
    };
    let successCount = 0;

    results.forEach(result => {
      const tabInfo = aiTabs.find(t => t.id === result.tabId);
      const name = tabInfo ? tabInfo.platformName : `Tab ${result.tabId}`;
      
      if (result.success) {
        successCount++;
        const msg = autoSend ? `${name} — Sent` : `${name} — Drafted`;
        addStatus(msg, 'success');
      } else {
        addStatus(`${name} — Failed: ${result.error || 'Unknown'}`, 'error');
      }
    });

    if (successCount === results.length && results.length > 0) {
      // Clear the input box on full success
      messageInput.value = '';
      setTimeout(() => { updateSendButton(); }, 1500);
      // 新建窗口后同步刷新会话列表标题
      if (newChat) {
        setTimeout(() => loadTabs(), 800);
      }
    } else {
      updateSendButton();
    }

    console.log(`[AIB][popup][${summary.requestId}] summary`, summary);
    if (debugLogs) {
      console.table(results.map((item) => ({
        tabId: item.tabId,
        platform: item.platform || 'Unknown',
        success: Boolean(item.success),
        stage: item.stage || 'done',
        strategy: item.strategy || 'n/a',
        fallbackUsed: Boolean(item.fallbackUsed),
        findInputMs: item.timings?.findInputMs ?? 0,
        injectMs: item.timings?.injectMs ?? 0,
        sendMs: item.timings?.sendMs ?? 0,
        totalMs: item.timings?.totalMs ?? 0,
        error: item.error || ''
      })));
    }

  } catch (err) {
    clearStatus();
    addStatus(`Failed: ${err.message}`, 'error');
    updateSendButton();
  } finally {
    sendBtn.innerHTML = sendIconSVG;
  }
});

// Handle Enter key (Ctrl+Enter to send)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (!sendBtn.disabled) sendBtn.click();
  }
});

// Initial load
loadTabs();
