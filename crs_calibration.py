#!/usr/bin/env python3
"""Populate the OECD-CRS column of the #read_me calibration table — no key needed.

The calibration table compares this sample against the recent IATI universe; this
adds an *outside* reference column: recent ODA per sector from the **OECD Creditor
Reporting System (CRS)**, the authoritative record of all DAC donors' aid. CRS
reports against **DAC purpose codes — the same 5-digit codes used here** — so it
maps directly.

It pulls straight from the **OECD SDMX API** (public, no key) — all DAC donors →
developing countries, by sector, latest year — and writes a `CRS` global into
js/data.js keyed by sector name: { "Basic drinking water": {oda, year} }.

    python crs_calibration.py            # fetch + write
    python crs_calibration.py --dry-run  # print the figures; write nothing
    python crs_calibration.py --start 2021   # earliest year to consider

Amounts are OECD ODA in current US$ (the CRS values are USD millions; scaled to
absolute USD here so the dashboard shows e.g. "$10.3B"). It's a different measure
from the IATI activity counts — shown for scale, not as a coverage denominator.
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

from iati_ingest import DATA

# All DAC donors (DAC) -> developing countries (DPGC + unallocated), SECTOR open,
# MEASURE 100 = ODA, current prices. dimensionAtObservation=AllDimensions.
URL = ("https://sdmx.oecd.org/dcd-public/rest/data/OECD.DCD.FSD,DSD_CRS@DF_CRS,1.6/"
       "DAC.DPGC+DPGC_X..100._T._T.D.Q._T..?startPeriod={start}&dimensionAtObservation=AllDimensions")
HEADERS = {"Accept": "application/vnd.sdmx.data+json; charset=utf-8; version=1.0",
           "User-Agent": "BenchmarkDB-crs/1.0"}
MULT = 1_000_000   # CRS values are USD millions; the "USD" unit label omits the multiplier


def fetch(start):
    req = urllib.request.Request(URL.format(start=start), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", type=int, default=2021, help="earliest year to consider")
    ap.add_argument("--year", type=int, help="force a specific year (default: latest available)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    try:
        doc = fetch(args.start)
    except Exception as e:
        sys.exit(f"OECD SDMX fetch failed: {e}")
    dims = doc["data"]["structure"]["dimensions"]["observation"]
    sec_i = next(i for i, d in enumerate(dims) if d["id"] == "SECTOR")
    time_i = next(i for i, d in enumerate(dims) if d["id"] == "TIME_PERIOD")
    sec_vals = dims[sec_i]["values"]
    time_vals = dims[time_i]["values"]

    by_year = {}   # {year: {sector_code: usd_millions}}
    for key, val in doc["data"]["dataSets"][0]["observations"].items():
        if not val or val[0] is None:
            continue
        idx = key.split(":")
        code = sec_vals[int(idx[sec_i])]["id"]
        if not re.fullmatch(r"\d{5}", code):
            continue
        year = time_vals[int(idx[time_i])]["id"]
        by_year.setdefault(year, {})[code] = by_year.get(year, {}).get(code, 0) + val[0]

    if not by_year:
        sys.exit("No sector observations returned.")
    use = str(args.year) if args.year else max(by_year, key=lambda y: int(y))
    if use not in by_year:
        sys.exit(f"Year {use} not in data ({sorted(by_year)}).")

    # map purpose code -> the sector name the dataset uses
    src = DATA.read_text(encoding="utf-8")
    sn_map = {p["sc"]: p["sn"] for p in
              json.loads(re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src).group(1))
              if p.get("sc") and p.get("sn")}
    crs = {}
    for code, musd in by_year[use].items():
        name = sn_map.get(code)
        usd = musd * MULT
        if name and usd > 0:
            crs[name] = {"oda": int(usd), "year": int(use)}

    print(f"OECD CRS {use}: mapped {len(crs)} sectors. Top:")
    for name in sorted(crs, key=lambda n: -crs[n]["oda"])[:8]:
        print(f"  {name:<34} ${crs[name]['oda']/1e9:,.2f}bn")
    if args.dry_run or not crs:
        print("[dry-run] nothing written." if args.dry_run else "Nothing to write."); return

    block = json.dumps(crs, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    if re.search(r"(?:const|let|var)\s+CRS\s*=\s*\{[\s\S]*?\};", src):
        src = re.sub(r"((?:const|let|var)\s+CRS\s*=\s*)\{[\s\S]*?\};", r"\g<1>" + block + ";", src, count=1)
    else:   # insert right after the TOTALS global
        src = re.sub(r"((?:const|let|var)\s+TOTALS\s*=\s*\{[\s\S]*?\};)",
                     r"\1\nconst CRS=" + block + ";", src, count=1)
    DATA.write_text(src, encoding="utf-8")
    print(f"\nWrote CRS global ({len(crs)} sectors, year {use}) into {DATA}.")


if __name__ == "__main__":
    main()
