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

Any static file server works. Two easy options:

```sh
# Python (no dependencies)
python serve.py            # serves http://localhost:8000 and opens your browser
python serve.py 9000       # custom port

# Node
npx serve .
```

Then open <http://localhost:8000/>. Opening `index.html` directly via `file://`
also works in most browsers, but serving over HTTP avoids occasional font/CORS
quirks and matches production.

## Project layout

```
Database/
├── index.html        # markup + view shells; loads the css/js below
├── css/
│   └── styles.css     # all styling (light/dark themes via [data-theme])
├── js/
│   ├── data.js        # embedded dataset: PROGRAMS, OUTCOMES, RATES,
│   │                  #   TOTALS, DEVREGION, DEFLATOR, META (globals)
│   └── app.js         # all application logic (vanilla JS, no framework)
├── serve.py          # tiny no-cache static dev server
└── README.md
```

`data.js` and `app.js` are plain (non-module) scripts, so the `const`/`let`
declarations in `data.js` are visible to `app.js`. Load order matters: `data.js`
must come before `app.js` (it does, in `index.html`).

## Views

- **Programmes** — searchable/filterable grid of every programme in the sample.
- **Benchmarks** — median budget, duration and reporting rate by sector, donor
  type and region, computed live over the sample.
- **Plan a programme** — pick a need, get a benchmark from comparable programmes,
  then adjust the plan to fit a budget. Deep-linkable via URL params, e.g.
  `?country=KE&sector=12220&target=50000&budget=5000000`.
- **Reported outcomes** — indicator-level baseline → target → actual values.
- **#read_me** — full method, provenance and caveats.

## Data provenance

Every figure is one of: **REPORTED** (straight from the IATI record),
**DERIVED** (computed from reported figures — duration, ≈USD, real-2024 USD,
achieved share), or left as a **GAP** (blank, never guessed). No fabricated
benchmarks. Cost-per-beneficiary is deliberately not computed (IATI reach
indicators are non-comparable). See the in-app **#read_me** view for the full
treatment of caveats.

FX rates (`RATES` in `data.js`) are indicative, fixed, order-of-magnitude only —
editable live in the #read_me view.

## Regenerating the data

The embedded dataset was produced by a Python pipeline (not included in this
project setup): `setup_geo.py` builds the developing-country + region reference
from the World Bank API, `pull.py` fetches and classifies programmes from the
IATI datastore, and `build_html.py` rebuilds the page. To refresh the sample,
re-run that pipeline and replace `js/data.js`. For production, point `pull.py`
at the official IATI v3 datastore with a free API key instead of the no-key
mirror.
