# Time Zone Planner

A static, browser-only time-zone planner that can be hosted on GitHub Pages.

## Features

- Runs entirely in the browser with HTML, CSS, and JavaScript.
- No backend, database, Python runtime, Java runtime, Kotlin runtime, or Node.js server is required.
- Converts one or more available times or time ranges between IANA time zones.
- Uses the browser's `Intl.DateTimeFormat` time-zone support, including daylight saving time changes.
- Lets users select their own place/time zone and another person's place/time zone.
- Saves contacts, notes, and profile choices in `localStorage`.
- Optional "Check on Them" safety summaries through a separate backend endpoint.
- Includes playful contact cards, profile choices, button sounds, and animations.
- Works when opened directly as `index.html` and when hosted on GitHub Pages.

## Project Files

- `index.html` - app entry point.
- `style.css` - responsive visual design and animations.
- `script.js` - browser-only application logic.
- `api/check-on-them.js` - optional Vercel Function for safety checks.
- `vercel.json` - optional Vercel Function settings.

The old Python files can be kept as historical reference, but they are not required for the static app.

## Run Locally

Open `index.html` directly in any modern browser.

Some optional features, such as online place lookup and weather checks, use public APIs and require internet access. The core time-zone converter works without a server.

## Deploy To GitHub Pages

1. Create a GitHub repository.
2. Add `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Commit and push the files.
4. In GitHub, open the repository settings.
5. Go to **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select the branch, usually `main`, and the root folder `/`.
8. Save.

GitHub will publish the app at a URL like:

`https://your-username.github.io/your-repository-name/`

## Optional Check On Them Backend

The GitHub Pages app stays static. The optional safety feature can call a separate backend so API keys or server-only search tools are never placed in frontend JavaScript.

This project includes a Vercel Function at:

`api/check-on-them.js`

It accepts a `POST` request with a contact location, checks public sources, and returns categorized results:

- Weather
- Safety News
- Traffic
- Food/Health Alerts
- General Local Updates

The function currently uses public APIs that do not require API keys:

- Open-Meteo geocoding and forecast data
- National Weather Service alerts for US locations
- GDELT article search for recent local updates

It does not use AI and does not invent information. If reliable results are unavailable, that category is returned empty and the frontend says no reliable results were found.

### Deploy Backend To Vercel

1. Push this repository to GitHub.
2. Create a Vercel account if needed.
3. In Vercel, choose **Add New Project**.
4. Import the GitHub repository.
5. Deploy with the default settings.
6. After deployment, copy the function URL:

`https://your-vercel-project.vercel.app/api/check-on-them`

7. Open the app.
8. Paste that URL into **Check on Them backend URL (optional)**.
9. Save or change contacts as usual, then click **Check on Them**.

The backend URL is stored only in your browser's `localStorage`.

### Adding AI Later

If you later add AI search or web-search APIs that require keys, add those keys as Vercel environment variables. Do not put them in `script.js`, `index.html`, or any other frontend file.

## Notes

The app relies on browser-supported IANA time zones. Modern Chrome, Edge, Firefox, and Safari support the APIs used here.
