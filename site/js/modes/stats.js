// 6: Statistics — data editor, one-variable stats, linear regression, plots.
import { calculate, CalcError } from '../math/engine.js';
import { oneVar, linReg } from '../math/numeric.js';
import { formatPlain, decimalLayout } from '../math/format.js';
import { LineEditor } from '../editor.js';
import { editKey } from '../tokens.js';
import { W, H, TOP, PAPER } from '../lcd.js';
import { ListScreen, ValuesScreen } from '../ui/screens.js';
import { View, drawAxes } from '../ui/plot.js';

class StatPlotScreen {
  constructor(app, data, type) {
    Object.assign(this, { app, data, type });
  }

  onKey(a) {
    if (a === 'AC' || a === '=') this.app.pop(this);
  }

  render(lcd) {
    const { x, y } = this.data;
    if (this.type === '1var') {
      const s = oneVar(x);
      const pad = (s.max - s.min) * 0.1 || 1;
      const v = new View(s.min - pad, s.max + pad, 0, 1, { x: 4, y: TOP, w: W - 8, h: H - TOP - 14 });
      const yc = TOP + 52;
      lcd.line(v.px(s.min), yc, v.px(s.q1), yc, 1);
      lcd.line(v.px(s.q3), yc, v.px(s.max), yc, 1);
      lcd.box(v.px(s.q1), yc - 14, Math.max(2, v.px(s.q3) - v.px(s.q1)), 28, 1.4);
      lcd.line(v.px(s.med), yc - 14, v.px(s.med), yc + 14, 2);
      for (const e of [s.min, s.max]) lcd.line(v.px(e), yc - 7, v.px(e), yc + 7, 1.2);
      x.forEach((xi) => lcd.fill(v.px(xi) - 1.5, yc + 26, 3, 3));
      const f = (n) => formatPlain(n, { mode: 'norm', digits: 0 }, 5);
      lcd.text(`min ${f(s.min)}  Q1 ${f(s.q1)}  med ${f(s.med)}  Q3 ${f(s.q3)}  max ${f(s.max)}`, W / 2, H - 4, { size: 8, align: 'center' });
      return;
    }
    const xmin = Math.min(...x), xmax = Math.max(...x), ymin = Math.min(...y), ymax = Math.max(...y);
    const px = (xmax - xmin) * 0.12 || 1;
    const py = (ymax - ymin) * 0.15 || 1;
    const v = new View(xmin - px, xmax + px, ymin - py, ymax + py);
    drawAxes(lcd, v, { grid: false });
    x.forEach((xi, i) => lcd.box(v.px(xi) - 2, v.py(y[i]) - 2, 4, 4, 1.2));
    const r = linReg(x, y);
    if (r) {
      lcd.line(v.px(v.xmin), v.py(r.a + r.b * v.xmin), v.px(v.xmax), v.py(r.a + r.b * v.xmax), 1.2);
      const f = (n) => formatPlain(n, { mode: 'norm', digits: 0 }, 5);
      lcd.fill(0, H - 12, W, 12);
      lcd.shadow(false);
      lcd.text(`y = ${f(r.a)} + ${f(r.b)}x    r = ${f(r.r)}`, 4, H - 3, { size: 9, weight: 600, color: PAPER });
      lcd.shadow(true);
    }
  }
}

export class StatsMode {
  static title = 'Statistics';
  static icon = 'stat';
  static tag = 'STAT';

  constructor(app) {
    this.app = app;
    const saved = app.store.stats || {};
    this.type = saved.type || '1var';
    this.chosen = !!saved.type;
    this.data = saved.data || { x: [1, 2, 3, 4, 5, 6], y: [2.1, 3.9, 6.2, 7.8, 10.1, 12.2] };
    this.row = 0;
    this.col = 0;
    this.first = 0;
    this.ed = null;
  }

  persist() {
    this.app.store.stats = { type: this.chosen ? this.type : null, data: this.data };
  }

  enter() {
    if (!this.chosen) this.chooseType();
  }

  chooseType() {
    this.app.push(new ListScreen(this.app, {
      title: 'STATISTICS TYPE',
      items: [
        { label: '1-Variable', action: () => this.setType('1var') },
        { label: 'y=a+bx (linear reg)', action: () => this.setType('linreg') },
      ],
    }));
  }

  setType(t) {
    this.type = t;
    this.chosen = true;
    this.col = 0;
  }

  get cols() {
    return this.type === '1var' ? ['x'] : ['x', 'y'];
  }

  get n() {
    return this.data.x.length;
  }

  insertToken(tok) {
    if (!this.ed) this.ed = new LineEditor();
    this.ed.put(tok);
  }

  commit() {
    if (!this.ed) return true;
    if (this.ed.empty) {
      this.ed = null;
      return true;
    }
    let v;
    try {
      v = calculate(this.ed.text(), this.app.ctx());
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      this.app.toast(`${e.kind} ERROR`);
      return false;
    }
    if (this.row >= this.n) {
      this.data.x.push(0);
      this.data.y.push(0);
    }
    this.data[this.cols[this.col]][this.row] = v;
    this.ed = null;
    return true;
  }

  onKey(a) {
    if (this.ed) {
      if (a === 'AC') this.ed = null;
      else if (a === '=' || a === 'UP' || a === 'DOWN') {
        if (!this.commit()) return;
        if (a === 'UP') this.row = Math.max(0, this.row - 1);
        else if (a === '=' && this.cols.length === 2 && this.col === 0) this.col = 1;
        else {
          this.row = Math.min(this.n, this.row + 1);
          if (a === '=') this.col = 0;
        }
      } else editKey(this.ed, a);
      return;
    }
    switch (a) {
      case 'UP': this.row = Math.max(0, this.row - 1); return;
      case 'DOWN': this.row = Math.min(this.n, this.row + 1); return;
      case 'LEFT': this.col = (this.col + this.cols.length - 1) % this.cols.length; return;
      case 'RIGHT': this.col = (this.col + 1) % this.cols.length; return;
      case 'DEL':
        if (this.row < this.n) {
          this.data.x.splice(this.row, 1);
          this.data.y.splice(this.row, 1);
        }
        return;
      case 'OPTN': return this.options();
      case '=': return this.results();
      case 'AC': return;
      default: {
        const probe = new LineEditor();
        if (editKey(probe, a) && !['LEFT', 'RIGHT', 'DEL', 'INS', 'UNDO'].includes(a)) this.ed = probe;
      }
    }
  }

  options() {
    const items = [
      { label: this.type === '1var' ? '1-Variable Calc' : 'Regression Calc', action: () => this.results() },
      { label: this.type === '1var' ? 'Box Plot' : 'Scatter Plot', action: () => this.plot() },
      { label: 'Statistics Type', action: () => this.chooseType() },
      { label: 'Delete All Data', action: () => { this.data = { x: [], y: [] }; this.row = 0; } },
    ];
    this.app.push(new ListScreen(this.app, { title: 'OPTN', items }));
  }

  plot() {
    if (this.n < (this.type === '1var' ? 1 : 2)) {
      this.app.toast('Need more data');
      return;
    }
    this.app.push(new StatPlotScreen(this.app, this.data, this.type));
  }

  results() {
    const { x, y } = this.data;
    if (this.type === '1var') {
      const s = oneVar(x);
      if (!s) {
        this.app.toast('No data');
        return;
      }
      const rows = [
        ['x̄=', s.mean], ['Σx=', s.sum], ['Σx²=', s.sum2], ['σx=', s.sigma], ['sx=', Number.isFinite(s.s) ? s.s : 'ERROR'],
        ['n=', s.n], ['min(x)=', s.min], ['Q₁=', s.q1], ['Med=', s.med], ['Q₃=', s.q3], ['max(x)=', s.max],
      ];
      this.app.push(new ValuesScreen(this.app, { title: '1-VARIABLE', rows: rows.map(([label, value]) => ({ label, value })), hint: '[▲▼] Scroll   [AC] Back', exact: false }));
      return;
    }
    const r = linReg(x, y);
    if (!r) {
      this.app.toast('Need 2+ distinct x');
      return;
    }
    const rows = [
      ['a=', r.a], ['b=', r.b], ['r=', Number.isFinite(r.r) ? r.r : 'ERROR'], ['r²=', Number.isFinite(r.r) ? r.r * r.r : 'ERROR'],
      ['x̄=', r.mx], ['ȳ=', r.my], ['n=', r.n],
    ];
    this.app.push(new ValuesScreen(this.app, { title: 'y=a+bx', rows: rows.map(([label, value]) => ({ label, value })), hint: '[▲▼] Scroll   [AC] Back', exact: false }));
  }

  status() {
    return { tag: this.type === '1var' ? 'STAT 1-VAR' : 'STAT REG' };
  }

  render(lcd) {
    const cols = this.cols;
    const idxW = 30;
    const cw = (W - idxW - 4) / cols.length;
    const y0 = TOP + 1;
    const rowH = 15;
    const visible = 6;
    if (this.row < this.first) this.first = this.row;
    if (this.row >= this.first + visible) this.first = this.row - visible + 1;
    cols.forEach((c, i) => {
      lcd.text(c, idxW + cw * i + cw / 2, y0 + 10, { size: 11, weight: 700, align: 'center' });
      lcd.line(idxW + cw * i, y0, idxW + cw * i, y0 + 13 + visible * rowH, 0.8);
    });
    lcd.line(0, y0 + 13, W - 4, y0 + 13, 1);
    for (let r = 0; r < visible; r++) {
      const i = this.first + r;
      if (i > this.n) break;
      const y = y0 + 14 + r * rowH;
      lcd.text(String(i + 1), idxW - 5, y + 11, { size: 10, align: 'right' });
      cols.forEach((c, k) => {
        const v = this.data[c][i];
        const sel = i === this.row && k === this.col;
        const x = idxW + cw * k;
        if (sel) {
          lcd.fill(x + 1, y, cw - 2, rowH - 1);
          lcd.shadow(false);
        }
        if (v !== undefined) lcd.fitText(formatPlain(v, { mode: 'norm', digits: 0 }, 8), x + cw - 4, y + 11, cw - 8, { size: 11, align: 'right', color: sel ? PAPER : undefined });
        if (sel) lcd.shadow(true);
      });
    }
    lcd.line(0, H - 17, W, H - 17, 0.8, [1, 1.5]);
    if (this.ed) {
      lcd.editor(this.ed, 4, H - 4, W - 10, { size: 12, cursor: this.app.blink });
    } else {
      const v = this.data[cols[this.col]][this.row];
      if (v !== undefined) lcd.drawFit(decimalLayout(v, this.app.settings.format), W - 4, H - 2, W - 10, [12, 10]);
      else lcd.text('[OPTN] Calc · Plot   [=] Results', 4, H - 4, { size: 9 });
    }
  }
}
