// Base-N (DEC/HEX/BIN/OCT) integer evaluator with 32-bit two's-complement
// wrap-around and logic operators.
import { CalcError } from './engine.js';

export const BASES = { DEC: 10, HEX: 16, BIN: 2, OCT: 8 };
const PREFIX = { 'ᵈ': 10, 'ʰ': 16, 'ᵇ': 2, 'ᵒ': 8 };
const WORDS = ['xnor', 'xor', 'and', 'or', 'Not(', 'Neg('];
const OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/' };

const wrap = (v) => BigInt.asIntN(32, v);

function lex(src, base) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    const word = WORDS.find((w) => src.startsWith(w, i));
    if (word) {
      out.push({ type: word.endsWith('(') ? 'fn' : 'op', value: word.replace('(', ''), pos: i });
      i += word.length;
      continue;
    }
    let b = base;
    let j = i;
    if (PREFIX[ch]) {
      b = PREFIX[ch];
      j++;
    }
    const m = /^[0-9A-F]+/.exec(src.slice(j));
    if (m) {
      const digits = m[0];
      const bad = [...digits].findIndex((d) => parseInt(d, 16) >= b);
      if (bad >= 0) throw new CalcError('Syntax', j + bad);
      let v = 0n;
      for (const d of digits) v = v * BigInt(b) + BigInt(parseInt(d, 16));
      out.push({ type: 'num', value: wrap(v), pos: i });
      i = j + digits.length;
      continue;
    }
    if (PREFIX[ch]) throw new CalcError('Syntax', i + 1);
    if (OPS[ch]) out.push({ type: 'op', value: OPS[ch], pos: i });
    else if (ch === '(') out.push({ type: 'lp', pos: i });
    else if (ch === ')') out.push({ type: 'rp', pos: i });
    else throw new CalcError('Syntax', i);
    i++;
  }
  return out;
}

const BP = { or: 1, xor: 2, xnor: 2, and: 3, '+': 4, '-': 4, '*': 5, '/': 5 };

export function evalBaseN(src, base = 10) {
  const toks = lex(src, base);
  if (!toks.length) throw new CalcError('Syntax', 0);
  let i = 0;
  const fail = (t) => {
    throw new CalcError('Syntax', t ? t.pos : src.length);
  };
  const expr = (min) => {
    let left = unary();
    for (;;) {
      const t = toks[i];
      if (!t || t.type !== 'op' || !(BP[t.value] > min)) break;
      i++;
      const r = expr(BP[t.value]);
      left = apply(t, left, r);
    }
    return left;
  };
  const unary = () => {
    const t = toks[i++];
    if (!t) fail();
    if (t.type === 'num') return t.value;
    if (t.type === 'op' && t.value === '-') return wrap(-unary());
    if (t.type === 'lp' || t.type === 'fn') {
      const v = expr(0);
      if (toks[i]?.type === 'rp') i++;
      else if (toks[i]) fail(toks[i]);
      if (t.value === 'Not') return wrap(~v);
      if (t.value === 'Neg') return wrap(-v);
      return v;
    }
    return fail(t);
  };
  const apply = (t, a, b) => {
    switch (t.value) {
      case '+': return wrap(a + b);
      case '-': return wrap(a - b);
      case '*': return wrap(a * b);
      case '/':
        if (b === 0n) throw new CalcError('Math', t.pos);
        return wrap(a / b);
      case 'and': return wrap(a & b);
      case 'or': return wrap(a | b);
      case 'xor': return wrap(a ^ b);
      case 'xnor': return wrap(~(a ^ b));
      default: return fail(t);
    }
  };
  const v = expr(0);
  if (i < toks.length) fail(toks[i]);
  return Number(v);
}

export function formatBase(v, base) {
  if (base === 10) return String(v);
  return BigInt.asUintN(32, BigInt(v)).toString(base).toUpperCase();
}
