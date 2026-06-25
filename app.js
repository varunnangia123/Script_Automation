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

let timerId = null;
let activeConfig = null;
let wasAboveThreshold = false;

function normaliseAsxSymbol(value) {
  const symbol = value.trim().toUpperCase();
  if (!symbol) {
    return "XRO.AX";
  }
  return symbol.endsWith(".AX") ? symbol : `${symbol}.AX`;
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

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchYahooPrice(symbol) {
  const encodedSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=1d&interval=1m`;
  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const latestClose = [...closes].reverse().find((value) => Number.isFinite(value));
  const price = meta?.regularMarketPrice ?? latestClose;

  if (!Number.isFinite(price)) {
    throw new Error("No Yahoo price returned");
  }

  return Number(price);
}

async function fetchYahooPriceViaProxy(symbol) {
  const encodedYahooUrl = encodeURIComponent(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`
  );
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodedYahooUrl}`;
  const data = await fetchJson(proxyUrl);
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const latestClose = [...closes].reverse().find((value) => Number.isFinite(value));
  const price = meta?.regularMarketPrice ?? latestClose;

  if (!Number.isFinite(price)) {
    throw new Error("No proxy price returned");
  }

  return Number(price);
}

async function getLatestPrice(symbol) {
  try {
    return await fetchYahooPrice(symbol);
  } catch (directError) {
    addLog(`Direct quote failed: ${directError.message}`);
    return fetchYahooPriceViaProxy(symbol);
  }
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) {
    addLog("Browser notifications are unavailable");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    addLog("Browser notifications are blocked");
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

function sendPriceAlert(symbol, price, threshold) {
  const message = `${symbol} is $${price.toFixed(2)}, above $${threshold.toFixed(2)}`;
  alertBanner.textContent = message;
  alertBanner.hidden = false;
  setStatus("Alert", "alerting");
  addLog(message);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("ASX Price Alert", { body: message });
  }
}

async function checkPrice() {
  if (!activeConfig) {
    return;
  }

  const { symbol, threshold } = activeConfig;

  try {
    const price = await getLatestPrice(symbol);
    const checkedAt = formatTime();

    priceOutput.textContent = `$${price.toFixed(2)}`;
    checkedOutput.textContent = checkedAt;
    addLog(`${symbol}: $${price.toFixed(2)}`);

    if (price > threshold && !wasAboveThreshold) {
      wasAboveThreshold = true;
      sendPriceAlert(symbol, price, threshold);
    } else if (price <= threshold) {
      wasAboveThreshold = false;
      alertBanner.hidden = true;
      setStatus("Running", "running");
    } else {
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

  const symbol = normaliseAsxSymbol(symbolInput.value);
  const threshold = Number(thresholdInput.value || 74);
  const intervalSeconds = Math.max(10, Number(intervalInput.value || 10));

  symbolInput.value = symbol;
  intervalInput.value = intervalSeconds;
  activeConfig = { symbol, threshold, intervalSeconds };
  wasAboveThreshold = false;

  startButton.disabled = true;
  stopButton.disabled = false;
  alertBanner.hidden = true;
  setStatus("Running", "running");

  await ensureNotificationPermission();
  addLog(`Started ${symbol}, above $${threshold.toFixed(2)}, every ${intervalSeconds}s`);
  await checkPrice();
  timerId = window.setInterval(checkPrice, intervalSeconds * 1000);
}

function stopMonitor(writeLog = true) {
  if (timerId !== null) {
    window.clearInterval(timerId);
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
