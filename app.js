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
let marketWasOpen = null;

const DEFAULT_SYMBOLS = ["WTC.AX", "XRO.AX"];
const ASX_TIMEZONE = "Australia/Sydney";
const ASX_MARKET_OPEN_MINUTES = 10 * 60;
const ASX_MARKET_CLOSE_MINUTES = 16 * 60;
const NO_KEY_PROXY_PREFIX = "https://r.jina.ai/http://";
const asxTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: ASX_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

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
  statusPill.classList.toggle("closed", state === "closed");
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

function isAsxMarketOpen(date = new Date()) {
  const parts = Object.fromEntries(
    asxTimeFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const weekday = parts.weekday;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);

  if (["Sat", "Sun"].includes(weekday)) {
    return false;
  }

  return minutes >= ASX_MARKET_OPEN_MINUTES && minutes < ASX_MARKET_CLOSE_MINUTES;
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

  if (!isAsxMarketOpen()) {
    if (marketWasOpen !== false) {
      addLog("ASX market is closed; waiting to check prices");
    }
    marketWasOpen = false;
    checkedOutput.textContent = formatTime();
    setStatus("Closed", "closed");
    return;
  }

  if (marketWasOpen !== true) {
    addLog("ASX market is open; checking prices");
    marketWasOpen = true;
  }

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
  const intervalSeconds = Math.max(60, Number(intervalInput.value || 60));

  symbolInput.value = symbols.join(", ");
  intervalInput.value = intervalSeconds;
  activeConfig = {
    symbols,
    threshold,
    intervalSeconds,
    aboveThresholdBySymbol: new Map(symbols.map((symbol) => [symbol, false]))
  };
  marketWasOpen = null;

  startButton.disabled = true;
  stopButton.disabled = false;
  alertBanner.hidden = true;
  setStatus("Running", "running");

  addLog(`Started ${symbols.join(", ")}, above $${threshold.toFixed(2)}, every ${intervalSeconds}s, ASX hours only`);
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
