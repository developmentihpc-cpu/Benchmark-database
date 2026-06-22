#!/usr/bin/env python3
"""Pull a bigger, cleaner sample straight from the official IATI Datastore.

d-portal (used by add_sector.py) cannot filter by sector and needs a slow
per-activity fetch for country/sector. The **official IATI Datastore**
(https://api.iatistandard.org/) is a Solr index that filters by `sector_code`
and returns recipient country, sector, dates, currency and budget as flat fields
in one query per sector — far faster and exact. This script uses it to top up
each DAC sector toward a target sample size, classifies into the project's
schema (see iati_ingest.py), and appends to js/data.js.

Needs a **free API key** (register at https://developer.iatistandard.org/ and
subscribe to the Datastore API):

    export IATI_DATASTORE_KEY=...      # Windows: set IATI_DATASTORE_KEY=...

    python datastore_pull.py                  # top every in-data sector toward --target
    python datastore_pull.py --codes 23210,11320
    python datastore_pull.py --target 80 --per-query 400
    python datastore_pull.py --dry-run

Recency matches the sample: started since RECENT_SINCE (2021-06-02) or ongoing.
Nothing is fabricated — an activity missing a recipient country is skipped.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from iati_ingest import (DATA, STATUS, ORG_TYPE, SECTOR_NAME, stream_for,
                         english_clean, RECENT_SINCE)

ENDPOINT = "https://api.iatistandard.org/datastore/activity/select"
RECENT_FQ = (f"(activity_date_start_actual:[{RECENT_SINCE}T00:00:00Z TO *] "
             f"OR activity_date_start_planned:[{RECENT_SINCE}T00:00:00Z TO *] "
             f"OR activity_status_code:2)")
# Flat fields we need from the activity core.
FL = ",".join([
    "iati_identifier", "title_narrative", "description_narrative",
    "reporting_org_ref", "reporting_org_type_code", "reporting_org_narrative",
    "recipient_country_code", "sector_code", "sector_vocabulary",
    "activity_status_code", "default_currency",
    "activity_date_iso_date", "activity_date_type",
    "budget_value", "budget_value_currency",
])


def first(v):
    """Solr multi-valued fields come back as lists — take the first scalar."""
    if isinstance(v, list):
        return v[0] if v else None
    return v


def num(v):
    try:
        return float(first(v))
    except Exception:
        return None


def query(key, sector_code, rows, start):
    params = {
        "q": f"sector_code:{sector_code} AND sector_vocabulary:1",
        "fq": RECENT_FQ, "fl": FL, "rows": str(rows), "start": str(start), "wt": "json",
    }
    req = urllib.request.Request(ENDPOINT + "?" + urllib.parse.urlencode(params), headers={
        "Ocp-Apim-Subscription-Key": key, "Accept": "application/json",
        "User-Agent": "BenchmarkDB-pull/1.0",
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r).get("response", {}).get("docs", [])
        except Exception as e:
            if attempt == 2:
                print(f"  ! {sector_code}: {e}"); return []
            time.sleep(1.0 * (attempt + 1))
    return []


def load_ctx():
    src = DATA.read_text(encoding="utf-8")
    programs = json.loads(re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src).group(1))
    devregion = json.loads(re.search(r"const DEVREGION=(\{[\s\S]*?\});", src).group(1))
    region = {k.lower(): v for k, v in devregion.items()}
    cc2name = {p["cc"]: p["co"] for p in programs if p.get("cc") and p.get("co")}
    seen = {p.get("id") for p in programs if p.get("id")}
    seccount = {}
    for p in programs:
        if p.get("sc"):
            seccount[p["sc"]] = seccount.get(p["sc"], 0) + 1
    return src, region, cc2name, seen, seccount


def build(doc, code, region, cc2name):
    aid = first(doc.get("iati_identifier"))
    if not aid:
        return None
    cc = (first(doc.get("recipient_country_code")) or "").upper()
    if not cc:
        return None
    co = cc2name.get(cc)
    if not co:
        return None                       # outside the developing-country sample
    rg = region.get(co.lower())
    if not rg:
        return None
    title = first(doc.get("title_narrative"))
    if not title:
        return None
    desc = english_clean(first(doc.get("description_narrative")))
    org = first(doc.get("reporting_org_narrative")) or "—"
    d, rt = ORG_TYPE.get(str(first(doc.get("reporting_org_type_code")) or ""), ("Multilateral", "Other"))
    cur = (first(doc.get("default_currency")) or first(doc.get("budget_value_currency")) or "USD").upper()
    amt = sum(x for x in [num(b) for b in (doc.get("budget_value") or [])] if x) \
        if isinstance(doc.get("budget_value"), list) else (num(doc.get("budget_value")) or 0)
    # dates
    isos = doc.get("activity_date_iso_date") or []
    types = doc.get("activity_date_type") or []
    st = en = None
    for iso, ty in zip(isos if isinstance(isos, list) else [isos], types if isinstance(types, list) else [types]):
        ty = str(ty)
        if ty in ("1", "2"):
            st = (iso or "")[:10]
        if ty in ("3", "4"):
            en = (iso or "")[:10]
    sta = STATUS.get(str(first(doc.get("activity_status_code")) or ""), "Ongoing")
    rec = {
        "n": title, "d": d, "r": org, "rt": rt, "s": stream_for(code), "sc": code,
        "sn": SECTOR_NAME.get(code, f"DAC {code}"), "co": co, "cc": cc, "rg": rg,
        "sta": sta, "multi": 0, "st": st or None, "en": en or None, "c": cur,
        "a": round(float(amt or 0), 2), "b": "budget", "rc": None, "rb": "", "re": 0,
        "year": int(st[:4]) if st and st[:4].isdigit() else None,
        "fn": org, "pcc": "", "pn": "", "id": aid,
    }
    if desc:
        rec["desc"] = desc
    return rec


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--codes", default="", help="comma-separated DAC codes (default: every sector already in the data)")
    ap.add_argument("--target", type=int, default=60, help="desired total programmes per sector")
    ap.add_argument("--per-query", type=int, default=300, help="rows fetched per sector query")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    key = os.environ.get("IATI_DATASTORE_KEY")
    if not key and not args.dry_run:
        sys.exit("Set IATI_DATASTORE_KEY first (free key from https://developer.iatistandard.org/).")

    src, region, cc2name, seen, seccount = load_ctx()
    codes = [c.strip() for c in args.codes.split(",") if c.strip()] or sorted(seccount.keys())
    print(f"{len(codes)} sectors; topping each toward {args.target}.")

    added = []
    for code in codes:
        have = seccount.get(code, 0)
        if have >= args.target:
            continue
        docs = query(key, code, args.per_query, 0) if key else []
        kept = 0
        for doc in docs:
            if seccount.get(code, 0) >= args.target:
                break
            rec = build(doc, code, region, cc2name)
            if not rec or rec["id"] in seen:
                continue
            seen.add(rec["id"]); seccount[code] = seccount.get(code, 0) + 1; kept += 1
            added.append(rec)
        print(f"  {code} {SECTOR_NAME.get(code,''):<32} had {have}, +{kept}")

    print(f"\nReady to add {len(added)} programmes.")
    if args.dry_run or not added:
        print("[dry-run] nothing written." if args.dry_run else "Nothing to add."); return

    body = re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src).group(1)
    addition = "".join("," + json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in added)
    src = src.replace(body, body[:-1] + addition + "]", 1)
    src = re.sub(r'("nprog":\s*)(\d+)', lambda m: m.group(1) + str(int(m.group(2)) + len(added)), src, count=1)
    DATA.write_text(src, encoding="utf-8")
    print(f"Wrote {len(added)} programmes into {DATA}. "
          f"Run datastore_totals.py for the universe counts, then enrich_llm.py.")


if __name__ == "__main__":
    main()
