#!/usr/bin/env python3
"""Add UAE aid-agency programmes to js/data.js from IATI (via d-portal, no key).

The UAE publishes its aid to IATI as **UAE Ministry of Foreign Affairs** (MOFAIC),
reporting-org ref ``XM-DAC-576`` (576 = the OECD-DAC donor code for the UAE). This
pulls those activities, classifies them into the project's ``PROGRAMS`` schema
(see iati_ingest.py), and appends the new records to js/data.js. Re-runnable —
activities already present are skipped.

    python add_uae.py                 # add all active UAE publishers (currently MOFAIC)
    python add_uae.py --limit 25      # test on the first 25 per publisher
    python add_uae.py --dry-run       # preview; write nothing
    python add_uae.py --all-countries # don't restrict to the developing-country set
    python add_uae.py --include AE-ADFD-1,AE-ERC-1   # also pull candidate UAE bodies
    python add_uae.py --ref XX-ABC-1  # or one arbitrary reporting-org ref instead

As of 2026-06 only MOFAIC publishes to IATI. Abu Dhabi Fund for Development,
Emirates Red Crescent and Dubai Cares are listed as inactive candidates; when one
starts publishing, set its ``active`` flag (or pass ``--include <ref>``) and fix
its ``ref`` to the real IATI identifier. Afterwards run enrich_llm.py for the
one-line ``summary`` and any ``name_en`` translation.
"""
import argparse

from iati_ingest import Ingest, REPORTING_SEARCH

# Known + candidate UAE aid publishers. active=False = not on IATI yet (2026-06).
PUBLISHERS = [
    {"ref": "XM-DAC-576", "label": "UAE Ministry of Foreign Affairs",
     "d": "Bilateral", "rt": "Government", "active": True},
    {"ref": "AE-ADFD-1", "label": "Abu Dhabi Fund for Development",
     "d": "Bilateral", "rt": "Government", "active": False},
    {"ref": "AE-ERC-1", "label": "Emirates Red Crescent",
     "d": "NGO", "rt": "National NGO", "active": False},
    {"ref": "AE-DUBAICARES-1", "label": "Dubai Cares",
     "d": "Foundation", "rt": "Foundation", "active": False},
]
PCC, PN = "AE", "United Arab Emirates"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", help="pull ONE arbitrary reporting-org ref instead of the registry")
    ap.add_argument("--include", default="", help="comma-separated extra UAE refs to enable")
    ap.add_argument("--limit", type=int, default=0, help="cap activities per publisher")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--all-countries", action="store_true")
    ap.add_argument("--delay", type=float, default=0.15)
    args = ap.parse_args()

    if args.ref:
        pubs = [{"ref": args.ref, "label": args.ref, "d": "Bilateral", "rt": "Government"}]
    else:
        extra = {r.strip() for r in args.include.split(",") if r.strip()}
        pubs = [p for p in PUBLISHERS if p["active"] or p["ref"] in extra]
        off = [p for p in PUBLISHERS if not p["active"] and p["ref"] not in extra]
        if off:
            print("Not on IATI yet (enable with --include once they publish): "
                  + ", ".join(f"{p['label']} [{p['ref']}]" for p in off))

    ing = Ingest()
    for pub in pubs:
        rows = ing.fetch_flat(REPORTING_SEARCH.format(ref=pub["ref"], limit=8000))
        print(f"\n[{pub['ref']}] {pub['label']}: {len(rows)} activities found.")
        if not rows:
            print("  (nothing returned — not publishing to IATI, or network blocked.)")
            continue
        donor = {"d": pub["d"], "rt": pub["rt"], "pcc": PCC, "pn": PN, "label": pub["label"]}
        ing.add_rows(rows, donor=donor, all_countries=args.all_countries,
                     limit=args.limit, delay=args.delay,
                     on_progress=lambda i, n, k, s: print(f"  {i}/{n} … {k} kept, {s} skipped"))

    print(f"\nReady to add {len(ing.added)} programmes. Skipped {ing.skipped}: {ing.reasons}")
    for r in ing.added[:5]:
        print(f"  + [{r['cc']}/{r['sc']} {r['s']}] {r['n'][:64]}  ({r['c']} {r['a']:,.0f})")
    ing.commit(dry_run=args.dry_run)
    if ing.added and not args.dry_run:
        print("Run enrich_llm.py next to add summaries/translations.")


if __name__ == "__main__":
    main()
