#!/usr/bin/env python3
"""Shared IATI -> PROGRAMS ingestion core for add_uae.py and add_sector.py.

Pulls activities from d-portal (https://d-portal.org — an IATI Datastore mirror,
**no API key**), classifies each into the project's ``PROGRAMS`` schema, and
splices the new records into ``js/data.js``. Nothing is fabricated: an activity
missing a recipient country or a DAC sector is reported and dropped, never guessed.

Use the ``Ingest`` class:

    ing = Ingest()
    rows = ing.fetch_flat(REPORTING_SEARCH.format(ref="XM-DAC-576", limit=8000))
    ing.add_rows(rows, donor={"d": "Bilateral", "rt": "Government", "pcc": "AE",
                              "pn": "United Arab Emirates"})
    ing.commit(dry_run=False)

For a sector pull the donor identity is derived from each activity's own
reporting org (``donor=None``) and the sector is forced to the queried code.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent / "js" / "data.js"
ACT = "https://d-portal.org/q?form=json&aid={aid}"
SECTOR_SEARCH = "https://d-portal.org/q?form=json&sector={code}&limit={limit}"
REPORTING_SEARCH = "https://d-portal.org/q?form=json&reporting_ref={ref}&limit={limit}"
UA = "BenchmarkDB-ingest/1.0 (+https://iatistandard.org)"
AED_USD = round(1 / 3.6725, 6)          # indicative AED->USD (AED pegged 3.6725/USD)
CAP = 2000

# Canonical stream order (the 5th is new — for energy/transport/economic/environment).
STREAMS = ["Humanitarian", "WASH", "Governance/Capacity", "Development",
           "Infrastructure & Economic"]

STATUS = {"1": "Planned", "2": "Ongoing", "3": "Finalisation",
          "4": "Closed", "5": "Cancelled", "6": "Suspended"}

# "Recent IATI universe" window — activities started on/after this date, matching
# the existing TOTALS values. Counted client-side from each flat row's day_start.
RECENT_SINCE = "2021-06-02"
RECENT_DAY = (date(2021, 6, 2) - date(1970, 1, 1)).days


def recent_count(rows):
    """Activities in a flat row set that started within the recent window."""
    return sum(1 for r in rows
               if isinstance(r.get("day_start"), (int, float)) and r["day_start"] >= RECENT_DAY)

# IATI organisation-type code -> (donor type, reporting-org-type label).
ORG_TYPE = {
    "10": ("Bilateral", "Government"), "11": ("Bilateral", "Local Government"),
    "15": ("Bilateral", "Other public sector"),
    "21": ("NGO", "International NGO"), "22": ("NGO", "National NGO"),
    "23": ("NGO", "Regional NGO"), "24": ("NGO", "Partner-country NGO"),
    "30": ("Private sector", "Public-private partnership"),
    "40": ("Multilateral", "Multilateral"),
    "60": ("Foundation", "Foundation"),
    "70": ("Private sector", "Private sector"),
    "71": ("Private sector", "Private sector (provider)"),
    "72": ("Private sector", "Private sector (recipient)"),
    "73": ("Private sector", "Private sector (third-country)"),
    "80": ("NGO", "Academic / research"), "90": ("NGO", "Other"),
}

# DAC sector names for the codes the pullers add (+ the existing seven). The IATI
# sector narrative is used when present; this is the fallback so codes read nicely.
SECTOR_NAME = {
    "14030": "Basic drinking water", "14020": "Water & sanitation - large systems",
    "14021": "Water supply - large systems", "14022": "Sanitation - large systems",
    "14031": "Basic drinking water supply", "14032": "Basic sanitation",
    "12220": "Basic health care", "12110": "Health policy & admin",
    "12191": "Medical services", "12240": "Basic nutrition",
    "12250": "Infectious disease control", "12262": "Malaria control",
    "12263": "Tuberculosis control", "13020": "Reproductive health care",
    "13040": "STD control including HIV/AIDS",
    "11220": "Primary education", "11110": "Education policy & admin",
    "11130": "Teacher training", "11240": "Early childhood education",
    "11320": "Secondary education", "11330": "Vocational training",
    "11420": "Higher education",
    "31120": "Agricultural development", "31110": "Agricultural policy & admin",
    "31161": "Food crop production", "31163": "Livestock", "43040": "Rural development",
    "16010": "Social protection", "16020": "Employment policy",
    "25010": "Business support & institutions", "32130": "SME development",
    "24010": "Financial policy & admin", "24030": "Financial intermediaries",
    "15110": "Public sector policy & PFM", "15150": "Civil society & participation",
    "15130": "Legal & judicial development", "15160": "Human rights",
    "15170": "Women's rights organisations", "15220": "Civilian peace-building",
    "15230": "Security system management",
    "72010": "Emergency response", "72040": "Emergency food assistance",
    "72050": "Relief coordination & support services", "73010": "Reconstruction relief",
    "74020": "Multi-hazard disaster preparedness",
    "23210": "Energy generation, renewable", "23110": "Energy policy & admin",
    "23220": "Hydro-electric power plants", "23230": "Solar energy",
    "21010": "Transport policy & admin", "21020": "Road transport",
    "22010": "Communications policy", "41010": "Environmental policy & admin",
    "41020": "Biosphere protection",
}

_WORD = re.compile(r"[a-zà-ÿ']+", re.I)
_EN = set("the of and to will this that with from are is by has have been it its their our we "
          "project programme support improve provide training health water education women children "
          "communities community access rural development assistance services people national local "
          "government district market farmers schools".split())
_FR = set("le la les des une un et à pour dans avec sur par au aux que qui cette leur sont nous "
          "vous ses développement renforcement gestion appui projet santé éducation communauté mise "
          "oeuvre accès formation afin proyecto programa apoyo".split())
_PLACEHOLDER = re.compile(r"no description.{0,40}available|description indisponible|"
                          r"description non disponible|sin descripci|pas de description", re.I)


def stream_for(sc):
    """Map a DAC 5-digit sector code to one of the five streams."""
    sc = sc or ""
    g3, g2 = sc[:3], sc[:2]
    if g3 == "140":
        return "WASH"
    if g3 in ("720", "730", "740"):
        return "Humanitarian"
    if g3 in ("151", "152"):
        return "Governance/Capacity"
    if g2 in ("21", "22", "23", "24", "25", "32", "33", "41"):
        return "Infrastructure & Economic"   # transport, comms, energy, banking,
    return "Development"                       # business, industry, trade, environment


def english_clean(text):
    if not text:
        return None
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or _PLACEHOLDER.search(text):
        return None
    low = text.lower()
    en = sum(1 for w in _WORD.findall(low) if w in _EN)
    fr = sum(1 for w in _WORD.findall(low) if w in _FR)
    if fr >= 3 and fr > en:
        return None
    if len(text) <= CAP:
        return text
    c = text[:CAP]
    m = re.search(r"^(.{400,}[.!?])\s", c, re.S) or re.search(r"^(.*)\s\S+$", c, re.S)
    return (m.group(1) if m else c) + "…"


def fetch_json(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except Exception:
            if attempt == retries:
                return None
            time.sleep(0.8 * (attempt + 1))
    return None


def _narr(node, key="/narrative"):
    best = None
    for n in (node.get(key) or []):
        t = (n.get("") or "").strip()
        if not t:
            continue
        if (n.get("@xml:lang") or "").lower() == "en":
            return t
        best = best or t
    return best


def _first_act(j):
    return ((j.get("xson") or [{}])[0].get("/iati-activities/iati-activity") or [None])[0]


def _iso_year(s):
    try:
        return int(s[:4])
    except Exception:
        return None


def _day_to_iso(days):
    try:
        return date.fromordinal(date(1970, 1, 1).toordinal() + int(days)).isoformat()
    except Exception:
        return None


class Ingest:
    """Stateful ingestion against a single js/data.js, committed once at the end."""

    def __init__(self):
        self.src = DATA.read_text(encoding="utf-8")
        _, programs = self._block("PROGRAMS", "[")
        self._rates_m, self.rates = self._block("RATES", "{")
        self._totals_m, self.totals = self._block("TOTALS", "{")
        _, devregion = self._block("DEVREGION", "{")
        self.region = {k.lower(): v for k, v in devregion.items()}
        self.sn_map = {p["sc"]: p["sn"] for p in programs if p.get("sc") and p.get("sn")}
        self.seen = {p.get("id") for p in programs if p.get("id")}
        self.added, self.skipped, self.reasons = [], 0, {}
        self._totals_changed = False

    def record_total(self, sector_name, stream, count):
        """Stage a 'recent IATI universe' count for a sector (written on commit)."""
        if count and count > 0:
            self.totals[sector_name] = {"recent_total": int(count), "stream": stream}
            self._totals_changed = True

    def _block(self, name, opener):
        closer = "]" if opener == "[" else "}"
        m = re.search(r"(?:const|let|var)\s+" + name + r"\s*=\s*(" +
                      re.escape(opener) + r"[\s\S]*?" + re.escape(closer) + r");", self.src)
        if not m:
            sys.exit(f"Could not locate {name} in js/data.js")
        return m, json.loads(m.group(1))

    def fetch_flat(self, url):
        return (fetch_json(url) or {}).get("rows") or []

    def _build(self, flat, donor, force_sector):
        aid = flat.get("aid")
        j = fetch_json(ACT.format(aid=urllib.parse.quote(aid, safe="")))
        a = _first_act(j) if j else None
        if not a:
            return None, "fetch failed"
        adef = (a.get("@default-currency") or "").upper()

        title = None
        for tt in (a.get("/title") or []):
            title = _narr(tt) or title
        title = title or flat.get("title")
        if not title:
            return None, "no title"
        desc = None
        for dd in (a.get("/description") or []):
            desc = _narr(dd) or desc
        desc = english_clean(desc or flat.get("description"))

        countries = []
        for rc in (a.get("/recipient-country") or []):
            code = (rc.get("@code") or "").upper()
            if code:
                countries.append((code, _narr(rc) or code, float(rc.get("@percentage") or 0) or 0))
        if not countries:
            return None, "no recipient country"
        countries.sort(key=lambda c: -c[2])
        cc, co, _ = countries[0]
        multi = 1 if len(countries) > 1 else 0

        # Sector: forced (sector pull) or primary DAC sector from the record.
        sc, sn_x = force_sector, None
        if not sc:
            sectors = []
            for sx in (a.get("/sector") or []):
                if str(sx.get("@vocabulary") or "1") not in ("1", "", "2"):
                    continue
                code = str(sx.get("@code") or "").strip()
                if re.fullmatch(r"\d{3,5}", code):
                    sectors.append((code.zfill(5), _narr(sx), float(sx.get("@percentage") or 0) or 0))
            if not sectors:
                return None, "no DAC sector"
            sectors.sort(key=lambda s: -s[2])
            sc, sn_x = sectors[0][0], sectors[0][1]
        else:
            # Verify the activity genuinely reports this DAC sector (don't trust the
            # d-portal sector= filter blindly — never mislabel an activity).
            codes = set()
            for sx in (a.get("/sector") or []):
                code = str(sx.get("@code") or "").strip()
                if re.fullmatch(r"\d{3,5}", code):
                    z = code.zfill(5)
                    codes.add(z)
                    if z == sc:
                        sn_x = _narr(sx) or sn_x
            if sc not in codes:
                return None, "sector not in activity"

        # Currency + amount: commitment transactions, else budgets, else flat USD.
        cur, amount, commit, basis = None, 0.0, 0.0, None
        for tr in (a.get("/transaction") or []):
            tt = (tr.get("/transaction-type") or [{}])[0]
            v = (tr.get("/value") or [{}])[0]
            try:
                amt = float(v.get("") or 0)
            except Exception:
                amt = 0.0
            if str(tt.get("@code") or "") in ("2", "C"):
                commit += amt
                cur = cur or (v.get("@currency") or adef or "").upper()
        if commit > 0:
            amount, basis, cur = commit, "commitment", (cur or adef)
        else:
            for bd in (a.get("/budget") or []):
                v = (bd.get("/value") or [{}])[0]
                try:
                    amount += float(v.get("") or 0)
                except Exception:
                    pass
                cur = cur or (v.get("@currency") or adef or "").upper()
            basis = "budget"
        if not amount or amount <= 0:
            amount = flat.get("commitment") or flat.get("spend") or 0
            cur, basis = cur or "USD", basis or "commitment"
        cur = (cur or "USD").upper()

        st = en = None
        for ad in (a.get("/activity-date") or []):
            ty, iso = str(ad.get("@type") or ""), (ad.get("@iso-date") or "")[:10]
            if ty in ("1", "2") and iso:
                st = iso if (st is None or ty == "2") else st
            if ty in ("3", "4") and iso:
                en = iso if (en is None or ty == "4") else en
        st = st or _day_to_iso(flat.get("day_start"))
        en = en or _day_to_iso(flat.get("day_end"))

        sta_code = ""
        for s in (a.get("/activity-status") or []):
            sta_code = str(s.get("@code") or "")
        sta = STATUS.get(sta_code, STATUS.get(str(flat.get("status_code") or ""), "Ongoing"))
        re_flag = 1 if a.get("/result") else 0

        # Donor identity: fixed (e.g. UAE) or derived from the reporting org.
        if donor:
            d, rt = donor["d"], donor["rt"]
            pcc, pn = donor.get("pcc", ""), donor.get("pn", "")
        else:
            ro = (a.get("/reporting-org") or [{}])[0]
            d, rt = ORG_TYPE.get(str(ro.get("@type") or ""), ("Multilateral", "Other"))
            pcc, pn = "", ""
        org = (flat.get("reporting") or "").strip() or (donor.get("label") if donor else "") or "—"
        # Funder name: a participating funding org if named, else the reporter.
        fn = org
        for po in (a.get("/participating-org") or []):
            if str(po.get("@role") or "") == "1":
                fn = _narr(po) or fn
                break

        rec = {
            "n": title, "d": d, "r": org, "rt": rt,
            "s": stream_for(sc), "sc": sc,
            # Canonical name first so one DAC code => one sector name (keeps TOTALS
            # keys aligned with programme sn, and benchmarks from fragmenting).
            "sn": SECTOR_NAME.get(sc) or (sn_x or "").strip() or self.sn_map.get(sc) or f"DAC {sc}",
            "co": co, "cc": cc, "rg": None, "sta": sta, "multi": multi,
            "st": st, "en": en, "c": cur, "a": round(float(amount), 2),
            "b": basis, "rc": None, "rb": "", "re": re_flag,
            "year": _iso_year(st), "fn": fn, "pcc": pcc, "pn": pn, "id": aid,
        }
        if desc:
            rec["desc"] = desc
        return rec, None

    def add_rows(self, rows, *, donor=None, force_sector=None, all_countries=False,
                 limit=0, delay=0.15, on_progress=None):
        todo = [r for r in rows if r.get("aid") and r["aid"] not in self.seen]
        if limit:
            todo = todo[:limit]
        for i, fr in enumerate(todo, 1):
            rec, why = self._build(fr, donor, force_sector)
            if not rec:
                self.skipped += 1
                self.reasons[why] = self.reasons.get(why, 0) + 1
            else:
                rg = self.region.get((rec["co"] or "").lower())
                if not rg and not all_countries:
                    self.skipped += 1
                    self.reasons["country out of scope"] = self.reasons.get("country out of scope", 0) + 1
                else:
                    rec["rg"] = rg or "Other"
                    self.seen.add(rec["id"])
                    self.added.append(rec)
            if on_progress and (i % 25 == 0 or i == len(todo)):
                on_progress(i, len(todo), len(self.added), self.skipped)
            time.sleep(delay)
        return len(todo)

    def commit(self, dry_run=False):
        if not self.added and not self._totals_changed:
            print("Nothing to add."); return
        if dry_run:
            print("[dry-run] no files written."); return
        src = self.src
        # Price any new currency (indicative) so the ≈USD column isn't blank.
        if any(r["c"] == "AED" for r in self.added) and "AED" not in self.rates:
            rstr = self._rates_m.group(1)[:-1] + ',"AED":' + json.dumps(AED_USD) + "}"
            src = src.replace(self._rates_m.group(1), rstr, 1)
            print(f"Added indicative AED rate ({AED_USD}) to RATES.")
        missing = sorted({r["c"] for r in self.added if r["c"] not in self.rates and r["c"] != "AED"})
        if missing:
            print(f"NOTE: not in RATES (≈USD will be blank for these): {missing}")
        if self.added:
            pm = re.search(r"const PROGRAMS=(\[[\s\S]*?\]);\s*const OUTCOMES=", src)
            body = pm.group(1)
            addition = "".join("," + json.dumps(r, ensure_ascii=False, separators=(",", ":"))
                               for r in self.added)
            src = src.replace(body, body[:-1] + addition + "]", 1)
            src = re.sub(r'("nprog":\s*)(\d+)',
                         lambda m: m.group(1) + str(int(m.group(2)) + len(self.added)), src, count=1)
        # Update the recent-IATI-universe totals (used by the #read_me table and the
        # benchmark 'In IATI' column) — by value, so RATES/PROGRAMS edits don't shift it.
        if self._totals_changed:
            src = src.replace(self._totals_m.group(1),
                              json.dumps(self.totals, ensure_ascii=False, separators=(",", ":")), 1)
        DATA.write_text(src, encoding="utf-8")
        print(f"Wrote {len(self.added)} programmes"
              + (f" and {len(self.totals)} sector totals" if self._totals_changed else "")
              + f" into {DATA}.")
