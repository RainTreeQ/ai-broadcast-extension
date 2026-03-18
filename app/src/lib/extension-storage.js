/* global chrome */

const STORAGE_SCHEMA_VERSION = 1;
const STORAGE_SCHEMA_VERSION_KEY = 'storageSchemaVersion';

const LEGACY_KEYS = {
  autoSend: 'autoSend',
  newChat: 'newChat',
  draft: 'popupDraft',
};

const STRUCTURED_KEYS = {
  popupSettings: 'popupSettingsV1',
  proTemplates: 'proTemplatesV1',
  proNotes: 'proNotesV1',
  proHistory: 'proHistoryV1',
  proRules: 'proRulesV1',
};

const DRAFT_LOCAL_STORAGE_KEY = 'popupDraftLocal';

const DEFAULT_POPUP_SETTINGS = {
  autoSend: false,
  newChat: false,
  selectedPlatforms: [],
};

const SCHEMA_KEYS = [
  STORAGE_SCHEMA_VERSION_KEY,
  STRUCTURED_KEYS.popupSettings,
  STRUCTURED_KEYS.proTemplates,
  STRUCTURED_KEYS.proNotes,
  STRUCTURED_KEYS.proHistory,
  STRUCTURED_KEYS.proRules,
  LEGACY_KEYS.autoSend,
  LEGACY_KEYS.newChat,
];

function hasChromeStorage() {
  try {
    return Boolean(typeof chrome !== 'undefined' && chrome.storage?.local);
  } catch {
    return false;
  }
}

async function storageGet(keys) {
  if (!hasChromeStorage()) return {};
  return chrome.storage.local.get(keys);
}

async function storageSet(patch) {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set(patch);
}

async function storageRemove(keys) {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.remove(keys);
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function coalesceBool(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function normalizeSelectedPlatforms(value) {
  if (!Array.isArray(value)) return [];

  const unique = new Set();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const next = item.trim();
    if (!next) continue;
    unique.add(next);
  }

  return [...unique];
}

function resolvePopupSettings(record = {}) {
  const structured = isObject(record[STRUCTURED_KEYS.popupSettings])
    ? record[STRUCTURED_KEYS.popupSettings]
    : {};

  return {
    autoSend: coalesceBool(
      readBool(structured.autoSend),
      readBool(record[LEGACY_KEYS.autoSend]),
      DEFAULT_POPUP_SETTINGS.autoSend
    ),
    newChat: coalesceBool(
      readBool(structured.newChat),
      readBool(record[LEGACY_KEYS.newChat]),
      DEFAULT_POPUP_SETTINGS.newChat
    ),
    selectedPlatforms: normalizeSelectedPlatforms(structured.selectedPlatforms),
  };
}

function popupSettingsEqual(a, b) {
  const aSelectedPlatforms = normalizeSelectedPlatforms(a?.selectedPlatforms);
  const bSelectedPlatforms = normalizeSelectedPlatforms(b?.selectedPlatforms);

  return (
    Boolean(a?.autoSend) === Boolean(b?.autoSend) &&
    Boolean(a?.newChat) === Boolean(b?.newChat) &&
    aSelectedPlatforms.length === bSelectedPlatforms.length &&
    aSelectedPlatforms.every((value, index) => value === bSelectedPlatforms[index])
  );
}

function normalizeDraft(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeCollection(value) {
  return Array.isArray(value) ? value : [];
}

function buildPopupSettingsPatch(current, patch = {}) {
  return {
    autoSend: typeof patch.autoSend === 'boolean' ? patch.autoSend : Boolean(current.autoSend),
    newChat: typeof patch.newChat === 'boolean' ? patch.newChat : Boolean(current.newChat),
    selectedPlatforms: Array.isArray(patch.selectedPlatforms)
      ? normalizeSelectedPlatforms(patch.selectedPlatforms)
      : normalizeSelectedPlatforms(current.selectedPlatforms),
  };
}

export async function ensureStorageSchema() {
  const data = await storageGet(SCHEMA_KEYS);
  const patch = {};

  const currentVersion = Number(data[STORAGE_SCHEMA_VERSION_KEY] || 0);
  if (!Number.isFinite(currentVersion) || currentVersion < STORAGE_SCHEMA_VERSION) {
    patch[STORAGE_SCHEMA_VERSION_KEY] = STORAGE_SCHEMA_VERSION;
  }

  const resolvedSettings = resolvePopupSettings(data);
  const existingSettings = isObject(data[STRUCTURED_KEYS.popupSettings])
    ? data[STRUCTURED_KEYS.popupSettings]
    : null;
  if (!existingSettings || !popupSettingsEqual(existingSettings, resolvedSettings)) {
    patch[STRUCTURED_KEYS.popupSettings] = resolvedSettings;
  }

  if (!Array.isArray(data[STRUCTURED_KEYS.proTemplates])) {
    patch[STRUCTURED_KEYS.proTemplates] = [];
  }
  if (!Array.isArray(data[STRUCTURED_KEYS.proNotes])) {
    patch[STRUCTURED_KEYS.proNotes] = [];
  }
  if (!Array.isArray(data[STRUCTURED_KEYS.proHistory])) {
    patch[STRUCTURED_KEYS.proHistory] = [];
  }
  if (!Array.isArray(data[STRUCTURED_KEYS.proRules])) {
    patch[STRUCTURED_KEYS.proRules] = [];
  }

  if (Object.keys(patch).length > 0) {
    await storageSet(patch);
  }
}

export async function getPopupBootstrapState() {
  await ensureStorageSchema();
  const data = await storageGet([
    STRUCTURED_KEYS.popupSettings,
    LEGACY_KEYS.autoSend,
    LEGACY_KEYS.newChat,
    LEGACY_KEYS.draft,
  ]);
  return {
    popupSettings: resolvePopupSettings(data),
    storageDraft: normalizeDraft(data[LEGACY_KEYS.draft]),
  };
}

export async function setPopupSettingsPatch(patch) {
  await ensureStorageSchema();
  const currentData = await storageGet([
    STRUCTURED_KEYS.popupSettings,
    LEGACY_KEYS.autoSend,
    LEGACY_KEYS.newChat,
  ]);
  const current = resolvePopupSettings(currentData);
  const next = buildPopupSettingsPatch(current, patch);

  await storageSet({
    [STRUCTURED_KEYS.popupSettings]: next,
    [LEGACY_KEYS.autoSend]: next.autoSend,
    [LEGACY_KEYS.newChat]: next.newChat,
  });

  return next;
}

export async function persistDraftToStorage(value) {
  await storageSet({ [LEGACY_KEYS.draft]: normalizeDraft(value) });
}

export async function clearDraftFromStorage() {
  await storageRemove(LEGACY_KEYS.draft);
}

export function readDraftFromLocalMirror() {
  try {
    if (!window.localStorage) return null;
    const value = window.localStorage.getItem(DRAFT_LOCAL_STORAGE_KEY);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function writeDraftToLocalMirror(value) {
  try {
    if (!window.localStorage) return;
    const next = normalizeDraft(value);
    if (next.length > 0) {
      window.localStorage.setItem(DRAFT_LOCAL_STORAGE_KEY, next);
    } else {
      window.localStorage.removeItem(DRAFT_LOCAL_STORAGE_KEY);
    }
  } catch {
    // noop
  }
}

export async function getProCollections() {
  await ensureStorageSchema();
  const data = await storageGet([
    STRUCTURED_KEYS.proTemplates,
    STRUCTURED_KEYS.proNotes,
    STRUCTURED_KEYS.proHistory,
    STRUCTURED_KEYS.proRules,
  ]);
  return {
    templates: normalizeCollection(data[STRUCTURED_KEYS.proTemplates]),
    notes: normalizeCollection(data[STRUCTURED_KEYS.proNotes]),
    history: normalizeCollection(data[STRUCTURED_KEYS.proHistory]),
    rules: normalizeCollection(data[STRUCTURED_KEYS.proRules]),
  };
}
