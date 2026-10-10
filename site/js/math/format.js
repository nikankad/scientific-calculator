// Number formatting and the small layout tree used for "natural" display
// (fractions, roots, superscripts) on the LCD.
import { toFraction, primeFactors } from './numeric.js';

export const MINUS = '−';
export const T = (s) => ({ t: 'text', s: String(s) });
export const R = (...c) => ({ t: 'row', c });
export const FR = (n, d) => ({ t: 'frac', n, d });
export const SQ = (c) => ({ t: 'sqrt', c });
export const SUP = (c) => ({ t: 'sup', c });

const SUPERSCRIPT = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '−': '⁻', '.': '·' };
export const toSup = (s) => String(s).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');

const signed = (s) => s.replace(/^-/, MINUS);
const trimZeros = (s) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

function sciParts(x, digits, trim) {
  const [m, e] = x.toExponential(digits - 1).split('e');
  return { m: trim ? trimZeros(m) : m, e: Number(e) };
}

function plain(x, sig) {
  if (x === 0) return '0';
  const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(x))));
  return trimZeros(x.toFixed(Math.min(decimals, 20)));
}

// Split a number into mantissa string and exponent (null = plain) following
// the calculator's display format.
export function decimalParts(x, fmt = { mode: 'norm', digits: 0 }, eng = null) {
  if (Object.is(x, -0)) x = 0;
  if (eng !== null) {
    if (x === 0) return { m: '0', e: 0 };
    const e = Math.floor(Math.log10(Math.abs(Number(x.toPrecision(10)))) / 3) * 3 - 3 * eng;
    const m = Number((x / Math.pow(10, e)).toPrecision(10));
    return { m: plain(m, 10), e };
  }
  if (fmt.mode === 'sci') return sciParts(x, fmt.digits || 10, !fmt.digits);
  if (fmt.mode === 'fix') {
    if (Math.abs(x) >= 1e10) return sciParts(x, 10, true);
    return { m: x.toFixed(fmt.digits), e: null };
  }
  if (x === 0) return { m: '0', e: null };
  const r = Number(x.toPrecision(10));
  const ar = Math.abs(r);
  if (ar >= 1e10 || ar < 1e-9) return sciParts(r, 10, true);
  return { m: plain(r, 10), e: null };
}

export function roundDisplay(x, fmt) {
  const p = decimalParts(x, fmt);
  return Number(p.e === null ? p.m : `${p.m}e${p.e}`);
}

export function formatPlain(x, fmt, sig = 10) {
  const p = decimalParts(x, fmt);
  if (sig < 10 && p.e === null && fmt.mode === 'norm') return signed(plain(Number(x.toPrecision(sig)), sig));
  return p.e === null ? signed(p.m) : `${signed(p.m)}${'×10'}${toSup(p.e)}`;
}

export function decimalLayout(x, fmt, eng = null) {
  const p = decimalParts(x, fmt, eng);
  if (p.e === null) return T(signed(p.m));
  return R(T(`${signed(p.m)}×10`), SUP(T(signed(String(p.e)))));
}

// ---------- exact forms ----------

const SQUAREFREE = [];
for (let r = 2; r < 200; r++) {
  let ok = true;
  for (let p = 2; p * p <= r; p++) if (r % (p * p) === 0) ok = false;
  if (ok) SQUAREFREE.push(r);
}

const nearInt = (x) => Math.abs(x - Math.round(x)) <= 1e-12 * Math.max(1, Math.abs(x));

export function exactInfo(x, { pi = false, surd = false } = {}) {
  if (!Number.isFinite(x) || Math.abs(x) >= 1e10 || x === 0 || nearInt(x)) return null;
  const fr = toFraction(x, 9999);
  if (fr && fr[1] > 1) return { kind: 'frac', n: fr[0], d: fr[1] };
  if (pi) {
    const p = toFraction(x / Math.PI, 99);
    if (p && Math.abs(p[0]) < 1000) return { kind: 'pi', n: p[0], d: p[1] };
  }
  if (surd) {
    for (const r of SQUAREFREE) {
      const s = toFraction(x / Math.sqrt(r), 99, 1e-12);
      if (s && Math.abs(s[0]) < 1000) return { kind: 'surd', n: s[0], d: s[1], r };
    }
  }
  return null;
}

export function exactLayout(info, mixed = false) {
  const neg = info.n < 0;
  const n = Math.abs(info.n);
  const d = info.d;
  let node;
  if (info.kind === 'frac') {
    if (mixed && n > d) {
      const whole = Math.floor(n / d);
      node = R(T(String(whole)), FR(T(String(n - whole * d)), T(String(d))));
    } else node = FR(T(String(n)), T(String(d)));
  } else if (info.kind === 'pi') {
    const num = T(`${n === 1 ? '' : n}π`);
    node = d === 1 ? num : FR(num, T(String(d)));
  } else {
    const num = R(T(n === 1 ? '' : String(n)), SQ(T(String(info.r))));
    node = d === 1 ? num : FR(num, T(String(d)));
  }
  return neg ? R(T(MINUS), node) : node;
}

export function dmsLayout(x) {
  const neg = x < 0;
  let ax = Math.abs(x);
  let d = Math.floor(ax);
  let mf = (ax - d) * 60;
  let m = Math.floor(mf + 1e-9);
  let s = Math.round((mf - m) * 60 * 100) / 100;
  if (s >= 60) { s -= 60; m += 1; }
  if (m >= 60) { m -= 60; d += 1; }
  return T(`${neg ? MINUS : ''}${d}°${m}'${trimZeros(s.toFixed(2))}"`);
}

export function factorLayout(x) {
  if (!Number.isInteger(x) || x < 2 || x >= 1e10) return null;
  const items = [];
  primeFactors(x).forEach(([p, e], i) => {
    if (i) items.push(T('×'));
    items.push(T(String(p)));
    if (e > 1) items.push(SUP(T(String(e))));
  });
  return R(...items);
}
