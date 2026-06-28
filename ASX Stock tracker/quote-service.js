import { QUOTE_PROXY_PREFIX, QUOTE_TIMEOUT_MS } from "./config.js";

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

function lastFinitePrice(values) {
  for (const value of [...values].reverse()) {
    const price = Number(value);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }

  return null;
}

function priceFromYahooChart(data) {
  const result = data?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const metaPrice = Number(meta.regularMarketPrice);

  if (Number.isFinite(metaPrice) && metaPrice > 0) {
    return {
      price: metaPrice,
      currency: meta.currency || "AUD",
      marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : null
    };
  }

  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const closePrice = lastFinitePrice(closes);
  if (closePrice !== null) {
    return {
      price: closePrice,
      currency: meta.currency || "AUD",
      marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : null
    };
  }

  throw new Error("No usable price returned");
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchQuote(symbol) {
  const text = await fetchText(`${QUOTE_PROXY_PREFIX}${yahooChartUrl(symbol)}`);
  const quote = priceFromYahooChart(extractYahooChartPayload(text));

  return {
    symbol,
    ...quote,
    readAt: new Date()
  };
}