# ASX Price Monitor Web

A static browser-based ASX price monitor that can be hosted on GitHub Pages.

## Run Locally

Open `index.html` in your browser.

## GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open Settings > Pages.
3. Select the branch and folder that contains `index.html`.
4. Open the published GitHub Pages URL.

## Default Monitor

The page defaults to:

```text
Symbols: WTC.AX, XRO.AX
Threshold: 74
Interval: 60 seconds
Schedule: ASX market hours only, Monday-Friday 10:00-16:00 Australia/Sydney
```

The browser tab must stay open for monitoring to continue. GitHub Pages hosts static files only, so it cannot run checks after the tab is closed.

## Data Source

This version does not use API keys.

The page reads Yahoo Finance chart data through the public Jina Reader route so it can run from GitHub Pages without a backend server.

The default 60-second interval checks two stocks during ASX market hours, which is roughly 720 no-key quote requests on a normal trading day while the tab is open. Public no-key routes can rate-limit or change without notice.

This web version shows alerts inside the page and does not request browser notification permission.
