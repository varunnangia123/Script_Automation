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

## API Key

This version uses Twelve Data because GitHub Pages JavaScript needs a browser-accessible API with CORS enabled.

1. Get a free API key from `https://twelvedata.com/`.
2. Paste it into the Twelve Data API Key field on the page.
3. Start the monitor.

The key is saved in your browser local storage only. Do not hard-code API keys into public GitHub files.

Free API plans can rate-limit requests. A 10-second interval is 6 requests per minute for one stock while the tab is open.

This web version shows alerts inside the page and does not request browser notification permission.
