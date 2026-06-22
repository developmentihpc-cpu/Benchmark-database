#!/usr/bin/env python3
"""Populate the OECD-CRS column of the #read_me calibration table.

The calibration table compares this sample against the recent IATI universe; this
script adds an *outside* reference column — total recent ODA to each sector from
the **OECD Creditor Reporting System (CRS)**, the authoritative record of all DAC
donors' aid. CRS reports against **DAC purpose codes, which are exactly the
5-digit sector codes used here**, so it maps directly.

It reads an OECD CRS CSV export (no API key, just a download) and writes a `CRS`
global into js/data.js keyed by sector name: { "Basic drinking water": {oda, year} }.

How to get the CSV (one-time, ~2 min):
  1. OECD Data Explorer → "Creditor Reporting System (CRS)"
     https://data-explorer.oecd.org/  (search "CRS")
  2. Filter: Donor = "All donors, Total", Recipient = "Developing countries, Total"
     (or a region), Measure = "Commitments", recent years (e.g. last 3).
  3. Export → CSV (the "table" export with a sector/purpose-code column).
  Or use the CRS bulk microdata file (has `sector_code` + `usd_commitment`).

    python crs_calibration.py --csv crs_export.csv
    python crs_calibration.py --csv crs.csv --recent-years 3 --unit millions
    python crs_calibration.py --csv crs.csv --dry-run

The script auto-detects the sector-code, value and year columns; override with
--sector-col / --value-col / --year-col if your export uses different headers.
Amounts are assumed to be USD **millions** (the CRS standard) unless --unit units.
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

from iati_ingest import DATA, SECTOR_NAME

CODE_RE = re.compile(r"^\d{5}$")
SECTOR_HINTS = ["sector_code", "sector code", "purpose_code", "purpose code", "sector", "purpose", "crs"]
VALUE_HINTS = ["usd_commitment", "obs_value", "value", "amount", "commitment", "usd"]
YEAR_HINTS = ["year", "time_period", "time", "period"]


def pick_column(fieldnames, hints, sample_rows=None, want_codes=False):
    low = {f.lower().strip(): f for f in fieldnames}
    for h in hints:
        for lname, orig in low.items():
            if h in lname:
                return orig
    # fall back: a column that mostly holds 5-digit codes (for the sector column)
    if want_codes and sample_rows:
        for f in fieldnames:
            hits = sum(1 for r in sample_rows if CODE_RE.match((r.get(f) or "").strip()))
            if hits >= max(1, len(sample_rows) // 2):
                return f
    return None


def num(s):
    if s is None:
        return None
    s = str(s).replace(",", "").replace(" ", "").strip()
    try:
        return float(s)
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", required=True, help="OECD CRS CSV export")
    ap.add_argument("--recent-years", type=int, default=3, help="keep the latest N years present")
    ap.add_argument("--unit", choices=["millions", "units"], default="millions",
                    help="CRS amount unit (CRS standard is USD millions)")
    ap.add_argument("--sector-col"); ap.add_argument("--value-col"); ap.add_argument("--year-col")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    path = Path(args.csv)
    if not path.exists():
        sys.exit(f"CSV not found: {path}")
    with path.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("CSV has no rows.")
    fns = list(rows[0].keys())
    sc_col = args.sector_col or pick_column(fns, SECTOR_HINTS, rows[:50], want_codes=True)
    val_col = args.value_col or pick_column(fns, VALUE_HINTS)
    yr_col = args.year_col or pick_column(fns, YEAR_HINTS)
    if not sc_col or not val_col:
        sys.exit(f"Could not detect columns. Found headers: {fns}\n"
                 f"Pass --sector-col / --value-col explicitly.")
    print(f"columns → sector: {sc_col!r}  value: {val_col!r}  year: {yr_col or '(none)'}")

    # determine the recent-year window
    keep_years = None
    if yr_col:
        years = sorted({int(y) for r in rows if (y := re.match(r"\d{4}", str(r.get(yr_col) or "")))
                        and (y := y.group())}, reverse=True)
        keep_years = set(years[:args.recent_years]) if years else None
        if keep_years:
            print(f"recent years: {sorted(keep_years)}")

    # sector-name lookup: canonical names + whatever the data already uses
    src = DATA.read_text(encoding="utf-8")
    sn_map = {p["sc"]: p["sn"] for p in
              json.loads(re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src).group(1))
              if p.get("sc") and p.get("sn")}
    name_for = lambda code: SECTOR_NAME.get(code) or sn_map.get(code)
    in_data = set(sn_map.values()) | set(SECTOR_NAME.values())

    mult = 1_000_000 if args.unit == "millions" else 1
    agg, yrs = {}, {}
    for r in rows:
        code = (r.get(sc_col) or "").strip()
        if not CODE_RE.match(code):
            continue
        if keep_years:
            ym = re.match(r"\d{4}", str(r.get(yr_col) or ""))
            if not ym or int(ym.group()) not in keep_years:
                continue
        name = name_for(code)
        if not name or name not in in_data:
            continue
        v = num(r.get(val_col))
        if v is None or v <= 0:
            continue
        agg[name] = agg.get(name, 0) + v * mult
        if yr_col:
            ym = re.match(r"\d{4}", str(r.get(yr_col) or ""))
            if ym:
                yrs.setdefault(name, set()).add(int(ym.group()))

    CRS = {name: {"oda": round(v), "year": (f"{min(yrs[name])}-{max(yrs[name])}" if yrs.get(name)
                  and len(yrs[name]) > 1 else (str(max(yrs[name])) if yrs.get(name) else None))}
           for name, v in sorted(agg.items())}
    print(f"\nAggregated CRS ODA for {len(CRS)} sectors. Sample:")
    for name in list(CRS)[:8]:
        print(f"  {name:<34} ${CRS[name]['oda']/1e9:,.2f}bn  ({CRS[name]['year']})")
    if args.dry_run or not CRS:
        print("[dry-run] nothing written." if args.dry_run else "No matching sectors."); return

    block = json.dumps(CRS, ensure_ascii=False, separators=(",", ":"))
    if re.search(r"(?:const|let|var)\s+CRS\s*=\s*\{[\s\S]*?\};", src):
        src = re.sub(r"((?:const|let|var)\s+CRS\s*=\s*)\{[\s\S]*?\};", r"\g<1>" + block + ";", src, count=1)
    else:   # insert right after the TOTALS global
        src = re.sub(r"((?:const|let|var)\s+TOTALS\s*=\s*\{[\s\S]*?\};)",
                     r"\1\nconst CRS=" + block + ";", src, count=1)
    DATA.write_text(src, encoding="utf-8")
    print(f"\nWrote CRS global ({len(CRS)} sectors) into {DATA}. The #read_me OECD column now fills.")


if __name__ == "__main__":
    main()
