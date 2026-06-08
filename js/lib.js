/* Benchmark DB — pure helper functions (no DOM, no app state).
 * Works as a browser global script and as a Node module (for tests):
 *   const { median, quantile, durMonths, ... } = require("../js/lib.js");
 */
(function (root) {
  "use strict";

  var DAY = 864e5;
  var nf = new Intl.NumberFormat("en-US");

  function parseDate(s) { if (!s) return null; var t = Date.parse(s); return isNaN(t) ? null : t; }
  function durMonths(st, en) { var a = parseDate(st), b = parseDate(en); if (a == null || b == null || b < a) return null; return Math.round((b - a) / (DAY * 30.44)); }

  function median(arr) {
    var a = arr.filter(function (v) { return typeof v === "number" && !isNaN(v); }).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function quantile(s, p) {
    if (!s.length) return null;
    var i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
  }
  function statsOf(rows, key) {
    var a = rows.map(function (r) { return r[key]; }).filter(function (v) { return typeof v === "number" && !isNaN(v); }).sort(function (x, y) { return x - y; });
    return { n: a.length, min: a[0], max: a[a.length - 1], p25: quantile(a, 0.25), med: quantile(a, 0.5), p75: quantile(a, 0.75), arr: a };
  }
  function pctRank(arr, v) { if (!arr.length || v == null) return null; var c = 0; for (var i = 0; i < arr.length; i++) if (arr[i] <= v) c++; return c / arr.length; }

  function num(v) { var x = parseFloat(v); return isNaN(x) ? null : x; }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function cc(v) { v = (v == null ? "" : String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  function fmtUSD(v) { return (v == null) ? "—" : "$" + nf.format(Math.round(v)); }
  function fmtCompact(v) { if (v == null) return "—"; var a = Math.abs(v); if (a >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B"; if (a >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M"; if (a >= 1e3) return "$" + Math.round(v / 1e3) + "k"; return "$" + Math.round(v); }
  function fmtNum(v) { return (v == null) ? "—" : nf.format(v); }
  function fmtPct(v) { return (v == null) ? "—" : Math.round(v * 100) + "%"; }
  function achClass(v) { if (v == null) return ""; if (v >= 1) return "a5"; if (v >= 0.75) return "a4"; if (v >= 0.5) return "a3"; if (v >= 0.25) return "a2"; return "a1"; }

  var API = { DAY: DAY, nf: nf, parseDate: parseDate, durMonths: durMonths, median: median, quantile: quantile, statsOf: statsOf, pctRank: pctRank, num: num, esc: esc, cc: cc, fmtUSD: fmtUSD, fmtCompact: fmtCompact, fmtNum: fmtNum, fmtPct: fmtPct, achClass: achClass };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;                       // Node / tests
  } else {
    for (var k in API) root[k] = API[k];          // browser globals
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
