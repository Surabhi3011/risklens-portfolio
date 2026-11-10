# PLAN.md — RiskLens Portfolio build plan

Three phases, roughly one week each, part-time. Work top to bottom. Each task has an ID, a done-when check, and a box to tick. See `CLAUDE.md` for rules and `ARCHITECTURE.md` for schemas.

## Phase 0 — Before coding (Surabhi, manual)

- [x] **P0.1** Sign in with GOV.UK One Login at get-energy-performance-data.communities.gov.uk. Download domestic and non-domestic EPC bulk CSVs (certificates + recommendations) for the chosen local authorities into `data/raw/epc/`.
- [x] **P0.2** Choose 3–4 demo local authorities with mixed risk, e.g. a riverside northern city, a coastal town, and two London boroughs. Record their LA codes in `etl/config/areas.yaml`.
- [x] **P0.3** Download into `data/raw/`:
  - EA RoFRS, Flood Zones 2 and 3, and RoFSW for those areas (Defra Data Services Platform)
  - OS Open UPRN
  - ONS Postcode Directory (latest)
  - UK House Price Index full CSV
  - LA boundary file (ONS Open Geography)
- [x] **P0.4** Write download dates and source URLs in `data/raw/MANIFEST.md`.
- [ ] **P0.5** Pick the brand name and accent colour, or keep "RiskLens Portfolio".

## Phase 1 — Data pipeline (week 1)

- [x] **P1.1 Scaffold repo.** Create the folders from `CLAUDE.md`, plus `.gitignore` (ignore `data/`), `etl/pyproject.toml` with pandas, geopandas, pyarrow, shapely, pyyaml and pytest, and an empty `run_all.py`.
  - Done when `uv run pytest` runs (0 tests) and `data/` is ignored.
- [x] **P1.2 EPC loader** (`01_load_epc.py`). Inspect the raw headers, write `epc_columns.yaml`, load domestic and non-domestic, drop address columns, keep the latest certificate per UPRN, add `epc_expired`, and parse recommendation costs.
  - Done when you print row counts per LA and no column containing ADDRESS survives in the output.
- [x] **P1.3 Flood loader** (`02_load_flood.py`). Clip RoFRS, Flood Zones and RoFSW to the demo LA boundaries, reproject to EPSG:27700, and save as GeoParquet.
  - Done when you print feature counts per layer and per LA.
- [x] **P1.4 Locations** (`03_load_locations.py`). Filter OS Open UPRN and ONSPD to the demo LAs.
- [x] **P1.5 Flood join** (`04_flood_join.py`). Spatially join UPRN points to each flood layer, keeping the worst band per layer. Write `uprn_flood.parquet`.
  - Done when you print the band distribution and spot-check 5 UPRNs against the gov.uk "check long term flood risk" service.
  - Note (2026-11-10): the gov.uk postcode search is behind a CAPTCHA, so the 5 UPRNs were checked against the EA's own WMS GetFeatureInfo at each point instead (5/5 match). A manual gov.uk check is still open.
- [x] **P1.6 HPI** (`05_hpi.py`). Take the latest month's average price per LA and property type, and write `hpi.parquet`.
- [x] **P1.7 Scoring module** (`risklens_etl/scoring.py`). Implement `ARCHITECTURE.md` §4, reading `web/public/config/rules.json`. Create `tests/fixtures/scoring_cases.json` with at least 12 hand-checked cases covering every branch (including owner-occupied, no EPC, expired, commercial over 1,000 m², and postcode-only).
  - Done when all tests pass.
- [x] **P1.8 Sample portfolio** (`06_sample_portfolio.py`). With a fixed seed, pick 150 rented domestic and 30 rented non-domestic UPRNs (a few over 1,000 m²), roughly 40% rated D or below, with at least 10% in some flood band. Assign `RL-0001…`.
  - Done when you print the band and flood mix.
- [x] **P1.9 Enrich and export** (`07_enrich_score.py` + `run_all.py`). Produce `portfolio_enriched.geojson` (§3.3), `uprn_epc.parquet` and `postcode_lookup.parquet`, then copy everything to `web/public/data/`.
  - Done when the GeoJSON is under 1 MB, all Parquet files total under 25 MB, and no address strings appear (grep check).

## Phase 2 — Dashboard (week 2)

- [x] **P2.1 Scaffold web app.** Set up Vite + React + TS (strict), ESLint, vitest, MapLibre, ECharts and Zustand. Load `rules.json` and the GeoJSON.
  - Done when `npm run build` passes and the asset count shows on the page.
- [x] **P2.2 Scoring parity.** Write `lib/scoring.ts` and a vitest that runs `scoring_cases.json`.
  - Done when the same results come out as in Python.
- [x] **P2.3 Layout and KPI row.** Build the header, KPI row (assets, % below C, % in Flood Zone 3, indicative upgrade budget, value exposed) and footer with the full disclaimer and attributions (§7).
- [x] **P2.4 Risk map.** Use the OpenFreeMap muted style with points coloured by tier and labelled in the legend. Add WMS toggles for RoFRS, Flood Zones and RoFSW, and visible OSM attribution.
  - Done when the toggles work and clicking a point selects the asset.
- [x] **P2.5 Charts.** Add the EPC band distribution (bar, bands A–G in order) and the compliance timeline (non-compliant counts at today, Oct 2030 and 2031, with 2031 labelled "announced").
- [x] **P2.6 Filters and table.** Filter by LA, use, band and tier, applied to the map, charts, KPIs and table together. Make the table sortable.
- [x] **P2.7 Asset drawer.** Show current vs potential band, the failing rule and its deadline, flood bands, the top 3 recommendations with indicative costs, match level, and EPC age.
- [x] **P2.8 Design pass.**
  - Calm, institutional styling.
  - Readable at 375 px.
  - Keyboard access to the table and drawer.
  - Tier never shown by colour alone.

## Phase 3 — Upload, export, ship (week 3)

- [x] **P3.1 Upload dialog.** Offer a downloadable sample CSV and validate input against §3.2, showing clear row-level errors.
- [x] **P3.2 DuckDB-Wasm enrichment** (`lib/duck.ts`). Lazy-load it, join by UPRN, fall back to postcode, score in TS and replace the store.
  - Done when the summary shows the counts matched by UPRN, matched by postcode, and not covered, and a 500-row upload takes under 5 s.
- [ ] **P3.3 Exports.** The CSV export contains the enriched assets for the current filter. The one-page PDF (jsPDF) has the KPIs, band chart image, top 10 act-now assets, disclaimer and attribution.
- [ ] **P3.4 Summary card.** Add a template-generated paragraph built from portfolio stats, e.g. "62 of 180 assets (34%) fall below EPC C ahead of the October 2030 deadline…". No external AI API.
- [ ] **P3.5 Verify.**
  - Spot-check 20 assets against the gov.uk EPC register and the flood risk service.
  - Run Lighthouse (performance and accessibility above 90).
  - Check that no address strings appear in `web/dist`.
- [ ] **P3.6 Deploy.** Add a GitHub Actions workflow that builds `web/` to GitHub Pages and sets the Vite `base`. Confirm the Parquet files load on the live site.
- [ ] **P3.7 README.** Cover what it is, a screenshot, the data sources with licences, how to run the ETL, and a limitations section (demo areas only, indicative costs, announced rules).

## Later (not in this build)

- What-if planner: tick upgrades and see the portfolio reach compliance.
- More areas, or a national build with tiled Parquet.
- Heat-stress layer from UKCP18.
- Lender view weighted by loan balance.

## Starter prompt for Claude Code

> Read CLAUDE.md, ARCHITECTURE.md and PLAN.md. Then start Phase 1 at task P1.1. Before each task, tell me in two lines what you'll do and which files you'll touch. After each task, run the checks in its "done when", tick the box in PLAN.md, and stop for my review at the end of each phase.
