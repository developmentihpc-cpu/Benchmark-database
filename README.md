# Benchmark DB

A reference set of real, comparable aid programmes and live benchmarks to inform
programme **design** — realistic scope, budget, duration and targets. Source data
is the [IATI Standard](https://iatistandard.org/) via the
[Code for IATI](https://iatidatastore.iati.cloud/) datastore (developing countries,
pulled 2026-06-02). It is a design reference, not an M&E tracking system.

The app is a fully client-side, in-memory single-page app — no backend, no build
step. It ships with an embedded representative sample of **3,388 programmes** across
**125 developing countries** and **700 reported indicators**.

## Run it

Any static file server works. Pick whichever runtime you have:

```sh
# Perl (zero install — ships with Git for Windows)
perl serve.pl              # serves http://localhost:8000
perl serve.pl 9000         # custom port

# Python (no dependencies)
python serve.py            # serves http://localhost:8000 and opens your browser
python serve.py 9000       # custom port

# Node
npx serve .
```

If you use the Claude Code preview, `.claude/launch.json` defines these as
`perl-static` (8000), `python-static` (8000) and `node-serve` (8001).

Then open <http://localhost:8000/>. Opening `index.html` directly via `file://`
also works in most browsers, but serving over HTTP avoids occasional font/CORS
quirks and matches production.

## Deploy to GitHub Pages

No build step — Pages serves the repo as-is. Once the repo is on GitHub:

1. Push this repo to GitHub (see the commands your setup notes / below).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on
   every push to `main` and publishes the site. The live URL appears in the
   Actions run summary and under Settings → Pages, typically:
   `https://<user>.github.io/<repo>/`.

(Alternatively, set Pages **Source: Deploy from a branch → `main` / root** and skip
the workflow — both serve the same static files.)

## Embed in your dashboard

This site stands alone; link or embed it from your existing dashboard.

Plain link:

```html
<a href="https://<user>.github.io/<repo>/" target="_blank" rel="noopener">
  Open Benchmark DB
</a>
```

Inline iframe (deep-link straight into the planner with URL params):

```html
<iframe
  src="https://<user>.github.io/<repo>/?country=KE&sector=12220&target=50000&budget=5000000"
  title="Benchmark DB"
  style="width:100%;height:90vh;border:0"
  loading="lazy"></iframe>
```

The planner reads `country`, `sector`, `target` and `budget` query params, so each
dashboard tile can deep-link to a pre-filled view.

## Project layout

```
Database/
├── index.html        # markup + view shells; loads the css/js below
├── css/
│   ├── styles.css     # all styling (light/dark themes via [data-theme])
│   └── fonts.css      # @font-face for the self-hosted fonts
├── fonts/            # Source Serif 4 + Public Sans woff2 subsets (self-hosted)
├── js/
│   ├── data.js        # embedded dataset: PROGRAMS, OUTCOMES, RATES,
│   │                  #   TOTALS, DEVREGION, DEFLATOR, META (globals)
│   └── app.js         # all application logic (vanilla JS, no framework)
├── serve.pl          # zero-install Perl static dev server (Git for Windows)
├── serve.py          # tiny no-cache static dev server (if you have Python)
└── README.md
```

Fonts are **self-hosted** (`fonts/` + `css/fonts.css`), so the app makes **no
third-party requests** and works fully offline.

`data.js` and `app.js` are plain (non-module) scripts, so the `const`/`let`
declarations in `data.js` are visible to `app.js`. Load order matters: `data.js`
must come before `app.js` (it does, in `index.html`).

## Views

- **Programmes** — searchable/filterable grid of every programme in the sample.
- **Benchmarks** — median budget, duration and reporting rate by sector, donor
  type and region, computed live over the sample.
- **Charts** — zero-dependency SVG views of the sample: budget distribution,
  programmes by start year, budget-vs-duration scatter, and a regional split.
- **Countries** — pick a country for a one-screen profile (spend, sectors,
  donors, recent programmes) with jump-offs to the filtered grid or the planner.
- **Plan a programme** — pick a need, get a benchmark from comparable programmes,
  then adjust the plan to fit a budget.
- **Reported outcomes** — indicator-level baseline → target → actual values.
- **#read_me** — full method, provenance, caveats, and a live **data-quality /
  coverage** panel (how complete each field is across the sample). The ≈USD
  figure exposes the exact FX/CPI factor applied per programme (grid cell
  tooltip and the detail card's "FX applied" line).

### Shareable / deep-linkable URLs

Every view's state lives in the query string (via `history.replaceState`), so
any filtered view is bookmarkable and embeddable. Examples:

| URL | Opens |
|-----|-------|
| `?donor=Bilateral&sector=Primary+education&sort=a&dir=1` | Programmes, filtered + sorted |
| `?view=countries&country=Kenya` | Kenya country profile |
| `?view=charts&usd=real` | Charts in constant-2024 USD |
| `?view=outcomes&stream=WASH` | Outcomes, WASH stream |
| `?country=KE&sector=12220&target=50000&budget=5000000` | Planner, pre-filled |

Programme-grid params: `q, donor, region, country, sector, status, results,
provider, sort, dir, page, size`. Add `usd=real` for inflation-adjusted figures.
The planner link is the original deep-link and still works unchanged.

## Data provenance

Every figure is one of: **REPORTED** (straight from the IATI record),
**DERIVED** (computed from reported figures — duration, ≈USD, real-2024 USD,
achieved share), or left as a **GAP** (blank, never guessed). No fabricated
benchmarks. Cost-per-beneficiary is deliberately not computed (IATI reach
indicators are non-comparable). See the in-app **#read_me** view for the full
treatment of caveats.

FX rates (`RATES` in `data.js`) are indicative, fixed, order-of-magnitude only —
editable live in the #read_me view.

## Enriching descriptions

Each programme card shows a plain-language summary of **what the programme
does**. Where a record has a real IATI activity description (the `desc` field)
it is used verbatim; otherwise the app derives a summary from the sector and the
programme's reported outcome indicators.

[`enrich_descriptions.py`](enrich_descriptions.py) fetches those real
descriptions from **d-portal** (an IATI Datastore mirror — **no API key
needed**), keyed by each programme's IATI identifier, and writes them back into
`js/data.js` as a `desc` field. It is re-runnable and resumable:

```sh
python enrich_descriptions.py              # enrich all programmes in place
python enrich_descriptions.py --limit 50   # test on the first 50
python enrich_descriptions.py --force      # re-fetch even if desc exists
```

## Regenerating the data

The embedded dataset was produced by a Python pipeline (not included in this
project setup): `setup_geo.py` builds the developing-country + region reference
from the World Bank API, `pull.py` fetches and classifies programmes from the
IATI datastore, and `build_html.py` rebuilds the page. To refresh the sample,
re-run that pipeline and replace `js/data.js`. For production, point `pull.py`
at the official IATI v3 datastore with a free API key instead of the no-key
mirror.
