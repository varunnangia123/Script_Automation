export const CHECK_INTERVAL_SECONDS = 10;
export const QUOTE_TIMEOUT_MS = 12000;
export const MAX_LOG_ENTRIES = 120;
export const QUOTE_PROXY_PREFIX = "https://r.jina.ai/http://";

export const WATCHLIST = [
  { symbol: "CBA.AX", name: "Commonwealth Bank" },
  { symbol: "WTC.AX", name: "WiseTech Global" },
  { symbol: "RIO.AX", name: "Rio Tinto" },
  { symbol: "BHP.AX", name: "BHP Group" },
  { symbol: "NEU.AX", name: "Neuren Pharma" },
  { symbol: "XRO.AX", name: "Xero" },
  { symbol: "IVV.AX", name: "iShares S&P 500 ETF" },
  { symbol: "VAS.AX", name: "Vanguard Australian Shares ETF" },
  { symbol: "PME.AX", name: "Pro Medicus" },
  { symbol: "QAN.AX", name: "Qantas Airways" },
  { symbol: "NAB.AX", name: "National Australia Bank" },
  { symbol: "WBC.AX", name: "Westpac" },
  { symbol: "ANZ.AX", name: "ANZ Group" },
  { symbol: "CSL.AX", name: "CSL" },
  { symbol: "MQG.AX", name: "Macquarie Group" },
  { symbol: "WES.AX", name: "Wesfarmers" },
  { symbol: "WOW.AX", name: "Woolworths Group" },
  { symbol: "GMG.AX", name: "Goodman Group" },
  { symbol: "TLS.AX", name: "Telstra Group" },
  { symbol: "FMG.AX", name: "Fortescue" }
];

export const ALERT_RULES = [
  { symbol: "XRO.AX", threshold: 74 },
  { symbol: "WTC.AX", threshold: 37 }
];