# ASX Stock Tracker

A static GitHub Pages dashboard that watches 20 ASX symbols with no API keys.

## Watchlist

The grid includes:

```text
CBA.AX, WTC.AX, RIO.AX, BHP.AX, NEU.AX, XRO.AX, IVV.AX, VAS.AX, PME.AX, QAN.AX,
BXB.AX, JHX.AX, COL.AX, WDS.AX, MQG.AX, WES.AX, JBH.AX, ASX.AX, SEK.AX, CSL.AX
```

The grid is arranged as 4 columns by 5 rows. The page is fixed to one desktop viewport, with scrolling isolated to the data stream panel.

## Alerts

The header checkbox selector lets you choose up to 4 stocks. Each selected stock appears in the right-side threshold panel with its own target price field and a progress bar against that target, with green rows for crossed thresholds and red rows for targets that have not been reached.

Each tile shows the latest price and percentage change versus the previous close. The data stream shows cycle summaries only, not every per-symbol quote message.

## Data Source

The page reads Yahoo Finance spark data through the public Jina Reader route so it can run on GitHub Pages without a backend server or API key. All symbols are fetched in one batch request per 10-second cycle.

The tracker checks every 10 seconds while the browser tab is open. Public no-key routes can rate-limit or change without notice.