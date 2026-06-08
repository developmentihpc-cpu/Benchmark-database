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
CAP = 2000  # store the full description; the app clamps it to a 3-line preview with "Show more"
EN_WORDS = set("the of and to will this that with from are is by has have been it its their our we "
               "project programme support improve provide training health water education women children "
               "communities community access rural development assistance services people national local "
               "government district market farmers schools".split())
FR_WORDS = set("le la les des une un du et à pour dans avec sur par au aux que qui cette leur sont nous "
               "vous ses développement renforcement gestion appui projet santé éducation communauté mise "
               "oeuvre accès formation afin ainsi mediante hacia niños proyecto programa apoyo vise renforcer "
               "améliorer promouvoir contrat contribuer sécurité alimentaire système soutien".split())
PLACEHOLDER = re.compile(r"no description.{0,40}available|description indisponible|"
                         r"description non disponible|sin descripci|pas de description", re.I)
WORD = re.compile(r"[a-zà-ÿ']+", re.I)


def _english_clean(text):
    """Strip HTML, drop placeholders, and keep only English-reading text.

    Assumes English unless there is a strong foreign-stopword signal
    (>=3 French/Spanish stopwords outnumbering English ones). Non-English
    descriptions return None, so the app uses its English derived summary.
    """
    if not text:
        return None
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("�", "").replace("¿", "'")
    text = re.sub(r"\s+", " ", text).strip()
    if not text or PLACEHOLDER.search(text):
        return None
    low = text.lower()
    en = sum(1 for w in WORD.findall(low) if w in EN_WORDS)
    fr = sum(1 for w in WORD.findall(low) if w in FR_WORDS)
    if fr >= 3 and fr > en:
        return None
    if len(text) <= CAP:
        return text
    c = text[:CAP]
    m = re.search(r"^(.{400,}[.!?])\s", c, re.S) or re.search(r"^(.*)\s\S+$", c, re.S)
    return (m.group(1) if m else c) + "…"


def fetch_desc(aid, retries=2):
    """Return an English, summarised description for an IATI id, or None.

    Prefers an explicit English narrative (by description type); accepts an
    untagged narrative only if it reads as English; never returns a narrative
    explicitly tagged another language (the app falls back to an English
    sector-derived summary instead).
    """
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
    cand, title_en = [], None  # cand: (type:int, lang:str, text:str)
    for a in acts:
        adef = (a.get("@xml:lang") or "").lower()
        for d in (a.get("/description") or []):
            raw = str(d.get("@type", "1"))
            ty = int(raw) if raw.isdigit() else 1
            for n in (d.get("/narrative") or []):
                t = (n.get("") or "").strip()
                if not t:
                    continue
                lang = (n.get("@xml:lang") or adef or "").lower()
                cand.append((ty, lang, t))
        if title_en is None:
            for tt in (a.get("/title") or []):
                for n in (tt.get("/narrative") or []):
                    t = (n.get("") or "").strip()
                    lang = (n.get("@xml:lang") or adef or "").lower()
                    if t and lang == "en":
                        title_en = t

    def pick(want):
        for ty in (1, 2, 3, 4, 5, 6, 7, 8, 99):
            for cty, clang, t in sorted(cand, key=lambda x: x[0]):
                if ty != 99 and cty != ty:
                    continue
                if want == "en" and clang == "en":
                    return t
                if want == "" and clang == "":
                    return t
        return None

    text = pick("en") or pick("") or title_en
    return _english_clean(text)


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
