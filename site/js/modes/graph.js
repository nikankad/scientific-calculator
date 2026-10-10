// 2: Graph — plot up to three functions with trace, roots, extrema, zoom.
import { compileFn, CalcError, parse } from '../math/engine.js';
import { formatPlain } from '../math/format.js';
import { LineEditor } from '../editor.js';
import { editKey, toks } from '../tokens.js';
import { W, H, TOP, PAPER } from '../lcd.js';
import { ListScreen, drawHint } from '../ui/screens.js';
import { View, drawAxes, plotFn, crosshair, findRoots, findExtrema } from '../ui/plot.js';

const STYLES = [{ width: 1.5 }, { width: 2.6 }, { width: 1.4, dash: [3, 2] }];
const DEFAULT_FUNCS = [
  toks('sin', 'x', ')', '*', '2'),
  toks('0', '.', '2', 'x', 'sq', '-', '3'),
  [],
];
const STANDARD = { xmin: -8, xmax: 8, ymin: -3.2, ymax: 3.2 };

export class GraphMode {
  static title = 'Graph';
  static icon = 'graph';
  static tag = 'GRAPH';

  constructor(app) {
    this.app = app;
    const saved = app.store.graph || {};
    this.eds = (saved.funcs || DEFAULT_FUNCS).map((t) => new LineEditor(t));
    this.view = { ...(saved.view || STANDARD) };
    this.sel = 0;
    this.screen = 'edit';
    this.trace = null;
    this.points = null;
  }

  persist() {
    this.app.store.graph = { funcs: this.eds.map((e) => e.tokens), view: this.view };
  }

  status() {
    return { angle: 'R', flag: this.trace ? 'TRACE' : this.points ? this.points.kind : null };
  }

  insertToken(tok) {
    if (this.screen === 'edit') this.eds[this.sel].put(tok);
  }

  get v() {
    const { xmin, xmax, ymin, ymax } = this.view;
    return new View(xmin, xmax, ymin, ymax);
  }

  fns() {
    const ctx = this.app.ctx({ angle: 'rad' });
    return this.eds.map((ed) => {
      const src = ed.text();
      if (!src.trim()) return null;
      try {
        return compileFn(src, ctx);
      } catch {
        return null;
      }
    });
  }

  active() {
    return this.fns().map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  }

  onKey(a) {
    if (this.screen === 'edit') return this.editKey(a);
    return this.plotKey(a);
  }

  editKey(a) {
    const ed = this.eds[this.sel];
    switch (a) {
      case 'UP':
        this.sel = (this.sel + 2) % 3;
        return;
      case 'DOWN':
        this.sel = (this.sel + 1) % 3;
        return;
      case 'AC':
        ed.clear();
        return;
      case '=':
        for (const e of this.eds) {
          if (!e.text().trim()) continue;
          try {
            parse(e.text());
          } catch (err) {
            if (!(err instanceof CalcError)) throw err;
            this.sel = this.eds.indexOf(e);
            e.cursor = e.indexOfPos(err.pos);
            this.app.toast('Syntax ERROR');
            return;
          }
        }
        if (!this.active().length) {
          this.app.toast('No function');
          return;
        }
        this.screen = 'plot';
        this.trace = null;
        this.points = null;
        return;
      case 'OPTN':
        return this.tools();
      default:
        editKey(ed, a);
    }
  }

  plotKey(a) {
    const vw = this.view;
    const spanX = vw.xmax - vw.xmin;
    const spanY = vw.ymax - vw.ymin;
    const fns = this.fns();
    if (this.points) {
      const p = this.points;
      if (a === 'LEFT') p.i = (p.i + p.list.length - 1) % p.list.length;
      else if (a === 'RIGHT') p.i = (p.i + 1) % p.list.length;
      else if (a === 'AC' || a === '=') this.points = null;
      else if (a === 'OPTN') this.tools();
      return;
    }
    if (this.trace) {
      const t = this.trace;
      const active = this.active();
      if (a === 'LEFT' || a === 'RIGHT') {
        t.x += (a === 'LEFT' ? -1 : 1) * this.v.dx * 2;
        if (t.x < vw.xmin || t.x > vw.xmax) {
          const shift = (a === 'LEFT' ? -1 : 1) * spanX / 4;
          vw.xmin += shift;
          vw.xmax += shift;
        }
      } else if (a === 'UP' || a === 'DOWN') {
        const k = active.indexOf(t.fn);
        t.fn = active[(k + (a === 'UP' ? active.length - 1 : 1)) % active.length];
      } else if (a === 'AC' || a === '=') this.trace = null;
      else if (a === 'OPTN') this.tools();
      else if (a === '+' || a === '-') this.zoom(a === '+' ? 0.5 : 2, t.x, fns[t.fn]?.(t.x));
      return;
    }
    switch (a) {
      case 'LEFT': vw.xmin -= spanX / 8; vw.xmax -= spanX / 8; return;
      case 'RIGHT': vw.xmin += spanX / 8; vw.xmax += spanX / 8; return;
      case 'UP': vw.ymin += spanY / 8; vw.ymax += spanY / 8; return;
      case 'DOWN': vw.ymin -= spanY / 8; vw.ymax -= spanY / 8; return;
      case '+': return this.zoom(0.5);
      case '-': return this.zoom(2);
      case '=': return this.startTrace();
      case 'OPTN': return this.tools();
      case 'AC':
      case 'DEL':
        this.screen = 'edit';
        return;
      default:
        if (editKey(new LineEditor(), a)) {
          this.screen = 'edit';
          this.editKey(a);
        }
    }
  }

  zoom(k, cx = (this.view.xmin + this.view.xmax) / 2, cy = (this.view.ymin + this.view.ymax) / 2) {
    const vw = this.view;
    if (!Number.isFinite(cy)) cy = (vw.ymin + vw.ymax) / 2;
    const hx = ((vw.xmax - vw.xmin) / 2) * k;
    const hy = ((vw.ymax - vw.ymin) / 2) * k;
    Object.assign(vw, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy });
  }

  startTrace() {
    const active = this.active();
    if (!active.length) return;
    this.points = null;
    this.trace = { fn: active.includes(this.sel) ? this.sel : active[0], x: (this.view.xmin + this.view.xmax) / 2 };
  }

  analyse(kind) {
    const fns = this.fns();
    const active = this.active();
    if (!active.length) return;
    this.screen = 'plot';
    this.trace = null;
    const fi = active.includes(this.sel) ? this.sel : active[0];
    const f = fns[fi];
    const { xmin, xmax } = this.view;
    let list = [];
    if (kind === 'ROOT') list = findRoots(f, xmin, xmax).map((x) => ({ x, y: 0, fn: fi }));
    else if (kind === 'MIN' || kind === 'MAX') list = findExtrema(f, xmin, xmax, kind.toLowerCase()).map((x) => ({ x, y: f(x), fn: fi }));
    else if (kind === 'Y-ICPT') list = Number.isFinite(f(0)) ? [{ x: 0, y: f(0), fn: fi }] : [];
    else if (kind === 'ISECT') {
      const other = active.find((i) => i !== fi);
      if (other === undefined) {
        this.app.toast('Need 2 functions');
        return;
      }
      const g = fns[other];
      list = findRoots((x) => f(x) - g(x), xmin, xmax).map((x) => ({ x, y: f(x), fn: fi }));
    }
    if (!list.length) {
      this.app.toast('None in view');
      return;
    }
    this.points = { kind, list, i: 0 };
  }

  zoomFit() {
    const fns = this.fns().filter(Boolean);
    const { xmin, xmax } = this.view;
    let lo = Infinity;
    let hi = -Infinity;
    for (const f of fns) {
      for (let i = 0; i <= 200; i++) {
        const y = f(xmin + ((xmax - xmin) * i) / 200);
        if (Number.isFinite(y) && Math.abs(y) < 1e6) {
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
      }
    }
    if (!Number.isFinite(lo)) return;
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.08;
    Object.assign(this.view, { ymin: lo - pad, ymax: hi + pad });
  }

  tools() {
    const set = (v) => () => {
      Object.assign(this.view, v);
      this.screen = 'plot';
      this.points = null;
    };
    this.app.push(new ListScreen(this.app, {
      title: 'GRAPH TOOLS',
      items: [
        { label: 'Trace', action: () => { this.screen = 'plot'; this.startTrace(); } },
        { label: 'Root', action: () => this.analyse('ROOT') },
        { label: 'Minimum', action: () => this.analyse('MIN') },
        { label: 'Maximum', action: () => this.analyse('MAX') },
        { label: 'Intersection', action: () => this.analyse('ISECT') },
        { label: 'y-Intercept', action: () => this.analyse('Y-ICPT') },
        { label: 'Zoom Standard', action: set(STANDARD) },
        { label: 'Zoom Trig', action: set({ xmin: -2 * Math.PI, xmax: 2 * Math.PI, ymin: -2.5, ymax: 2.5 }) },
        { label: 'Zoom Fit', action: () => { this.zoomFit(); this.screen = 'plot'; this.points = null; } },
        { label: 'Zoom Square', action: () => {
          const v = this.view;
          const cy = (v.ymin + v.ymax) / 2;
          const hy = ((v.xmax - v.xmin) * (H - TOP)) / W / 2;
          Object.assign(v, { ymin: cy - hy, ymax: cy + hy });
          this.screen = 'plot';
        } },
      ],
    }));
  }

  // ---------- rendering ----------

  render(lcd) {
    if (this.screen === 'edit') return this.renderEdit(lcd);
    const v = this.v;
    const fns = this.fns();
    drawAxes(lcd, v);
    fns.forEach((f, i) => f && plotFn(lcd, v, f, STYLES[i]));
    const fmt = (x) => formatPlain(x, { mode: 'norm', digits: 0 }, 6);
    let info = null;
    if (this.trace) {
      const { fn, x } = this.trace;
      const y = fns[fn]?.(x);
      if (Number.isFinite(y)) crosshair(lcd, v, x, y);
      info = `Y${fn + 1}  x=${fmt(x)}  y=${Number.isFinite(y) ? fmt(y) : '—'}`;
    } else if (this.points) {
      const p = this.points.list[this.points.i];
      crosshair(lcd, v, p.x, p.y);
      const n = this.points.list.length > 1 ? ` ${this.points.i + 1}/${this.points.list.length}` : '';
      info = `${this.points.kind}${n}  x=${fmt(p.x)}  y=${fmt(p.y)}`;
    }
    if (info) {
      lcd.fill(0, H - 12, W, 12);
      lcd.shadow(false);
      lcd.text(info, 4, H - 3, { size: 9, weight: 600, color: PAPER });
      lcd.shadow(true);
    }
  }

  renderEdit(lcd) {
    this.eds.forEach((ed, i) => {
      const y = TOP + 22 + i * 30;
      const selected = i === this.sel;
      lcd.fill(3, y - 12, 24, 15);
      lcd.shadow(false);
      lcd.text(`Y${i + 1}`, 15, y, { size: 12, weight: 700, align: 'center', color: PAPER });
      lcd.shadow(true);
      lcd.line(5, y + 7, 25, y + 7, STYLES[i].width, STYLES[i].dash);
      lcd.text('=', 31, y, { size: 14 });
      lcd.editor(ed, 42, y, W - 52, { size: 14, cursor: selected && this.app.blink });
      if (selected) lcd.tri(W - 4, y - 4, 3, 'left');
    });
    drawHint(lcd, '[=] Draw   [OPTN] Tools   [▲▼] Select');
  }
}
