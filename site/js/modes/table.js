// 3: Table — tabulate f(x) and g(x) over a range.
import { compileFn, CalcError, parse } from '../math/engine.js';
import { formatPlain, decimalLayout } from '../math/format.js';
import { toks } from '../tokens.js';
import { W, H, TOP, PAPER } from '../lcd.js';
import { FormScreen } from '../ui/screens.js';

const MAX_ROWS = 300;

class TableScreen {
  constructor(app, rows, hasG) {
    Object.assign(this, { app, rows, hasG, sel: 0, col: 1, first: 0 });
  }

  status() {
    return { up: this.sel > 0, down: this.sel < this.rows.length - 1 };
  }

  onKey(a) {
    const cols = this.hasG ? 3 : 2;
    if (a === 'UP') this.sel = Math.max(0, this.sel - 1);
    else if (a === 'DOWN') this.sel = Math.min(this.rows.length - 1, this.sel + 1);
    else if (a === 'LEFT') this.col = (this.col + cols - 1) % cols;
    else if (a === 'RIGHT') this.col = (this.col + 1) % cols;
    else if (a === 'AC' || a === '=') this.app.pop(this);
  }

  render(lcd) {
    const cols = this.hasG ? [{ w: 84, h: 'x' }, { w: 116, h: 'f(x)' }, { w: 116, h: 'g(x)' }] : [{ w: 110, h: 'x' }, { w: 206, h: 'f(x)' }];
    const x0 = 2;
    const y0 = TOP + 1;
    const rowH = 15;
    const visible = 6;
    if (this.sel < this.first) this.first = this.sel;
    if (this.sel >= this.first + visible) this.first = this.sel - visible + 1;
    let cx = x0;
    cols.forEach((c, i) => {
      lcd.text(c.h, cx + c.w / 2, y0 + 10, { size: 10, weight: 700, align: 'center' });
      if (i) lcd.line(cx, y0, cx, y0 + 13 + visible * rowH, 0.8);
      cx += c.w;
    });
    lcd.line(x0, y0 + 13, x0 + cols.reduce((s, c) => s + c.w, 0), y0 + 13, 1);
    for (let r = 0; r < visible; r++) {
      const i = this.first + r;
      const row = this.rows[i];
      if (!row) break;
      const y = y0 + 14 + r * rowH;
      let x = x0;
      cols.forEach((c, k) => {
        const v = row[k];
        const s = Number.isFinite(v) ? formatPlain(v, { mode: 'norm', digits: 0 }, k === 0 ? 7 : 9) : 'ERROR';
        const selected = i === this.sel && k === this.col;
        if (selected) {
          lcd.fill(x + 1, y, c.w - 2, rowH - 1);
          lcd.shadow(false);
        }
        lcd.fitText(s, x + c.w - 4, y + 11, c.w - 6, { size: 11, align: 'right', color: selected ? PAPER : undefined });
        if (selected) lcd.shadow(true);
        x += c.w;
      });
    }
    const v = this.rows[this.sel]?.[this.col];
    const label = ['x', 'f(x)', 'g(x)'][this.col];
    lcd.line(0, H - 17, W, H - 17, 0.8, [1, 1.5]);
    lcd.text(`${label}=`, 4, H - 4, { size: 11, weight: 600 });
    if (Number.isFinite(v)) lcd.drawFit(decimalLayout(v, this.app.settings.format), W - 4, H - 2, W - 60, [12, 10]);
  }
}

export class TableMode extends FormScreen {
  static title = 'Table';
  static icon = 'table';
  static tag = 'TABLE';

  constructor(app) {
    const saved = app.store.table || {};
    super(app, {
      root: true,
      title: 'TABLE RANGE',
      hint: '[=] Table   [▲▼] Field',
      fields: [
        { key: 'f', label: 'f(x)=', kind: 'expr', tokens: saved.f || toks('x', 'sq', '-', '2', 'x') },
        { key: 'g', label: 'g(x)=', kind: 'expr', tokens: saved.g || [] },
        { key: 'start', label: 'Start:', kind: 'num', value: saved.start ?? -2 },
        { key: 'end', label: 'End:', kind: 'num', value: saved.end ?? 5 },
        { key: 'step', label: 'Step:', kind: 'num', value: saved.step ?? 1 },
      ],
      onSubmit: (v) => this.build(v),
    });
  }

  persist() {
    const [f, g, start, end, step] = this.fields;
    this.app.store.table = { f: f.ed.tokens, g: g.ed.tokens, start: start.value, end: end.value, step: step.value };
  }

  insertToken(tok) {
    const f = this.current;
    if (f.kind === 'expr') f.ed.put(tok);
  }

  build({ f, g, start, end, step }) {
    if (!f.trim()) {
      this.sel = 0;
      this.app.toast('Enter f(x)');
      return;
    }
    for (const [i, src] of [[0, f], [1, g]]) {
      if (!src.trim()) continue;
      try {
        parse(src);
      } catch (e) {
        if (!(e instanceof CalcError)) throw e;
        this.sel = i;
        this.fields[i].ed.cursor = this.fields[i].ed.indexOfPos(e.pos);
        this.app.toast('Syntax ERROR');
        return;
      }
    }
    if (!(step > 0) || !(end >= start)) {
      this.app.toast('Range ERROR');
      return;
    }
    const count = Math.floor((end - start) / step + 1e-9) + 1;
    if (count > MAX_ROWS) {
      this.app.toast(`Max ${MAX_ROWS} rows`);
      return;
    }
    const ctx = this.app.ctx();
    const fx = compileFn(f, ctx);
    const gx = g.trim() ? compileFn(g, ctx) : null;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const x = Number((start + i * step).toPrecision(12));
      rows.push(gx ? [x, fx(x), gx(x)] : [x, fx(x)]);
    }
    this.app.push(new TableScreen(this.app, rows, !!gx));
  }
}
