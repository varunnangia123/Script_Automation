import { DEFAULT_SETTINGS, LOCAL_STORAGE_KEY, SEEN_JOBS_STORAGE_KEY } from "./config.js";

function readJson(key, fallback) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readSettings() {
  const savedSettings = readJson(LOCAL_STORAGE_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    keywords: Array.isArray(savedSettings.keywords) ? savedSettings.keywords : DEFAULT_SETTINGS.keywords,
    contractTerms: Array.isArray(savedSettings.contractTerms) ? savedSettings.contractTerms : DEFAULT_SETTINGS.contractTerms,
    intervalSeconds: Math.max(10, Number(savedSettings.intervalSeconds || DEFAULT_SETTINGS.intervalSeconds))
  };
}

export function saveSettings(settings) {
  writeJson(LOCAL_STORAGE_KEY, settings);
}

export function readSeenJobIds() {
  return new Set(readJson(SEEN_JOBS_STORAGE_KEY, []));
}

export function saveSeenJobIds(jobIds) {
  writeJson(SEEN_JOBS_STORAGE_KEY, [...jobIds]);
}

export function clearSeenJobIds() {
  window.localStorage.removeItem(SEEN_JOBS_STORAGE_KEY);
}