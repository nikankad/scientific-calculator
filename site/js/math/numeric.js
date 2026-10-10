// Numerical routines: integration, differentiation, root finding,
// rational approximation, polynomial and linear-system solvers, statistics.

// Gauss–Kronrod 7/15 abscissae and weights.
const XGK = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851,
  0.864864423359769072789712788640926, 0.741531185599394439863864773280788,
  0.586087235467691130294144845693013, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0,
];
const WGK = [
  0.02293532201052922496373200805897, 0.063092092629978553290700663189204,
  0.104790010322250183839876322541518, 0.140653259715525918745189590510238,
  0.16900472663926790282658342659855, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
const WG = [
  0.129484966168869693270611432679082, 0.27970539148927666790146777142378,
  0.381830050505118944950369775488975, 0.417959183673469387755102040816327,
];

function gk15(f, a, b) {
  const c = (a + b) / 2;
  const h = (b - a) / 2;
  const fc = f(c);
  let k = fc * WGK[7];
  let g = fc * WG[3];
  for (let j = 0; j < 7; j++) {
    const dx = h * XGK[j];
    const s = f(c - dx) + f(c + dx);
    k += WGK[j] * s;
    if (j % 2 === 1) g += WG[(j - 1) / 2] * s;
  }
  return [k * h, Math.abs((k - g) * h)];
}

export function integrate(f, a, b, tol = 1e-11) {
  if (a === b) return 0;
  if (a > b) return -integrate(f, b, a, tol);
  const [v0, e0] = gk15(f, a, b);
  const span = b - a;
  const stack = [[a, b, v0, e0, 0]];
  let total = 0;
  let evals = 0;
  while (stack.length) {
    const [lo, hi, v, e, depth] = stack.pop();
    const local = Math.max(tol * Math.abs(v), tol * Math.abs(v0) * ((hi - lo) / span), 1e-15);
    if (e <= local || depth > 40 || evals > 8000) {
      total += v;
      continue;
    }
    const mid = (lo + hi) / 2;
    const L = gk15(f, lo, mid);
    const R = gk15(f, mid, hi);
    evals += 2;
    stack.push([lo, mid, L[0], L[1], depth + 1], [mid, hi, R[0], R[1], depth + 1]);
  }
  return total;
}

// Ridders' extrapolation of central differences.
export function derivative(f, x) {
  const CON = 1.4;
  const CON2 = CON * CON;
  const N = 10;
  let h = 0.05 * Math.max(1, Math.abs(x));
  const a = Array.from({ length: N }, () => new Array(N).fill(0));
  a[0][0] = (f(x + h) - f(x - h)) / (2 * h);
  let best = a[0][0];
  let err = Infinity;
  for (let i = 1; i < N; i++) {
    h /= CON;
    a[0][i] = (f(x + h) - f(x - h)) / (2 * h);
    let fac = CON2;
    for (let j = 1; j <= i; j++) {
      a[j][i] = (a[j - 1][i] * fac - a[j - 1][i - 1]) / (fac - 1);
      fac *= CON2;
      const errt = Math.max(Math.abs(a[j][i] - a[j - 1][i]), Math.abs(a[j][i] - a[j - 1][i - 1]));
      if (errt <= err) {
        err = errt;
        best = a[j][i];
      }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= 2 * err) break;
  }
  return best;
}

function safe(f) {
  return (x) => {
    try {
      const v = f(x);
      return Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };
}

function bisect(F, a, b, fa) {
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    const fm = F(m);
    if (fm === 0 || (b - a) / 2 < 1e-15 * Math.max(1, Math.abs(m))) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}

// Find x with f(x) = 0 near x0. Returns null when no root is found.
export function solve(f, x0 = 0) {
  const F = safe(f);
  let x = Number.isFinite(x0) ? x0 : 0;
  const tiny = (v) => Math.abs(v) < 1e-9;
  for (let i = 0; i < 100; i++) {
    const fx = F(x);
    if (Number.isNaN(fx)) break;
    if (fx === 0) return x;
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const d = (F(x + h) - F(x - h)) / (2 * h);
    if (!Number.isFinite(d) || d === 0) break;
    let step = fx / d;
    let nx = x - step;
    let tries = 0;
    while (tries < 30 && !(Math.abs(F(nx)) < Math.abs(fx))) {
      step /= 2;
      nx = x - step;
      tries++;
    }
    if (tries === 30) break;
    if (Math.abs(nx - x) <= 1e-14 * Math.max(1, Math.abs(x))) {
      if (tiny(F(nx))) return nx;
      break;
    }
    x = nx;
  }
  if (tiny(F(x))) return x;
  // Expand outward from x0 looking for a sign change.
  const base = Number.isFinite(x0) ? x0 : 0;
  for (const dir of [1, -1]) {
    let prev = base;
    let fprev = F(prev);
    for (let k = 0; k < 260; k++) {
      const cur = base + dir * 0.01 * Math.pow(1.12, k);
      const fcur = F(cur);
      if (!Number.isNaN(fprev) && !Number.isNaN(fcur) && Math.sign(fprev) !== Math.sign(fcur)) {
        const lo = Math.min(prev, cur);
        const hi = Math.max(prev, cur);
        const r = bisect(F, lo, hi, F(lo));
        const fr = F(r);
        if (Math.abs(fr) <= 1e-6 * Math.max(1, Math.abs(fprev), Math.abs(fcur)) || Math.abs(fr) < 1e-9) return r;
      }
      prev = cur;
      fprev = fcur;
    }
  }
  return null;
}

// Best rational approximation n/d with d <= maxDen, or null if none within tol.
export function toFraction(x, maxDen = 9999, tol = 1e-11) {
  if (!Number.isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0;
  let v = ax;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(v);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(ax - h1 / k1) <= tol * Math.max(1, ax)) return [sign * h1, k1];
    const frac = v - a;
    if (frac < 1e-15) break;
    v = 1 / frac;
  }
  return null;
}

// ---------- polynomials ----------

const C = {
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  div: (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  },
  abs: (a) => Math.hypot(a.re, a.im),
};

function horner(coef, z) {
  let p = { re: 0, im: 0 };
  let dp = { re: 0, im: 0 };
  for (const c of coef) {
    dp = C.add(C.mul(dp, z), p);
    p = C.add(C.mul(p, z), { re: c, im: 0 });
  }
  return [p, dp];
}

function sortRoots(roots) {
  const clean = roots.map(({ re, im }) => {
    const scale = 1 + Math.abs(re);
    return {
      re: Math.abs(re) < 1e-12 * (1 + Math.abs(im)) ? 0 : re,
      im: Math.abs(im) < 1e-9 * scale ? 0 : im,
    };
  });
  const real = clean.filter((r) => r.im === 0).sort((a, b) => b.re - a.re);
  const cplx = clean.filter((r) => r.im !== 0).sort((a, b) => b.re - a.re || b.im - a.im);
  return [...real, ...cplx];
}

function cubicRoots(a, b, c) {
  // x^3 + a x^2 + b x + c
  const p = b - (a * a) / 3;
  const q = (2 * a * a * a) / 27 - (a * b) / 3 + c;
  const shift = -a / 3;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const scale = Math.max((q * q) / 4, Math.abs(p * p * p) / 27, 1e-300);
  let ts;
  if (Math.abs(p) < 1e-14 && Math.abs(q) < 1e-14) {
    ts = [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }];
  } else if (Math.abs(disc) <= 1e-12 * scale) {
    ts = [{ re: (3 * q) / p, im: 0 }, { re: (-3 * q) / (2 * p), im: 0 }, { re: (-3 * q) / (2 * p), im: 0 }];
  } else if (disc > 0) {
    const s = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + s);
    const v = Math.cbrt(-q / 2 - s);
    ts = [
      { re: u + v, im: 0 },
      { re: -(u + v) / 2, im: (Math.sqrt(3) / 2) * (u - v) },
      { re: -(u + v) / 2, im: -(Math.sqrt(3) / 2) * (u - v) },
    ];
  } else {
    const r = 2 * Math.sqrt(-p / 3);
    const phi = Math.acos(Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)))) / 3;
    ts = [0, 1, 2].map((k) => ({ re: r * Math.cos(phi - (2 * Math.PI * k) / 3), im: 0 }));
  }
  return ts.map((t) => ({ re: t.re + shift, im: t.im }));
}

function durandKerner(coef) {
  const n = coef.length - 1;
  const R = 1 + Math.max(...coef.slice(1).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => ({
    re: R * Math.cos((2 * Math.PI * k) / n + 0.4),
    im: R * Math.sin((2 * Math.PI * k) / n + 0.4),
  }));
  for (let it = 0; it < 2000; it++) {
    let delta = 0;
    z = z.map((zi, i) => {
      const [p] = horner(coef, zi);
      let den = { re: 1, im: 0 };
      z.forEach((zj, j) => {
        if (j !== i) den = C.mul(den, C.sub(zi, zj));
      });
      const step = C.div(p, den);
      delta = Math.max(delta, C.abs(step));
      return C.sub(zi, step);
    });
    if (delta < 1e-15) break;
  }
  return z;
}

// Roots of a polynomial given by coefficients (highest degree first).
export function polyRoots(coeffs) {
  if (!coeffs.length || coeffs[0] === 0) throw new Error('Leading coefficient must be non-zero');
  const a = coeffs.map((v) => v / coeffs[0]);
  const n = a.length - 1;
  let roots;
  if (n === 1) roots = [{ re: -a[1], im: 0 }];
  else if (n === 2) {
    const b = a[1];
    const c = a[2];
    const disc = b * b - 4 * c;
    if (disc >= 0) {
      const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(disc));
      roots = q === 0 ? [{ re: 0, im: 0 }, { re: 0, im: 0 }] : [{ re: q, im: 0 }, { re: c / q, im: 0 }];
    } else {
      const im = Math.sqrt(-disc) / 2;
      roots = [{ re: -b / 2, im }, { re: -b / 2, im: -im }];
    }
  } else if (n === 3) roots = cubicRoots(a[1], a[2], a[3]);
  else roots = durandKerner(a);
  // Newton polish on simple roots.
  roots = roots.map((z) => {
    let r = z;
    for (let i = 0; i < 4; i++) {
      const [p, dp] = horner(a, r);
      if (C.abs(dp) < 1e-12) break;
      const nr = C.sub(r, C.div(p, dp));
      if (!(C.abs(horner(a, nr)[0]) <= C.abs(p))) break;
      r = nr;
    }
    return r;
  });
  return sortRoots(roots);
}

// ---------- linear systems ----------

export function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const scale = Math.max(1e-300, ...M.flat().map(Math.abs));
  const eps = 1e-11 * scale;
  let rank = 0;
  const pivCols = [];
  for (let col = 0; col < n && rank < n; col++) {
    let piv = rank;
    for (let r = rank + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) <= eps) continue;
    [M[rank], M[piv]] = [M[piv], M[rank]];
    for (let r = 0; r < n; r++) {
      if (r === rank) continue;
      const f = M[r][col] / M[rank][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[rank][c];
    }
    pivCols.push(col);
    rank++;
  }
  for (let r = rank; r < n; r++) if (Math.abs(M[r][n]) > eps) return { kind: 'none' };
  if (rank < n) return { kind: 'infinite' };
  const x = new Array(n);
  pivCols.forEach((col, r) => {
    x[col] = M[r][n] / M[r][col];
  });
  return { kind: 'unique', x: x.map((v) => (Math.abs(v) < 1e-13 * scale ? 0 : v)) };
}

// ---------- statistics ----------

function median(s) {
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function oneVar(xs) {
  const n = xs.length;
  if (!n) return null;
  const s = [...xs].sort((a, b) => a - b);
  const sum = xs.reduce((a, b) => a + b, 0);
  const sum2 = xs.reduce((a, b) => a + b * b, 0);
  const mean = sum / n;
  const ss = xs.reduce((a, b) => a + (b - mean) ** 2, 0);
  const half = Math.floor(n / 2);
  return {
    n,
    mean,
    sum,
    sum2,
    sigma: Math.sqrt(ss / n),
    s: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN,
    min: s[0],
    q1: n === 1 ? s[0] : median(s.slice(0, half)),
    med: median(s),
    q3: n === 1 ? s[0] : median(s.slice(n - half)),
    max: s[n - 1],
  };
}

export function linReg(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { n, mx, my, a: my - b * mx, b, r: syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy) };
}

// ---------- integers ----------

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function primeFactors(n) {
  const out = [];
  let m = n;
  for (let p = 2; p * p <= m; p += p === 2 ? 1 : 2) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

// ln Γ(x) via Lanczos approximation.
export function lnGamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
