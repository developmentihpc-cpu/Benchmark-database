#!/usr/bin/env python3
"""Broaden js/data.js with more DAC sectors, pulled from IATI (d-portal, no key).

The embedded sample only covers seven DAC sub-sectors. This pulls real activities
for a curated set of additional sectors (Tiers 1-3, see below), classifies each
into the project's PROGRAMS schema (see iati_ingest.py), and appends them. For a
sector pull the sector is fixed to the queried DAC code and the donor identity is
derived from each activity's own reporting org. Re-runnable; nothing is guessed.

    python add_sector.py                 # add all three tiers
    python add_sector.py --tier 1        # just Tier 1 (fill the obvious holes)
    python add_sector.py --per 30        # cap activities pulled per sector (default 50)
    python add_sector.py --dry-run       # preview; write nothing
    python add_sector.py --codes 23210,11320   # only these DAC codes
    python add_sector.py --all-countries # don't restrict to the developing-country set

This makes many per-activity IATI fetches (≈ tiers × sectors × --per), so a full
run takes a while — it's a one-time data build. Afterwards run enrich_llm.py for
summaries/translations. Tier-3 sectors land in the new "Infrastructure & Economic"
stream (see iati_ingest.stream_for).
"""
import argparse

from iati_ingest import (Ingest, SECTOR_SEARCH, SECTOR_NAME, stream_for,
                         recent_count, RECENT_SINCE)

# Curated DAC codes to add, by tier (names resolve via iati_ingest.SECTOR_NAME).
TIERS = {
    1: ["14022", "14032", "13020", "13040", "12262", "12250", "12240",
        "72040", "74020", "73010", "11320", "11330", "11240"],
    2: ["43040", "16010", "25010", "32130", "24010", "15130", "15160", "15220"],
    3: ["23210", "23230", "23110", "21010", "21020", "41010"],
}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tier", type=int, choices=[1, 2, 3], help="only this tier (default: all)")
    ap.add_argument("--codes", default="", help="comma-separated DAC codes (overrides tiers)")
    ap.add_argument("--per", type=int, default=50, help="max activities sampled per sector")
    ap.add_argument("--universe-limit", type=int, default=50000,
                    help="rows fetched per sector to count the recent IATI universe")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--all-countries", action="store_true")
    ap.add_argument("--delay", type=float, default=0.15)
    args = ap.parse_args()

    if args.codes:
        codes = [c.strip() for c in args.codes.split(",") if c.strip()]
    elif args.tier:
        codes = TIERS[args.tier]
    else:
        codes = [c for t in (1, 2, 3) for c in TIERS[t]]

    ing = Ingest()
    for code in codes:
        name = SECTOR_NAME.get(code, f"DAC {code}")
        rows = ing.fetch_flat(SECTOR_SEARCH.format(code=code, limit=args.universe_limit))
        universe = recent_count(rows)
        print(f"\n[{code}] {name} → {stream_for(code)}: {len(rows)} activities, "
              f"{universe} recent (since {RECENT_SINCE}).")
        if not rows:
            print("  (nothing returned — sector empty or network blocked.)")
            continue
        ing.record_total(name, stream_for(code), universe)   # → TOTALS (read_me + benchmarks)
        ing.add_rows(rows, force_sector=code, all_countries=args.all_countries,
                     limit=args.per, delay=args.delay,
                     on_progress=lambda i, n, k, s: print(f"  {i}/{n} … {k} kept, {s} skipped"))

    print(f"\nReady to add {len(ing.added)} programmes across {len(codes)} sectors. "
          f"Skipped {ing.skipped}: {ing.reasons}")
    for r in ing.added[:8]:
        print(f"  + [{r['cc']}/{r['sc']} {r['s']}] {r['n'][:60]}  ({r['c']} {r['a']:,.0f})")
    ing.commit(dry_run=args.dry_run)
    if ing.added and not args.dry_run:
        print("Run enrich_llm.py next to add summaries/translations.")


if __name__ == "__main__":
    main()
