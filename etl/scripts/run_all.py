"""Run the full ETL pipeline (steps 01-07), copy outputs to web/public/data/, then run publish checks.

Raw downloads (scripts/00_fetch_raw.py and the manual EPC download) are a separate, recorded step.
Usage: uv run python scripts/run_all.py [--from N]   (--from 7 re-runs only the last step)
"""

from __future__ import annotations

import argparse
import logging
import shutil
import subprocess
import sys
import time
from pathlib import Path

from risklens_etl.checks import check_outputs

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent
PROCESSED = ROOT / "data" / "processed"
WEB_DATA = ROOT / "web" / "public" / "data"

STEPS = ["01_load_epc.py", "02_load_flood.py", "03_load_locations.py", "04_flood_join.py",
         "05_hpi.py", "06_sample_portfolio.py", "07_enrich_score.py"]
PUBLISH = ["portfolio_enriched.geojson", "portfolio_sample.csv", "uprn_epc.parquet", "uprn_flood.parquet",
           "postcode_lookup.parquet", "hpi.parquet"]
GEOJSON_MAX = 1_000_000
PARQUET_MAX = 25_000_000

log = logging.getLogger("run_all")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="start", type=int, default=1, help="first step number to run (1-7)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    for step in STEPS[args.start - 1:]:
        t0 = time.time()
        log.info("=== %s", step)
        subprocess.run([sys.executable, str(SCRIPTS / step)], check=True, cwd=ROOT / "etl")
        log.info("=== %s done in %.0fs", step, time.time() - t0)

    WEB_DATA.mkdir(parents=True, exist_ok=True)
    (WEB_DATA / ".gitkeep").unlink(missing_ok=True)
    for name in PUBLISH:
        shutil.copy2(PROCESSED / name, WEB_DATA / name)
    log.info("copied %d files to %s", len(PUBLISH), WEB_DATA.relative_to(ROOT))

    problems, sizes = check_outputs(WEB_DATA, GEOJSON_MAX, PARQUET_MAX)
    for name, size in sizes.items():
        print(f"  {name:28s} {size / 1e6:7.2f} MB")
    pq_total = sum(v for k, v in sizes.items() if k.endswith(".parquet"))
    print(f"  {'parquet total':28s} {pq_total / 1e6:7.2f} MB (budget {PARQUET_MAX / 1e6:.0f} MB)")
    if problems:
        for p in problems:
            log.error(p)
        sys.exit(1)
    log.info("publish checks passed: no address columns or address-like text; size budgets met")


if __name__ == "__main__":
    main()
