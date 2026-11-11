# Raw data manifest

Record every raw download here: source page, direct URL, download date, release, size and SHA-256.
`data/` is gitignored, so this file is the only record of what the ETL was built from.

| Folder | File | Release | Downloaded | Size (bytes) | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `os_open_uprn/` | `osopenuprn_202610_csv.zip` | OS Open UPRN, October 2026 | 2026-11-10 | 619,869,247 | `d353528c91032b693e42cb84d8b7c359d87f625b43dc044b2f85d02dffb7904b` |
| `onspd/` | `ONSPD_AUG_2026.zip` | ONS Postcode Directory, August 2026 | 2026-11-10 | 253,928,895 | `ab51f1e82bd5beeb1089c3732ea6e11d62eb5693d619e2c4f4dd8c4baaa69293` |
| `hpi/` | `UK-HPI-full-file-2026-08.csv` | UK HPI full file, August 2026 data | 2026-11-10 | 35,125,643 | `b00756d0c39f356d17fadf93c42af75ccc48f7123cd666e602c65260d081b6c9` |

## Sources

### OS Open UPRN
- Product page: https://osdatahub.os.uk/downloads/open/OpenUPRN
- Direct URL: https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect
- Licence: OS OpenData (OGL v3.0). Attribution from `licence.txt`: "Contains Ordnance Survey data © Crown copyright and database right 2026."
- Contents: `osopenuprn_202610.csv` (2.3 GB unzipped), with columns `UPRN, X_COORDINATE, Y_COORDINATE, LATITUDE, LONGITUDE`.

### ONS Postcode Directory (ONSPD)
- Hub page: https://open-geography-portalx-ons.hub.arcgis.com/ (item `9e5a92a3cfb14dc7ad43d6ea7a7b8c7f`)
- Direct URL: https://www.arcgis.com/sharing/rest/content/items/9e5a92a3cfb14dc7ad43d6ea7a7b8c7f/data
- Licence: OGL v3.0. The listing notes that the product "contains Royal Mail, Gridlink, LPS (Northern Ireland), Ordnance Survey and ONS Intellectual Property Rights". TODO: confirm the exact attribution wording from `User Guide/ONSPD User Guide Aug 2026.pdf`.
- Contents: `Data/ONSPD_AUG_2026_UK.csv` (1.5 GB unzipped) plus per-area files in `Data/multi_csv/`.
- Schema note: the LA column is `lad26cd`, not `oslaua`. Postcode is `pcds`; coordinates are `lat` and `long`; LSOA is `lsoa21cd`.

### UK House Price Index
- Page: https://www.gov.uk/government/statistical-data-sets/uk-house-price-index-data-downloads-august-2026
- Direct URL: https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/UK-HPI-full-file-2026-08.csv
- Licence: OGL v3.0 (HM Land Registry, ONS). This is the HPI index file, not Price Paid Data.
- Latest month available on 2026-11-10. The September file returned 404.

## Scripted downloads (`etl/scripts/00_fetch_raw.py`)

The data was first fetched on 2026-11-10 in WGS84. It was **re-fetched on 2026-11-11 natively in British National Grid (EPSG:27700)** to remove a 2–3 m datum-shift error: pyproj here has no OSTN15 grid. See `docs/verification.md`.

- Endpoints are in `etl/config/sources.yaml` and areas in `etl/config/areas.yaml`.
- All files are GeoJSON in EPSG:27700, with a `crs` member so GeoPandas reads them correctly.
- Each flood file holds the features intersecting the LA boundary's bbox, padded by 100 m. P1.3 clips them to the boundary.

### LA boundaries
- `boundaries/lad_may2026_bgc_demo.geojson`: 4 features (E06000014, E07000145, E09000033, E09000013), fetched with `outSR=27700`.
- Source: ONS Local Authority Districts (May 2026) Boundaries UK BGC, hub item `43eddab36751466db7bb4006b242243c`.
- Licence: OGL v3.0. Contains OS data © Crown copyright and database right; source: Office for National Statistics.

### Flood layers (Environment Agency, OGL v3.0; `crs` and `bbox-crs` = EPSG:27700)

| Layer | Dataset | York | Great Yarmouth | Westminster | Hammersmith and Fulham | Size |
| --- | --- | --- | --- | --- | --- | --- |
| `flood/rofrs/` | RoFRS NaFRA2, `96ab4342-82c1-4095-87f1-0082e8d84ef1` | 992 | 964 | 43 | 71 | 76 MB |
| `flood/flood_zones/` | Flood Map for Planning FZ2/3, `04532375-a198-476e-985e-0579a0a11b47` | 2,346 | 1,678 | 158 | 235 | 93 MB |
| `flood/rofsw/` | RoFSW NaFRA2, `b5aaa28d-6eb9-460e-8d6f-43caa71fbe0e` | 1,386 | 1,028 | 189 | 162 | 386 MB |

Counts differ slightly from the first fetch because the bbox is now the LA boundary's own extent in metres, rather than a WGS84 box. No layer reported a `numberMatched` mismatch.

## EPC (manual download by Surabhi, 2026-11-10)

- Source: https://get-energy-performance-data.communities.gov.uk/ (GOV.UK One Login; OGL v3.0 for certificate data).
- Filtered on the service to the four demo LAs. Address columns are present in the raw files and must be dropped on load (CLAUDE.md rule 2).

| File | Original download name | Rows | Size (bytes) | SHA-256 |
| --- | --- | --- | --- | --- |
| `epc/domestic/certificates.csv` | `fd1b0901-3a29-43ab-912f-0a3f82d8003e.csv` | 459,868 | 495,031,933 | `c9e200ca16fc8c28ab3edae47849005ba2b38de9687e776af85bb55ffaa0af24` |
| `epc/domestic/recommendations.csv` | `f50839b9-1249-427c-938d-bbf8eb476d31.csv` | 1,381,525 | 916,000,197 | `35ea43143bce2098712f9bf05cf2457416fd1364a8fa3056b26509537d25aa62` |

Domestic certificates per LA:

| LA | Rows |
| --- | --- |
| Westminster (E09000033) | 182,793 |
| Hammersmith and Fulham (E09000013) | 127,886 |
| York (E06000014) | 95,540 |
| Great Yarmouth (E07000145) | 53,642 |
| Odd codes | 7: six `E07000147` labelled Great Yarmouth, one `E06000065` labelled York |

- Lodgement dates run from 2008-09-22 to 2026-10-31.
- 23,374 certificates have no UPRN.
- Every recommendation row links to a certificate via `certificate_number`.

### Non-domestic (manual download by Surabhi, 2026-11-10)

| File | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `epc/non_domestic/non-domestic-csv.zip` | 306,723,726 | `d007593b1734b960a3f7eefb4b9045e0a1c21b57825a0b5351874a477d45e6e9` |

- This is the national file (England and Wales), not filtered by LA. It holds yearly `certificates-YYYY.csv` and `recommendations-YYYY.csv` for 2008–2026: about 0.7 GB and 2.1 GB unzipped. Leave it zipped; the ETL streams it and filters to the demo LAs.
- There are 1,598,892 certificates in total and 48,215 in the demo LAs:

| LA | Certificates | Over 1,000 m² |
| --- | --- | --- |
| Westminster | 30,811 | 4,402 |
| Hammersmith and Fulham | 7,956 | 730 |
| York | 6,280 | 901 |
| Great Yarmouth | 3,168 | 317 |

- Certificate columns of note: `asset_rating`, `asset_rating_band`, `floor_area`, `property_type`, `lodgement_date`, `uprn`. Address columns are present and must be dropped.
- Recommendation columns are `certificate_number, related_certificate_number, payback_type, recommendation_item, recommendation_code, recommendation`. There is **no `indicative_cost`**, so commercial upgrade costs can't come from the EPC data.

## Pending

None. All Phase 0 raw data is in place.
