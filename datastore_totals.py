#!/usr/bin/env python3
"""Populate the recent-IATI-universe `TOTALS` counts from the official IATI Datastore.

d-portal (used by add_uae.py / add_sector.py) cannot filter by sector, so it can't
tell you how big each sector's universe is. The **official IATI Datastore**
(https://api.iatistandard.org/) can — it's a Solr index that filters by
`sector_code` and returns `numFound`. This script queries the recent activity
count for every sector present in `js/data.js` and writes it into the `TOTALS`
global, which drives the #read_me "Recent IATI universe by sector" table and the
benchmark "In IATI" column.

It needs a **free API key** (the "subscription key" you get from
https://developer.iatistandard.org/ — register, subscribe to the Datastore API):

    export IATI_DATASTORE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # Windows: set IATI_DATASTORE_KEY=...

    python datastore_totals.py              # fill counts for sectors missing one
    python datastore_totals.py --refresh    # recompute ALL sectors (overwrite the originals too)
    python datastore_totals.py --dry-run    # print the counts; write nothing

"Recent" matches the dataset's basis — activities started on/after RECENT_SINCE
(default 2021-06-02) OR currently ongoing. If the Datastore's field names ever
change, adjust RECENT_FQ below; the script prints each query's numFound so you can
sanity-check against the seven original sectors.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent / "js" / "data.js"
ENDPOINT = "https://api.iatistandard.org/datastore/activity/select"
RECENT_SINCE = "2021-06-02"
# Solr filter for "started in the window OR currently ongoing" — mirrors the app's
# inclusion rule. Adjust here if the Datastore schema's date fields differ.
RECENT_FQ = (f"(activity_date_start_actual:[{RECENT_SINCE}T00:00:00Z TO *] "
             f"OR activity_date_start_planned:[{RECENT_SINCE}T00:00:00Z TO *] "
             f"OR activity_status_code:2)")


def query_count(key, sector_code, retries=3):
    """Recent IATI activity count for one DAC 5-digit sector, or None on failure."""
    params = {
        "q": f"sector_code:{sector_code} AND sector_vocabulary:1",
        "fq": RECENT_FQ,
        "rows": "0",
        "wt": "json",
    }
    url = ENDPOINT + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Ocp-Apim-Subscription-Key": key,
        "Accept": "application/json",
        "User-Agent": "BenchmarkDB-totals/1.0",
    })
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                doc = json.load(r)
            return int(doc.get("response", {}).get("numFound", 0))
        except Exception as e:
            if attempt == retries:
                print(f"  ! {sector_code}: {e}")
                return None
            time.sleep(1.0 * (attempt + 1))
    return None


def block(src, name):
    m = re.search(r"(?:const|let|var)\s+" + name + r"\s*=\s*(\{[\s\S]*?\});", src)
    if not m:
        sys.exit(f"Could not locate {name} in js/data.js")
    return m, json.loads(m.group(1))


def block_arr(src, name):
    m = re.search(r"(?:const|let|var)\s+" + name + r"\s*=\s*(\[[\s\S]*?\]);", src)
    if not m:
        sys.exit(f"Could not locate {name} in js/data.js")
    return json.loads(m.group(1))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="recompute every sector (overwrite originals)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--delay", type=float, default=0.3, help="seconds between Datastore queries")
    args = ap.parse_args()

    key = os.environ.get("IATI_DATASTORE_KEY")
    if not key and not args.dry_run:
        sys.exit("Set IATI_DATASTORE_KEY first (free key from https://developer.iatistandard.org/).")

    src = DATA.read_text(encoding="utf-8")
    programs = block_arr(src, "PROGRAMS")
    totals_m, totals = block(src, "TOTALS")

    # Distinct sectors in the data: dominant DAC code -> (sector name, stream).
    sectors = {}
    for p in programs:
        sc, sn, s = p.get("sc"), p.get("sn"), p.get("s")
        if sc and sn and re.fullmatch(r"\d{5}", sc):
            sectors.setdefault(sc, (sn, s))
    todo = [(sc, sn, s) for sc, (sn, s) in sorted(sectors.items())
            if args.refresh or sn not in totals]
    print(f"{len(sectors)} sectors in data; querying {len(todo)} "
          f"(window: started ≥ {RECENT_SINCE} or ongoing).")

    if args.dry_run and not key:
        for sc, sn, s in todo:
            print(f"  would query sector_code:{sc}  → {sn} [{s}]")
        print("[dry-run] no key / no API calls."); return

    updated = 0
    for sc, sn, s in todo:
        n = query_count(key, sc)
        if n is None:
            continue
        print(f"  {sc} {sn:<34} {n:>7,}")
        if not args.dry_run:
            totals[sn] = {"recent_total": n, "stream": s}
            updated += 1
        time.sleep(args.delay)

    if args.dry_run:
        print("[dry-run] no files written."); return
    if updated:
        src = src.replace(totals_m.group(1),
                          json.dumps(totals, ensure_ascii=False, separators=(",", ":")), 1)
        DATA.write_text(src, encoding="utf-8")
        print(f"Wrote {updated} sector totals into {DATA}.")
    else:
        print("No totals updated.")


if __name__ == "__main__":
    main()
