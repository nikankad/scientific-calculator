// Token-based line editor. Each token has a canonical text `t` (fed to the
// parser) and a display string `d`, so DEL removes "sin(" as one unit.
// Fractions are templates made of three structural tokens (k = fo/fm/fc)
// that the LCD draws as a stacked numerator over denominator.

export const FRAC_OPEN = { t: '((', d: '(', k: 'fo' };
export const FRAC_MID = { t: ')⁄(', d: ')/(', k: 'fm' };
export const FRAC_CLOSE = { t: '))', d: ')', k: 'fc' };

const POSTFIX = new Set(['²', '³', '⁻¹', '!', '%', '°', 'ʳ', 'ᵍ']);
const DIGIT = /^[0-9.ᴇ]$/;
const OPERAND = /^(Ans|Ran#|[A-FMXYxnπℯ]|\[.*\]|\{.*\})$/;

export class LineEditor {
  constructor(tokens = []) {
    this.tokens = tokens.map((t) => ({ ...t }));
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
    if (tok.frac) {
      this.insertFraction();
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
      // Removing any part of a fraction removes the template, keeping its contents.
      const [o, m, c] = this.group(idx);
      const removedBefore = [o, m, c].filter((j) => j >= 0 && j < idx).length;
      [c, m, o].filter((j) => j >= 0).forEach((j) => this.tokens.splice(j, 1));
      this.cursor = idx - removedBefore;
      return;
    }
    this.tokens.splice(idx, 1);
    this.cursor = idx;
  }

  // Wrap the operand before the cursor as the numerator (cursor goes to the
  // denominator), or insert an empty template with the cursor in the numerator.
  insertFraction() {
    this.snapshot();
    const start = this.operandStart(this.cursor);
    if (start < this.cursor) {
      const num = this.tokens.slice(start, this.cursor);
      this.tokens.splice(start, num.length, { ...FRAC_OPEN }, ...num, { ...FRAC_MID }, { ...FRAC_CLOSE });
      this.cursor = start + num.length + 2;
    } else {
      this.tokens.splice(this.cursor, 0, { ...FRAC_OPEN }, { ...FRAC_MID }, { ...FRAC_CLOSE });
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
    if (t.t === ')' || t.k === 'fc') {
      let depth = 0;
      for (let j = i - 1; j >= 0; j--) {
        const tj = toks[j];
        if (tj.k === 'fm') continue;
        if (tj.t === ')' || tj.k === 'fc') depth++;
        else if (tj.t.endsWith('(')) {
          depth--;
          if (depth === 0) return tj.t === '^(' ? this.operandStart(j) : j;
        }
      }
    }
    return end;
  }

  // Indices [open, mid, close] of the fraction that structural token idx belongs to.
  group(idx) {
    const toks = this.tokens;
    let o = idx;
    if (toks[idx].k !== 'fo') {
      let depth = 0;
      for (let j = idx - 1; j >= 0; j--) {
        if (toks[j].k === 'fc') depth++;
        else if (toks[j].k === 'fo') {
          if (depth === 0) {
            o = j;
            break;
          }
          depth--;
        }
      }
    }
    let m = -1;
    let c = -1;
    let depth = 0;
    for (let j = o + 1; j < toks.length; j++) {
      const k = toks[j].k;
      if (k === 'fo') depth++;
      else if (k === 'fc') {
        if (depth === 0) {
          c = j;
          break;
        }
        depth--;
      } else if (k === 'fm' && depth === 0) m = j;
    }
    return [o, m, c];
  }

  // ▲/▼ inside a fraction: jump between numerator and denominator.
  fracNav(dir) {
    const stack = [];
    for (let j = 0; j < this.cursor; j++) {
      const k = this.tokens[j].k;
      if (k === 'fo') stack.push({ o: j, den: false });
      else if (k === 'fm' && stack.length) stack[stack.length - 1].den = true;
      else if (k === 'fc') stack.pop();
    }
    const top = stack[stack.length - 1];
    if (!top) return false;
    if (dir === 'DOWN' && !top.den) {
      this.cursor = this.group(top.o)[1] + 1;
      return true;
    }
    if (dir === 'UP' && top.den) {
      this.cursor = top.o + 1;
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
