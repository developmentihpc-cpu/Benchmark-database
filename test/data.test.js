// Tests for the pure data/format helpers in js/lib.js.
// Run with:  npm test   (alias for: node --test)
// Requires Node 18+ (built-in node:test runner).
const assert = require("node:assert/strict");
const { test } = require("node:test");
const lib = require("../js/lib.js");
const {
  median, quantile, statsOf, pctRank, durMonths, parseDate, num,
  esc, cc, achClass, fmtCompact, fmtPct, fmtNum, fmtUSD,
} = lib;

test("module exports the expected helpers", () => {
  for (const name of ["median","quantile","statsOf","pctRank","durMonths",
    "parseDate","num","esc","cc","achClass","fmtCompact","fmtPct","fmtNum","fmtUSD"]) {
    assert.equal(typeof lib[name], "function", name + " should be a function");
  }
});

test("median", () => {
  assert.equal(median([3, 1, 2]), 2);                 // odd: middle
  assert.equal(median([1, 2, 3, 4]), 2.5);            // even: mean of two middles
  assert.equal(median([]), null);                     // empty
  assert.equal(median([1, "x", null, NaN, 3]), 2);    // ignores non-numbers/NaN
});

test("quantile (linear interpolation)", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4], 0.75), 3.25);
  assert.equal(quantile([5], 0.5), 5);                // single element
  assert.equal(quantile([], 0.5), null);              // empty
});

test("statsOf extracts a key, ignores non-numbers", () => {
  const s = statsOf([{ x: 3 }, { x: 1 }, { x: 2 }, { x: null }, { x: "a" }], "x");
  assert.equal(s.n, 3);
  assert.equal(s.min, 1);
  assert.equal(s.max, 3);
  assert.equal(s.p25, 1.5);
  assert.equal(s.med, 2);
  assert.equal(s.p75, 2.5);
  assert.deepEqual(s.arr, [1, 2, 3]);                 // sorted ascending
});

test("pctRank", () => {
  assert.equal(pctRank([1, 2, 3, 4], 2), 0.5);        // 2 of 4 are <= 2
  assert.equal(pctRank([1, 2, 3], 0), 0);             // below all
  assert.equal(pctRank([1, 2, 3], 9), 1);             // above all
  assert.equal(pctRank([], 1), null);                 // empty
  assert.equal(pctRank([1, 2, 3], null), null);       // null value
});

test("durMonths", () => {
  assert.equal(durMonths("2022-01-01", "2022-07-01"), 6);
  assert.equal(durMonths("2022-07-01", "2022-01-01"), null); // end before start
  assert.equal(durMonths("notadate", "2022-01-01"), null);   // bad date
  assert.equal(durMonths("2022-01-01", null), null);         // missing end
});

test("parseDate", () => {
  assert.equal(typeof parseDate("2022-01-01"), "number");
  assert.equal(parseDate("xyz"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
});

test("num", () => {
  assert.equal(num("  42.5 "), 42.5);
  assert.equal(num("abc"), null);
  assert.equal(num(""), null);
  assert.equal(num("10x"), 10);                       // parseFloat leading number
});

test("esc escapes HTML-significant characters incl. quotes", () => {
  assert.equal(esc("a<b>&\"'"), "a&lt;b&gt;&amp;&quot;&#39;");
  assert.equal(esc(null), "");
  assert.equal(esc(5), "5");
});

test("cc (CSV cell) quotes only when needed", () => {
  assert.equal(cc('a,b"c'), '"a,b""c"');              // comma + escaped quote
  assert.equal(cc("plain"), "plain");
  assert.equal(cc(null), "");
  assert.equal(cc("line\nbreak"), '"line\nbreak"');
});

test("achClass thresholds", () => {
  assert.equal(achClass(1), "a5");
  assert.equal(achClass(0.8), "a4");
  assert.equal(achClass(0.5), "a3");
  assert.equal(achClass(0.3), "a2");
  assert.equal(achClass(0.1), "a1");
  assert.equal(achClass(null), "");
});

test("fmtCompact", () => {
  assert.equal(fmtCompact(2.5e9), "$2.5B");
  assert.equal(fmtCompact(1.5e6), "$1.5M");
  assert.equal(fmtCompact(1500), "$2k");              // rounds thousands
  assert.equal(fmtCompact(999), "$999");
  assert.equal(fmtCompact(null), "—");
});

test("fmtPct / fmtNum / fmtUSD", () => {
  assert.equal(fmtPct(0.1234), "12%");
  assert.equal(fmtPct(null), "—");
  assert.equal(fmtNum(1234567), "1,234,567");
  assert.equal(fmtNum(null), "—");
  assert.equal(fmtUSD(1234.6), "$1,235");
  assert.equal(fmtUSD(null), "—");
});
