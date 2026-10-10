// 4: Base-N — integer arithmetic and logic in DEC/HEX/BIN/OCT.
import { evalBaseN, formatBase, BASES } from '../math/basen.js';
import { CalcError } from '../math/engine.js';
import { LineEditor } from '../editor.js';
import { editKey } from '../tokens.js';
import { W, TOP } from '../lcd.js';
import { ListScreen, drawError } from '../ui/screens.js';

const tk = (t, d = t) => ({ t, d });
const BASE_NAMES = { 10: 'DEC', 16: 'HEX', 2: 'BIN', 8: 'OCT' };
const ALLOWED = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/', '(', ')', 'DEL', 'LEFT', 'RIGHT', 'INS', 'UNDO']);

function group(s, n) {
  const out = [];
  for (let i = s.length; i > 0; i -= n) out.unshift(s.slice(Math.max(0, i - n), i));
  return out.join(' ');
}

export class BaseNMode {
  static title = 'Base-N';
  static icon = 'basen';
  static tag = 'BASE-N';

  constructor(app) {
    this.app = app;
    this.base = app.store.basen?.base || 10;
    this.ed = new LineEditor(app.store.basen?.tokens || []);
    this.result = null;
    this.error = null;
  }

  persist() {
    this.app.store.basen = { base: this.base, tokens: this.ed.tokens };
  }

  status() {
    return { angle: '', tag: BASE_NAMES[this.base] };
  }

  // In Base-N the blue labels (DEC/HEX/BIN/OCT) and the A–F letters are direct.
  mapKey(def, shift, alpha) {
    if (shift || alpha) return null;
    if (def.base) return def.base;
    if (def.alpha && 'ABCDEF'.includes(def.alpha) && def.alpha.length === 1) return `hex${def.alpha}`;
    return null;
  }

  onKey(a) {
    if (this.error) {
      if (a === 'AC') this.ed.clear();
      else if (a === 'LEFT' || a === 'RIGHT') this.ed.cursor = this.ed.indexOfPos(this.error.pos);
      else return;
      this.error = null;
      this.result = null;
      return;
    }
    if (BASES[a]) {
      this.base = BASES[a];
      return;
    }
    switch (a) {
      case 'AC':
        this.ed.clear();
        this.result = null;
        return;
      case '=':
        return this.exec();
      case 'OPTN':
        return this.options();
      default:
        break;
    }
    if (a.startsWith('hex')) return this.put(tk(a.slice(3)));
    if (!ALLOWED.has(a)) return;
    if (this.result !== null) {
      const r = this.result;
      this.result = null;
      if (a === 'LEFT' || a === 'RIGHT') return;
      if (!['DEL', 'INS', 'UNDO'].includes(a)) {
        this.ed.clear();
        if (['+', '-', '*', '/'].includes(a)) this.ed.put(tk(formatBase(r, this.base)));
      }
    }
    editKey(this.ed, a);
  }

  put(tok) {
    if (this.result !== null) {
      this.ed.clear();
      this.result = null;
    }
    this.ed.put(tok);
  }

  insertToken() {}

  exec() {
    if (this.ed.empty) return;
    try {
      this.result = evalBaseN(this.ed.text(), this.base);
      this.app.vars.Ans = this.result;
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      this.error = e;
    }
  }

  options() {
    const ins = (t, d) => ({ label: d, action: () => this.put(tk(t, d)) });
    this.app.push(new ListScreen(this.app, {
      title: 'LOGIC / BASE PREFIX',
      items: [
        ins('and', ' and '), ins('or', ' or '), ins('xor', ' xor '), ins('xnor', ' xnor '),
        ins('Not(', 'Not('), ins('Neg(', 'Neg('),
        ins('ᵈ', 'd'), ins('ʰ', 'h'), ins('ᵇ', 'b'), ins('ᵒ', 'o'),
      ].map((it) => ({ ...it, label: it.label.trim() })),
    }));
  }

  render(lcd) {
    if (this.error) return drawError(lcd, this.error.kind);
    lcd.editor(this.ed, 4, TOP + 17, W - 10, { size: 15, lines: 2, cursor: this.result === null && this.app.blink });
    if (this.result === null) return;
    const main = formatBase(this.result, this.base);
    const shown = this.base === 2 ? group(main, 4) : main;
    lcd.drawFit({ t: 'text', s: shown }, W - 4, 84, W - 10, [22, 16, 12, 10]);
    let y = 100;
    for (const b of [10, 16, 8, 2].filter((x) => x !== this.base)) {
      const s = formatBase(this.result, b);
      lcd.text(BASE_NAMES[b], 4, y, { size: 9, weight: 700 });
      lcd.fitText(b === 2 ? group(s, 4) : s, W - 4, y, W - 34, { size: 9, align: 'right' });
      y += 13;
    }
  }
}
