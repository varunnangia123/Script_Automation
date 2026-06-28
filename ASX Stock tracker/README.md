# ASX Stock Tracker

A static GitHub Pages dashboard that watches 20 ASX symbols with no API keys.

## Watchlist

The grid includes:

```text
CBA.AX, WTC.AX, RIO.AX, BHP.AX, NEU.AX, XRO.AX, IVV.AX, VAS.AX, PME.AX, QAN.AX,
BXB.AX, JHX.AX, COL.AX, WDS.AX, MQG.AX, WES.AX, JBH.AX, ^IXIC, ^DJI, ^GSPC
```

The grid is arranged as 4 columns by 5 rows. The page is fixed to one desktop viewport, with scrolling isolated to the data stream panel.

## Alerts

The right-side alert panel watches:

```text
XRO.AX > $74
WTC.AX > $37
```

## Data Source

The page reads Yahoo Finance spark data through the public Jina Reader route so it can run on GitHub Pages without a backend server or API key. All symbols are fetched in one batch request per 10-second cycle.

The tracker checks every 10 seconds while the browser tab is open. Public no-key routes can rate-limit or change without notice.