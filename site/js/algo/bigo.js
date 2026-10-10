// Complexity classes, empirical curve fitting, the Master theorem and a
// numeric asymptotic classifier for user-supplied T(n).
import { lnGamma } from '../math/numeric.js';

const LOG10_2 = Math.log10(2);

export const CLASSES = [
  { id: '1', label: 'O(1)', short: '1', f: () => 1, lg: () => 0 },
  { id: 'logn', label: 'O(log n)', short: 'log n', f: (n) => Math.log2(n), lg: (n) => Math.log10(Math.log2(n)) },
  { id: 'sqrtn', label: 'O(√n)', short: '√n', f: (n) => Math.sqrt(n), lg: (n) => 0.5 * Math.log10(n) },
  { id: 'n', label: 'O(n)', short: 'n', f: (n) => n, lg: (n) => Math.log10(n) },
  { id: 'nlogn', label: 'O(n log n)', short: 'n log n', f: (n) => n * Math.log2(n), lg: (n) => Math.log10(n) + Math.log10(Math.log2(n)) },
  { id: 'n2', label: 'O(n²)', short: 'n²', f: (n) => n * n, lg: (n) => 2 * Math.log10(n) },
  { id: 'n3', label: 'O(n³)', short: 'n³', f: (n) => n ** 3, lg: (n) => 3 * Math.log10(n) },
  { id: '2n', label: 'O(2ⁿ)', short: '2ⁿ', f: (n) => 2 ** n, lg: (n) => n * LOG10_2 },
  { id: 'nfact', label: 'O(n!)', short: 'n!', f: (n) => Math.exp(lnGamma(n + 1)), lg: (n) => lnGamma(n + 1) / Math.LN10 },
];

export const classById = (id) => CLASSES.find((c) => c.id === id);

// Fit ops ≈ c·f(n) for every class (relative least squares) and rank them.
export function fitComplexity(samples) {
  const fits = CLASSES.map((cls) => {
    const pts = samples
      .map(({ n, ops }) => ({ y: ops, f: cls.f(n) }))
      .filter((p) => Number.isFinite(p.f) && p.f > 0 && p.y > 0);
    if (pts.length < samples.length || pts.length < 2) return { cls, c: NaN, err: Infinity, r2: NaN };
    const sr = pts.reduce((s, p) => s + p.f / p.y, 0);
    const sr2 = pts.reduce((s, p) => s + (p.f / p.y) ** 2, 0);
    const c = sr / sr2;
    const err = Math.sqrt(pts.reduce((s, p) => s + ((p.y - c * p.f) / p.y) ** 2, 0) / pts.length);
    const ly = pts.map((p) => Math.log(p.y));
    const mean = ly.reduce((s, v) => s + v, 0) / ly.length;
    const ssTot = ly.reduce((s, v) => s + (v - mean) ** 2, 0);
    const ssRes = pts.reduce((s, p, i) => s + (ly[i] - Math.log(c * p.f)) ** 2, 0);
    return { cls, c, err, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1 };
  });
  return fits.sort((a, b) => a.err - b.err);
}

// Slope of log(ops) vs log(n) between the two largest samples.
export function empiricalExponent(samples) {
  const [a, b] = samples.slice(-2);
  return Math.log(b.ops / a.ops) / Math.log(b.n / a.n);
}

// ---------- Master theorem ----------

const fmt = (x) => String(Number(x.toFixed(3)));

// T(n) = a·T(n/b) + Θ(n^d · log^k n)
export function masterTheorem(a, b, d, k = 0) {
  if (!(a >= 1) || !(b > 1) || !(d >= 0) || !(k >= 0)) return { ok: false, reason: 'Need a≥1, b>1, d≥0, k≥0' };
  const crit = Math.log(a) / Math.log(b);
  const eps = 1e-9;
  if (d < crit - eps) {
    return { ok: true, crit, case: 1, p: crit, k: 0, why: `d < log_b a: leaves dominate` };
  }
  if (Math.abs(d - crit) <= eps) {
    return { ok: true, crit, case: 2, p: crit, k: k + 1, why: `d = log_b a: every level costs the same` };
  }
  return { ok: true, crit, case: 3, p: d, k, why: `d > log_b a: root dominates` };
}

export const MASTER_PRESETS = [
  { name: 'Merge sort', a: 2, b: 2, d: 1 },
  { name: 'Binary search', a: 1, b: 2, d: 0 },
  { name: 'Karatsuba', a: 3, b: 2, d: 1 },
  { name: 'Strassen', a: 7, b: 2, d: 2 },
  { name: 'Tree traversal', a: 2, b: 2, d: 0 },
  { name: 'Quickselect avg', a: 1, b: 2, d: 1 },
];

// ---------- numeric classification of T(n) ----------

function snap(v, step, tol) {
  const r = Math.round(v / step) * step;
  return Math.abs(v - r) <= tol ? r : null;
}

export function classifyGrowth(f) {
  const L = (n) => {
    const v = f(n);
    return v > 0 && Number.isFinite(v) ? Math.log(v) : NaN;
  };
  // Exponential / factorial test: is ln f(n) growing linearly (or faster) in n?
  const l10 = L(10), l20 = L(20), l40 = L(40);
  if ([l10, l20, l40].some(Number.isNaN)) {
    if ([L(2 ** 20), L(2 ** 30)].some(Number.isNaN)) return { kind: 'error' };
  } else if (Math.abs(l20 - l10) > 1e-9) {
    const ratio = (l40 - l20) / (l20 - l10);
    if (ratio > 1.45) {
      if (ratio > 2.2) return { kind: 'fact' };
      let n1 = 20, n2 = 40;
      if (!Number.isNaN(L(200)) && !Number.isNaN(L(100))) [n1, n2] = [100, 200];
      let base = Math.exp((L(n2) - L(n1)) / (n2 - n1));
      const ib = snap(base, 1, 0.03 * base);
      base = ib !== null ? ib : Number(base.toFixed(2));
      return { kind: 'exp', base, c: f(n1) / base ** n1 };
    }
  }
  // Polynomial × polylog: estimate the exponent at very large n.
  let N1 = 2 ** 30, N2 = 2 ** 40;
  if (Number.isNaN(L(N2)) || Number.isNaN(L(N1))) [N1, N2] = [2 ** 12, 2 ** 16];
  if (Number.isNaN(L(N2)) || Number.isNaN(L(N1))) return { kind: 'error' };
  const s = (L(N2) - L(N1)) / Math.log(N2 / N1);
  let p = snap(s, 0.5, 0.12);
  if (p === null) p = Number(s.toFixed(2));
  const h1 = L(N1) - p * Math.log(N1);
  const h2 = L(N2) - p * Math.log(N2);
  const kRaw = (h2 - h1) / (Math.log(Math.log(N2)) - Math.log(Math.log(N1)));
  let k = snap(kRaw, 1, 0.25);
  if (k === null) k = Number(kRaw.toFixed(2));
  if (Math.abs(p) < 1e-9) p = 0;
  if (Math.abs(k) < 1e-9) k = 0;
  const c = f(N2) / (N2 ** p * Math.log2(N2) ** k);
  return { kind: 'poly', p, k, c, slope: s };
}

// Human-readable growth text, e.g. "n² log n".
export function growthText(p, k) {
  const sup = (v) => {
    const s = fmt(v);
    return s === '1' ? '' : s.replace(/[-0-9.]/g, (c) => ({ '-': '⁻', '.': '·' }[c] ?? '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]));
  };
  const parts = [];
  if (p === 0.5) parts.push('√n');
  else if (p !== 0) parts.push(`n${sup(p)}`);
  if (k !== 0) parts.push(`log${sup(k)} n`);
  return parts.length ? parts.join(' ') : '1';
}

// ---------- "ops at n" ----------

export function opsAt(n) {
  return CLASSES.map((cls) => {
    const lg = cls.lg(n);
    return { cls, lg, seconds: lg - 9 };
  });
}

// Format a log10 value as a number string.
export function formatLog10(lg) {
  if (!Number.isFinite(lg)) return '∞';
  if (lg < 9) {
    const v = 10 ** lg;
    return v >= 100 ? String(Math.round(v)) : String(Number(v.toPrecision(4)));
  }
  const e = Math.floor(lg);
  const m = 10 ** (lg - e);
  return `${m.toFixed(2)}×10${String(e).replace(/[0-9]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`;
}

// Time for 10^lg operations at 10^9 ops/s.
export function formatDuration(lg) {
  const ls = lg - 9;
  if (!Number.isFinite(ls)) return '∞';
  const s = 10 ** ls;
  const units = [
    [1e-9, 'ns'], [1e-6, 'µs'], [1e-3, 'ms'], [1, 's'], [60, 'min'], [3600, 'h'], [86400, 'days'], [31557600, 'yr'],
  ];
  if (ls < -9) return '<1ns';
  let pick = units[0];
  for (const u of units) if (s >= u[0]) pick = u;
  if (pick[1] === 'yr') {
    const ly = ls - Math.log10(31557600);
    if (ly > 10.14) return '≫universe';
    if (ly >= 4) return `${formatLog10(ly)}yr`;
  }
  const v = s / pick[0];
  return `${v >= 100 ? Math.round(v) : Number(v.toPrecision(3))}${pick[1]}`;
}
