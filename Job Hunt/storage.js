import { CONTRACT_CONDITIONS, DEFAULT_SETTINGS, LOCAL_STORAGE_KEY, ROLE_CONDITIONS, SEEN_JOBS_STORAGE_KEY } from "./config.js";

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

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function validSelectedIds(savedIds, conditions, fallbackIds) {
  const validIds = new Set(conditions.map((condition) => condition.id));

  if (!Array.isArray(savedIds)) {
    return fallbackIds;
  }

  return savedIds.filter((id) => validIds.has(id));
}

function selectedConditions(conditions, selectedIds) {
  const selected = new Set(selectedIds);
  return conditions.filter((condition) => selected.has(condition.id));
}

export function normalizeSettings(settings = {}) {
  const selectedRoleIds = validSelectedIds(settings.selectedRoleIds, ROLE_CONDITIONS, DEFAULT_SETTINGS.selectedRoleIds);
  const selectedContractIds = validSelectedIds(settings.selectedContractIds, CONTRACT_CONDITIONS, DEFAULT_SETTINGS.selectedContractIds);
  const roleConditions = selectedConditions(ROLE_CONDITIONS, selectedRoleIds);
  const contractConditions = selectedConditions(CONTRACT_CONDITIONS, selectedContractIds);

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    selectedRoleIds,
    selectedContractIds,
    roleLabels: roleConditions.map((condition) => condition.label),
    contractLabels: contractConditions.map((condition) => condition.label),
    keywords: uniqueValues(roleConditions.flatMap((condition) => condition.terms)),
    contractTerms: uniqueValues(contractConditions.flatMap((condition) => condition.terms)),
    intervalSeconds: Math.max(10, Number(settings.intervalSeconds || DEFAULT_SETTINGS.intervalSeconds)),
    location: String(settings.location || DEFAULT_SETTINGS.location),
    sourceEndpoint: String(settings.sourceEndpoint || "")
  };
}

export function readSettings() {
  const savedSettings = readJson(LOCAL_STORAGE_KEY, {});
  return normalizeSettings(savedSettings);
}

export function saveSettings(settings) {
  const normalizedSettings = normalizeSettings(settings);
  writeJson(LOCAL_STORAGE_KEY, {
    selectedRoleIds: normalizedSettings.selectedRoleIds,
    selectedContractIds: normalizedSettings.selectedContractIds,
    location: normalizedSettings.location,
    intervalSeconds: normalizedSettings.intervalSeconds,
    sourceEndpoint: normalizedSettings.sourceEndpoint
  });
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