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
Symbol: XRO.AX
Threshold: 74
Interval: 10 seconds
```

The browser tab must stay open for monitoring to continue. GitHub Pages hosts static files only, so it cannot run checks after the tab is closed.

The app fetches Yahoo Finance chart data directly from the browser and uses a public CORS proxy as a fallback. Free browser-accessible finance endpoints can change or rate-limit requests.
