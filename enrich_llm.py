#!/usr/bin/env python3
"""LLM enrichment for js/data.js — translate names + summarise descriptions.

This is the *second* enrichment pass. The first, `enrich_descriptions.py`,
pulls real IATI activity descriptions from d-portal (no API key). This pass
uses the **Anthropic API** to make two final-mile fixes the data set needs:

  1. **English-only names.**  Any programme whose title `n` is not English gets
     an English translation written to a new `name_en` field. English titles are
     left untouched (no `name_en`).
  2. **Core-activities summary.**  Every programme that has a real description
     (`desc`) gets a single plain-English sentence naming only what the
     programme *does* (e.g. "Builds rural water points and trains local
     committees to maintain them."), written to a new `summary` field. The web
     app shows `summary` on the card and keeps the full `desc` behind "Show more".

The app reads both fields defensively (`name_en || n`, `summary || desc ||
derived`), so running this is purely additive — nothing breaks if it hasn't run.

Why the Message Batches API + Haiku: ~3,000 tiny, independent calls. Batches are
50% cheaper and run async; Haiku is the cheap tier and is more than capable of
translate/summarise. A shared, cache-marked system prompt is reused across every
request in the batch. (Note: prompt-cache *reads* only kick in once the cached
prefix exceeds the model minimum — 4096 tokens for Haiku — so on a short system
prompt the cache may not engage; the run prints cache stats so you can see.)

Cost is a few cents to ~$1 of Haiku batch tokens for the whole data set.

Re-runnable and resumable
-------------------------
* Results are cached in `enrich_llm_cache.json` (keyed by IATI id). Cached
  programmes are skipped on the next run unless --force.
* The in-flight batch id is saved to `enrich_llm_state.json`. If the script is
  interrupted while a batch is processing, just run it again — it reconnects to
  the same batch instead of resubmitting.
* The write-back into js/data.js always re-applies the full cache, so it is safe
  to re-run (idempotent). Use --apply-only to write the cache into data.js
  without making any API calls.

Usage
-----
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...        # Windows: set ANTHROPIC_API_KEY=...

    python enrich_llm.py                 # enrich everything that needs it
    python enrich_llm.py --limit 25      # smoke-test on 25 records first
    python enrich_llm.py --names-only    # only translate non-English names
    python enrich_llm.py --desc-only     # only summarise descriptions
    python enrich_llm.py --force         # ignore cache, redo everything
    python enrich_llm.py --apply-only    # just write the cache into data.js
    python enrich_llm.py --dry-run       # show what would be sent; no API calls

The API key is read from the ANTHROPIC_API_KEY environment variable — it is
never hard-coded or stored. Costs land on your own Anthropic account.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "js" / "data.js"
CACHE_FILE = HERE / "enrich_llm_cache.json"
STATE_FILE = HERE / "enrich_llm_state.json"

MODEL = "claude-haiku-4-5"          # cheap tier; user-overridable with --model
MAX_PER_BATCH = 20000               # well under the 100k/batch API limit
POLL_SECONDS = 30

# Heuristic to decide whether a *name* needs translating. It only gates
# no-description records (records with a description always get name + summary in
# one call anyway), and a false positive just costs one cheap call that returns
# an empty translation — so this errs toward inclusive.
EN_WORDS = set("the of and to a in for on with support project programme program improve "
               "provide health water education women children community rural development "
               "access services people national local government school food security "
               "emergency response activity under preparation new phase fund grant".split())
FR_ES_WORDS = set("le la les des une un du de et à pour dans avec sur par au aux que qui "
                  "cette leur sont nous vous ses développement renforcement gestion appui "
                  "projet santé éducation communauté accès formation afin améliorer "
                  "promouvoir sécurité alimentaire système soutien programme amélioration "
                  "pérennisation professionnalisation eau potable assainissement "
                  "el los las una uno y para con por proyecto programa apoyo desarrollo "
                  "agua salud educación seguridad alimentaria fortalecimiento mejora "
                  "región niños mujeres".split())
ACCENT = re.compile(r"[àâäéèêëîïôöùûüçñáíóúãõ]", re.I)
WORD = re.compile(r"[a-zà-ÿ']+", re.I)

SYSTEM = """You normalise records from an international-aid programme database (IATI). \
Every record is one development/humanitarian programme. You always reply with a single \
minified JSON object and nothing else — no markdown, no code fence, no commentary.

For each record you receive a programme NAME and (optionally) a DESCRIPTION. Return:

{"name_en": <string>, "summary": <string>}

Rules for "name_en":
- If the NAME is already in English, return "" (empty string).
- If the NAME is not in English (commonly French, Spanish, or Portuguese), return a \
faithful, natural English translation. Keep proper nouns, place names, agency names, \
codes and reference numbers (e.g. "PROGRAMME 2017-2021_4_RDC_...") intact; translate the \
descriptive words around them. Do not add words that are not in the original. Names are \
often truncated mid-word — translate what is there and do not invent an ending.

Rules for "summary":
- If there is no DESCRIPTION, return "" (empty string).
- Otherwise return ONE short plain-English sentence (aim for 6-18 words) naming only the \
CORE ACTIVITIES — what the programme actually does on the ground. Start with a verb. \
Drop boilerplate, funders, locations, dates, jargon, outcome/indicator wording and \
results framing. Be concrete.
  Examples:
  "Builds and rehabilitates rural water points and trains local committees to maintain them."
  "Delivers primary health care and essential medicines to refugee settlements."
  "Provides cash transfers and farming inputs to smallholder households."
  "Constructs school latrines and runs handwashing and hygiene education for pupils."

Output ONLY the JSON object."""


def looks_nonenglish(name):
    if not name:
        return False
    low = name.lower()
    toks = WORD.findall(low)
    if not toks:
        return False
    en = sum(1 for w in toks if w in EN_WORDS)
    fr = sum(1 for w in toks if w in FR_ES_WORDS)
    if fr >= 2 and fr >= en:
        return True
    if ACCENT.search(name) and fr >= 1:
        return True
    if ACCENT.search(name) and en == 0 and len(toks) >= 3:
        return True
    return False


def load_json(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default


def save_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=0), encoding="utf-8")


def read_programs():
    src = DATA.read_text(encoding="utf-8")
    m = re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src)
    if not m:
        sys.exit("Could not locate the PROGRAMS array in js/data.js")
    return src, m, json.loads(m.group(1))


def needs(p, args):
    """What this programme needs: (do_name, do_summary)."""
    has_desc = bool(p.get("desc"))
    do_name = (not args.desc_only) and (looks_nonenglish(p.get("n")) or has_desc)
    do_summary = (not args.names_only) and has_desc
    return do_name, do_summary


def user_content(p, do_name, do_summary):
    parts = ["NAME: " + (p.get("n") or "")]
    if do_summary:
        parts.append("DESCRIPTION: " + (p.get("desc") or ""))
    else:
        parts.append("DESCRIPTION: (none)")
    return "\n".join(parts)


def parse_reply(text):
    """Pull {"name_en":..., "summary":...} out of a model reply."""
    text = (text or "").strip()
    try:
        obj = json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except Exception:
            return None
    if not isinstance(obj, dict):
        return None
    return {
        "name_en": (obj.get("name_en") or "").strip(),
        "summary": (obj.get("summary") or "").strip(),
    }


def apply_to_data(cache):
    """Write cached name_en/summary into js/data.js (idempotent, full re-apply)."""
    src, m, programs = read_programs()
    changed = 0
    for p in programs:
        ent = cache.get(p.get("id"))
        if not ent:
            continue
        ne, su = ent.get("name_en") or "", ent.get("summary") or ""
        if ne and ne != p.get("n"):
            if p.get("name_en") != ne:
                changed += 1
            p["name_en"] = ne
        elif "name_en" in p:
            del p["name_en"]
        if su:
            if p.get("summary") != su:
                changed += 1
            p["summary"] = su
        elif "summary" in p:
            del p["summary"]
    body = json.dumps(programs, ensure_ascii=False, separators=(",", ":"))
    new_src = src[:m.start(1)] + body + src[m.end(1):]
    DATA.write_text(new_src, encoding="utf-8")
    n_names = sum(1 for p in programs if p.get("name_en"))
    n_sum = sum(1 for p in programs if p.get("summary"))
    print(f"Wrote js/data.js — {n_names} translated names, {n_sum} summaries "
          f"({changed} cells changed this run).")


def run_batch(client, requests, items, cache, args):
    """Submit one batch, poll to completion, merge results into the cache.

    `items` maps custom_id -> {"pid", "name": bool, "sum": bool} so each result
    updates only the fields that were actually requested (a --names-only run must
    not stamp an empty summary that blocks a later --desc-only run).
    """
    state = load_json(STATE_FILE, {})
    batch_id = state.get("batch_id")

    if batch_id:
        print(f"Resuming in-flight batch {batch_id} from {STATE_FILE.name} …")
        items = {**(state.get("items") or {}), **items}
    else:
        batch = client.messages.batches.create(requests=requests)
        batch_id = batch.id
        save_json(STATE_FILE, {"batch_id": batch_id, "items": items})
        print(f"Submitted batch {batch_id} ({len(requests)} requests). Polling …")

    while True:
        b = client.messages.batches.retrieve(batch_id)
        if b.processing_status == "ended":
            break
        rc = b.request_counts
        print(f"  status={b.processing_status} "
              f"processing={rc.processing} succeeded={rc.succeeded} errored={rc.errored}")
        time.sleep(args.poll)

    ok = err = 0
    cache_read = cache_create = uncached = 0
    for result in client.messages.batches.results(batch_id):
        it = items.get(result.custom_id)
        if not it:
            continue
        pid = it["pid"]
        if result.result.type == "succeeded":
            msg = result.result.message
            u = getattr(msg, "usage", None)
            if u:
                cache_read += getattr(u, "cache_read_input_tokens", 0) or 0
                cache_create += getattr(u, "cache_creation_input_tokens", 0) or 0
                uncached += getattr(u, "input_tokens", 0) or 0
            text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            parsed = parse_reply(text)
            if parsed is not None:
                ent = cache.get(pid) or {}
                if it.get("name"):
                    ent["name_en"] = parsed["name_en"]
                if it.get("sum"):
                    ent["summary"] = parsed["summary"]
                cache[pid] = ent
                ok += 1
            else:
                err += 1
        else:
            err += 1

    save_json(CACHE_FILE, cache)
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    print(f"Batch done: {ok} parsed, {err} failed. "
          f"Tokens — uncached={uncached}, cache_read={cache_read}, cache_write={cache_create}.")
    if cache_read == 0 and len(requests) > 1:
        print("  (No cache reads — the shared system prompt is below the model's cache "
              "minimum, so each request paid full input price. This is expected for a "
              "short prompt; the cost is already tiny on Haiku batch pricing.)")
    return ok, err


def build_todo(programs, cache, args):
    """Records still needing work: list of (idx, programme, do_name, do_summary)."""
    todo = []
    for idx, p in enumerate(programs):
        pid = p.get("id")
        if not pid:
            continue
        do_name, do_summary = needs(p, args)
        if not (do_name or do_summary):
            continue
        if not args.force and pid in cache:
            ent = cache[pid]
            # Only redo if a field this run wants is still missing from the cache
            # (e.g. the first run was --names-only and this one is --desc-only).
            if not ((do_name and "name_en" not in ent) or (do_summary and "summary" not in ent)):
                continue
        todo.append((idx, p, do_name, do_summary))
    if args.limit:
        todo = todo[: args.limit]
    return todo


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=0, help="cap number of records (smoke test)")
    ap.add_argument("--force", action="store_true", help="ignore cache; redo every record")
    ap.add_argument("--names-only", action="store_true", help="only translate names")
    ap.add_argument("--desc-only", action="store_true", help="only summarise descriptions")
    ap.add_argument("--apply-only", action="store_true",
                    help="write the existing cache into data.js; no API calls")
    ap.add_argument("--dry-run", action="store_true", help="show the plan; no API calls")
    ap.add_argument("--model", default=MODEL, help=f"model id (default {MODEL})")
    ap.add_argument("--poll", type=float, default=POLL_SECONDS, help="seconds between status polls")
    ap.add_argument("--max-per-batch", type=int, default=MAX_PER_BATCH)
    args = ap.parse_args()

    cache = load_json(CACHE_FILE, {})

    if args.apply_only:
        apply_to_data(cache)
        return

    _, _, programs = read_programs()

    todo = build_todo(programs, cache, args)
    n_name = sum(1 for _, _, dn, _ in todo if dn)
    n_sum = sum(1 for _, _, _, ds in todo if ds)
    print(f"{len(todo)} records to process "
          f"({n_name} name checks, {n_sum} description summaries) of {len(programs)} total.")

    in_flight = bool(load_json(STATE_FILE, {}).get("batch_id"))
    if not todo and not in_flight:
        print("Nothing to do — cache already covers everything. Applying cache to data.js.")
        apply_to_data(cache)
        return

    if args.dry_run:
        for idx, p, dn, ds in todo[:8]:
            print("\n---", p.get("id"))
            print(user_content(p, dn, ds)[:400])
        print(f"\n[dry-run] would send {len(todo)} requests in batches of "
              f"{args.max_per_batch}. No API calls made.")
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY in your environment first "
                 "(e.g.  export ANTHROPIC_API_KEY=sk-ant-...).")

    try:
        import anthropic
    except ImportError:
        sys.exit("The anthropic package is not installed. Run:  pip install anthropic")

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

    # One batch per pass. Recompute the work list each pass so an interrupted/
    # in-flight batch (resumed inside run_batch) is always drained first, then
    # any remaining records are submitted in the next pass.
    bi = 0
    while True:
        in_flight = bool(load_json(STATE_FILE, {}).get("batch_id"))
        todo = build_todo(programs, cache, args)
        if not todo and not in_flight:
            break
        bi += 1
        chunk = todo[: args.max_per_batch]
        print(f"\n=== Pass {bi} ({'resuming in-flight batch' if in_flight else str(len(chunk)) + ' records'}) ===")
        items, requests = {}, []
        for idx, p, dn, ds in chunk:
            cid = f"r{idx}"
            items[cid] = {"pid": p["id"], "name": dn, "sum": ds}
            requests.append({
                "custom_id": cid,
                "params": {
                    "model": args.model,
                    "max_tokens": 256,
                    "system": [{
                        "type": "text",
                        "text": SYSTEM,
                        "cache_control": {"type": "ephemeral"},
                    }],
                    "messages": [{"role": "user", "content": user_content(p, dn, ds)}],
                },
            })
        ok, err = run_batch(client, requests, items, cache, args)
        if not in_flight and ok == 0:
            print("No records succeeded this pass — stopping to avoid resubmitting "
                  "records that keep failing. Check the errors above.")
            break

    # Write everything we have into data.js.
    apply_to_data(cache)
    print("Done.")


if __name__ == "__main__":
    main()
