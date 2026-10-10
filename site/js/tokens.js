// Mapping from key actions to editor tokens.

const tk = (t, d = t) => ({ t, d });

export const TOKENS = {
  '.': tk('.'), '+': tk('+'), '-': tk('-', '−'), '*': tk('*', '×'), '/': tk('/', '÷'),
  frac: { t: '', d: '', tpl: 'frac' }, neg: tk('-', '-'), '(': tk('('), ')': tk(')'), ',': tk(','), ':': tk(':'), eqsign: tk('='),
  sq: tk('²'), cube: tk('³'), inv: tk('⁻¹'), fact: tk('!'), pct: tk('%'),
  dms: tk('°'), degm: tk('°'), radm: tk('ʳ'), gradm: tk('ᵍ'),
  pow: tk('^('), sqrt: tk('sqrt(', '√('), cbrt: tk('cbrt(', '∛('), root: tk('root(', 'ˣ√('),
  logab: tk('log('), log: tk('log('), ln: tk('ln('), exp: tk('exp(', 'e^('), pow10: tk('pow10(', '10^('),
  sin: tk('sin('), cos: tk('cos('), tan: tk('tan('),
  asin: tk('asin(', 'sin⁻¹('), acos: tk('acos(', 'cos⁻¹('), atan: tk('atan(', 'tan⁻¹('),
  sinh: tk('sinh('), cosh: tk('cosh('), tanh: tk('tanh('),
  asinh: tk('asinh(', 'sinh⁻¹('), acosh: tk('acosh(', 'cosh⁻¹('), atanh: tk('atanh(', 'tanh⁻¹('),
  Abs: tk('abs(', 'Abs('), Pol: tk('Pol('), Rec: tk('Rec('), Int: tk('Int('), Intg: tk('Intg('),
  RanInt: tk('RanInt('), GCD: tk('GCD('), LCM: tk('LCM('), Rnd: tk('Rnd('), RndFix: tk('RndFix('),
  integ: { t: '', d: '', tpl: 'integ' }, deriv: { t: '', d: '', tpl: 'deriv' }, sum: { t: '', d: '', tpl: 'sum' }, prod: { t: '', d: '', tpl: 'prod' },
  nPr: tk('nPr', 'P'), nCr: tk('nCr', 'C'), divR: tk('÷R'),
  x: tk('x'), pi: tk('π'), e: tk('ℯ', 'e'), 'Ran#': tk('Ran#'), Ans: tk('Ans'), exp10: tk('ᴇ'),
};
for (const d of '0123456789') TOKENS[d] = tk(d);
for (const v of 'ABCDEFMXY') TOKENS[v] = tk(v);

// Operators that continue from the previous answer (Ans) when typed first.
export const ANS_PREFIX = new Set(['+', '-', '*', '/', 'frac', 'sq', 'cube', 'inv', 'fact', 'pct', 'pow', 'nPr', 'nCr', 'divR']);

export const VARS = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'X', 'Y'];

export const tokenFor = (a) => (TOKENS[a] ? { ...TOKENS[a] } : null);
export const toks = (...actions) => actions.map(tokenFor);
export const constToken = (c) => tk(`[${c.id}]`, c.label);
export const convToken = (c) => tk(`{${c.id}}`, c.label);

// Tokens that spell out a number, e.g. for re-editing a stored value.
export function numberTokens(v) {
  const s = String(Number(v.toPrecision(12)));
  const out = [];
  const [m, e] = s.split('e');
  for (const ch of m) out.push(ch === '-' ? tokenFor('neg') : tokenFor(ch));
  if (e !== undefined) {
    out.push(tokenFor('exp10'));
    for (const ch of e.replace('+', '')) out.push(ch === '-' ? tokenFor('neg') : tokenFor(ch));
  }
  return out;
}

// Shared editing keys. Returns true when handled.
export function editKey(ed, a, { x = null } = {}) {
  switch (a) {
    case 'DEL': ed.del(); return true;
    case 'INS': ed.insert = !ed.insert; return true;
    case 'UNDO': ed.undo(); return true;
    case 'LEFT': ed.left(); return true;
    case 'RIGHT': ed.right(); return true;
    default: break;
  }
  if (a === 'x' && x) {
    ed.put(x);
    return true;
  }
  const tok = tokenFor(a);
  if (!tok) return false;
  ed.put(tok);
  return true;
}
