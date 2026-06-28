const form = document.querySelector("#monitor-form");
const tenantInput = document.querySelector("#tenant-input");
const clientInput = document.querySelector("#client-input");
const listUrlInput = document.querySelector("#list-url-input");
const hostInput = document.querySelector("#host-input");
const sitePathInput = document.querySelector("#site-path-input");
const listInput = document.querySelector("#list-input");
const columnInput = document.querySelector("#column-input");
const valueInput = document.querySelector("#value-input");
const refreshInput = document.querySelector("#refresh-input");
const columnsInput = document.querySelector("#columns-input");
const signInButton = document.querySelector("#sign-in-button");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const statusOutput = document.querySelector("#status-output");
const matchCountOutput = document.querySelector("#match-count-output");
const lastCheckedOutput = document.querySelector("#last-checked-output");
const nextRefreshOutput = document.querySelector("#next-refresh-output");
const messageOutput = document.querySelector("#message-output");
const resultsTable = document.querySelector("#results-table");

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const MIN_REFRESH_SECONDS = 10;
const MAX_PAGES = 20;
const CONFIG_STORAGE_KEY = "sharepoint-list-monitor-config";
const GRAPH_SCOPES = ["Sites.Read.All"];

let msalClient = null;
let signedInAccount = null;
let activeConfig = null;
let refreshTimerId = null;
let countdownTimerId = null;
let nextRefreshAt = null;

refreshInput.min = String(MIN_REFRESH_SECONDS);

function setStatus(text, state = "idle") {
  statusOutput.textContent = text;
  statusOutput.dataset.state = state;
}

function setMessage(message, isError = false) {
  messageOutput.textContent = message;
  messageOutput.hidden = !message;
  messageOutput.classList.toggle("error", isError);
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function normaliseSitePath(path) {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return "";
  }

  return trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
}

function splitCsvInput(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanGuid(value) {
  return value.trim().replace(/[{}]/gu, "");
}

function isGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(cleanGuid(value));
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function parseSharePointListUrl(rawUrl) {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return null;
  }

  const markdownMatch = trimmedUrl.match(/\((https?:\/\/[^)]+)\)/iu);
  const sourceUrl = markdownMatch?.[1] || trimmedUrl;
  let parsedUrl;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error("Enter a valid SharePoint list URL.");
  }

  const segments = parsedUrl.pathname.split("/").filter(Boolean).map(decodePathSegment);
  const listsIndex = segments.findIndex((segment) => segment.toLocaleLowerCase() === "lists");
  const listId = parsedUrl.searchParams.get("List");

  if (listsIndex === -1 && !listId) {
    throw new Error("The SharePoint URL must include /Lists/<ListName>/ or a List query parameter.");
  }

  const siteSegments = listsIndex === -1 ? segments : segments.slice(0, listsIndex);
  const listSegment = listsIndex === -1 ? "" : segments[listsIndex + 1] || "";
  const list = listId ? cleanGuid(listId) : listSegment;

  if (!list) {
    throw new Error("The SharePoint URL does not include a list name or ID.");
  }

  return {
    host: parsedUrl.host,
    sitePath: siteSegments.length > 0 ? `/${siteSegments.join("/")}` : "/",
    list
  };
}

function sanitiseHost(value) {
  return value.trim().replace(/^https?:\/\//iu, "").replace(/\/.*$/u, "");
}

function applyListUrlParts(parts, overwrite = false) {
  if (!parts) {
    return;
  }

  if (overwrite || !hostInput.value.trim()) {
    hostInput.value = parts.host;
  }

  if (overwrite || !sitePathInput.value.trim()) {
    sitePathInput.value = parts.sitePath;
  }

  if (overwrite || !listInput.value.trim()) {
    listInput.value = parts.list;
  }
}

function getFormConfig({ ignoreListUrlErrors = false } = {}) {
  const refreshSeconds = Math.max(MIN_REFRESH_SECONDS, Number(refreshInput.value || MIN_REFRESH_SECONDS));
  const listUrl = listUrlInput.value.trim();
  let parsedListUrl = null;

  try {
    parsedListUrl = parseSharePointListUrl(listUrl);
  } catch (error) {
    if (!ignoreListUrlErrors) {
      throw error;
    }
  }

  return {
    listUrl,
    tenant: tenantInput.value.trim(),
    clientId: clientInput.value.trim(),
    host: sanitiseHost(hostInput.value) || parsedListUrl?.host || "",
    sitePath: normaliseSitePath(sitePathInput.value) || parsedListUrl?.sitePath || "",
    list: listInput.value.trim() || parsedListUrl?.list || "",
    column: columnInput.value.trim(),
    matchValue: valueInput.value.trim(),
    refreshSeconds,
    displayColumns: splitCsvInput(columnsInput.value)
  };
}

function validateAuthConfig(config) {
  const missingFields = [];

  if (!config.tenant) missingFields.push("tenant");
  if (!config.clientId) missingFields.push("client ID");

  if (missingFields.length > 0) {
    throw new Error(`Enter ${missingFields.join(", ")}.`);
  }

  if (!window.msal?.PublicClientApplication) {
    throw new Error("Microsoft authentication library did not load. Check your network connection and refresh the page.");
  }
}

function validateMonitorConfig(config) {
  const missingFields = [];

  if (!config.tenant) missingFields.push("tenant");
  if (!config.clientId) missingFields.push("client ID");
  if (!config.host) missingFields.push("SharePoint host");
  if (!config.sitePath) missingFields.push("site path");
  if (!config.list) missingFields.push("list name or ID");
  if (!config.column) missingFields.push("column internal name");
  if (!config.matchValue) missingFields.push("value to match");

  if (missingFields.length > 0) {
    throw new Error(`Enter ${missingFields.join(", ")}.`);
  }

  validateAuthConfig(config);
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function loadSavedConfig() {
  try {
    const savedConfig = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "null");
    if (!savedConfig) {
      return;
    }

    tenantInput.value = savedConfig.tenant || "";
    clientInput.value = savedConfig.clientId || "";
    listUrlInput.value = savedConfig.listUrl || "";
    hostInput.value = savedConfig.host || "";
    sitePathInput.value = savedConfig.sitePath || "";
    listInput.value = savedConfig.list || "";
    columnInput.value = savedConfig.column || "";
    valueInput.value = savedConfig.matchValue || "";
    refreshInput.value = savedConfig.refreshSeconds || MIN_REFRESH_SECONDS;
    columnsInput.value = (savedConfig.displayColumns || []).join(", ");
  } catch {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }
}

async function configureMsal(config) {
  if (msalClient && msalClient.getConfiguration().auth.clientId === config.clientId) {
    return msalClient;
  }

  msalClient = new window.msal.PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}`,
      redirectUri: window.location.origin + window.location.pathname
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false
    }
  });

  const redirectResponse = await msalClient.handleRedirectPromise();
  signedInAccount = redirectResponse?.account || msalClient.getAllAccounts()[0] || null;

  if (signedInAccount) {
    msalClient.setActiveAccount(signedInAccount);
    setStatus(`Signed in as ${signedInAccount.username}`, "connected");
  }

  return msalClient;
}

async function signIn(config = getFormConfig({ ignoreListUrlErrors: true })) {
  validateAuthConfig(config);
  saveConfig(config);

  const client = await configureMsal(config);
  signedInAccount = client.getActiveAccount() || client.getAllAccounts()[0] || null;

  if (!signedInAccount) {
    const loginResponse = await client.loginPopup({ scopes: GRAPH_SCOPES });
    signedInAccount = loginResponse.account;
    client.setActiveAccount(signedInAccount);
  }

  setStatus(`Signed in as ${signedInAccount.username}`, "connected");
  return signedInAccount;
}

async function getAccessToken(config) {
  const client = await configureMsal(config);
  let account = signedInAccount || client.getActiveAccount() || client.getAllAccounts()[0];

  if (!account) {
    await signIn(config);
    account = signedInAccount || client.getActiveAccount();
  }

  try {
    const tokenResponse = await client.acquireTokenSilent({
      account,
      scopes: GRAPH_SCOPES
    });
    return tokenResponse.accessToken;
  } catch (error) {
    if (error instanceof window.msal.InteractionRequiredAuthError) {
      const tokenResponse = await client.acquireTokenPopup({ scopes: GRAPH_SCOPES });
      signedInAccount = tokenResponse.account;
      client.setActiveAccount(signedInAccount);
      return tokenResponse.accessToken;
    }

    throw error;
  }
}

async function graphGet(url, token) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly"
    }
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.error?.message || "";
    } catch {
      detail = await response.text();
    }

    throw new Error(`Graph request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  return response.json();
}

async function resolveSite(config, token) {
  const sitePath = encodeURI(config.sitePath).replace(/#/gu, "%23");
  return graphGet(`${GRAPH_ROOT}/sites/${config.host}:${sitePath}?$select=id,displayName,webUrl`, token);
}

async function resolveList(config, siteId, token) {
  if (isGuid(config.list)) {
    return graphGet(`${GRAPH_ROOT}/sites/${siteId}/lists/${cleanGuid(config.list)}?$select=id,displayName,webUrl`, token);
  }

  const data = await graphGet(`${GRAPH_ROOT}/sites/${siteId}/lists?$select=id,displayName,name,webUrl&$top=200`, token);
  const exactMatch = data.value?.find((list) => listNameMatches(list, config.list));

  if (!exactMatch) {
    throw new Error(`No list named "${config.list}" was found on this site.`);
  }

  return exactMatch;
}

function normaliseListName(value) {
  return decodePathSegment(String(value || "")).trim().toLocaleLowerCase();
}

function listUrlName(webUrl) {
  if (!webUrl) {
    return "";
  }

  try {
    const segments = new URL(webUrl).pathname.split("/").filter(Boolean).map(decodePathSegment);
    const listsIndex = segments.findIndex((segment) => segment.toLocaleLowerCase() === "lists");
    return listsIndex === -1 ? "" : segments[listsIndex + 1] || "";
  } catch {
    return "";
  }
}

function listNameMatches(list, configuredList) {
  const expected = normaliseListName(configuredList);
  return [list.displayName, list.name, listUrlName(list.webUrl)].some((candidate) => normaliseListName(candidate) === expected);
}

async function fetchListItems(siteId, listId, token) {
  let url = `${GRAPH_ROOT}/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`;
  const items = [];
  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
    const data = await graphGet(url, token);
    items.push(...(data.value || []));
    url = data["@odata.nextLink"] || "";
    pageCount += 1;
  }

  if (url) {
    setMessage(`Loaded the first ${items.length} list items. Narrow the list or index the monitored column if more rows are needed.`);
  }

  return items;
}

function normaliseFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map(normaliseFieldValue).join(", ");
  }

  if (value && typeof value === "object") {
    return Object.values(value).map(normaliseFieldValue).join(", ");
  }

  return value === null || value === undefined ? "" : String(value);
}

function rowMatches(fields, config) {
  const candidateValue = normaliseFieldValue(fields[config.column]).trim().toLocaleLowerCase();
  return candidateValue === config.matchValue.trim().toLocaleLowerCase();
}

function chooseDisplayColumns(rows, preferredColumns) {
  if (preferredColumns.length > 0) {
    return preferredColumns;
  }

  const columns = [];
  const hiddenPrefixes = ["_", "ContentType", "Edit", "LinkTitle", "ItemChildCount", "FolderChildCount"];

  rows.forEach((row) => {
    Object.keys(row.fields || {}).forEach((column) => {
      if (columns.includes(column) || hiddenPrefixes.some((prefix) => column.startsWith(prefix))) {
        return;
      }

      columns.push(column);
    });
  });

  return columns.slice(0, 10);
}

function renderRows(rows, config) {
  resultsTable.replaceChildren();
  matchCountOutput.textContent = String(rows.length);

  if (rows.length === 0) {
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const header = document.createElement("th");
    header.textContent = config.column;
    headerRow.append(header);
    thead.append(headerRow);

    const tbody = document.createElement("tbody");
    const bodyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = `No rows currently match "${config.matchValue}".`;
    bodyRow.append(cell);
    tbody.append(bodyRow);
    resultsTable.append(thead, tbody);
    return;
  }

  const columns = chooseDisplayColumns(rows, config.displayColumns);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  columns.forEach((column) => {
    const header = document.createElement("th");
    header.textContent = column;
    headerRow.append(header);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    columns.forEach((column) => {
      const cell = document.createElement("td");
      cell.textContent = normaliseFieldValue(row.fields?.[column]);
      tableRow.append(cell);
    });

    tbody.append(tableRow);
  });

  resultsTable.append(thead, tbody);
}

function updateCountdown() {
  if (!nextRefreshAt) {
    nextRefreshOutput.textContent = "--";
    return;
  }

  const secondsRemaining = Math.max(0, Math.ceil((nextRefreshAt.getTime() - Date.now()) / 1000));
  nextRefreshOutput.textContent = secondsRemaining === 0 ? "Now" : `${secondsRemaining}s`;
}

function clearTimers() {
  if (refreshTimerId !== null) {
    window.clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }

  if (countdownTimerId !== null) {
    window.clearInterval(countdownTimerId);
    countdownTimerId = null;
  }

  nextRefreshAt = null;
  updateCountdown();
}

function scheduleNextRefresh() {
  if (!activeConfig) {
    return;
  }

  if (countdownTimerId !== null) {
    window.clearInterval(countdownTimerId);
  }

  nextRefreshAt = new Date(Date.now() + activeConfig.refreshSeconds * 1000);
  updateCountdown();
  countdownTimerId = window.setInterval(updateCountdown, 1000);

  refreshTimerId = window.setTimeout(async () => {
    if (countdownTimerId !== null) {
      window.clearInterval(countdownTimerId);
      countdownTimerId = null;
    }

    refreshTimerId = null;
    await refreshRows();
  }, activeConfig.refreshSeconds * 1000);
}

async function refreshRows() {
  if (!activeConfig) {
    return;
  }

  try {
    setStatus("Refreshing", "running");
    const token = await getAccessToken(activeConfig);
    const site = await resolveSite(activeConfig, token);
    const list = await resolveList(activeConfig, site.id, token);
    const items = await fetchListItems(site.id, list.id, token);
    const matchingRows = items.filter((item) => rowMatches(item.fields || {}, activeConfig));

    renderRows(matchingRows, activeConfig);
    lastCheckedOutput.textContent = formatTime();
    setStatus("Monitoring", "running");
    setMessage(`Checked ${items.length} item${items.length === 1 ? "" : "s"} in ${list.displayName}.`);
    scheduleNextRefresh();
  } catch (error) {
    setStatus("Error", "error");
    setMessage(error.message, true);
    stopMonitor(false);
  }
}

async function startMonitor(event) {
  event.preventDefault();

  try {
    const config = getFormConfig();
    validateMonitorConfig(config);
    saveConfig(config);
    clearTimers();
    activeConfig = config;
    refreshInput.value = String(config.refreshSeconds);

    startButton.disabled = true;
    stopButton.disabled = false;
    setMessage("");
    await signIn(config);
    await refreshRows();
  } catch (error) {
    setStatus("Error", "error");
    setMessage(error.message, true);
    startButton.disabled = false;
    stopButton.disabled = true;
    activeConfig = null;
    clearTimers();
  }
}

function stopMonitor(showMessage = true) {
  clearTimers();
  activeConfig = null;
  startButton.disabled = false;
  stopButton.disabled = true;

  if (showMessage) {
    setStatus(signedInAccount ? "Signed in" : "Stopped", signedInAccount ? "connected" : "idle");
    setMessage("Monitor stopped.");
  }
}

async function handleSignInClick() {
  try {
    const config = getFormConfig({ ignoreListUrlErrors: true });
    await signIn(config);
    setMessage("Signed in. Start the monitor when ready.");
  } catch (error) {
    setStatus("Error", "error");
    setMessage(error.message, true);
  }
}

function handleListUrlChange() {
  try {
    const parts = parseSharePointListUrl(listUrlInput.value);
    applyListUrlParts(parts, true);

    if (parts) {
      setMessage(`Detected ${parts.host}${parts.sitePath}, list ${parts.list}.`);
    }
  } catch (error) {
    setStatus("Check URL", "error");
    setMessage(error.message, true);
  }
}

loadSavedConfig();
form.addEventListener("submit", startMonitor);
signInButton.addEventListener("click", handleSignInClick);
listUrlInput.addEventListener("change", handleListUrlChange);
stopButton.addEventListener("click", () => stopMonitor(true));
