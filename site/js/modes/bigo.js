// 8: Big-O — growth curves, cost at n, empirical complexity fitting,
// the Master theorem and asymptotic classification of T(n).
import { CLASSES, fitComplexity, empiricalExponent, masterTheorem, MASTER_PRESETS, classifyGrowth, growthText, opsAt, formatLog10, formatDuration } from '../algo/bigo.js';
import { ALGORITHMS, PATTERNS, measure } from '../algo/algorithms.js';
import { compileFn, CalcError, parse } from '../math/engine.js';
import { formatPlain, T, R, SUP } from '../math/format.js';
import { toks } from '../tokens.js';
import { W, H, TOP } from '../lcd.js';
import { ListScreen, FormScreen, ValuesScreen, TextScreen, drawHint } from '../ui/screens.js';
import { View, plotFn } from '../ui/plot.js';

const N_TOKEN = { t: 'n', d: 'n' };
const fmt = (v, sig = 5) => formatPlain(v, { mode: 'norm', digits: 0 }, sig);
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (v) => String(v).replace(/[0-9]/g, (c) => SUBS[c]);

// Θ(n^p log^k n) as a natural-display layout.
function growthLayout(p, k, wrap = 'Θ', prefix = '') {
  const items = [T(`${prefix}${wrap}(`)];
  if (p === 0.5) items.push(T('√n'));
  else if (p !== 0) {
    items.push(T('n'));
    if (p !== 1) items.push(SUP(T(fmt(p, 4))));
  }
  if (k !== 0) {
    if (p !== 0) items.push(T(' '));
    items.push(T('log'));
    if (k !== 1) items.push(SUP(T(fmt(k, 4))));
    items.push(T(' n'));
  }
  if (p === 0 && k === 0) items.push(T('1'));
  items.push(T(')'));
  return R(...items);
}

// ---------- growth curves ----------

class GrowthScreen {
  constructor(app) {
    Object.assign(this, { app, N: 16, Y: 128, log: false, sel: 5 });
  }

  status() {
    return { tag: this.log ? 'BIG-O LOG' : 'BIG-O', up: true, down: true };
  }

  onKey(a) {
    const n = CLASSES.length;
    if (a === 'UP') this.sel = (this.sel + n - 1) % n;
    else if (a === 'DOWN') this.sel = (this.sel + 1) % n;
    else if (a === 'LEFT') this.N = Math.max(4, this.N / 2);
    else if (a === 'RIGHT') this.N = Math.min(2 ** 20, this.N * 2);
    else if (a === '+') this.Y = Math.max(2, this.Y / 4);
    else if (a === '-') this.Y = Math.min(1e12, this.Y * 4);
    else if (a === '=') this.log = !this.log;
    else if (a === 'AC') this.app.pop(this);
  }

  render(lcd) {
    const box = { x: 2, y: TOP + 14, w: W - 4, h: H - TOP - 28 };
    const lgOf = (id) => CLASSES.find((c) => c.id === id).lg(this.N);
    const ymax = this.log ? Math.min(300, Math.max(lgOf('n3'), lgOf('2n'), 1)) * 1.15 : this.Y;
    const v = new View(0, this.N, 0, ymax, box);
    lcd.line(box.x, box.y + box.h, box.x + box.w, box.y + box.h, 1);
    lcd.line(box.x, box.y, box.x, box.y + box.h, 1);
    const used = [];
    CLASSES.forEach((cls, i) => {
      const f = this.log ? (n) => (n >= 1 ? Math.max(0, cls.lg(n)) : NaN) : (n) => (n > 0 || cls.id === '1' ? cls.f(Math.max(n, 1e-9)) : NaN);
      const selected = i === this.sel;
      plotFn(lcd, v, f, { width: selected ? 2.6 : 0.9, samples: 240 });
      // label where the curve leaves the plot
      let lx = this.N;
      let ly = f(lx);
      if (!(ly <= ymax)) {
        let lo = 0;
        let hi = this.N;
        for (let k = 0; k < 40; k++) {
          const m = (lo + hi) / 2;
          if (f(m) > ymax) hi = m;
          else lo = m;
        }
        lx = lo;
        ly = ymax;
      }
      const px = Math.min(v.px(lx), box.x + box.w - 2);
      const py = Math.max(v.py(ly), box.y + 6);
      const s = cls.short;
      const w = lcd.width(s, 7, selected ? 700 : 500);
      const rx = Math.max(box.x + 2, Math.min(px - w - 2, box.x + box.w - w - 2));
      let ry = Math.max(py + (ly >= ymax ? 8 : -2), box.y + 8);
      const hit = (y) => used.some((u) => y > u.y - 8 && y < u.y + 8 && rx < u.x2 + 3 && rx + w > u.x1 - 3);
      for (let k = 0; k < 8 && hit(ry); k++) ry += 8;
      if (ry < box.y + box.h - 2 && !hit(ry)) {
        used.push({ x1: rx, x2: rx + w, y: ry });
        lcd.text(s, rx, ry, { size: 7, weight: selected ? 700 : 500 });
      }
    });
    const cls = CLASSES[this.sel];
    const valLg = cls.lg(this.N);
    const head = `${cls.label}   f(${fmt(this.N, 7)}) = ${formatLog10(valLg)}`;
    lcd.badge(head, 2, TOP + 1, { size: 9, h: 11 });
    lcd.text(this.log ? 'log₁₀ y' : `y≤${fmt(this.Y)}`, W - 3, TOP + 10, { size: 8, align: 'right' });
    drawHint(lcd, `[▲▼]class [◀▶]n:${fmt(this.N, 7)} ${this.log ? '' : '[±]y '}[=]${this.log ? 'linear' : 'log'}`);
  }
}

// ---------- empirical analysis ----------

class AnalysisScreen {
  constructor(app, alg, pattern) {
    Object.assign(this, { app, alg, pattern, page: 0, first: 0, data: null });
    setTimeout(() => {
      this.data = measure(alg, pattern);
      this.fits = fitComplexity(this.data);
      this.slope = empiricalExponent(this.data);
      app.dirty = true;
    }, 40);
  }

  status() {
    return { tag: `FIT ${this.page + 1}/4` };
  }

  onKey(a) {
    if (a === 'LEFT') this.page = (this.page + 3) % 4;
    else if (a === 'RIGHT') this.page = (this.page + 1) % 4;
    else if (a === 'UP') this.first = Math.max(0, this.first - 1);
    else if (a === 'DOWN') this.first = Math.min(5, this.first + 1);
    else if (a === 'AC' || a === '=') this.app.pop(this);
    if (a === 'LEFT' || a === 'RIGHT') this.first = 0;
  }

  render(lcd) {
    const pat = this.alg.kind === 'search' ? 'absent target' : PATTERNS.find((p) => p.id === this.pattern).name;
    lcd.fitText(`${this.alg.name} · ${pat}`, 4, TOP + 10, W - 8, { size: 9, weight: 700 });
    if (!this.data) {
      lcd.text('Measuring…', W / 2, 76, { size: 14, weight: 600, align: 'center' });
      return;
    }
    const best = this.fits[0];
    [this.summary, this.plot, this.table, this.ranking][this.page].call(this, lcd, best);
    drawHint(lcd, '[◀▶] Page   [▲▼] Scroll   [AC] Back');
  }

  summary(lcd, best) {
    lcd.text('Best empirical fit', W / 2, TOP + 26, { size: 9, align: 'center' });
    lcd.text(best.cls.label, W / 2, TOP + 52, { size: 24, weight: 700, align: 'center' });
    lcd.text(`ops ≈ ${fmt(best.c, 4)} · ${best.cls.short}`, W / 2, TOP + 70, { size: 11, align: 'center' });
    lcd.text(`R²=${best.r2.toFixed(5)}  err ${(best.err * 100).toFixed(1)}%  slope ${this.slope.toFixed(2)}`, W / 2, TOP + 85, { size: 9, align: 'center' });
    const a = this.alg;
    lcd.text(`theory: best O(${a.best}) · avg O(${a.avg}) · worst O(${a.worst})`, W / 2, TOP + 100, { size: 8, align: 'center' });
  }

  plot(lcd, best) {
    const box = { x: 30, y: TOP + 16, w: W - 36, h: H - TOP - 32 };
    const maxN = this.data[this.data.length - 1].n;
    const maxY = Math.max(...this.data.map((d) => d.ops)) * 1.1;
    const v = new View(0, maxN * 1.05, 0, maxY, box);
    lcd.line(box.x, box.y + box.h, box.x + box.w, box.y + box.h, 1);
    lcd.line(box.x, box.y, box.x, box.y + box.h, 1);
    lcd.text(fmt(maxY / 1.1, 3), box.x - 2, box.y + 6, { size: 7, align: 'right' });
    lcd.text('0', box.x - 2, box.y + box.h, { size: 7, align: 'right' });
    lcd.text(`n=${maxN}`, box.x + box.w, box.y + box.h - 3, { size: 7, align: 'right' });
    plotFn(lcd, v, (n) => (n > 0 ? best.c * best.cls.f(n) : NaN), { width: 1.2, dash: [3, 2] });
    for (const d of this.data) lcd.box(v.px(d.n) - 2.5, v.py(d.ops) - 2.5, 5, 5, 1.3);
    lcd.text(`□ measured   ┄ ${fmt(best.c, 3)}·${best.cls.short}`, box.x + 4, box.y + 8, { size: 8 });
  }

  table(lcd, best) {
    const y0 = TOP + 24;
    lcd.text('n', 40, y0, { size: 9, weight: 700, align: 'right' });
    lcd.text('ops', 150, y0, { size: 9, weight: 700, align: 'right' });
    lcd.text(`ops/${best.cls.short}`, W - 8, y0, { size: 9, weight: 700, align: 'right' });
    this.data.slice(this.first, this.first + 6).forEach((d, i) => {
      const y = y0 + 13 + i * 13;
      lcd.text(String(d.n), 40, y, { size: 10, align: 'right' });
      lcd.text(String(d.ops), 150, y, { size: 10, align: 'right' });
      lcd.text(fmt(d.ops / best.cls.f(d.n), 5), W - 8, y, { size: 10, align: 'right' });
    });
  }

  ranking(lcd) {
    const y0 = TOP + 24;
    lcd.text('class', 6, y0, { size: 9, weight: 700 });
    lcd.text('rel. error', W - 8, y0, { size: 9, weight: 700, align: 'right' });
    this.fits.slice(this.first, this.first + 6).forEach((f, i) => {
      const y = y0 + 13 + i * 13;
      lcd.text(`${this.first + i + 1}. ${f.cls.label}`, 6, y, { size: 10, weight: i + this.first === 0 ? 700 : 500 });
      lcd.text(Number.isFinite(f.err) ? `${(f.err * 100).toFixed(1)}%` : '—', W - 8, y, { size: 10, align: 'right' });
    });
  }
}

// ---------- mode ----------

export class BigOMode extends ListScreen {
  static title = 'Big-O';
  static icon = 'bigo';
  static tag = 'BIG-O';

  constructor(app) {
    super(app, {
      title: 'BIG-O ANALYSIS',
      root: true,
      items: [
        { label: 'Growth Curves', action: () => app.push(new GrowthScreen(app)) },
        { label: 'Cost at n', action: () => this.costForm() },
        { label: 'Analyze Algorithm', action: () => this.analyze() },
        { label: 'Master Theorem', action: () => this.master() },
        { label: 'Classify T(n)', action: () => this.classify() },
      ],
    });
  }

  costForm() {
    this.cost ??= new FormScreen(this.app, {
      title: 'OPERATIONS AT INPUT SIZE n',
      fields: [{ key: 'n', label: 'n=', kind: 'num', value: 1e6 }],
      hint: '[=] Compare all classes @ 10⁹ ops/s',
      onSubmit: ({ n }) => {
        if (!(n >= 1) || !Number.isFinite(n)) {
          this.app.toast('n must be ≥ 1');
          return;
        }
        const rows = opsAt(n).map((r) => ({ label: r.cls.short, value: formatLog10(r.lg), extra: formatDuration(r.lg) }));
        this.app.push(new ValuesScreen(this.app, { title: `n = ${fmt(n, 8)}   ops · time @1GHz`, rows, labelSize: 12, hint: '[▲▼] Scroll   [AC] Back' }));
      },
    });
    this.app.push(this.cost);
  }

  analyze() {
    const run = (alg, pattern) => this.app.push(new AnalysisScreen(this.app, alg, pattern));
    this.app.push(new ListScreen(this.app, {
      title: 'ANALYZE: ALGORITHM',
      size: 13,
      rowH: 16,
      items: ALGORITHMS.map((alg) => ({ label: alg.name, alg })),
      onSelect: ({ alg }) => {
        if (alg.kind === 'search') return run(alg, 'sorted');
        this.app.push(new ListScreen(this.app, {
          title: `${alg.name.toUpperCase()}: INPUT`,
          items: PATTERNS.map((p) => ({ label: p.name, action: () => run(alg, p.id) })),
        }));
        return null;
      },
    }));
  }

  master() {
    this.masterForm ??= new FormScreen(this.app, {
      title: 'T(n)=a·T(n/b)+Θ(nᵈ logᵏ n)',
      fields: [
        { key: 'a', label: 'a=', kind: 'num', value: 2 },
        { key: 'b', label: 'b=', kind: 'num', value: 2 },
        { key: 'd', label: 'd=', kind: 'num', value: 1 },
        { key: 'k', label: 'k=', kind: 'num', value: 0 },
      ],
      hint: '[=] Solve   [OPTN] Presets',
      onOptn: (form) => this.app.push(new ListScreen(this.app, {
        title: 'PRESETS',
        items: MASTER_PRESETS.map((p) => ({ label: `${p.name}  (${p.a},${p.b},${p.d})`, action: () => form.setValues({ a: p.a, b: p.b, d: p.d, k: 0 }) })),
      })),
      onSubmit: ({ a, b, d, k }) => {
        const m = masterTheorem(a, b, d, k);
        if (!m.ok) {
          this.app.toast(m.reason, 2200);
          return;
        }
        const f = growthText(d, k);
        this.app.push(new TextScreen(this.app, {
          lines: [
            { s: `T(n) = ${fmt(a)}·T(n/${fmt(b)}) + Θ(${f})`, size: 11, weight: 600 },
            { s: `log${sub(fmt(b))} ${fmt(a)} = ${fmt(m.crit, 6)}   vs   d = ${fmt(d)}`, size: 10 },
            { s: `Case ${m.case}: ${m.why}`, size: 10 },
            { rule: true, size: 8 },
            { node: growthLayout(m.p, m.k, 'Θ', 'T(n) = '), size: 18, align: 'center', gap: 8 },
          ],
          hint: '[AC] Back',
        }));
      },
    });
    this.app.push(this.masterForm);
  }

  classify() {
    this.classifyForm ??= new FormScreen(this.app, {
      title: 'CLASSIFY T(n)   ([x] key types n)',
      xToken: N_TOKEN,
      fields: [{ key: 'f', label: 'T(n)=', kind: 'expr', tokens: [...toks('3'), N_TOKEN, ...toks('sq', '+', '5'), N_TOKEN, ...toks('log'), N_TOKEN, ...toks(')', '+', '7')] }],
      hint: '[=] Classify',
      onSubmit: ({ f }, form) => {
        if (!f.trim()) return;
        try {
          parse(f);
        } catch (e) {
          if (!(e instanceof CalcError)) throw e;
          form.fields[0].ed.cursor = form.fields[0].ed.indexOfPos(e.pos);
          this.app.toast('Syntax ERROR');
          return;
        }
        const r = classifyGrowth(compileFn(f, this.app.ctx(), 'n'));
        const shown = form.fields[0].ed.display();
        const lines = [{ s: `T(n) = ${shown}`, size: 11 }];
        if (r.kind === 'poly') {
          const g = growthText(r.p, r.k);
          lines.push(
            { node: growthLayout(r.p, r.k, 'O'), size: 22, align: 'center', gap: 8 },
            { s: `T(n) / ${g === '1' ? '1' : g} → ${fmt(r.c, 5)}`, size: 10, align: 'center', gap: 4 },
            { s: `log-log slope at n≈2⁴⁰: ${r.slope.toFixed(3)}`, size: 9, align: 'center' },
          );
        } else if (r.kind === 'exp') {
          lines.push(
            { node: R(T(`O(${fmt(r.base)}`), SUP(T('n')), T(')')), size: 22, align: 'center', gap: 8 },
            { s: `≈ ${fmt(r.c, 4)} · ${fmt(r.base)}ⁿ — exponential`, size: 10, align: 'center', gap: 4 },
          );
        } else if (r.kind === 'fact') {
          lines.push(
            { s: 'O(n!)', size: 22, weight: 700, align: 'center', gap: 8 },
            { s: 'super-exponential growth', size: 10, align: 'center', gap: 4 },
          );
        } else {
          lines.push({ s: 'Cannot classify: T(n) must stay positive and finite for large n.', size: 11, gap: 10 });
        }
        this.app.push(new TextScreen(this.app, { lines, hint: '[AC] Back' }));
      },
    });
    this.app.push(this.classifyForm);
  }
}
