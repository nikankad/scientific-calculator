// Expression engine: lexer, Casio-style Pratt parser and evaluator.
//
// Priority (high → low): postfix (x², x⁻¹, x!, °), powers/roots, fractions (⁄),
// prefix minus, implied multiplication, nPr/nCr, × ÷, + −, ÷R.
import { integrate, derivative, toFraction, gcd } from './numeric.js';
import { CONSTANTS, CONVERSIONS } from './units.js';
import { roundDisplay } from './format.js';

export class CalcError extends Error {
  constructor(kind, pos = -1) {
    super(`${kind} ERROR`);
    this.kind = kind;
    this.pos = pos;
  }
}

export const FUNCTIONS = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'log', 'ln', 'exp', 'pow10', 'sqrt', 'cbrt', 'root', 'abs', 'Pol', 'Rec', 'Int', 'Intg',
  'RanInt', 'GCD', 'LCM', 'Rnd', 'RndFix', 'integ', 'deriv', 'sum', 'prod',
];

const ARITY = {
  log: [1, 2], root: [2], Pol: [2], Rec: [2], RanInt: [2], GCD: [2], LCM: [2], RndFix: [2],
  integ: [3], deriv: [2], sum: [3], prod: [3],
};
const LAZY = new Set(['integ', 'deriv', 'sum', 'prod']);

const WORDS = [
  ...FUNCTIONS.map((f) => [`${f}(`, { type: 'func', value: f }]),
  ['Ans', { type: 'var', value: 'Ans' }],
  ['Ran#', { type: 'const', value: 'ran' }],
  ['nPr', { type: 'op', value: 'nPr' }],
  ['nCr', { type: 'op', value: 'nCr' }],
  ['÷R', { type: 'op', value: 'rem' }],
  ['⁻¹', { type: 'post', value: 'inv' }],
].sort((a, b) => b[0].length - a[0].length);

const CHARS = {
  '+': ['op', '+'], '-': ['op', '-'], '−': ['op', '-'], '*': ['op', '*'], '×': ['op', '*'],
  '/': ['op', '/'], '÷': ['op', '/'], '⁄': ['op', 'frac'], '^': ['op', '^'],
  '²': ['post', 'sq'], '³': ['post', 'cube'], '!': ['post', 'fact'], '%': ['post', 'pct'],
  '°': ['post', 'deg'], 'ʳ': ['post', 'rad'], 'ᵍ': ['post', 'grad'],
  '(': ['lp'], ')': ['rp'], ',': ['comma'], ':': ['colon'], '=': ['eq'],
  'π': ['const', 'pi'], 'ℯ': ['const', 'e'], x: ['var', 'X'], n: ['var', 'n'],
};
for (const v of 'ABCDEFMXY') CHARS[v] = ['var', v];

const NUMBER = /^(?:\d+\.?\d*|\.\d+)?(?:ᴇ[-−]?\d+)?/;

export function lex(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    const rest = src.slice(i);
    const num = NUMBER.exec(rest)[0];
    if (num) {
      const next = src[i + num.length];
      if (next === '.' || (next && /\d/.test(next))) throw new CalcError('Syntax', i + num.length);
      let s = num.replace('−', '-');
      if (s[0] === 'ᴇ') s = `1${s}`;
      out.push({ type: 'num', value: Number(s.replace('ᴇ', 'e')), pos: i });
      i += num.length;
      continue;
    }
    if (ch === '[' || ch === '{') {
      const close = src.indexOf(ch === '[' ? ']' : '}', i);
      const name = close < 0 ? '' : src.slice(i + 1, close);
      const table = ch === '[' ? CONSTANTS : CONVERSIONS;
      if (!table.some((c) => c.id === name)) throw new CalcError('Syntax', i);
      out.push({ type: ch === '[' ? 'pconst' : 'conv', value: name, pos: i });
      i = close + 1;
      continue;
    }
    const w = WORDS.find(([text]) => rest.startsWith(text));
    if (w) {
      out.push({ ...w[1], pos: i });
      i += w[0].length;
      continue;
    }
    const c = CHARS[ch];
    if (!c) throw new CalcError('Syntax', i);
    out.push({ type: c[0], value: c[1], pos: i });
    i++;
  }
  return out;
}

const BINARY = { '+': 10, '-': 10, '*': 20, '/': 20, nPr: 25, nCr: 25, frac: 37, '^': 40, rem: 5 };
const IMPLICIT = 30;
const PREFIX = 35;
const POSTFIX = 50;
const STARTERS = new Set(['num', 'var', 'const', 'pconst', 'func', 'lp']);

class Parser {
  constructor(tokens, end) {
    this.t = tokens;
    this.i = 0;
    this.end = end;
  }

  peek() {
    return this.t[this.i];
  }

  fail(tok) {
    throw new CalcError('Syntax', tok ? tok.pos : this.end);
  }

  program() {
    const body = [];
    for (;;) {
      body.push(this.statement());
      const t = this.peek();
      if (!t) break;
      if (t.type !== 'colon') this.fail(t);
      this.i++;
    }
    return { type: 'prog', body };
  }

  statement() {
    const l = this.expr(0);
    const t = this.peek();
    if (t?.type === 'eq') {
      this.i++;
      return { type: 'eq', l, r: this.expr(0), pos: t.pos };
    }
    return l;
  }

  expr(min) {
    let left = this.nud();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'op' && BINARY[t.value] > min) {
        this.i++;
        const bp = BINARY[t.value];
        const right = this.expr(t.value === '^' ? bp - 1 : bp);
        left = { type: 'bin', op: t.value, l: left, r: right, pos: t.pos };
      } else if ((t.type === 'post' || t.type === 'conv') && POSTFIX > min) {
        this.i++;
        left = { type: t.type, op: t.value, a: left, pos: t.pos };
      } else if (STARTERS.has(t.type) && IMPLICIT > min) {
        const right = this.expr(IMPLICIT);
        left = { type: 'bin', op: '*', l: left, r: right, pos: t.pos };
      } else break;
    }
    return left;
  }

  nud() {
    const t = this.t[this.i++];
    if (!t) this.fail();
    switch (t.type) {
      case 'num':
        return { type: 'num', value: t.value, pos: t.pos };
      case 'var':
      case 'const':
      case 'pconst':
        return { type: t.type, name: t.value, pos: t.pos };
      case 'lp': {
        const e = this.expr(0);
        this.close();
        return e;
      }
      case 'func': {
        const args = [];
        if (this.peek() && this.peek().type !== 'rp') {
          for (;;) {
            args.push(this.expr(0));
            if (this.peek()?.type !== 'comma') break;
            this.i++;
          }
        }
        this.close();
        return { type: 'call', name: t.value, args, pos: t.pos };
      }
      case 'op':
        if (t.value === '-' || t.value === '+') {
          const a = this.expr(PREFIX);
          return t.value === '-' ? { type: 'neg', a, pos: t.pos } : a;
        }
        break;
      default:
        break;
    }
    return this.fail(t);
  }

  // Missing closing parentheses are allowed at the end of a statement.
  close() {
    const t = this.peek();
    if (!t || t.type === 'colon' || t.type === 'eq') return;
    if (t.type !== 'rp') this.fail(t);
    this.i++;
  }
}

export function parse(src) {
  const tokens = lex(src);
  if (!tokens.length) throw new CalcError('Syntax', 0);
  return new Parser(tokens, src.length).program();
}

// Variables referenced by an expression, in order of appearance (for CALC).
export function collectVars(ast) {
  const out = [];
  const walk = (n, bound) => {
    if (!n) return;
    switch (n.type) {
      case 'prog':
        n.body.forEach((s) => walk(s, bound));
        break;
      case 'eq':
      case 'bin':
        walk(n.l, bound);
        walk(n.r, bound);
        break;
      case 'var':
        if (n.name !== 'Ans' && !(bound && n.name === 'X') && !out.includes(n.name)) out.push(n.name);
        break;
      case 'neg':
      case 'post':
      case 'conv':
        walk(n.a, bound);
        break;
      case 'call':
        n.args.forEach((a, i) => walk(a, bound || (LAZY.has(n.name) && i === 0)));
        break;
      default:
        break;
    }
  };
  walk(ast, false);
  return out;
}

// ---------- evaluation ----------

const TO_RAD = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200 };
const FULL_TURN = { deg: 360, grad: 400 };

export const convertAngle = (x, from, to) => (from === to ? x : (x * TO_RAD[from]) / TO_RAD[to]);

function math(pos) {
  return new CalcError('Math', pos);
}

function check(v, pos) {
  if (!Number.isFinite(v) || Math.abs(v) >= 1e100) throw math(pos);
  return Object.is(v, -0) ? 0 : v;
}

const isInt = (v) => Number.isInteger(v);

// Exact values at multiples of a quarter turn in degree/gradian mode.
function quarter(x, unit) {
  const full = FULL_TURN[unit];
  if (!full) return -1;
  const r = ((x % full) + full) % full;
  const q = full / 4;
  return r % q === 0 ? r / q : -1;
}

function trig(name, x, unit, pos) {
  const q = quarter(x, unit);
  if (name === 'sin') {
    if (q >= 0) return [0, 1, 0, -1][q];
    const v = Math.sin(x * TO_RAD[unit]);
    return Math.abs(v) < 1e-15 && Math.abs(x) > 1e-6 ? 0 : v;
  }
  if (name === 'cos') {
    if (q >= 0) return [1, 0, -1, 0][q];
    const v = Math.cos(x * TO_RAD[unit]);
    return Math.abs(v) < 1e-15 && Math.abs(x) > 1e-6 ? 0 : v;
  }
  if (q === 1 || q === 3) throw math(pos);
  if (q >= 0) return 0;
  const r = x * TO_RAD[unit];
  if (Math.abs(Math.cos(r)) < 1e-15) throw math(pos);
  const v = Math.tan(r);
  return Math.abs(v) < 1e-15 && Math.abs(x) > 1e-6 ? 0 : v;
}

function power(a, b, pos) {
  if (a === 0 && b <= 0) throw math(pos);
  if (a < 0 && !isInt(b)) {
    const f = toFraction(b, 999);
    if (!f || f[1] % 2 === 0) throw math(pos);
    const v = Math.pow(-a, b);
    return f[0] % 2 === 0 ? v : -v;
  }
  return Math.pow(a, b);
}

function factorial(n, pos) {
  if (!isInt(n) || n < 0 || n > 170) throw math(pos);
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function nPr(n, r, pos) {
  if (!isInt(n) || !isInt(r) || n < 0 || r < 0 || r > n || n >= 1e10) throw math(pos);
  let v = 1;
  for (let i = 0; i < r; i++) {
    v *= n - i;
    if (v >= 1e100) throw math(pos);
  }
  return v;
}

function nCr(n, r, pos) {
  if (!isInt(n) || !isInt(r) || n < 0 || r < 0 || r > n || n >= 1e10) throw math(pos);
  const k = Math.min(r, n - r);
  let v = 1;
  for (let i = 1; i <= k; i++) {
    v = (v * (n - k + i)) / i;
    if (v >= 1e100) throw math(pos);
  }
  return Math.round(v);
}

function lookup(name, ctx) {
  if (ctx.local && name in ctx.local) return ctx.local[name];
  return ctx.vars?.[name] ?? 0;
}

const bindX = (ctx, x) => ({ ...ctx, local: { ...(ctx.local || {}), X: x } });

export function divRem(a, b, pos = -1) {
  if (!isInt(a) || !isInt(b) || b === 0) throw math(pos);
  const q = Math.trunc(a / b);
  return [q, a - b * q];
}

function call(node, ctx) {
  const { name, args, pos } = node;
  const allowed = ARITY[name] || [1];
  if (!allowed.includes(args.length)) throw new CalcError('Syntax', pos);
  if (LAZY.has(name)) {
    const body = args[0];
    const f = (x) => evaluate(body, bindX(ctx, x));
    const a = evaluate(args[1], ctx);
    if (name === 'deriv') {
      f(a);
      return derivative(f, a);
    }
    const b = evaluate(args[2], ctx);
    if (name === 'integ') return integrate(f, a, b);
    if (!isInt(a) || !isInt(b) || b < a || b - a > 1e6) throw math(pos);
    let acc = name === 'sum' ? 0 : 1;
    for (let k = a; k <= b; k++) acc = name === 'sum' ? acc + f(k) : acc * f(k);
    return acc;
  }
  const v = args.map((a) => evaluate(a, ctx));
  const [x, y] = v;
  const unit = ctx.angle || 'deg';
  switch (name) {
    case 'sin':
    case 'cos':
    case 'tan':
      return trig(name, x, unit, pos);
    case 'asin':
    case 'acos': {
      if (Math.abs(x) > 1 + 1e-12) throw math(pos);
      const c = Math.max(-1, Math.min(1, x));
      return (name === 'asin' ? Math.asin(c) : Math.acos(c)) / TO_RAD[unit];
    }
    case 'atan':
      return Math.atan(x) / TO_RAD[unit];
    case 'sinh':
      return Math.sinh(x);
    case 'cosh':
      return Math.cosh(x);
    case 'tanh':
      return Math.tanh(x);
    case 'asinh':
      return Math.asinh(x);
    case 'acosh':
      if (x < 1) throw math(pos);
      return Math.acosh(x);
    case 'atanh':
      if (Math.abs(x) >= 1) throw math(pos);
      return Math.atanh(x);
    case 'log':
      if (v.length === 2) {
        if (x <= 0 || x === 1 || y <= 0) throw math(pos);
        return Math.log(y) / Math.log(x);
      }
      if (x <= 0) throw math(pos);
      return Math.log10(x);
    case 'ln':
      if (x <= 0) throw math(pos);
      return Math.log(x);
    case 'exp':
      return Math.exp(x);
    case 'pow10':
      return Math.pow(10, x);
    case 'sqrt':
      if (x < 0) throw math(pos);
      return Math.sqrt(x);
    case 'cbrt':
      return Math.cbrt(x);
    case 'root': {
      if (x === 0) throw math(pos);
      if (y < 0) {
        if (!isInt(x) || x % 2 === 0) throw math(pos);
        return -Math.pow(-y, 1 / x);
      }
      return Math.pow(y, 1 / x);
    }
    case 'abs':
      return Math.abs(x);
    case 'Int':
      return Math.trunc(x);
    case 'Intg':
      return Math.floor(x);
    case 'Rnd':
      return roundDisplay(x, ctx.format || { mode: 'norm', digits: 0 });
    case 'RndFix': {
      if (!isInt(y) || y < 0 || y > 9) throw math(pos);
      return Number(x.toFixed(y));
    }
    case 'RanInt': {
      if (!isInt(x) || !isInt(y) || y < x) throw math(pos);
      return x + Math.floor((ctx.random || Math.random)() * (y - x + 1));
    }
    case 'GCD':
    case 'LCM': {
      if (!isInt(x) || !isInt(y) || Math.abs(x) >= 1e10 || Math.abs(y) >= 1e10) throw math(pos);
      const g = gcd(x, y);
      if (name === 'GCD') return g;
      return g === 0 ? 0 : Math.abs((x / g) * y);
    }
    case 'Pol': {
      if (x === 0 && y === 0) throw math(pos);
      const r = Math.hypot(x, y);
      const th = Math.atan2(y, x) / TO_RAD[unit];
      if (ctx.vars) {
        ctx.vars.X = r;
        ctx.vars.Y = th;
      }
      return r;
    }
    case 'Rec': {
      const px = x * trig('cos', y, unit, pos);
      const py = x * trig('sin', y, unit, pos);
      if (ctx.vars) {
        ctx.vars.X = px;
        ctx.vars.Y = py;
      }
      return px;
    }
    default:
      throw new CalcError('Syntax', pos);
  }
}

function binary(node, ctx) {
  const a = evaluate(node.l, ctx);
  const b = evaluate(node.r, ctx);
  switch (node.op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
    case 'frac':
      if (b === 0) throw math(node.pos);
      return a / b;
    case '^':
      return power(a, b, node.pos);
    case 'nPr':
      return nPr(a, b, node.pos);
    case 'nCr':
      return nCr(a, b, node.pos);
    case 'rem':
      return divRem(a, b, node.pos)[0];
    default:
      throw new CalcError('Syntax', node.pos);
  }
}

function postfix(node, ctx) {
  const a = evaluate(node.a, ctx);
  const unit = ctx.angle || 'deg';
  switch (node.op) {
    case 'sq':
      return a * a;
    case 'cube':
      return a * a * a;
    case 'inv':
      if (a === 0) throw math(node.pos);
      return 1 / a;
    case 'fact':
      return factorial(a, node.pos);
    case 'pct':
      return a / 100;
    case 'deg':
      return convertAngle(a, 'deg', unit);
    case 'rad':
      return convertAngle(a, 'rad', unit);
    case 'grad':
      return convertAngle(a, 'grad', unit);
    default:
      throw new CalcError('Syntax', node.pos);
  }
}

export function evaluate(node, ctx = {}) {
  switch (node.type) {
    case 'prog': {
      let v = 0;
      node.body.forEach((s, i) => {
        v = evaluate(s, ctx);
        if (node.body.length > 1 && i < node.body.length - 1 && ctx.vars) ctx.vars.Ans = v;
      });
      return v;
    }
    case 'eq':
      return check(evaluate(node.l, ctx) - evaluate(node.r, ctx), node.pos);
    case 'num':
      return check(node.value, node.pos);
    case 'var':
      return lookup(node.name, ctx);
    case 'const':
      if (node.name === 'pi') return Math.PI;
      if (node.name === 'e') return Math.E;
      return Math.floor((ctx.random || Math.random)() * 1000) / 1000;
    case 'pconst':
      return CONSTANTS.find((c) => c.id === node.name).value;
    case 'neg':
      return check(-evaluate(node.a, ctx), node.pos);
    case 'post':
      return check(postfix(node, ctx), node.pos);
    case 'conv':
      return check(CONVERSIONS.find((c) => c.id === node.op).fn(evaluate(node.a, ctx)), node.pos);
    case 'bin':
      return check(binary(node, ctx), node.pos);
    case 'call':
      return check(call(node, ctx), node.pos);
    default:
      throw new CalcError('Syntax', node.pos ?? -1);
  }
}

export function calculate(src, ctx = {}) {
  return evaluate(parse(src), ctx);
}

// Compile an expression of one variable into a fast, non-throwing function.
export function compileFn(src, ctx, variable = 'X') {
  const ast = parse(src);
  const local = { ...(ctx.local || {}) };
  const c = { ...ctx, vars: { ...(ctx.vars || {}) }, local };
  return (x) => {
    local[variable] = x;
    try {
      return evaluate(ast, c);
    } catch {
      return NaN;
    }
  };
}
