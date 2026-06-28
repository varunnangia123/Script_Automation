import { ALERT_RULES, CHECK_INTERVAL_SECONDS, MAX_LOG_ENTRIES, WATCHLIST } from "./config.js?v=20260628-7";
import { fetchQuotes } from "./quote-service.js?v=20260628-7";

const stockGrid = document.querySelector("#stock-grid");
const alertList = document.querySelector("#alert-list");
const streamLog = document.querySelector("#stream-log");
const runStatus = document.querySelector("#run-status");
const lastReadOutput = document.querySelector("#last-read-output");

const tileBySymbol = new Map();
const alertBySymbol = new Map();
const quoteState = new Map();

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

  ALERT_RULES.forEach((rule) => {
    const row = document.createElement("article");
    row.className = "alert-row";
    row.dataset.symbol = rule.symbol;
    row.innerHTML = `
      <div>
        <strong>${rule.symbol}</strong>
        <span>Above ${formatPrice(rule.threshold)}</span>
      </div>
      <div>
        <span class="alert-state">Waiting</span>
        <strong class="alert-price">--</strong>
      </div>
    `;

    alertBySymbol.set(rule.symbol, row);
    fragment.append(row);
  });

  alertList.replaceChildren(fragment);
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
  ALERT_RULES.forEach((rule) => {
    const row = alertBySymbol.get(rule.symbol);
    const quote = quoteState.get(rule.symbol);
    if (!row || !quote) {
      return;
    }

    const crossed = quote.price > rule.threshold;
    row.classList.toggle("is-crossed", crossed);
    row.querySelector(".alert-state").textContent = crossed ? "Crossed" : "Below";
    row.querySelector(".alert-price").textContent = formatPrice(quote.price);
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
        addStream(`${stock.symbol} failed: No quote returned`, "error");
        return;
      }

      okCount += 1;
      updateTile(quote);
      addStream(`${stock.symbol} ${formatPrice(quote.price)}`, "ok");
    });
  } catch (error) {
    failedCount = WATCHLIST.length;
    WATCHLIST.forEach((stock) => updateTileError(stock.symbol, error));
    addStream(`Batch quote failed: ${error.message}`, "error");
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
  addStream(`Starting ${WATCHLIST.length} symbols, every ${CHECK_INTERVAL_SECONDS}s, one batch request per cycle`);
  readCycle();
}

startDashboard();