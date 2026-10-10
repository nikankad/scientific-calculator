// Plotting helpers shared by Graph, Statistics and Big-O modes.
import { W, H, TOP } from '../lcd.js';
import { formatPlain } from '../math/format.js';

export const PLOT = { x: 0, y: TOP, w: W, h: H - TOP };

export function niceStep(span, target = 6) {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

export class View {
  constructor(xmin, xmax, ymin, ymax, box = PLOT) {
    Object.assign(this, { xmin, xmax, ymin, ymax, box });
  }

  px(x) {
    return this.box.x + ((x - this.xmin) / (this.xmax - this.xmin)) * this.box.w;
  }

  py(y) {
    return this.box.y + this.box.h - ((y - this.ymin) / (this.ymax - this.ymin)) * this.box.h;
  }

  xAt(px) {
    return this.xmin + ((px - this.box.x) / this.box.w) * (this.xmax - this.xmin);
  }

  get dx() {
    return (this.xmax - this.xmin) / this.box.w;
  }
}

const tickLabel = (v) => formatPlain(Math.abs(v) < 1e-12 ? 0 : v, { mode: 'norm', digits: 0 }, 4);

export function drawAxes(lcd, v, { labels = true, grid = true } = {}) {
  const { box } = v;
  const ax = Math.min(Math.max(v.px(0), box.x), box.x + box.w - 1);
  const ay = Math.min(Math.max(v.py(0), box.y), box.y + box.h - 1);
  const sx = niceStep(v.xmax - v.xmin, 8);
  const sy = niceStep(v.ymax - v.ymin, 5);
  const c = lcd.ctx;
  if (grid) {
    c.fillStyle = 'rgba(24,33,27,0.35)';
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) {
      for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) c.fillRect(v.px(x) - 0.5, v.py(y) - 0.5, 1, 1);
    }
  }
  lcd.line(box.x, ay, box.x + box.w, ay, 1);
  lcd.line(ax, box.y, ax, box.y + box.h, 1);
  let lastX = -Infinity;
  for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) {
    const px = v.px(x);
    lcd.line(px, ay - 2, px, ay + 2, 1);
    if (!labels || Math.abs(x) < sx / 2) continue;
    const s = tickLabel(x);
    const tw = lcd.width(s, 7);
    if (px - tw / 2 < lastX + 4 || px - tw / 2 < 1 || px + tw / 2 > box.x + box.w - 1) continue;
    lcd.text(s, px, ay + 9 > box.y + box.h - 1 ? ay - 4 : ay + 9, { size: 7, align: 'center' });
    lastX = px + tw / 2;
  }
  let lastY = Infinity;
  for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) {
    const py = v.py(y);
    lcd.line(ax - 2, py, ax + 2, py, 1);
    if (!labels || Math.abs(y) < sy / 2 || py < box.y + 6 || py > box.y + box.h - 3) continue;
    if (py > lastY - 9) continue;
    const s = tickLabel(y);
    const right = ax + 4 + lcd.width(s, 7) > box.x + box.w;
    lcd.text(s, right ? ax - 4 : ax + 4, py + 2.5, { size: 7, align: right ? 'right' : 'left' });
    lastY = py;
  }
}

// Plot y = f(x) across the view, breaking the line at gaps and asymptotes.
export function plotFn(lcd, v, f, { width = 1.4, dash = null, samples = null } = {}) {
  const c = lcd.ctx;
  const n = samples || Math.round(v.box.w * 1.5);
  const span = v.ymax - v.ymin;
  lcd.clip(v.box.x, v.box.y, v.box.w, v.box.h, () => {
    c.strokeStyle = '#18211b';
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.setLineDash(dash || []);
    c.beginPath();
    let pen = false;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const x = v.xmin + ((v.xmax - v.xmin) * i) / n;
      const y = f(x);
      if (!Number.isFinite(y)) {
        pen = false;
        prev = null;
        continue;
      }
      const cy = Math.max(v.ymin - span * 2, Math.min(v.ymax + span * 2, y));
      if (prev !== null && Math.abs(y - prev) > span * 1.5 && Math.sign(y - (v.ymin + v.ymax) / 2) !== Math.sign(prev - (v.ymin + v.ymax) / 2)) pen = false;
      if (pen) c.lineTo(v.px(x), v.py(cy));
      else c.moveTo(v.px(x), v.py(cy));
      pen = true;
      prev = y;
    }
    c.stroke();
    c.setLineDash([]);
  });
}

export function crosshair(lcd, v, x, y) {
  const px = v.px(x);
  const py = v.py(y);
  lcd.clip(v.box.x, v.box.y, v.box.w, v.box.h, () => {
    lcd.line(px - 6, py, px - 2, py, 1.2);
    lcd.line(px + 2, py, px + 6, py, 1.2);
    lcd.line(px, py - 6, px, py - 2, 1.2);
    lcd.line(px, py + 2, px, py + 6, 1.2);
    lcd.box(px - 1.5, py - 1.5, 3, 3, 1);
  });
}

// ---------- analysis ----------

function sampleFn(f, a, b, n = 480) {
  const xs = [];
  const ys = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    xs.push(x);
    ys.push(f(x));
  }
  return { xs, ys };
}

function bisect(f, a, b) {
  let fa = f(a);
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

export function findRoots(f, a, b) {
  const { xs, ys } = sampleFn(f, a, b);
  const out = [];
  const tol = (b - a) * 1e-9;
  for (let i = 0; i < xs.length - 1; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    let r = null;
    if (y0 === 0) r = xs[i];
    else if (Math.sign(y0) !== Math.sign(y1) && y1 !== 0) {
      r = bisect(f, xs[i], xs[i + 1]);
      if (Math.abs(f(r)) > Math.max(Math.abs(y0), Math.abs(y1))) r = null; // asymptote
    }
    if (r !== null && !out.some((o) => Math.abs(o - r) < tol)) out.push(r);
  }
  return out;
}

export function findExtrema(f, a, b, kind = 'min') {
  const sgn = kind === 'min' ? 1 : -1;
  const g = (x) => sgn * f(x);
  const { xs, ys } = sampleFn(g, a, b);
  const out = [];
  for (let i = 1; i < xs.length - 1; i++) {
    if (![ys[i - 1], ys[i], ys[i + 1]].every(Number.isFinite)) continue;
    if (!(ys[i] <= ys[i - 1] && ys[i] < ys[i + 1])) continue;
    let lo = xs[i - 1];
    let hi = xs[i + 1];
    const phi = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 80; k++) {
      const m1 = hi - phi * (hi - lo);
      const m2 = lo + phi * (hi - lo);
      if (g(m1) < g(m2)) hi = m2;
      else lo = m1;
    }
    out.push((lo + hi) / 2);
  }
  return out;
}
