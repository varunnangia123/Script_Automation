const form = document.querySelector("#settings-form");
const symbolInput = document.querySelector("#symbol-input");
const apiKeyInput = document.querySelector("#api-key-input");
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

const savedApiKey = window.localStorage.getItem("twelveDataApiKey");
if (savedApiKey) {
  apiKeyInput.value = savedApiKey;
}

function normaliseAsxSymbol(value) {
  const symbol = value.trim().toUpperCase();
  if (!symbol) {
    return "XRO.AX";
  }
  return symbol.endsWith(".AX") ? symbol : `${symbol}.AX`;
}

function toTwelveDataSymbol(symbol) {
  return `${symbol.replace(/\.AX$/u, "")}:ASX`;
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

async function getLatestPrice(apiSymbol, apiKey) {
  const encodedSymbol = encodeURIComponent(apiSymbol);
  const encodedApiKey = encodeURIComponent(apiKey);
  const url = `https://api.twelvedata.com/price?symbol=${encodedSymbol}&apikey=${encodedApiKey}`;
  const data = await fetchJson(url);

  if (data.status === "error") {
    throw new Error(data.message || "Twelve Data returned an error");
  }

  const price = Number(data.price);
  if (!Number.isFinite(price)) {
    throw new Error("No price returned");
  }

  return price;
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
    addLog("Browser notifications are blocked; page alerts still work");
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

  const { symbol, apiSymbol, apiKey, threshold } = activeConfig;

  try {
    const price = await getLatestPrice(apiSymbol, apiKey);
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
  const apiSymbol = toTwelveDataSymbol(symbol);
  const apiKey = apiKeyInput.value.trim();
  const threshold = Number(thresholdInput.value || 74);
  const intervalSeconds = Math.max(10, Number(intervalInput.value || 10));

  if (!apiKey) {
    setStatus("Error");
    addLog("Enter a Twelve Data API key before starting");
    return;
  }

  symbolInput.value = symbol;
  intervalInput.value = intervalSeconds;
  window.localStorage.setItem("twelveDataApiKey", apiKey);
  activeConfig = { symbol, apiSymbol, apiKey, threshold, intervalSeconds };
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
