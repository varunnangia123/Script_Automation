# ASX Stock Tracker

A static GitHub Pages dashboard that watches 20 ASX symbols with no API keys.

## Watchlist

The grid includes:

```text
CBA.AX, WTC.AX, RIO.AX, BHP.AX, NEU.AX, XRO.AX, IVV.AX, VAS.AX, PME.AX, QAN.AX,
NAB.AX, WBC.AX, ANZ.AX, CSL.AX, MQG.AX, WES.AX, WOW.AX, GMG.AX, TLS.AX, FMG.AX
```

## Alerts

The right-side alert panel watches:

```text
XRO.AX > $74
WTC.AX > $37
```

## Data Source

The page reads Yahoo Finance chart data through the public Jina Reader route so it can run on GitHub Pages without a backend server or API key.

The tracker checks every 10 seconds while the browser tab is open. Public no-key routes can rate-limit or change without notice.