const form = document.querySelector("#settings-form");
const symbolInput = document.querySelector("#symbol-input");
const thresholdInput = document.querySelector("#threshold-input");
const intervalInput = document.querySelector("#interval-input");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const clearLogButton = document.querySelector("#clear-log-button");
const statusPill = document.querySelector("#status-pill");
const priceOutput = document.querySelector("#price-output");
const checkedOutput = document.querySelector("#checked-output");
const alertBanner = document.querySelector("#alert-banner");
const logOutput = document.querySelector("#log-output");
const sharePointForm = document.querySelector("#sharepoint-form");
const sharePointLinkInput = document.querySelector("#sharepoint-link-input");
const sharePointLoadButton = document.querySelector("#sharepoint-load-button");
const sharePointStatus = document.querySelector("#sharepoint-status");
const sharePointMessage = document.querySelector("#sharepoint-message");
const sharePointTable = document.querySelector("#sharepoint-table");

let timerId = null;
let activeConfig = null;

const DEFAULT_SYMBOLS = ["WTC.AX", "XRO.AX"];
const DEFAULT_CHECK_INTERVAL_SECONDS = 10;
const NO_KEY_PROXY_PREFIX = "https://r.jina.ai/http://";

intervalInput.min = String(DEFAULT_CHECK_INTERVAL_SECONDS);
if (Number(intervalInput.value) < DEFAULT_CHECK_INTERVAL_SECONDS) {
  intervalInput.value = String(DEFAULT_CHECK_INTERVAL_SECONDS);
}

function normaliseAsxSymbols(value) {
  const symbols = value
    .split(/[\s,]+/u)
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .map((symbol) => symbol.endsWith(".AX") ? symbol : `${symbol}.AX`);

  const uniqueSymbols = [...new Set(symbols)];
  return uniqueSymbols.length > 0 ? uniqueSymbols : DEFAULT_SYMBOLS;
}

function setStatus(text, state = "idle") {
  statusPill.textContent = text;
  statusPill.classList.toggle("running", state === "running");
  statusPill.classList.toggle("alerting", state === "alerting");
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function addLog(message) {
  const item = document.createElement("li");
  const time = document.createElement("span");
  const text = document.createElement("span");

  time.className = "log-time";
  time.textContent = formatTime();
  text.textContent = message;

  item.append(time, text);
  logOutput.prepend(item);

  while (logOutput.children.length > 80) {
    logOutput.lastElementChild.remove();
  }
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function yahooChartUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
}

function extractYahooChartPayload(text) {
  const marker = "Markdown Content:";
  const payloadText = text.includes(marker) ? text.split(marker)[1].trim() : text.trim();
  const jsonStart = payloadText.indexOf('{"chart"');

  if (jsonStart === -1) {
    throw new Error("No quote payload returned");
  }

  return JSON.parse(payloadText.slice(jsonStart));
}

function priceFromYahooChart(data) {
  const result = data?.chart?.result?.[0];
  const metaPrice = Number(result?.meta?.regularMarketPrice);

  if (Number.isFinite(metaPrice) && metaPrice > 0) {
    return metaPrice;
  }

  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  for (const closePrice of [...closes].reverse()) {
    const price = Number(closePrice);
    if (Number.isFinite(price)) {
      return price;
    }
  }

  throw new Error("No usable price returned");
}

async function getLatestPrice(symbol) {
  const text = await fetchText(`${NO_KEY_PROXY_PREFIX}${yahooChartUrl(symbol)}`);
  return priceFromYahooChart(extractYahooChartPayload(text));
}

async function getLatestPrices(symbols) {
  const prices = new Map();

  for (const symbol of symbols) {
    prices.set(symbol, await getLatestPrice(symbol));
  }

  return prices;
}

function sendPriceAlert(messages) {
  const message = messages.join(" | ");
  alertBanner.textContent = message;
  alertBanner.hidden = false;
  setStatus("Alert", "alerting");
  addLog(message);
}

async function checkPrice() {
  if (!activeConfig) {
    return;
  }

  const { symbols, threshold, aboveThresholdBySymbol } = activeConfig;

  try {
    const prices = await getLatestPrices(symbols);
    const checkedAt = formatTime();
    const priceLines = [];
    const newAlerts = [];
    const aboveNow = [];

    symbols.forEach((symbol, index) => {
      const price = prices.get(symbol);
      if (!Number.isFinite(price)) {
        addLog(`No price returned for ${symbol}`);
        return;
      }

      priceLines.push(`${symbol}: $${price.toFixed(2)}`);
      addLog(`${symbol}: $${price.toFixed(2)}`);

      if (price > threshold) {
        aboveNow.push(`${symbol} $${price.toFixed(2)}`);
        if (!aboveThresholdBySymbol.get(symbol)) {
          newAlerts.push(`${symbol} is $${price.toFixed(2)}, above $${threshold.toFixed(2)}`);
          aboveThresholdBySymbol.set(symbol, true);
        }
      } else {
        aboveThresholdBySymbol.set(symbol, false);
      }
    });

    priceOutput.textContent = priceLines.join(" | ") || "--";
    checkedOutput.textContent = checkedAt;

    if (newAlerts.length > 0) {
      sendPriceAlert(newAlerts);
    } else if (aboveNow.length > 0) {
      alertBanner.textContent = `Above threshold: ${aboveNow.join(" | ")}`;
      alertBanner.hidden = false;
      setStatus("Alert", "alerting");
    } else {
      alertBanner.hidden = true;
      setStatus("Running", "running");
    }
  } catch (error) {
    setStatus("Error");
    addLog(`Price check failed: ${error.message}`);
  }
}

async function startMonitor(event) {
  event.preventDefault();

  stopMonitor(false);

  const symbols = normaliseAsxSymbols(symbolInput.value);
  const threshold = Number(thresholdInput.value || 74);
  const intervalSeconds = Math.max(
    DEFAULT_CHECK_INTERVAL_SECONDS,
    Number(intervalInput.value || DEFAULT_CHECK_INTERVAL_SECONDS)
  );

  symbolInput.value = symbols.join(", ");
  intervalInput.value = intervalSeconds;
  activeConfig = {
    symbols,
    threshold,
    intervalSeconds,
    aboveThresholdBySymbol: new Map(symbols.map((symbol) => [symbol, false]))
  };

  startButton.disabled = true;
  stopButton.disabled = false;
  alertBanner.hidden = true;
  setStatus("Running", "running");

  addLog(`Started ${symbols.join(", ")}, above $${threshold.toFixed(2)}, every ${intervalSeconds}s`);
  await checkPrice();
  scheduleNextCheck();
}

function scheduleNextCheck() {
  if (!activeConfig) {
    return;
  }

  timerId = window.setTimeout(async () => {
    timerId = null;
    await checkPrice();
    scheduleNextCheck();
  }, activeConfig.intervalSeconds * 1000);
}

function setSharePointStatus(text, state = "idle") {
  sharePointStatus.textContent = text;
  sharePointStatus.classList.toggle("running", state === "running");
  sharePointStatus.classList.toggle("alerting", state === "error");
}

function setSharePointMessage(message, isError = false) {
  sharePointMessage.textContent = message;
  sharePointMessage.hidden = !message;
  sharePointMessage.classList.toggle("error", isError);
}

function buildSharePointRequestUrls(rawUrl) {
  const parsedUrl = new URL(rawUrl);
  const urls = [parsedUrl.href];
  const listId = parsedUrl.searchParams.get("List")?.replace(/[{}]/gu, "");
  const listsIndex = parsedUrl.pathname.toLowerCase().indexOf("/lists/");

  if (listsIndex !== -1) {
    const sitePath = parsedUrl.pathname.slice(0, listsIndex) || "/";
    const listPathParts = parsedUrl.pathname.slice(listsIndex).split("/").slice(0, 3);
    const listPath = `${sitePath}${listPathParts.join("/")}`.replace(/\/+/gu, "/");
    const encodedListPath = encodeURIComponent(`'${decodeURIComponent(listPath)}'`);
    urls.unshift(`${parsedUrl.origin}${sitePath}/_api/web/GetList(@listUrl)/items?$top=50&@listUrl=${encodedListPath}`);
  }

  if (listId) {
    const sitePath = listsIndex === -1 ? parsedUrl.pathname.split("/_layouts/")[0] || "/" : parsedUrl.pathname.slice(0, listsIndex);
    urls.unshift(`${parsedUrl.origin}${sitePath}/_api/web/lists(guid'${listId}')/items?$top=50`);
  }

  return [...new Set(urls)];
}

async function fetchSharePointRows(rawUrl) {
  const urls = buildSharePointRequestUrls(rawUrl);
  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json;odata=nometadata,text/csv,text/plain,*/*" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      return rowsFromResponse(text, contentType);
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(errors.at(-1) || "Could not read SharePoint list");
}

function rowsFromResponse(text, contentType) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return [];
  }

  if (contentType.includes("json") || trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
    const data = JSON.parse(trimmedText);
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data.value)) {
      return data.value;
    }
    if (Array.isArray(data.d?.results)) {
      return data.d.results;
    }
    return [data];
  }

  if (contentType.includes("csv") || trimmedText.includes(",")) {
    return rowsFromCsv(trimmedText);
  }

  throw new Error("No JSON or CSV list data returned");
}

function rowsFromCsv(text) {
  const lines = parseCsv(text);
  const headers = lines.shift() || [];
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((candidateRow) => candidateRow.some((cell) => cell.trim()));
}

function renderSharePointRows(rows) {
  sharePointTable.replaceChildren();

  if (rows.length === 0) {
    setSharePointMessage("No rows returned.");
    return;
  }

  const visibleRows = rows.slice(0, 25);
  const columns = [...new Set(visibleRows.flatMap((row) => Object.keys(row)))].slice(0, 8);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  columns.forEach((column) => {
    const header = document.createElement("th");
    header.textContent = column;
    headerRow.append(header);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  visibleRows.forEach((row) => {
    const tableRow = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      const value = row[column];
      cell.textContent = value === null || value === undefined ? "" : String(value);
      tableRow.append(cell);
    });
    tbody.append(tableRow);
  });

  sharePointTable.append(thead, tbody);
  setSharePointMessage(`Loaded ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
}

async function loadSharePointList(event) {
  event.preventDefault();
  const link = sharePointLinkInput.value.trim();

  if (!link) {
    setSharePointStatus("Error", "error");
    setSharePointMessage("Enter a SharePoint list link first.", true);
    return;
  }

  sharePointLoadButton.disabled = true;
  setSharePointStatus("Loading", "running");
  setSharePointMessage("");
  sharePointTable.replaceChildren();

  try {
    const rows = await fetchSharePointRows(link);
    renderSharePointRows(rows);
    setSharePointStatus("Loaded", "running");
  } catch (error) {
    setSharePointStatus("Error", "error");
    setSharePointMessage(
      `${error.message}. Protected SharePoint lists usually need Microsoft sign-in/OAuth or a JSON/CSV export link that allows browser access.`,
      true
    );
  } finally {
    sharePointLoadButton.disabled = false;
  }
}

function stopMonitor(writeLog = true) {
  if (timerId !== null) {
    window.clearTimeout(timerId);
    timerId = null;
  }

  activeConfig = null;
  startButton.disabled = false;
  stopButton.disabled = true;
  setStatus("Idle");

  if (writeLog) {
    addLog("Stopped");
  }
}

form.addEventListener("submit", startMonitor);
stopButton.addEventListener("click", () => stopMonitor(true));
clearLogButton.addEventListener("click", () => {
  logOutput.replaceChildren();
});
sharePointForm.addEventListener("submit", loadSharePointList);
