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
Interval: 10 seconds
Schedule: runs every 10 seconds while the page is open
```

The browser tab must stay open for monitoring to continue. GitHub Pages hosts static files only, so it cannot run checks after the tab is closed.

## Data Source

This version does not use API keys.

The page reads Yahoo Finance chart data through the public Jina Reader route so it can run from GitHub Pages without a backend server.

The default 10-second interval checks two stocks while the tab is open. Public no-key routes can rate-limit or change without notice.

This web version shows alerts inside the page and does not request browser notification permission.

## SharePoint List Reader

The page has a SharePoint List Reader section. Paste a SharePoint list URL, JSON URL, or CSV export URL and press Load.

Protected SharePoint lists may be blocked by Microsoft sign-in, CORS, or tenant policy when loaded from GitHub Pages. In that case, use a JSON/CSV export link that allows browser access, or use a small authenticated backend/Microsoft Graph app.
