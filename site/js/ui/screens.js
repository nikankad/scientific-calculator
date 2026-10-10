// Reusable LCD screens: lists, the mode menu, forms, value tables, text pages.
import { W, H, TOP, INK, PAPER, GHOST } from '../lcd.js';
import { LineEditor } from '../editor.js';
import { editKey, numberTokens } from '../tokens.js';
import { calculate } from '../math/engine.js';
import { T, decimalLayout, exactInfo, exactLayout, formatPlain } from '../math/format.js';

export function valueLayout(v, app, flags = {}) {
  if (typeof v === 'string') return T(v);
  if (v && typeof v === 'object' && 't' in v) return v;
  const info = exactInfo(v, flags);
  return info ? exactLayout(info, app.settings.frac === 'mixed') : decimalLayout(v, app.settings.format);
}

export function wrapText(lcd, s, maxW, size, weight = 500) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (lcd.width(next, size, weight) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawError(lcd, kind) {
  const title = /ERROR|Solve|Solution/.test(kind) ? kind : `${kind} ERROR`;
  lcd.text(title, W / 2, 52, { size: 16, weight: 700, align: 'center' });
  lcd.text('[AC] :Cancel', 70, 84, { size: 12 });
  lcd.text('[◀][▶]:Goto', 70, 104, { size: 12 });
}

export function drawHint(lcd, s) {
  lcd.fill(0, H - 12, W, 12);
  lcd.shadow(false);
  lcd.text(s, W / 2, H - 3, { size: 9, weight: 600, align: 'center', color: PAPER });
  lcd.shadow(true);
}

function scrollbar(lcd, first, visible, total, y0) {
  if (total <= visible) return;
  const x = W - 3;
  const h = H - y0 - 2;
  lcd.line(x, y0, x, y0 + h, 0.6, [1, 2]);
  const th = Math.max(6, (h * visible) / total);
  const ty = y0 + ((h - th) * first) / (total - visible);
  lcd.fill(x - 1.2, ty, 2.4, th);
}

// ---------- list ----------

export class ListScreen {
  constructor(app, { title = null, items, onSelect = null, onCancel = null, sel = 0, root = false, numbered = true, rowH = 17, size = 14 }) {
    this.app = app;
    this.title = title;
    this.getItems = typeof items === 'function' ? items : () => items;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.sel = sel;
    this.root = root;
    this.numbered = numbered;
    this.rowH = rowH;
    this.size = size;
    this.first = 0;
  }

  get items() {
    return this.getItems();
  }

  onKey(a) {
    const n = this.items.length;
    if (a === 'UP') this.sel = (this.sel - 1 + n) % n;
    else if (a === 'DOWN') this.sel = (this.sel + 1) % n;
    else if (a === '=') this.choose(this.sel);
    else if (this.numbered && /^[1-9]$/.test(a)) {
      const i = Number(a) - 1;
      if (i < n) this.choose(i);
    } else if (a === 'AC' && !this.root) {
      this.app.pop(this);
      this.onCancel?.();
    }
  }

  choose(i) {
    this.sel = i;
    const item = this.items[i];
    if (!this.root && !item.keep) this.app.pop(this);
    (item.action || this.onSelect)?.(item, i);
  }

  render(lcd) {
    let y0 = TOP + 1;
    if (this.title) {
      lcd.text(this.title, 4, y0 + 10, { size: 10, weight: 700 });
      lcd.line(0, y0 + 14, W, y0 + 14, 0.8, [1, 1.5]);
      y0 += 16;
    }
    const items = this.items;
    const rows = Math.floor((H - y0) / this.rowH);
    if (this.sel < this.first) this.first = this.sel;
    if (this.sel >= this.first + rows) this.first = this.sel - rows + 1;
    this.first = Math.max(0, Math.min(this.first, Math.max(0, items.length - rows)));
    for (let r = 0; r < rows; r++) {
      const i = this.first + r;
      const item = items[i];
      if (!item) break;
      const y = y0 + r * this.rowH;
      const selected = i === this.sel;
      const color = selected ? PAPER : INK;
      if (selected) {
        lcd.fill(0, y, W - 6, this.rowH);
        lcd.shadow(false);
      }
      const base = y + this.rowH - (this.rowH - this.size * 0.72) / 2 - 0.5;
      const label = this.numbered ? `${i + 1}:${item.label}` : item.label;
      const rw = item.right ? lcd.width(item.right, this.size - 2) + 12 : 0;
      lcd.fitText(label, 4, base, W - 14 - rw, { size: this.size, weight: 500, color });
      if (item.right) lcd.text(item.right, W - 10, base, { size: this.size - 2, align: 'right', color });
      if (selected) lcd.shadow(true);
    }
    scrollbar(lcd, this.first, rows, items.length, y0);
  }
}

// ---------- mode menu ----------

function icon(lcd, id, x, y, w, h, color) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const c = lcd.ctx;
  const t = (s, tx, ty, size = 12, weight = 700) => lcd.text(s, tx, ty, { size, weight, align: 'center', color });
  c.strokeStyle = color;
  c.fillStyle = color;
  switch (id) {
    case 'calc':
      t('×÷', cx, cy - 2, 13);
      t('+−', cx, cy + 11, 13);
      break;
    case 'graph': {
      lcd.line(cx - 20, cy + 6, cx + 20, cy + 6, 1, null, color);
      lcd.line(cx - 10, cy - 14, cx - 10, cy + 13, 1, null, color);
      c.lineWidth = 1.6;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const px = cx - 20 + i;
        const py = cy + 6 - 9 * Math.sin((i / 40) * Math.PI * 2) - i * 0.12;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
      break;
    }
    case 'table':
      lcd.box(cx - 18, cy - 13, 36, 26, 1.2, color);
      lcd.line(cx - 18, cy - 5, cx + 18, cy - 5, 1, null, color);
      lcd.line(cx - 18, cy + 4, cx + 18, cy + 4, 0.8, null, color);
      lcd.line(cx - 6, cy - 13, cx - 6, cy + 13, 1, null, color);
      lcd.line(cx + 6, cy - 13, cx + 6, cy + 13, 1, null, color);
      break;
    case 'basen':
      t('2  8', cx, cy - 2, 11);
      t('10 16', cx, cy + 11, 11);
      break;
    case 'eqn':
      t('ax²+b', cx, cy - 2, 11);
      t('=0', cx, cy + 11, 11);
      break;
    case 'stat':
      [8, 14, 22, 17, 10, 5].forEach((bh, i) => c.fillRect(cx - 18 + i * 6.2, cy + 12 - bh, 4.6, bh));
      lcd.line(cx - 20, cy + 12.5, cx + 20, cy + 12.5, 1, null, color);
      break;
    case 'algo': {
      [6, 10, 14, 18, 22, 26].forEach((bh, i) => c.fillRect(cx - 18 + i * 6.2, cy + 13 - bh, 4.6, bh));
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(cx - 6, cy - 9, 6.5, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      lcd.tri(cx - 0.5, cy - 9, 2.2, 'down', color);
      break;
    }
    case 'bigo':
      t('O(n²)', cx, cy + 5, 13);
      break;
    default:
      break;
  }
}

export class MenuScreen {
  constructor(app) {
    this.app = app;
    this.sel = app.modeIndex;
  }

  onKey(a) {
    const n = this.app.modeList.length;
    if (a === 'LEFT') this.sel = (this.sel + n - 1) % n;
    else if (a === 'RIGHT') this.sel = (this.sel + 1) % n;
    else if (a === 'UP' || a === 'DOWN') this.sel = (this.sel + 4) % n;
    else if (a === '=') this.app.setMode(this.sel);
    else if (/^[1-8]$/.test(a)) this.app.setMode(Number(a) - 1);
    else if (a === 'AC') this.app.pop(this);
  }

  status() {
    return { tag: 'MENU' };
  }

  render(lcd) {
    const cw = W / 4;
    const ch = 48;
    const y0 = TOP + 5;
    this.app.modeList.forEach((M, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = col * cw;
      const y = y0 + row * (ch + 3);
      const selected = i === this.sel;
      if (selected) {
        lcd.fill(x + 2, y, cw - 4, ch);
        lcd.tri(x + cw / 2, y0 - 3.5, 3.5, 'down');
        lcd.shadow(false);
      }
      const color = selected ? PAPER : INK;
      icon(lcd, M.icon, x + 2, y + 2, cw - 16, ch - 6, color);
      // number badge in the lower-right corner, like the real menu
      const bx = x + cw - 14;
      const by = y + ch - 14;
      if (selected) lcd.fill(bx, by, 10, 11, PAPER);
      else lcd.fill(bx, by, 10, 11, INK);
      lcd.text(String(i + 1), bx + 5, by + 9, { size: 9, weight: 700, align: 'center', color: selected ? INK : PAPER });
      if (!selected) {
        lcd.line(x + 4, y + ch - 1, x + cw - 4, y + ch - 1, 1);
        lcd.line(x + cw - 2, y + ch - 13, x + cw - 2, y + ch - 1, 1);
      }
      if (selected) lcd.shadow(true);
    });
    const M = this.app.modeList[this.sel];
    lcd.text(`${this.sel + 1}:${M.title}`, 6, H - 6, { size: 16, weight: 600 });
  }
}

// ---------- form ----------

export class FormScreen {
  constructor(app, { title = null, fields, onSubmit, hint = null, xToken = null, root = false, onOptn = null }) {
    this.app = app;
    this.title = title;
    this.fields = fields.map((f) => ({ ...f, ed: new LineEditor(f.tokens || []), editing: f.kind === 'expr' }));
    this.onSubmit = onSubmit;
    this.hint = hint;
    this.xToken = xToken;
    this.root = root;
    this.onOptn = onOptn;
    this.sel = 0;
    this.first = 0;
  }

  get current() {
    return this.fields[this.sel];
  }

  values() {
    const out = {};
    for (const f of this.fields) out[f.key] = f.kind === 'num' ? f.value : f.ed.text();
    return out;
  }

  setValues(vals) {
    for (const f of this.fields) {
      if (!(f.key in vals)) continue;
      if (f.kind === 'num') {
        f.value = vals[f.key];
        f.editing = false;
      }
    }
  }

  commit() {
    const f = this.current;
    if (f.kind !== 'num' || !f.editing) return true;
    if (f.ed.empty) {
      f.editing = false;
      return true;
    }
    try {
      f.value = calculate(f.ed.text(), this.app.ctx());
      f.editing = false;
      return true;
    } catch (e) {
      this.app.toast(`${e.kind || 'Syntax'} ERROR`);
      return false;
    }
  }

  submit() {
    if (!this.commit()) return;
    this.onSubmit(this.values(), this);
  }

  onKey(a) {
    const f = this.current;
    const last = this.sel === this.fields.length - 1;
    switch (a) {
      case 'UP':
      case 'DOWN':
        if (!this.commit()) return;
        this.sel = (this.sel + (a === 'UP' ? this.fields.length - 1 : 1)) % this.fields.length;
        return;
      case '=':
        if (f.kind === 'num' && f.editing) {
          if (!this.commit()) return;
          if (last) this.submit();
          else this.sel++;
          return;
        }
        if (f.kind === 'expr' && !last) {
          this.sel++;
          return;
        }
        this.submit();
        return;
      case 'AC':
        if (f.kind === 'num' && f.editing) {
          f.editing = false;
          return;
        }
        if (!this.root) this.app.pop(this);
        return;
      case 'OPTN':
        this.onOptn?.(this);
        return;
      default:
        break;
    }
    if (f.kind === 'num' && !f.editing) {
      if (['DEL', 'LEFT', 'RIGHT'].includes(a)) {
        f.ed = new LineEditor(Number.isFinite(f.value) ? numberTokens(f.value) : []);
        f.editing = true;
        if (a === 'DEL') f.ed.del();
        return;
      }
      const probe = new LineEditor();
      if (!editKey(probe, a, { x: this.xToken })) return;
      f.ed = probe;
      f.editing = true;
      return;
    }
    editKey(f.ed, a, { x: this.xToken });
  }

  render(lcd) {
    let y0 = TOP + 1;
    if (this.title) {
      lcd.fitText(this.title, 4, y0 + 10, W - 8, { size: 10, weight: 700 });
      lcd.line(0, y0 + 14, W, y0 + 14, 0.8, [1, 1.5]);
      y0 += 16;
    }
    const rowH = 18;
    const bottom = this.hint ? H - 13 : H;
    const rows = Math.floor((bottom - y0) / rowH);
    if (this.sel < this.first) this.first = this.sel;
    if (this.sel >= this.first + rows) this.first = this.sel - rows + 1;
    const labelW = Math.max(...this.fields.map((f) => lcd.width(f.label, 13, 600))) + 6;
    for (let r = 0; r < rows; r++) {
      const i = this.first + r;
      const f = this.fields[i];
      if (!f) break;
      const y = y0 + r * rowH;
      const base = y + 13;
      const selected = i === this.sel;
      if (selected) {
        lcd.fill(0, y + 1, labelW + 2, rowH - 2);
        lcd.shadow(false);
        lcd.text(f.label, 3, base, { size: 13, weight: 600, color: PAPER });
        lcd.shadow(true);
      } else lcd.text(f.label, 3, base, { size: 13, weight: 600 });
      const vx = labelW + 8;
      const vw = W - vx - 8;
      if (f.editing) {
        lcd.editor(f.ed, vx, base, vw, { size: 13, cursor: selected && this.app.blink });
      } else {
        const node = Number.isFinite(f.value) ? decimalLayout(f.value, this.app.settings.format) : T('—');
        lcd.drawFit(node, W - 8, base + 3, vw, [13, 11, 9]);
      }
    }
    scrollbar(lcd, this.first, rows, this.fields.length, y0);
    if (this.hint) drawHint(lcd, this.hint);
  }
}

// ---------- values table ----------

export class ValuesScreen {
  constructor(app, { title = null, rows, hint = null, labelSize = 13, flags = {}, exact = true, onKey = null }) {
    this.app = app;
    this.title = title;
    this.rows = rows;
    this.exact = exact;
    this.hint = hint;
    this.labelSize = labelSize;
    this.flags = flags;
    this.extraKey = onKey;
    this.first = 0;
  }

  onKey(a) {
    if (this.extraKey?.(a)) return;
    if (a === 'UP') this.first = Math.max(0, this.first - 1);
    else if (a === 'DOWN' && this.canDown) this.first++;
    else if (a === 'AC' || a === '=') this.app.pop(this);
  }

  status() {
    return { up: this.first > 0, down: !!this.canDown };
  }

  render(lcd) {
    let y = TOP + 1;
    if (this.title) {
      lcd.fitText(this.title, 4, y + 10, W - 8, { size: 10, weight: 700 });
      lcd.line(0, y + 14, W, y + 14, 0.8, [1, 1.5]);
      y += 16;
    }
    const bottom = this.hint ? H - 13 : H;
    let i = this.first;
    for (; i < this.rows.length; i++) {
      const row = this.rows[i];
      const lw = lcd.width(row.label, this.labelSize, 600);
      const node = !this.exact && typeof row.value === 'number' ? decimalLayout(row.value, this.app.settings.format) : valueLayout(row.value, this.app, this.flags);
      const right = row.extra !== undefined ? W - 78 : W - 8;
      const maxW = right - lw - 12;
      const sizes = row.extra !== undefined ? [12, 10, 9] : [14, 12, 10, 9];
      const size = sizes.find((sz) => lcd.measure(node, sz).w <= maxW) ?? sizes[sizes.length - 1];
      const m = lcd.measure(node, size);
      const base = y + 3 + Math.max(m.a, this.labelSize * 0.8);
      const rowH = base + Math.max(m.d, 4) + 2 - y;
      if (base + Math.max(m.d, 0) > bottom) break;
      lcd.text(row.label, 4, base, { size: this.labelSize, weight: 600 });
      if (row.extra !== undefined) lcd.text(row.extra, W - 8, base, { size: 11, align: 'right' });
      lcd.draw(node, right - m.w, base, size);
      y += Math.max(19, rowH);
    }
    this.canDown = i < this.rows.length;
    if (this.first > 0 || this.canDown) scrollbar(lcd, this.first, i - this.first, this.rows.length, TOP + (this.title ? 17 : 1));
    if (this.hint) drawHint(lcd, this.hint);
  }
}

// ---------- free text ----------

export class TextScreen {
  constructor(app, { lines, hint = null, onKey = null }) {
    this.app = app;
    this.lines = lines;
    this.hint = hint;
    this.extraKey = onKey;
    this.scroll = 0;
  }

  onKey(a) {
    if (this.extraKey?.(a)) return;
    if (a === 'UP') this.scroll = Math.max(0, this.scroll - 12);
    else if (a === 'DOWN') this.scroll = Math.min(this.maxScroll || 0, this.scroll + 12);
    else if (a === 'AC' || a === '=') this.app.pop(this);
  }

  render(lcd) {
    const bottom = this.hint ? H - 13 : H;
    let y = TOP + 3 - this.scroll;
    lcd.clip(0, TOP, W, bottom - TOP, () => {
      for (const ln of this.lines) {
        const size = ln.size || 12;
        y += size * 1.2 + (ln.gap || 0);
        const x = ln.align === 'center' ? W / 2 : ln.align === 'right' ? W - 6 : 5;
        if (ln.node) {
          const m = lcd.measure(ln.node, size);
          const left = ln.align === 'center' ? (W - m.w) / 2 : ln.align === 'right' ? W - 6 - m.w : 5;
          if (ln.node.t === 'frac' || m.a > size) y += m.a - size * 0.74;
          lcd.draw(ln.node, left, y, size);
          y += Math.max(0, m.d - size * 0.2);
        } else if (ln.rule) {
          lcd.line(4, y - size * 0.4, W - 4, y - size * 0.4, 0.8, [1, 1.5]);
        } else {
          for (const part of wrapText(lcd, ln.s, W - 12, size, ln.weight || 500)) {
            lcd.text(part, x, y, { size, weight: ln.weight || 500, align: ln.align || 'left' });
            if (part !== ln.s) y += size * 1.2;
          }
        }
      }
    });
    this.maxScroll = Math.max(0, y + this.scroll - bottom + 4);
    if (this.hint) drawHint(lcd, this.hint);
  }
}

// ---------- small dialogs ----------

export class ConfirmScreen {
  constructor(app, { title, message, onYes }) {
    Object.assign(this, { app, title, message, onYes });
  }

  onKey(a) {
    if (a === '=') {
      this.app.pop(this);
      this.onYes();
    } else if (a === 'AC') this.app.pop(this);
  }

  render(lcd) {
    lcd.text(this.title, W / 2, 48, { size: 15, weight: 700, align: 'center' });
    lcd.text(this.message, W / 2, 72, { size: 12, align: 'center' });
    lcd.text('[=] :Yes', 90, 100, { size: 12 });
    lcd.text('[AC]:Cancel', 90, 118, { size: 12 });
  }
}

export class DigitScreen {
  constructor(app, { prompt, onDigit }) {
    Object.assign(this, { app, prompt, onDigit });
  }

  onKey(a) {
    if (/^[0-9]$/.test(a)) {
      this.app.pop(this);
      this.onDigit(Number(a));
    } else if (a === 'AC') this.app.pop(this);
  }

  render(lcd) {
    lcd.text(this.prompt, 8, 50, { size: 16, weight: 600 });
    if (this.app.blink) lcd.fill(8 + lcd.width(this.prompt, 16, 600) + 3, 37, 1.6, 15);
  }
}

export class ContrastScreen {
  constructor(app) {
    this.app = app;
  }

  onKey(a) {
    const s = this.app.settings;
    if (a === 'LEFT') s.contrast = Math.max(-5, s.contrast - 1);
    else if (a === 'RIGHT') s.contrast = Math.min(5, s.contrast + 1);
    else if (a === 'AC' || a === '=') this.app.pop(this);
    this.app.applyContrast();
  }

  render(lcd) {
    lcd.text('CONTRAST', W / 2, 44, { size: 15, weight: 700, align: 'center' });
    lcd.text('LIGHT', 30, 82, { size: 11 });
    lcd.text('DARK', W - 30, 82, { size: 11, align: 'right' });
    const x0 = 80;
    const bw = W - 160;
    lcd.box(x0, 72, bw, 12, 1);
    const v = this.app.settings.contrast + 5;
    lcd.fill(x0 + 2, 74, ((bw - 4) * v) / 10, 8, GHOST);
    lcd.tri(x0 + 2 + ((bw - 4) * v) / 10, 92, 4, 'up');
    lcd.text('[◀] [▶]', W / 2, 118, { size: 12, align: 'center' });
  }
}

export { formatPlain };
