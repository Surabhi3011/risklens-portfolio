# Verification (PLAN.md P3.5)

Run on 2026-11-10/11 against the demo build. The 20 spot-check assets were drawn as 4 residential per LA plus 4 commercial, using a fixed seed. Published outputs contain no addresses. The certificate links below open the public EPC register, which does show the address.

## 1. EPC register spot-check: 20 / 20 match

Each certificate was opened on the public register (find-energy-certificate.service.gov.uk) by certificate number. Band, score, certificate date and floor area match for all 20 assets. "Expired" also agrees for all 20: the register marks RL-0032, RL-0047 and RL-0157 as expired, and so does the pipeline, which scores them "No valid EPC".

Two register floor areas (RL-0159 and RL-0157) use thousands separators, "1,562" and "3,010". They were read from the page directly.

| Asset | LA | Use | Band (ours / register) | Score | Certificate date | Floor area m² (ours / register) | Expired (ours / register) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RL-0032 | York | residential | C / C | 72 / 72 | 2016-07-25 / 2016-07-25 | 20 / 20 | True / True |
| RL-0024 | York | residential | C / C | 76 / 76 | 2025-04-11 / 2025-04-11 | 40 / 40 | False / False |
| RL-0020 | York | residential | E / E | 52 / 52 | 2018-08-28 / 2018-08-28 | 86 / 86 | False / False |
| RL-0009 | York | residential | D / D | 64 / 64 | 2022-03-18 / 2022-03-18 | 56 / 56 | False / False |
| RL-0047 | Great Yarmouth | residential | D / D | 65 / 65 | 2013-07-20 / 2013-07-20 | 47 / 47 | True / True |
| RL-0052 | Great Yarmouth | residential | E / E | 45 / 45 | 2024-03-13 / 2024-03-13 | 63 / 63 | False / False |
| RL-0055 | Great Yarmouth | residential | D / D | 58 / 58 | 2025-05-24 / 2025-05-24 | 60 / 60 | False / False |
| RL-0072 | Great Yarmouth | residential | C / C | 69 / 69 | 2019-10-01 / 2019-10-01 | 29 / 29 | False / False |
| RL-0082 | Hammersmith and Fulham | residential | D / D | 65 / 65 | 2026-06-18 / 2026-06-18 | 70 / 70 | False / False |
| RL-0087 | Hammersmith and Fulham | residential | G / G | 14 / 14 | 2018-03-02 / 2018-03-02 | 151 / 151 | False / False |
| RL-0090 | Hammersmith and Fulham | residential | D / D | 63 / 63 | 2023-05-16 / 2023-05-16 | 52 / 52 | False / False |
| RL-0107 | Hammersmith and Fulham | residential | C / C | 69 / 69 | 2026-06-16 / 2026-06-16 | 20 / 20 | False / False |
| RL-0142 | Westminster | residential | C / C | 70 / 70 | 2021-09-16 / 2021-09-16 | 44 / 44 | False / False |
| RL-0134 | Westminster | residential | E / E | 54 / 54 | 2018-08-22 / 2018-08-22 | 105 / 105 | False / False |
| RL-0130 | Westminster | residential | C / C | 69 / 69 | 2018-06-30 / 2018-06-30 | 70 / 70 | False / False |
| RL-0119 | Westminster | residential | C / C | 70 / 70 | 2021-03-11 / 2021-03-11 | 67 / 67 | False / False |
| RL-0166 | Hammersmith and Fulham | commercial | C / C | 65 / 65 | 2026-02-16 / 2026-02-16 | 57 / 57 | False / False |
| RL-0159 | Great Yarmouth | commercial | E / E | 117 / 117 | 2026-04-16 / 2026-04-16 | 1562 / 1562 | False / False |
| RL-0157 | York | commercial | C / C | 53 / 53 | 2012-06-19 / 2012-06-19 | 3010 / 3010 | True / True |
| RL-0177 | Westminster | commercial | B / B | 33 / 33 | 2019-06-21 / 2019-06-21 | 696 / 696 | False / False |

## 2. Flood spot-check: 18 / 20 exact

The gov.uk "check long term flood risk" postcode search is behind a CAPTCHA, so automated checks used the Environment Agency's own WMS (GetFeatureInfo at the exact point, 1 m pixel).

| Asset | Ours (RoFRS / zone / RoFSW) | EA WMS at point | Match |
| --- | --- | --- | --- |
| RL-0032 | none / none / none | none / none / none | yes |
| RL-0024 | none / none / none | none / none / none | yes |
| RL-0020 | none / none / medium | none / none / high | **no** |
| RL-0009 | none / none / none | none / none / none | yes |
| RL-0047 | none / none / none | none / none / none | yes |
| RL-0052 | none / none / none | none / none / none | yes |
| RL-0055 | none / none / none | none / none / none | yes |
| RL-0072 | none / none / none | none / none / none | yes |
| RL-0082 | none / none / medium | none / none / high | **no** |
| RL-0087 | none / none / none | none / none / none | yes |
| RL-0090 | none / 3 / none | none / 3 / none | yes |
| RL-0107 | none / none / none | none / none / none | yes |
| RL-0142 | none / none / none | none / none / none | yes |
| RL-0134 | none / none / none | none / none / none | yes |
| RL-0130 | none / none / none | none / none / none | yes |
| RL-0119 | none / none / low | none / none / low | yes |
| RL-0166 | none / 3 / none | none / 3 / none | yes |
| RL-0159 | none / none / none | none / none / none | yes |
| RL-0157 | low / 3 / none | low / 3 / none | yes |
| RL-0177 | none / none / none | none / none / none | yes |

**The two mismatches (RL-0020, RL-0082).** In both, the EA WMS reports surface water High where we have Medium. Investigation:

- In the vector data we downloaded, the nearest RoFSW High polygon is 1.8–1.9 m from each point. The pipeline is faithful to that data.
- Re-fetching the features natively in EPSG:27700 from the EA OGC API, with no reprojection, also gives Medium at both points. Re-querying the WMS with `BUFFER=0` still gives High.
- Conclusion: the WMS view and the published OGL vector product differ by about 2 m at polygon edges. The dashboard follows the vector product. This is within the "indicative screening" framing, but it affects points close to surface-water boundaries.

**Accuracy issue found in passing: fixed on 2026-11-11.** pyproj in the ETL lacks the OSTN15 transformation grid, so WGS84 → EPSG:27700 conversions fell back to a Helmert approximation with roughly 2–3 m error. That affected the flood polygons and LA boundaries. The fix: `00_fetch_raw.py` now requests the flood layers (`crs`/`bbox-crs`) and LA boundaries (`outSR`) natively in EPSG:27700, and postcode centroids use ONSPD `east1m`/`north1m`. The ETL no longer performs any datum shift. Measured impact:

| What | Changed |
| --- | --- |
| UPRN bands, rivers and sea | 1,511 of 583,328 (0.26%) |
| UPRN bands, flood zones | 1,799 (0.31%) |
| UPRN bands, surface water | 14,040 (2.41%; finer polygons, more edges) |
| UPRNs on LA borders reassigned or now outside | 200 |
| Demo portfolio (same 180 properties) | 3 assets' surface-water band: RL-0053 medium → low (score 50 → 33, still Watch), RL-0067 none → low, RL-0091 low → medium. No tier changed. |

After the fix, the flood spot-check is unchanged at 18/20. The two remaining edge cases are the WMS-vs-vector difference described above, not the datum shift. pytest (45), vitest (59) and the browser upload-parity check (180/180) all pass on the regenerated data.

To keep asset IDs stable when data is refreshed, `06_sample_portfolio.py` now reuses the published `portfolio_sample.csv`, failing if any asset no longer resolves. Pass `--resample` to draw a new sample.

### Manual gov.uk check (to do by hand)

For each row, open the certificate to see the address, then search its postcode on https://check-long-term-flood-risk.service.gov.uk/ and record the result.

| Asset | Postcode | EPC certificate (shows the address) | Our bands (RoFRS / zone / RoFSW) | gov.uk result |
| --- | --- | --- | --- | --- |
| RL-0032 | YO10 3JW | [0749-2865-7130-9196-3975](https://find-energy-certificate.service.gov.uk/energy-certificate/0749-2865-7130-9196-3975) | none / none / none | |
| RL-0024 | YO32 2ZB | [9090-3049-5204-4165-0200](https://find-energy-certificate.service.gov.uk/energy-certificate/9090-3049-5204-4165-0200) | none / none / none | |
| RL-0020 | YO32 3LU | [2448-0072-6218-7878-3994](https://find-energy-certificate.service.gov.uk/energy-certificate/2448-0072-6218-7878-3994) | none / none / medium | |
| RL-0009 | YO10 3BZ | [0212-0527-4050-0038-5296](https://find-energy-certificate.service.gov.uk/energy-certificate/0212-0527-4050-0038-5296) | none / none / none | |
| RL-0047 | NR29 3NS | [9388-9901-7270-1357-3970](https://find-energy-certificate.service.gov.uk/energy-certificate/9388-9901-7270-1357-3970) | none / none / none | |
| RL-0052 | NR31 7DW | [8734-9827-3300-0959-5292](https://find-energy-certificate.service.gov.uk/energy-certificate/8734-9827-3300-0959-5292) | none / none / none | |
| RL-0055 | NR30 3BB | [4535-9725-5500-0267-0226](https://find-energy-certificate.service.gov.uk/energy-certificate/4535-9725-5500-0267-0226) | none / none / none | |
| RL-0072 | NR30 2JL | [2358-5024-7241-6961-9980](https://find-energy-certificate.service.gov.uk/energy-certificate/2358-5024-7241-6961-9980) | none / none / none | |
| RL-0082 | W12 7AE | [0360-2512-8660-2596-4305](https://find-energy-certificate.service.gov.uk/energy-certificate/0360-2512-8660-2596-4305) | none / none / medium | |
| RL-0087 | W14 0HS | [0351-2866-7928-9628-8065](https://find-energy-certificate.service.gov.uk/energy-certificate/0351-2866-7928-9628-8065) | none / none / none | |
| RL-0090 | SW6 5JB | [0350-2399-8250-2797-8601](https://find-energy-certificate.service.gov.uk/energy-certificate/0350-2399-8250-2797-8601) | none / 3 / none | |
| RL-0107 | W14 0DA | [5836-9526-5600-0815-3296](https://find-energy-certificate.service.gov.uk/energy-certificate/5836-9526-5600-0815-3296) | none / none / none | |
| RL-0142 | W9 3BQ | [2408-4111-6212-1811-2111](https://find-energy-certificate.service.gov.uk/energy-certificate/2408-4111-6212-1811-2111) | none / none / none | |
| RL-0134 | W2 6QE | [8558-6328-4220-4996-8992](https://find-energy-certificate.service.gov.uk/energy-certificate/8558-6328-4220-4996-8992) | none / none / none | |
| RL-0130 | NW8 6LR | [0441-2851-6260-9828-7815](https://find-energy-certificate.service.gov.uk/energy-certificate/0441-2851-6260-9828-7815) | none / none / none | |
| RL-0119 | NW8 9RY | [0160-2479-0070-2299-6225](https://find-energy-certificate.service.gov.uk/energy-certificate/0160-2479-0070-2299-6225) | none / none / low | |
| RL-0166 | SW6 2DH | [0923-0203-0306-0210-4000](https://find-energy-certificate.service.gov.uk/energy-certificate/0923-0203-0306-0210-4000) | none / 3 / none | |
| RL-0159 | NR31 0AG | [9192-4836-5202-8104-5706](https://find-energy-certificate.service.gov.uk/energy-certificate/9192-4836-5202-8104-5706) | none / none / none | |
| RL-0157 | YO31 7SX | [9826-3085-0121-0400-0171](https://find-energy-certificate.service.gov.uk/energy-certificate/9826-3085-0121-0400-0171) | low / 3 / none | |
| RL-0177 | WC2E 8BH | [0060-7991-0391-7630-3060](https://find-energy-certificate.service.gov.uk/energy-certificate/0060-7991-0391-7630-3060) | none / none / none | |

## 3. Lighthouse (production build, `vite preview`)

Lighthouse 13.6.0, headless Chrome.

| Run | Performance | Accessibility | Best practices | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| Mobile, before fixes | 48 | 100 | 96 | 0.8 s | 2,140 ms | 0.864 |
| Mobile, after fixes | **97** | **100** | 96 | 2.6 s | 60 ms | 0 |
| Desktop, before fixes | 76 | 97 | 96 | 1.1 s | 420 ms | 0.118 |
| Desktop, after fixes | **92** | **100** | 96 | 0.8 s | 220 ms | 0.001 |

Fixes:

- **Layout shift:** the header's "Rules as of" slot is always reserved, and the main area has a full-screen minimum height so the footer cannot jump.
- **Load time:** the map and charts mount only when scrolled near (MapLibre was 1.7 s of mobile main-thread work), and the table renders 60 rows first with "Show all".
- **Touch targets:** the legend checkboxes are larger.

## 4. Address check on `web/dist`: pass

- **Pattern scan:** all 24 non-binary files in `web/dist` (data, JS, CSS, HTML) were scanned for street-address patterns and forbidden column names. None were found.
- **Data files:** `dist/data/*` is byte-identical to `web/public/data/*`. In P1.9 those files were cross-checked against all 568,785 raw EPC address strings, with no matches.

## 5. Live deployment (P3.6, 2026-11-11)

- **Site:** https://surabhi3011.github.io/risklens-portfolio/. It is deployed by `.github/workflows/deploy.yml`, which runs lint, typecheck and tests, then builds with `VITE_BASE=/risklens-portfolio/`. First run: build 81 s, deploy 9 s.
- **Range requests on Pages:** supported. `Range: bytes=0-1023` on `data/uprn_epc.parquet` returns `206 Partial Content` (`Content-Range: bytes 0-1023/7475517`).
- **Assets:** every lazy chunk returns 200, including the map, charts, PDF export, the DuckDB module, both DuckDB wasm and worker builds, and the MapLibre worker (served as `text/javascript`).
- **Upload on the live site:** the sample CSV gives 180/180 matched by UPRN. A 500-row upload took 1.2 s once DuckDB was loaded. The very first upload in a fresh browser took 12.5 s, mostly the one-off download of the ~8 MB (gzip) DuckDB wasm plus the Parquet lookups. The download starts when the upload dialog opens, so in real use it overlaps with choosing a file.

## 6. UI redesign (2026-11-11)

The dashboard was restyled with a token-based design system: cool neutrals, the brand blue as the single accent, soft tier tints that are always paired with a label, and Lucide icons (ISC licence) in the header, filters, KPI cards and panel headers.

Lighthouse on the production build afterwards:

| Run | Performance | Accessibility | Best practices | CLS |
| --- | --- | --- | --- | --- |
| Mobile (3 runs) | 99–100 | 100 | 96 | 0 |
| Desktop (5 runs) | 72–87 | 100 | 96 | 0 |

**Desktop performance is now below the earlier 92.** With the more compact layout, about 70% of the map panel is visible in Lighthouse's 1350×940 desktop viewport at load, so MapLibre mounts immediately. Its single ~300 ms main-thread task dominates Total Blocking Time. Deferring the map further would only game the audit, because the map is genuinely visible. LCP (about 1.0 s) and CLS (0) are unaffected. The map and charts still load lazily when below the fold, which covers all phone layouts.

**Decision (Surabhi, 2026-11-11):** accept the lower desktop performance score and keep the map loading automatically. A click-to-load map was offered as an alternative and declined.
