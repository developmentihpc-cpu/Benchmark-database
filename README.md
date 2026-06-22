# Benchmark DB

A reference set of real, comparable aid programmes and live benchmarks to inform
programme **design** — realistic scope, budget, duration and targets. Source data
is the [IATI Standard](https://iatistandard.org/) via the
[Code for IATI](https://iatidatastore.iati.cloud/) datastore (developing countries,
pulled 2026-06-02). It is a design reference, not an M&E tracking system.

The app is a fully client-side, in-memory single-page app — no backend, no build
step. It ships with an embedded representative sample of **4,000+ programmes** (the
UI counts the live number) across
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
│   ├── lib.js         # pure helpers (median, quantile, fmt*, esc…) —
│   │                  #   browser globals + Node module (tested)
│   ├── i18n.js        # English translations for non-English outcome labels
│   │                  #   (applied at render via i18n(); data.js unchanged)
│   ├── data.js        # embedded dataset: PROGRAMS, OUTCOMES, RATES,
│   │                  #   TOTALS, DEVREGION, DEFLATOR, META (globals)
│   └── app.js         # all application logic (vanilla JS, no framework)
├── test/
│   └── data.test.js   # unit tests for js/lib.js (node --test)
├── serve.pl          # zero-install Perl static dev server (Git for Windows)
├── serve.py          # tiny no-cache static dev server (if you have Python)
└── README.md
```

Fonts are **self-hosted** (`fonts/` + `css/fonts.css`), so the app makes **no
third-party requests** and works fully offline.

`lib.js`, `data.js` and `app.js` are plain (non-module) scripts, so their
top-level declarations are visible to each other. Load order matters —
`lib.js` → `data.js` → `app.js` (as in `index.html`).

## Tests

Two suites, run with Node 18+ (no dependencies):

- [`test/data.test.js`](test/data.test.js) — unit tests for the pure helpers in
  `js/lib.js` (medians, quantiles, FX/date math, formatting). `lib.js` is
  dual-mode (browser global *and* Node module), so the tests import it directly.
- [`test/integrity.test.js`](test/integrity.test.js) — **data-integrity guards**
  over the embedded `js/data.js`: valid stream/donor/status enums, unique IATI
  ids, 5-digit DAC sectors (no placeholder names), non-negative amounts, the GAP
  rule (a zero/absent amount never becomes a real $0 comparator), every recipient
  country resolves to a region, every used currency has an FX rate, and provider
  countries are internally consistent. These catch the kind of pollution a bad
  IATI pull can introduce, so run them after `add_uae.py` / `add_sector.py`.

```sh
npm test          # alias for: node --test  (runs both suites in test/)
```

## Views

- **Programmes** — searchable/filterable grid of every programme in the sample.
- **Benchmarks** — median budget, duration and reporting rate by sector, donor
  type and region, computed live over the sample.
- **Charts** — zero-dependency SVG views of the sample: budget distribution,
  programmes by start year, budget-vs-duration scatter, and a regional split.
- **Countries** — pick a country for a one-screen profile (spend, sectors,
  donors, recent programmes) with jump-offs to the filtered grid or the planner.
- **Plan a programme** — scope by sector, country, donor type and **donor
  country**; seed your plan from the **cohort median or a single comparable
  programme**; then pressure-test it: budget/duration/burn percentile strips,
  plain-language reads, symmetric feasibility flags, a concentration warning when
  the cohort is narrow, an outcome reality-check (median actual vs target), a
  printable one-page **design brief**, and a **basket** to collect several plans
  (saved in your browser) and export them together as one CSV.
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

## Data schema (data dictionary)

`js/data.js` defines a few globals. Field names are short to keep the file small.

**`PROGRAMS`** — one object per programme:

| key | meaning | key | meaning |
|-----|---------|-----|---------|
| `n` | programme title | `b` | amount basis (`commitment`/`budget`) |
| `d` | donor type (Bilateral/Multilateral/NGO/Foundation/Private sector) | `rc` | reported reach count (or null) |
| `r` | reporting org name | `rb` | reach indicator label |
| `rt` | reporting org type | `re` | reports results (0/1) |
| `s` | stream (Humanitarian/WASH/Governance/Development/Infrastructure & Economic) | `year` | start year |
| `sc` | DAC 5-digit sector code | `fn` | funder name |
| `sn` | sector name | `pcc` | providing-country ISO2 (bilateral, inferred) |
| `co` | recipient country name | `pn` | providing-country name |
| `cc` | recipient country ISO2 | `id` | IATI activity identifier |
| `rg` | region | `desc` | full English IATI activity description (added by enrich; optional) |
| `name_en` | English title — set only when `n` is non-English (added by `enrich_llm.py`) | `summary` | one-line "core activities" summary of `desc` (added by `enrich_llm.py`) |
| `sta` | status (Ongoing/Planned/Finalisation/Closed/Suspended/Cancelled) | `multi` | 1 if multi-country |
| `st`,`en` | start/end date (ISO) | `c`,`a` | currency code, amount (original) |

Derived at runtime (not stored): `_dur` (months), `_usd` (≈USD via FX×CPI),
`_i` (original index).

**`OUTCOMES`** — indicator rows: `n` (programme title, links to `PROGRAMS.n`),
`s` stream, `sn` sector, `t` type (output/outcome), `i` indicator label,
`m` measure, `bl`/`tg`/`ac` baseline/target/actual. Derived: `_ach` = `ac/tg`.

**Other globals:** `RATES` (currency→USD), `TOTALS` (recent IATI universe per
sector), `DEVREGION` (country→region), `DEFLATOR` (US CPI by year, base 2024),
`META` (date + counts).

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

### English-only titles + one-line summaries (Claude API)

A second, optional pass — [`enrich_llm.py`](enrich_llm.py) — uses the
**Anthropic API** to finish two things the raw data can't do itself:

1. **Translate** any non-English programme title to English (written to a new
   `name_en` field; English titles are left untouched).
2. **Summarise** each real `desc` into a single plain-English "core activities"
   sentence (written to a new `summary` field). The card then shows the summary,
   with the full description still available behind **Show more**.

The app reads both defensively (`name_en || n`, `summary || desc || derived`), so
this pass is purely additive — the site works with or without it.

It uses the **Message Batches API** (50% cheaper, async) with the cheap **Haiku**
model and a shared, cache-marked system prompt, so the whole data set costs a few
cents to ~$1 of tokens. It is re-runnable and **resumable**: results are cached in
`enrich_llm_cache.json`, the in-flight batch id is saved to `enrich_llm_state.json`
(re-run to reconnect rather than resubmit), and the write-back is idempotent.

You supply your own key via the `ANTHROPIC_API_KEY` environment variable — it is
never hard-coded or stored, and costs land on your Anthropic account.

```sh
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...     # Windows: set ANTHROPIC_API_KEY=...

python enrich_llm.py                 # translate names + summarise descriptions
python enrich_llm.py --limit 25      # smoke-test on 25 records first
python enrich_llm.py --dry-run       # preview the plan; no API calls
python enrich_llm.py --names-only    # only translate non-English titles
python enrich_llm.py --desc-only     # only summarise descriptions
python enrich_llm.py --apply-only    # write the cache into data.js (no API calls)
python enrich_llm.py --force         # ignore the cache and redo everything
```

Non-English **outcome indicator labels** are handled separately, at render time,
by [`js/i18n.js`](js/i18n.js) (no data mutation), so this pass only touches
programme titles and descriptions.

## Adding more publishers (e.g. UAE)

[`add_uae.py`](add_uae.py) pulls a publisher's activities straight from
**d-portal** (no API key) and appends them to `js/data.js` in the project's
schema. It ships pointed at the **United Arab Emirates** aid programme — the UAE
Ministry of Foreign Affairs (MOFAIC), IATI reporting-org ref `XM-DAC-576` (576 is
the OECD-DAC donor code for the UAE), ~223 activities.

```sh
python add_uae.py                 # add all active UAE publishers (currently MOFAIC)
python add_uae.py --limit 25      # test on the first 25 per publisher
python add_uae.py --dry-run       # preview what would be added; writes nothing
python add_uae.py --all-countries # don't restrict to the developing-country set
python add_uae.py --include AE-ADFD-1,AE-ERC-1   # also pull candidate UAE bodies
python add_uae.py --ref XX-ABC-1  # or one arbitrary IATI reporting-org ref
```

The script carries a small **registry of UAE publishers** (`PUBLISHERS` near the
top). As of 2026-06, **only MOFAIC (`XM-DAC-576`) publishes to IATI** — verified
against the full d-portal publisher list. **Abu Dhabi Fund for Development**,
**Emirates Red Crescent** and **Dubai Cares** are listed as *inactive candidates*
with sensible donor/org types; when one starts publishing, flip its `active` flag
(or pass `--include <ref>`) and re-run — donor type, org type and reporting name
come from the registry entry and the publisher's own IATI data, so no other change
is needed.

For each activity it fetches the full IATI record, classifies it into the
schema (stream by DAC sector group, region from the country, status, currency and
original amount), filters to the developing-country set to match the rest of the
sample, and **skips anything it can't classify rather than guessing** (an activity
with no recipient country or no DAC sector is reported and dropped). It is
re-runnable — activities already in `js/data.js` are skipped — and it bumps
`META.nprog`. Afterwards, run [`enrich_llm.py`](enrich_llm.py) to add the one-line
`summary` (and `name_en` for any non-English titles) for the new records.

## Adding more sectors

The embedded sample only covers seven DAC sub-sectors. [`add_sector.py`](add_sector.py)
broadens it by pulling real activities for a curated set of additional DAC sectors
(no API key — same d-portal source) and appending them in the project's schema.

```sh
python add_sector.py                 # add all three tiers
python add_sector.py --tier 1        # just Tier 1 (fill the obvious holes)
python add_sector.py --codes 23210,11320   # only these DAC codes
python add_sector.py --per 30        # cap activities pulled per sector (default 50)
python add_sector.py --dry-run       # preview; writes nothing
```

The curated tiers (edit `TIERS` in the script to taste):

- **Tier 1** — sanitation, reproductive/HIV/malaria/infectious-disease/nutrition
  health, emergency food + disaster preparedness + reconstruction, secondary &
  vocational & early-childhood education.
- **Tier 2** — rural development, social protection, SME/business/financial,
  legal-judicial/human-rights/peacebuilding.
- **Tier 3** — renewable energy & solar, transport, environment.

Tier 1–2 sectors map onto the existing streams; **Tier 3 lands in a fifth stream,
"Infrastructure & Economic"** (energy, transport, communications, banking,
business, industry, trade, environment — see `stream_for()` in
[`iati_ingest.py`](iati_ingest.py)). Streams are data-driven in the app, and the
Benchmarks "by sector" tables now auto-include any sector with enough programmes
to benchmark, so added sectors appear without further code changes. A full run
makes many per-activity fetches (≈ sectors × `--per`), so it takes a while — it's
a one-time build. Afterwards run [`enrich_llm.py`](enrich_llm.py) for the new
records' summaries/translations.

### Recent IATI universe counts (`TOTALS`)

The #read_me "Recent IATI universe by sector" table and the benchmark "In IATI"
column read from the `TOTALS` global (sector → recent activity count). New sectors
show "—" until a count is extracted. **d-portal can't filter by sector**, so the
counts come from the official **IATI Datastore** via
[`datastore_totals.py`](datastore_totals.py), which needs a **free API key**
(register at <https://developer.iatistandard.org/> and subscribe to the Datastore
API):

```sh
export IATI_DATASTORE_KEY=...      # Windows: set IATI_DATASTORE_KEY=...
python datastore_totals.py         # fill counts for sectors missing one
python datastore_totals.py --refresh   # recompute every sector
python datastore_totals.py --dry-run   # print the counts; write nothing
```

It queries the recent activity count (started since 2021-06-02 or ongoing — the
same basis as the sample) for every sector in `js/data.js` and writes it into
`TOTALS`. The Datastore is also the robust way to **pull by sector** if you extend
the pipeline — it returns `recipient_country_code` / `sector_code` as flat fields,
no per-activity fetches.

Both [`add_uae.py`](add_uae.py) and `add_sector.py` share one ingestion core,
[`iati_ingest.py`](iati_ingest.py) — IATI→schema classification (stream, donor
type from the publisher's org type, region, status, currency) and the idempotent
`js/data.js` splice. Nothing is fabricated: an activity with no recipient country
or no DAC sector is reported and dropped, never guessed.

## Regenerating the data

The embedded dataset was produced by a Python pipeline (not included in this
project setup): `setup_geo.py` builds the developing-country + region reference
from the World Bank API, `pull.py` fetches and classifies programmes from the
IATI datastore, and `build_html.py` rebuilds the page. To refresh the sample,
re-run that pipeline and replace `js/data.js`. For production, point `pull.py`
at the official IATI v3 datastore with a free API key instead of the no-key
mirror.
