// Token-based line editor. Each token has a canonical text `t` (fed to the
// parser) and a display string `d`, so DEL removes "sin(" as one unit.
// Natural-display templates (fraction, ∫, d/dx, Σ, Π) are made of structural
// tokens: an opener (k = 'to'), slot separators ('ts') and a closer ('tc').
// The LCD draws them in 2D; the parser sees fully parenthesised arguments.

// Slot order is the argument order of the underlying function.
export const TEMPLATES = {
  frac: { open: '((', seps: [')⁄('], close: '))', lin: ['(', ')/(', ')'] },
  integ: { open: 'integ((', seps: ['),(', '),('], close: '))', lin: ['∫(', ',', ',', ')'] },
  deriv: { open: 'deriv((', seps: ['),('], close: '))', lin: ['d/dx(', ',', ')'] },
  sum: { open: 'sum((', seps: ['),(', '),('], close: '))', lin: ['Σ(', ',', ',', ')'] },
  prod: { open: 'prod((', seps: ['),(', '),('], close: '))', lin: ['Π(', ',', ',', ')'] },
};

// ▲/▼ targets per slot. ∫/Σ/Π slots are [body, lower, upper].
const NAV = {
  frac: [{ DOWN: 1 }, { UP: 0 }],
  integ: [{ UP: 2, DOWN: 1 }, { UP: 0 }, { DOWN: 0 }],
  sum: [{ UP: 2, DOWN: 1 }, { UP: 0 }, { DOWN: 0 }],
  prod: [{ UP: 2, DOWN: 1 }, { UP: 0 }, { DOWN: 0 }],
  deriv: [{ DOWN: 1 }, { UP: 0 }],
};

export function templateTokens(name) {
  const T = TEMPLATES[name];
  return [
    { t: T.open, d: T.lin[0], k: 'to', tpl: name },
    ...T.seps.map((t, i) => ({ t, d: T.lin[i + 1], k: 'ts' })),
    { t: T.close, d: T.lin[T.lin.length - 1], k: 'tc' },
  ];
}

// Tokens saved by the first fraction release used fo/fm/fc.
const LEGACY = { fo: { k: 'to', tpl: 'frac' }, fm: { k: 'ts' }, fc: { k: 'tc' } };

const POSTFIX = new Set(['²', '³', '⁻¹', '!', '%', '°', 'ʳ', 'ᵍ']);
const DIGIT = /^[0-9.ᴇ]$/;
const OPERAND = /^(Ans|Ran#|[A-FMXYxnπℯ]|\[.*\]|\{.*\})$/;

export class LineEditor {
  constructor(tokens = []) {
    this.tokens = tokens.map((t) => ({ ...t, ...(LEGACY[t.k] || {}) }));
    this.cursor = this.tokens.length;
    this.insert = true;
    this.history = [];
  }

  get empty() {
    return this.tokens.length === 0;
  }

  snapshot() {
    this.history.push({ tokens: this.tokens.slice(), cursor: this.cursor });
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    const s = this.history.pop();
    if (!s) return;
    this.tokens = s.tokens;
    this.cursor = s.cursor;
  }

  put(tok) {
    if (tok.tpl) {
      this.insertTemplate(tok.tpl);
      return;
    }
    this.snapshot();
    if (!this.insert && this.cursor < this.tokens.length && !this.tokens[this.cursor].k) this.tokens[this.cursor] = { ...tok };
    else this.tokens.splice(this.cursor, 0, { ...tok });
    this.cursor++;
  }

  del() {
    if (!this.tokens.length) return;
    const atCursor = this.insert ? this.cursor === 0 : this.cursor < this.tokens.length;
    const idx = atCursor ? this.cursor : this.cursor - 1;
    this.snapshot();
    if (this.tokens[idx].k) {
      // Removing part of a template removes the template. A fraction keeps
      // all of its contents; ∫, d/dx, Σ, Π keep their body.
      const g = this.group(idx);
      const o = g[0];
      if (this.tokens[o].tpl === 'frac') {
        const removedBefore = g.filter((j) => j < idx).length;
        [...g].reverse().forEach((j) => this.tokens.splice(j, 1));
        this.cursor = idx - removedBefore;
      } else {
        const close = g[g.length - 1];
        const bodyEnd = g[1];
        this.tokens.splice(bodyEnd, close - bodyEnd + 1);
        this.tokens.splice(o, 1);
        this.cursor = bodyEnd - 1;
      }
      return;
    }
    this.tokens.splice(idx, 1);
    this.cursor = idx;
  }

  // A fraction wraps the operand before the cursor as its numerator (cursor
  // goes to the denominator); otherwise the cursor lands in the first slot.
  insertTemplate(name) {
    this.snapshot();
    const [open, ...rest] = templateTokens(name);
    const start = name === 'frac' ? this.operandStart(this.cursor) : this.cursor;
    if (start < this.cursor) {
      const num = this.tokens.slice(start, this.cursor);
      this.tokens.splice(start, num.length, open, ...num, ...rest);
      this.cursor = start + num.length + 2;
    } else {
      this.tokens.splice(this.cursor, 0, open, ...rest);
      this.cursor += 1;
    }
  }

  operandStart(end) {
    const toks = this.tokens;
    let i = end;
    while (i > 0 && POSTFIX.has(toks[i - 1].t)) i--;
    if (i === 0) return end;
    const t = toks[i - 1];
    if (DIGIT.test(t.t)) {
      while (i > 0 && DIGIT.test(toks[i - 1].t)) i--;
      return i;
    }
    if (OPERAND.test(t.t)) return i - 1;
    if (t.t === ')' || t.k === 'tc') {
      let depth = 0;
      for (let j = i - 1; j >= 0; j--) {
        const tj = toks[j];
        if (tj.k === 'ts') continue;
        if (tj.t === ')' || tj.k === 'tc') depth++;
        else if (tj.t.endsWith('(')) {
          depth--;
          if (depth === 0) return tj.t === '^(' ? this.operandStart(j) : j;
        }
      }
    }
    return end;
  }

  // Indices [open, ...separators, close] of the template that structural token idx belongs to.
  group(idx) {
    const toks = this.tokens;
    let o = idx;
    if (toks[idx].k !== 'to') {
      let depth = 0;
      for (let j = idx - 1; j >= 0; j--) {
        if (toks[j].k === 'tc') depth++;
        else if (toks[j].k === 'to') {
          if (depth === 0) {
            o = j;
            break;
          }
          depth--;
        }
      }
    }
    const out = [o];
    let depth = 0;
    for (let j = o + 1; j < toks.length; j++) {
      const k = toks[j].k;
      if (k === 'to') depth++;
      else if (k === 'tc') {
        if (depth === 0) {
          out.push(j);
          break;
        }
        depth--;
      } else if (k === 'ts' && depth === 0) out.push(j);
    }
    return out;
  }

  // ▲/▼ inside a template: jump between its slots.
  slotNav(dir) {
    const stack = [];
    for (let j = 0; j < this.cursor; j++) {
      const k = this.tokens[j].k;
      if (k === 'to') stack.push({ o: j, slot: 0 });
      else if (k === 'ts' && stack.length) stack[stack.length - 1].slot++;
      else if (k === 'tc') stack.pop();
    }
    for (let s = stack.length - 1; s >= 0; s--) {
      const { o, slot } = stack[s];
      const target = NAV[this.tokens[o].tpl]?.[slot]?.[dir];
      if (target === undefined) continue;
      const g = this.group(o);
      this.cursor = g[target] + 1;
      return true;
    }
    return false;
  }

  left() {
    this.cursor = this.cursor > 0 ? this.cursor - 1 : this.tokens.length;
  }

  right() {
    this.cursor = this.cursor < this.tokens.length ? this.cursor + 1 : 0;
  }

  end() {
    this.cursor = this.tokens.length;
  }

  clear() {
    if (this.tokens.length) this.snapshot();
    this.tokens = [];
    this.cursor = 0;
  }

  set(tokens) {
    this.snapshot();
    this.tokens = tokens.map((t) => ({ ...t }));
    this.cursor = this.tokens.length;
  }

  text() {
    return this.tokens.map((t) => t.t).join('');
  }

  display() {
    return this.tokens.map((t) => t.d).join('');
  }

  // Token index containing canonical character position `pos`.
  indexOfPos(pos) {
    if (pos < 0) return this.tokens.length;
    let acc = 0;
    for (let i = 0; i < this.tokens.length; i++) {
      acc += this.tokens[i].t.length;
      if (acc > pos) return i;
    }
    return this.tokens.length;
  }
}
