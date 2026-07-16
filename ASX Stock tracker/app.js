import { CHECK_INTERVAL_SECONDS, MAX_LOG_ENTRIES, WATCHLIST } from "./config.js?v=20260716-8";
import { fetchQuotes } from "./quote-service.js?v=20260716-8";

const stockGrid = document.querySelector("#stock-grid");
const alertList = document.querySelector("#alert-list");
const streamLog = document.querySelector("#stream-log");
const runStatus = document.querySelector("#run-status");
const lastReadOutput = document.querySelector("#last-read-output");
const stockChecklist = document.querySelector("#stock-checklist");
const stockChecklistSummary = document.querySelector("#stock-checklist-summary");
const alertCount = document.querySelector("#alert-count");

const tileBySymbol = new Map();
const alertBySymbol = new Map();
const quoteState = new Map();
const MAX_SELECTED_ALERTS = 4;
const alertRules = [];

let cycleTimerId = null;
let cycleNumber = 0;
let isReading = false;

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stockNameForSymbol(symbol) {
  return WATCHLIST.find((stock) => stock.symbol === symbol)?.name ?? symbol;
}

function ruleForSymbol(symbol) {
  return alertRules.find((rule) => rule.symbol === symbol);
}

function isValidThreshold(value) {
  return Number.isFinite(value) && value > 0;
}

function thresholdInputId(symbol) {
  return `threshold-${symbol.replace(/[^a-z0-9]/gi, "-")}`;
}

function setAlertStatus(row, status, label) {
  const state = row.querySelector(".alert-state");

  state.dataset.status = status;
  state.textContent = "";
  state.setAttribute("aria-label", label);
  state.title = label;
}

function thresholdProgress(price, threshold) {
  if (!Number.isFinite(price) || !Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  return clamp((price / threshold) * 100, 0, 100);
}

function formatThresholdGap(price, threshold) {
  if (!Number.isFinite(price) || !Number.isFinite(threshold)) {
    return "Waiting";
  }

  const gap = price - threshold;
  return gap >= 0 ? `${formatPrice(gap)} over` : `${formatPrice(Math.abs(gap))} away`;
}

function formatThresholdPercent(price, threshold) {
  if (!Number.isFinite(price) || !Number.isFinite(threshold) || threshold <= 0) {
    return "--";
  }

  const gapPercent = ((price - threshold) / threshold) * 100;
  return `${Math.abs(gapPercent).toFixed(1)}% ${gapPercent >= 0 ? "over" : "away"}`;
}

function setRunStatus(text, state = "idle") {
  runStatus.textContent = text;
  runStatus.dataset.state = state;
}

function addStream(message, state = "info") {
  const item = document.createElement("li");
  const time = document.createElement("span");
  const text = document.createElement("span");

  item.dataset.state = state;
  time.className = "stream-time";
  time.textContent = formatTime();
  text.textContent = message;

  item.append(time, text);
  streamLog.prepend(item);

  while (streamLog.children.length > MAX_LOG_ENTRIES) {
    streamLog.lastElementChild.remove();
  }
}

function renderStockTiles() {
  const fragment = document.createDocumentFragment();

  WATCHLIST.forEach((stock) => {
    const tile = document.createElement("article");
    tile.className = "stock-tile";
    tile.dataset.symbol = stock.symbol;
    tile.innerHTML = `
      <div class="tile-topline">
        <span class="stock-symbol">${stock.symbol}</span>
        <span class="read-dot" aria-hidden="true"></span>
      </div>
      <div>
        <strong class="stock-price">--</strong>
        <span class="stock-change">--</span>
        <span class="stock-name">${stock.name}</span>
      </div>
      <div class="tile-footline">
        <span class="stock-status">Waiting</span>
        <span class="stock-time">--</span>
      </div>
    `;

    tileBySymbol.set(stock.symbol, tile);
    fragment.append(tile);
  });

  stockGrid.replaceChildren(fragment);
}

function renderAlerts() {
  const fragment = document.createDocumentFragment();
  alertBySymbol.clear();

  if (alertRules.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-alerts";
    emptyState.textContent = "Select up to 4 stocks from the checklist";
    alertList.replaceChildren(emptyState);
    return;
  }

  alertRules.forEach((rule) => {
    const thresholdValue = isValidThreshold(rule.threshold) ? rule.threshold : "";
    const row = document.createElement("article");
    row.className = "alert-row";
    row.dataset.symbol = rule.symbol;
    row.innerHTML = `
      <div class="alert-row-head">
        <div class="alert-title">
          <strong>${rule.symbol}</strong>
          <span>${stockNameForSymbol(rule.symbol)}</span>
        </div>
        <label class="threshold-target" for="${thresholdInputId(rule.symbol)}">
          <span>Target</span>
          <input id="${thresholdInputId(rule.symbol)}" class="alert-threshold-input" data-threshold-symbol="${rule.symbol}" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" value="${thresholdValue}">
        </label>
        <div class="alert-actions">
          <span class="alert-state" data-status="waiting" aria-label="Waiting" title="Waiting"></span>
        </div>
      </div>
      <div class="threshold-track" role="meter" aria-label="${rule.symbol} threshold progress" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0">
        <span class="threshold-fill"></span>
        <span class="threshold-value">--</span>
      </div>
      <div class="threshold-meta">
        <span class="alert-price">Latest --</span>
        <span class="alert-gap">Enter target price</span>
      </div>
    `;

    alertBySymbol.set(rule.symbol, row);
    fragment.append(row);
  });

  alertList.replaceChildren(fragment);
}

function syncStockChecklistStatus() {
  const selectedSymbols = alertRules.map((rule) => rule.symbol);

  alertCount.textContent = `${alertRules.length}/${MAX_SELECTED_ALERTS}`;
  stockChecklistSummary.textContent = selectedSymbols.length > 0
    ? `${selectedSymbols.join(", ")} (${selectedSymbols.length}/${MAX_SELECTED_ALERTS})`
    : `Choose stocks (0/${MAX_SELECTED_ALERTS})`;
}

function renderStockChecklist() {
  const selectedSymbols = new Set(alertRules.map((rule) => rule.symbol));
  const atLimit = alertRules.length >= MAX_SELECTED_ALERTS;
  const fragment = document.createDocumentFragment();

  WATCHLIST.forEach((stock) => {
    const isChecked = selectedSymbols.has(stock.symbol);
    const option = document.createElement("label");

    option.className = "stock-check-option";
    option.innerHTML = `
      <input type="checkbox" data-alert-symbol="${stock.symbol}" ${isChecked ? "checked" : ""} ${atLimit && !isChecked ? "disabled" : ""}>
      <span>
        <strong>${stock.symbol}</strong>
        <span>${stock.name}</span>
      </span>
    `;

    fragment.append(option);
  });

  stockChecklist.replaceChildren(fragment);
  syncStockChecklistStatus();
}

function handleStockChecklistChange(event) {
  const checkbox = event.target.closest("[data-alert-symbol]");

  if (!checkbox) {
    return;
  }

  const symbol = checkbox.dataset.alertSymbol;
  const existingRule = ruleForSymbol(symbol);

  if (checkbox.checked && !existingRule) {
    if (alertRules.length >= MAX_SELECTED_ALERTS) {
      checkbox.checked = false;
      return;
    }

    alertRules.push({ symbol, threshold: null });
  } else if (!checkbox.checked && existingRule) {
    const ruleIndex = alertRules.indexOf(existingRule);
    alertRules.splice(ruleIndex, 1);
  }

  renderAlerts();
  renderStockChecklist();
  updateAlerts();
}

function handleAlertThresholdInput(event) {
  const input = event.target.closest("[data-threshold-symbol]");

  if (!input) {
    return;
  }

  const rule = ruleForSymbol(input.dataset.thresholdSymbol);
  const threshold = Number(input.value);

  if (!rule) {
    return;
  }

  rule.threshold = isValidThreshold(threshold) ? threshold : null;

  updateAlerts();
}

function initThresholdControls() {
  renderStockChecklist();
  stockChecklist.addEventListener("change", handleStockChecklistChange);
  alertList.addEventListener("input", handleAlertThresholdInput);
}

function flashTiles() {
  tileBySymbol.forEach((tile) => {
    tile.classList.remove("is-reading");
    void tile.offsetWidth;
    tile.classList.add("is-reading");
  });
}

function updateTile(quote) {
  const tile = tileBySymbol.get(quote.symbol);
  if (!tile) {
    return;
  }

  quoteState.set(quote.symbol, quote);
  tile.classList.remove("has-error");
  tile.classList.toggle("is-up", Number(quote.changePercent) > 0);
  tile.classList.toggle("is-down", Number(quote.changePercent) < 0);
  tile.querySelector(".stock-price").textContent = formatPrice(quote.price);
  tile.querySelector(".stock-change").textContent = formatPercent(quote.changePercent);
  tile.querySelector(".stock-status").textContent = "Read";
  tile.querySelector(".stock-time").textContent = formatTime(quote.readAt);
}

function updateTileError(symbol, error) {
  const tile = tileBySymbol.get(symbol);
  if (!tile) {
    return;
  }

  tile.classList.add("has-error");
  tile.classList.remove("is-up", "is-down");
  tile.querySelector(".stock-status").textContent = error.message;
  tile.querySelector(".stock-time").textContent = formatTime();
}

function updateAlerts() {
  alertRules.forEach((rule) => {
    const row = alertBySymbol.get(rule.symbol);
    const quote = quoteState.get(rule.symbol);
    if (!row) {
      return;
    }

    const threshold = Number(rule.threshold);
    const hasThreshold = isValidThreshold(threshold);

    row.classList.toggle("needs-target", !hasThreshold);

    if (!hasThreshold) {
      row.classList.remove("is-crossed", "is-short");
      setAlertStatus(row, "waiting", "Set target");
      row.querySelector(".alert-price").textContent = quote ? `Latest ${formatPrice(quote.price)}` : "Latest --";
      row.querySelector(".alert-gap").textContent = "Enter target price";
      row.querySelector(".threshold-fill").style.width = "0%";
      row.querySelector(".threshold-value").textContent = quote ? formatPrice(quote.price) : "--";
      row.querySelector(".threshold-value").style.left = "0%";

      const meter = row.querySelector(".threshold-track");
      meter.setAttribute("aria-valuemax", "1");
      meter.setAttribute("aria-valuenow", "0");
      return;
    }

    if (!quote) {
      row.classList.remove("is-crossed", "is-short");
      setAlertStatus(row, "waiting", "Waiting");
      row.querySelector(".alert-price").textContent = "Latest --";
      row.querySelector(".alert-gap").textContent = `Target ${formatPrice(threshold)}`;
      row.querySelector(".threshold-fill").style.width = "0%";
      row.querySelector(".threshold-value").textContent = "--";
      row.querySelector(".threshold-value").style.left = "0%";

      const meter = row.querySelector(".threshold-track");
      meter.setAttribute("aria-valuemax", threshold.toFixed(2));
      meter.setAttribute("aria-valuenow", "0");
      return;
    }

    const crossed = quote.price >= threshold;
    const progress = thresholdProgress(quote.price, threshold);
    row.classList.toggle("is-crossed", crossed);
    row.classList.toggle("is-short", !crossed);
    setAlertStatus(row, crossed ? "crossed" : "short", crossed ? "Crossed" : "Not crossed");
    row.querySelector(".alert-price").textContent = `Latest ${formatPrice(quote.price)}`;
    row.querySelector(".alert-gap").textContent = `${formatThresholdGap(quote.price, threshold)} (${formatThresholdPercent(quote.price, threshold)})`;
    row.querySelector(".threshold-fill").style.width = `${progress}%`;
    row.querySelector(".threshold-value").textContent = formatPrice(quote.price);
    row.querySelector(".threshold-value").style.left = `${progress}%`;

    const meter = row.querySelector(".threshold-track");
    meter.setAttribute("aria-valuemax", threshold.toFixed(2));
    meter.setAttribute("aria-valuenow", quote.price.toFixed(2));
  });
}

async function readCycle() {
  if (isReading) {
    return;
  }

  isReading = true;
  cycleNumber += 1;
  setRunStatus("Reading", "reading");
  flashTiles();

  const startedAt = performance.now();
  let okCount = 0;
  let failedCount = 0;

  try {
    const quotes = await fetchQuotes(WATCHLIST.map((stock) => stock.symbol));

    WATCHLIST.forEach((stock) => {
      const quote = quotes.get(stock.symbol);
      if (!quote) {
        failedCount += 1;
        updateTileError(stock.symbol, new Error("No quote returned"));
        return;
      }

      okCount += 1;
      updateTile(quote);
    });
  } catch (error) {
    failedCount = WATCHLIST.length;
    WATCHLIST.forEach((stock) => updateTileError(stock.symbol, error));
  }

  const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);

  updateAlerts();
  lastReadOutput.textContent = formatTime();
  addStream(`Cycle ${cycleNumber}: ${okCount} read, ${failedCount} failed, ${elapsedSeconds}s`, failedCount ? "warn" : "ok");
  setRunStatus(failedCount ? "Partial" : "Live", failedCount ? "warn" : "live");
  isReading = false;
  scheduleNextCycle();
}

function scheduleNextCycle() {
  window.clearTimeout(cycleTimerId);
  cycleTimerId = window.setTimeout(readCycle, CHECK_INTERVAL_SECONDS * 1000);
}

function startDashboard() {
  renderStockTiles();
  renderAlerts();
  initThresholdControls();
  readCycle();
}

startDashboard();