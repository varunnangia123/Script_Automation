# Job Hunt Monitor

A static GitHub Pages dashboard for monitoring contract or fixed monthly Power BI report developer and data analyst roles. It refreshes every 10 seconds by default, filters jobs against saved requirements, and shows a short description summary under each matched job.

## Important SEEK Note

GitHub Pages is a static public host. A browser page published there cannot reliably scrape `seek.com.au` directly because SEEK pages and internal APIs are cross-origin and may be restricted by SEEK's terms. This app is therefore built with a modular source endpoint:

- Without a source endpoint, it runs with demo data and opens the matching SEEK search URL.
- With a source endpoint, it polls that endpoint every 10 seconds and filters/summarises the returned jobs.

Use a source endpoint only if you have permission to access and reuse the job data.

## Files

- `index.html` - GitHub Pages entry point.
- `styles.css` - Responsive dashboard styling.
- `app.js` - UI state, polling loop, rendering, and events.
- `config.js` - Defaults, polling limits, and demo jobs.
- `seek-service.js` - SEEK search URL builder and source endpoint normalisation.
- `summarizer.js` - Requirement parsing, match scoring, and description summaries.
- `storage.js` - Local browser storage for settings and seen jobs.

## Source Endpoint Shape

The endpoint can return either an array of jobs or an object with one of these array fields: `jobs`, `data`, `results`, `listings`, or `searchResults.jobs`.

Recommended job fields:

```json
{
  "id": "12345",
  "title": "Power BI Report Developer",
  "company": "Example Company",
  "location": "Sydney NSW",
  "workType": "Contract/Temp",
  "salary": "$850 per day",
  "listedAt": "Today",
  "url": "https://www.seek.com.au/job/12345",
  "description": "Build Power BI dashboards, tune DAX measures, and deliver monthly reporting packs."
}
```

The app also recognises common alternatives such as `jobTitle`, `companyName`, `jobType`, `employmentType`, `displaySalary`, `teaser`, `summary`, and `jobDescription`.

## Run Locally

Because this app uses JavaScript modules, serve the folder over HTTP:

```powershell
cd "job hunt"
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish With GitHub Pages

1. Push the `job hunt` folder to a GitHub repository.
2. Open the repository settings.
3. Go to Pages.
4. Select the branch and folder containing this app.
5. Open the published URL.

The monitor runs only while the browser tab is open.