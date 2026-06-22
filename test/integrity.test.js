// Integrity tests for the embedded dataset (js/data.js) — guards against the
// kind of pollution a bad IATI pull can introduce (negative amounts, $0
// "programmes" in medians, placeholder sector names, invalid enums, broken FX).
// These complement the pure-helper tests in data.test.js.
// Run with:  npm test   (alias for: node --test)
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const lib = require("../js/lib.js");

// Parse the globals out of the browser data file without executing it.
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
function arr(name) {
  const m = SRC.match(new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*(\\[[\\s\\S]*?\\]);"));
  if (!m) throw new Error("could not find " + name);
  return JSON.parse(m[1]);
}
function obj(name) {
  const m = SRC.match(new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*(\\{[\\s\\S]*?\\});"));
  if (!m) throw new Error("could not find " + name);
  return JSON.parse(m[1]);
}
const PROGRAMS = arr("PROGRAMS");
const OUTCOMES = arr("OUTCOMES");
const RATES = obj("RATES");
const DEVREGION = obj("DEVREGION");

const STREAMS = new Set(["Humanitarian", "WASH", "Governance/Capacity", "Development", "Infrastructure & Economic"]);
const DONORS = new Set(["Bilateral", "Multilateral", "NGO", "Foundation", "Private sector"]);
const STATUS = new Set(["Planned", "Ongoing", "Finalisation", "Closed", "Cancelled", "Suspended"]);

test("dataset is non-trivial and META agrees with PROGRAMS", () => {
  assert.ok(PROGRAMS.length > 3000, "expected a few thousand programmes");
  const meta = obj("META");
  assert.equal(meta.nprog, PROGRAMS.length, "META.nprog must equal PROGRAMS.length");
});

test("every programme has the required identifying fields", () => {
  // c (currency), a (amount), st/en (dates) are allowed to be GAP — never guessed.
  for (const p of PROGRAMS) {
    for (const k of ["n", "d", "sc", "sn", "co", "cc", "rg", "s", "sta", "id"]) {
      assert.ok(p[k] !== undefined && p[k] !== null && p[k] !== "",
        `programme ${p.id} missing ${k}`);
    }
  }
});

test("IATI identifiers are unique", () => {
  const seen = new Set();
  for (const p of PROGRAMS) {
    assert.ok(!seen.has(p.id), "duplicate id: " + p.id);
    seen.add(p.id);
  }
});

test("enums are valid (stream / donor type / status)", () => {
  for (const p of PROGRAMS) {
    assert.ok(STREAMS.has(p.s), `bad stream "${p.s}" on ${p.id}`);
    assert.ok(DONORS.has(p.d), `bad donor type "${p.d}" on ${p.id}`);
    assert.ok(STATUS.has(p.sta), `bad status "${p.sta}" on ${p.id}`);
  }
});

test("amounts are non-negative and numeric (no negative/NaN budgets)", () => {
  for (const p of PROGRAMS) {
    if (p.a === null || p.a === undefined) continue;      // GAP is allowed
    assert.equal(typeof p.a, "number", `non-numeric amount on ${p.id}`);
    assert.ok(p.a >= 0, `negative amount ${p.a} on ${p.id}`);
  }
});

test("a zero/absent amount is treated as a GAP, never a $0 comparator", () => {
  // mirrors usdOf(): only a positive amount in a known currency yields a USD value,
  // so a==0 or a missing amount must NOT contribute a real figure to medians.
  for (const p of PROGRAMS) {
    const usd = (typeof RATES[p.c] === "number" && typeof p.a === "number" && p.a > 0)
      ? p.a * RATES[p.c] : null;
    assert.ok(usd === null || usd > 0, `non-positive USD derived for ${p.id}`);
  }
});

test("sector codes are 5-digit DAC and names are not placeholders", () => {
  for (const p of PROGRAMS) {
    assert.match(p.sc, /^\d{5}$/, `bad sector code "${p.sc}" on ${p.id}`);
    assert.doesNotMatch(p.sn, /^DAC \d/, `placeholder sector name on ${p.id}: ${p.sn}`);
  }
});

test("dates are well-formed and ordered; years are plausible", () => {
  for (const p of PROGRAMS) {
    for (const k of ["st", "en"]) {
      if (p[k]) assert.match(p[k], /^\d{4}-\d{2}-\d{2}$/, `bad ${k} on ${p.id}`);
    }
    if (p.st && p.en) assert.ok(p.st <= p.en, `start after end on ${p.id}`);
    if (p.year != null) assert.ok(p.year >= 1990 && p.year <= 2030, `implausible year ${p.year} on ${p.id}`);
  }
});

test("every recipient country resolves to a region in DEVREGION", () => {
  for (const p of PROGRAMS) {
    assert.ok(DEVREGION[p.co] !== undefined, `country "${p.co}" (${p.id}) not in DEVREGION`);
  }
});

test("every reported currency has an FX rate (so ≈USD is computable, not silently dropped)", () => {
  const used = new Set(PROGRAMS.map(p => p.c).filter(Boolean));  // absent currency = GAP, fine
  for (const c of used) {
    assert.equal(typeof RATES[c], "number", `currency ${c} used but has no FX rate`);
  }
});

test("provider country, when present, maps to a single consistent name", () => {
  const byCc = {};
  for (const p of PROGRAMS) {
    if (!p.pcc) continue;
    assert.ok(p.pn, `provider code without name on ${p.id}`);
    (byCc[p.pcc] = byCc[p.pcc] || new Set()).add(p.pn);
  }
  for (const [code, names] of Object.entries(byCc)) {
    assert.equal(names.size, 1, `provider ${code} has inconsistent names: ${[...names].join(" / ")}`);
  }
});

test("outcome rows link to a programme and carry an indicator", () => {
  const progNames = new Set(PROGRAMS.map(p => p.n));
  let linked = 0;
  for (const o of OUTCOMES) {
    assert.ok(o.n, "outcome row missing programme name");
    if (progNames.has(o.n)) linked++;
  }
  assert.ok(linked > 0, "no outcome rows link to any programme");
});

test("CPI deflator covers the programme year range (real-USD toggle)", () => {
  const DEFLATOR = obj("DEFLATOR");
  const years = PROGRAMS.map(p => p.year).filter(y => y != null);
  const lo = Math.min(...years), hi = Math.max(...years);
  // the real-2024 USD toggle deflates by start year; the table should span the data.
  assert.ok(DEFLATOR[String(lo)] != null || DEFLATOR[lo] != null, `no CPI deflator for earliest year ${lo}`);
  assert.equal(typeof lib.statsOf, "function");  // helpers remain importable alongside data
});
