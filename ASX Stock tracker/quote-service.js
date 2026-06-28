import { QUOTE_PROXY_PREFIX, QUOTE_TIMEOUT_MS } from "./config.js?v=20260628-6";

function yahooChartUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
}

function yahooSparkUrl(symbols) {
  const symbolList = Array.isArray(symbols) ? symbols.join(",") : symbols;
  return `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolList)}&range=1d&interval=1m`;
}

function extractYahooPayload(text, rootKey) {
  const marker = "Markdown Content:";
  const payloadText = text.includes(marker) ? text.split(marker)[1].trim() : text.trim();
  const jsonStart = payloadText.indexOf(`{"${rootKey}"`);

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

function chartResults(data) {
  const results = data?.chart?.result;

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Yahoo returned no chart data");
  }

  return results;
}

function priceFromChartResult(result) {
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

function sparkResults(data) {
  const results = data?.spark?.result;

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Yahoo returned no spark data");
  }

  return results;
}

function priceFromSparkResult(result) {
  const response = result?.response?.[0];
  return priceFromChartResult(response);
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
  const quote = priceFromChartResult(chartResults(extractYahooPayload(text, "chart"))[0]);

  return {
    symbol,
    ...quote,
    readAt: new Date()
  };
}

export async function fetchQuotes(symbols) {
  const text = await fetchText(`${QUOTE_PROXY_PREFIX}${yahooSparkUrl(symbols)}`);
  const data = extractYahooPayload(text, "spark");
  const readAt = new Date();
  const quotes = new Map();

  sparkResults(data).forEach((result) => {
    const symbol = result?.symbol;
    if (!symbol) {
      return;
    }

    quotes.set(symbol, {
      symbol,
      ...priceFromSparkResult(result),
      readAt
    });
  });

  return quotes;
}