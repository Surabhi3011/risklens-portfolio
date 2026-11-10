# CLAUDE.md — RiskLens Portfolio

Read this file first in every session. Then read `ARCHITECTURE.md` (how it fits together) and `PLAN.md` (what to build next, with checkboxes). Update the checkboxes in `PLAN.md` as tasks finish.

## What this project is

A portfolio demo dashboard for UK real estate. A landlord's property list is enriched with open data. The dashboard then shows:

- which assets fail current or upcoming EPC (energy efficiency) rules
- which assets sit in flood-risk areas
- a rough upgrade budget

It is a client-acquisition demo, so it must look polished and institutional, load fast, and be trustworthy.

- Working name: **RiskLens Portfolio** (fictional brand; keep it configurable in `web/src/config/brand.ts`).
- Geography: England and Wales for EPC; England only for Environment Agency flood data.
- Demo scope: 3–4 local authorities, synthetic portfolio of ~180 assets built from real EPC records.

## Hard rules (never break these)

1. **Open data only.** Every dataset must be under the Open Government Licence (OGL) or ODbL. Allowed sources are listed in `ARCHITECTURE.md` § Data sources.
   - Do NOT use HM Land Registry Price Paid Data. Its address fields carry Royal Mail / Ordnance Survey restrictions.
   - Do NOT use any paid or keyed API: no Mapbox, Google, OS Places, AddressBase or postcodes.io.
2. **No addresses in published output.** The ETL may read EPC address columns only to drop them. Published files contain asset IDs, UPRNs, postcodes (from the ONS Postcode Directory) and certificate fields, never street addresses.
3. **No backend.** No Supabase, Firebase, servers, serverless functions or databases. Everything ships as static files on GitHub Pages. Uploaded CSVs are processed in the browser with DuckDB-Wasm.
4. **Open-source tooling only.** Use permissive licences (MIT, BSD, Apache-2.0, ISC). Ask before adding any dependency outside that.
5. **No secrets in the repo.** None should be needed. If you think one is, stop and ask.
6. **Regulatory rules live in config, not code.** Deadlines, thresholds and scoring weights live in `web/public/config/rules.json` and are read by both the ETL and the front end.
7. **Never invent figures.** If a cost, date or threshold isn't in `rules.json` or the source data, leave a clearly marked `TODO` and tell me.
8. **Label uncertainty in the UI.**
   - Upgrade costs are "indicative".
   - The 2031 non-domestic EPC B rule is "announced, subject to legislation".
   - The footer carries the disclaimer and OGL attributions (`ARCHITECTURE.md` § Attribution).

## Repo layout

```
risklens/
├── CLAUDE.md, PLAN.md, ARCHITECTURE.md
├── etl/                      # Python pipeline
│   ├── pyproject.toml
│   ├── config/areas.yaml     # demo local authorities + boundaries
│   ├── config/epc_columns.yaml  # maps raw EPC headers -> internal names
│   ├── scripts/              # numbered steps: 01_load_epc.py, 02_load_flood.py ...
│   ├── risklens_etl/         # importable package (scoring, matching, io)
│   └── tests/
├── data/                     # gitignored
│   ├── raw/                  # downloads, never committed
│   └── processed/
└── web/                      # Vite + React + TypeScript
    ├── public/
    │   ├── config/rules.json
    │   └── data/             # ETL outputs (committed, small)
    └── src/
```

## Commands

```bash
# ETL (Python 3.11+, use uv or venv)
cd etl && uv sync
uv run python scripts/run_all.py          # full pipeline -> web/public/data/
uv run pytest                              # scoring + matching tests

# Web
cd web && npm install
npm run dev                                # local dev server
npm run build && npm run preview           # production check
npm run lint && npm run typecheck
```

Deploys go through GitHub Actions to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).

## Tech stack

- **ETL:** Python, pandas, GeoPandas, pyarrow, shapely, pyyaml, pytest.
- **Web:**
  - Vite, React 18, TypeScript (strict)
  - MapLibre GL JS, ECharts (echarts-for-react)
  - @duckdb/duckdb-wasm, Papa Parse, jsPDF
  - plain CSS modules or Tailwind (pick one and stay consistent)
- **Basemap:** OpenFreeMap vector style (positron or a muted style), with the "© OpenStreetMap contributors" attribution visible.
- **Flood overlays on the map:** Environment Agency WMS (open data). Asset-level flood bands are always pre-computed in the ETL, never read from WMS.

## Coding conventions

- **Python:**
  - Type hints and small pure functions.
  - Scoring logic lives in `risklens_etl/scoring.py` and is unit tested.
  - Every script is idempotent and logs row counts in and out.
- **TypeScript:**
  - No `any`.
  - Shared types live in `web/src/types.ts` and mirror the schemas in `ARCHITECTURE.md`.
- **Scoring parity:** the same scoring logic exists in Python (`scoring.py`) and TypeScript (`web/src/lib/scoring.ts`, used for uploads). Keep them identical. A shared fixture `etl/tests/fixtures/scoring_cases.json` is run by both pytest and vitest.
- **Design:**
  - Calm, ESG-report feel: neutral greys, one accent colour.
  - Risk tiers: green / amber / red, plus a grey for "no data".
  - Never rely on colour alone; also show tier labels.
- **Accessibility:** keyboard-navigable table and drawer, readable at 375 px width.
- **Commits:** small, one task per commit, and the message references the `PLAN.md` task ID (e.g. `P2.3: asset drawer`).

## How to work

- Before coding a task, restate it in one or two lines and list the files you'll touch.
- After each task, run the relevant tests or build, then tick the box in `PLAN.md`.
- If a raw data file's columns differ from what `ARCHITECTURE.md` expects, update `etl/config/epc_columns.yaml` and tell me. Don't silently guess.
- If something here conflicts with `PLAN.md` or `ARCHITECTURE.md`, ask me before choosing.
