#!/usr/bin/env python3
"""Enrich js/data.js with real IATI activity descriptions.

For each programme (keyed by its IATI identifier, the `id` field) this fetches
the activity's own description from d-portal — https://d-portal.org — which
mirrors the IATI Datastore and needs **no API key**. The description is written
back into each programme object as a `desc` field; the web app prefers it over
the derived sector/outputs summary.

Re-runnable and resumable: programmes that already have a `desc` are skipped
unless --force. Records are written into js/data.js by appending `,"desc":"…"`
immediately after each object's `id` field, so existing field order/formatting
is preserved (minimal diff).

    python enrich_descriptions.py                # enrich all, in place
    python enrich_descriptions.py --limit 50     # test on the first 50
    python enrich_descriptions.py --force        # re-fetch even if desc exists

For the authoritative source instead of the d-portal mirror, swap ENDPOINT for
the official IATI Datastore (https://api.iatistandard.org/datastore/) and add
your free Ocp-Apim-Subscription-Key header.
"""
import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent / "js" / "data.js"
ENDPOINT = "https://d-portal.org/q?aid={aid}&form=json"
UA = "BenchmarkDB-enrich/1.0 (+https://iatistandard.org)"
MAXLEN = 280  # keep descriptions card-sized


def fetch_desc(aid, retries=2):
    url = ENDPOINT.format(aid=urllib.parse.quote(aid, safe=""))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                data = json.load(r)
            break
        except Exception:
            if attempt == retries:
                return None
            time.sleep(0.6 * (attempt + 1))
    acts = (data.get("xson") or [{}])[0].get("/iati-activities/iati-activity") or []
    by_type, title = {}, None
    for a in acts:
        for d in (a.get("/description") or []):
            typ = str(d.get("@type", "1"))
            for n in (d.get("/narrative") or []):
                t = (n.get("") or "").strip()
                if t and typ not in by_type:
                    by_type[typ] = t
        if title is None:
            for tt in (a.get("/title") or []):
                for n in (tt.get("/narrative") or []):
                    t = (n.get("") or "").strip()
                    if t:
                        title = t
                        break
    # prefer general description (@type 1), then any other, then the title
    text = by_type.get("1") or next(iter(by_type.values()), None) or title
    if not text:
        return None
    text = re.sub(r"\s+", " ", text).strip()
    return (text[: MAXLEN - 1] + "…") if len(text) > MAXLEN else text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--delay", type=float, default=0.1, help="seconds between requests")
    args = ap.parse_args()

    src = DATA.read_text(encoding="utf-8")
    m = re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src)
    if not m:
        sys.exit("Could not locate the PROGRAMS array in js/data.js")
    programs = json.loads(m.group(1))

    todo = [p for p in programs if p.get("id") and (args.force or not p.get("desc"))]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} programmes to enrich (of {len(programs)})")

    got = 0
    for i, p in enumerate(todo, 1):
        d = fetch_desc(p["id"])
        if d:
            # textual append after the id field — preserves order & formatting
            token = '"id":' + json.dumps(p["id"], ensure_ascii=True) + "}"
            repl = token[:-1] + ',"desc":' + json.dumps(d, ensure_ascii=True) + "}"
            if token in src:
                src = src.replace(token, repl, 1)
                got += 1
        if i % 50 == 0 or i == len(todo):
            print(f"  {i}/{len(todo)} … {got} written")
        time.sleep(args.delay)

    DATA.write_text(src, encoding="utf-8")
    print(f"Done. Wrote {got} descriptions into {DATA}")


if __name__ == "__main__":
    main()
