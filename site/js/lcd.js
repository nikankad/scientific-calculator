// Canvas renderer for the dot-matrix-style LCD. Everything is drawn in a
// 320×140 logical coordinate space and scaled to the device pixel ratio.

export const W = 320;
export const H = 140;
export const TOP = 13; // height of the status bar
export const FONT = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
export const INK = '#18211b';
export const PAPER = '#cfd7c6';
export const GHOST = 'rgba(24,33,27,0.42)';

export class LCD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr));
    this.canvas.width = w;
    this.canvas.height = Math.max(1, Math.round((w * H) / W));
    this.scale = w / W;
  }

  begin() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.textBaseline = 'alphabetic';
    this.shadow(true);
  }

  // A faint offset "ghost" gives the ink the depth of a real LCD segment.
  shadow(on) {
    const c = this.ctx;
    c.shadowColor = on ? 'rgba(10,20,12,0.22)' : 'transparent';
    c.shadowOffsetX = on ? 0.7 * this.scale : 0;
    c.shadowOffsetY = on ? 0.8 * this.scale : 0;
    c.shadowBlur = 0;
  }

  font(size, weight = 500) {
    this.ctx.font = `${weight} ${size}px ${FONT}`;
  }

  width(s, size = 14, weight = 500) {
    this.font(size, weight);
    return this.ctx.measureText(s).width;
  }

  text(s, x, y, { size = 14, weight = 500, align = 'left', color = INK } = {}) {
    const c = this.ctx;
    this.font(size, weight);
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(s, x, y);
    return c.measureText(s).width;
  }

  // Text clipped to a maximum width with an ellipsis.
  fitText(s, x, y, maxW, opts = {}) {
    let str = s;
    if (this.width(str, opts.size, opts.weight) > maxW) {
      while (str.length > 1 && this.width(`${str}…`, opts.size, opts.weight) > maxW) str = str.slice(0, -1);
      str += '…';
    }
    return this.text(str, x, y, opts);
  }

  fill(x, y, w, h, color = INK) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  box(x, y, w, h, lw = 1, color = INK) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  }

  line(x1, y1, x2, y2, lw = 1, dash = null, color = INK) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.setLineDash(dash || []);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.setLineDash([]);
  }

  tri(x, y, s, dir = 'down', color = INK) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    if (dir === 'down') { c.moveTo(x - s, y - s / 2); c.lineTo(x + s, y - s / 2); c.lineTo(x, y + s / 2); }
    else if (dir === 'up') { c.moveTo(x - s, y + s / 2); c.lineTo(x + s, y + s / 2); c.lineTo(x, y - s / 2); }
    else if (dir === 'left') { c.moveTo(x + s / 2, y - s); c.lineTo(x + s / 2, y + s); c.lineTo(x - s / 2, y); }
    else { c.moveTo(x - s / 2, y - s); c.lineTo(x - s / 2, y + s); c.lineTo(x + s / 2, y); }
    c.closePath();
    c.fill();
  }

  // Inverted label: dark block with light text.
  badge(s, x, y, { size = 9, weight = 700, pad = 2, h } = {}) {
    const w = this.width(s, size, weight) + pad * 2;
    const bh = h ?? size + 2;
    this.fill(x, y, w, bh);
    this.shadow(false);
    this.text(s, x + pad, y + bh - (bh - size * 0.72) / 2 - 0.5, { size, weight, color: PAPER });
    this.shadow(true);
    return w;
  }

  clip(x, y, w, h, fn) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    fn();
    c.restore();
  }

  // ---------- natural-display layout ----------

  measure(node, size) {
    switch (node.t) {
      case 'text':
        return { w: node.s ? this.width(node.s, size) : 0, a: size * 0.74, d: size * 0.2 };
      case 'row': {
        let w = 0, a = size * 0.74, d = size * 0.2;
        for (const c of node.c) {
          const m = this.measure(c, size);
          w += m.w;
          a = Math.max(a, m.a);
          d = Math.max(d, m.d);
        }
        return { w, a, d };
      }
      case 'frac': {
        const n = this.measure(node.n, size);
        const dd = this.measure(node.d, size);
        const axis = size * 0.3;
        return { w: Math.max(n.w, dd.w) + size * 0.35, a: axis + 2 + n.d + n.a, d: -axis + 2 + dd.a + dd.d };
      }
      case 'sqrt': {
        const b = this.measure(node.c, size);
        return { w: b.w + size * 0.6 + 2, a: b.a + 3, d: b.d };
      }
      case 'sup': {
        const m = this.measure(node.c, size * 0.62);
        return { w: m.w + 1, a: size * 0.45 + m.a, d: 0 };
      }
      default:
        return { w: 0, a: 0, d: 0 };
    }
  }

  draw(node, x, y, size, color = INK) {
    const c = this.ctx;
    switch (node.t) {
      case 'text':
        return node.s ? this.text(node.s, x, y, { size, color }) : 0;
      case 'row': {
        let cx = x;
        for (const ch of node.c) cx += this.draw(ch, cx, y, size, color);
        return cx - x;
      }
      case 'frac': {
        const m = this.measure(node, size);
        const n = this.measure(node.n, size);
        const dd = this.measure(node.d, size);
        const axis = y - size * 0.3;
        c.fillStyle = color;
        c.fillRect(x + 1, axis - 0.6, m.w - 2, 1.3);
        this.draw(node.n, x + (m.w - n.w) / 2, axis - 2 - n.d, size, color);
        this.draw(node.d, x + (m.w - dd.w) / 2, axis + 2 + dd.a, size, color);
        return m.w;
      }
      case 'sqrt': {
        const b = this.measure(node.c, size);
        const left = size * 0.6;
        const top = y - b.a - 2;
        c.strokeStyle = color;
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(x + 1, y - size * 0.3);
        c.lineTo(x + left * 0.35, y - size * 0.38);
        c.lineTo(x + left * 0.6, y + b.d - 1);
        c.lineTo(x + left, top);
        c.lineTo(x + left + b.w + 2, top);
        c.stroke();
        this.draw(node.c, x + left + 1, y, size, color);
        return b.w + left + 2;
      }
      case 'sup':
        return this.draw(node.c, x, y - size * 0.45, size * 0.62, color) + 1;
      default:
        return 0;
    }
  }

  // Draw a layout right-aligned, shrinking the font until it fits.
  drawFit(node, right, bottom, maxW, sizes = [22, 18, 15, 12]) {
    for (const size of sizes) {
      const m = this.measure(node, size);
      if (m.w <= maxW || size === sizes[sizes.length - 1]) {
        this.draw(node, right - m.w, bottom - m.d, size);
        return m;
      }
    }
    return null;
  }

  // ---------- line editor ----------

  // Draw a LineEditor in a box, wrapping over `lines` rows (or scrolling
  // horizontally when lines = 1) and keeping the cursor visible.
  editor(ed, x, y, w, opts = {}) {
    if (ed.tokens.some((t) => t.k)) return this.editor2D(ed, x, y, w, opts);
    return this.editorLinear(ed, x, y, w, opts);
  }

  editorLinear(ed, x, y, w, { size = 15, lines = 1, cursor = true, lineH = Math.round(size * 1.3), color = INK } = {}) {
    this.font(size);
    const cw = this.ctx.measureText('0').width;
    const items = [];
    let line = 0;
    let cx = 0;
    ed.tokens.forEach((tok, i) => {
      const tw = tok.d.length * cw;
      if (lines > 1 && cx + tw > w && cx > 0) {
        line++;
        cx = 0;
      }
      items.push({ i, x: cx, line, w: tw, tok });
      cx += tw;
    });
    const endPos = { x: cx, line };
    if (lines > 1 && cx + cw > w && ed.cursor === ed.tokens.length) {
      endPos.line = line + 1;
      endPos.x = 0;
    }
    const cur = ed.cursor < items.length ? items[ed.cursor] : endPos;
    let hscroll = 0;
    let first = 0;
    if (lines === 1) {
      hscroll = ed.hscroll || 0;
      if (cur.x - hscroll > w - cw) hscroll = cur.x - w + cw;
      if (cur.x - hscroll < 0) hscroll = Math.max(0, cur.x - cw * 2);
      if (endPos.x <= w) hscroll = 0;
      ed.hscroll = hscroll;
    } else {
      first = ed.firstLine || 0;
      if (cur.line < first) first = cur.line;
      if (cur.line >= first + lines) first = cur.line - lines + 1;
      ed.firstLine = first;
    }
    this.clip(x - 1, y - size - 2, w + 3, lines * lineH + 6, () => {
      for (const it of items) {
        if (it.line < first || it.line >= first + lines) continue;
        this.text(it.tok.d, x + it.x - hscroll, y + (it.line - first) * lineH, { size, color });
      }
      if (cursor && cur.line >= first && cur.line < first + lines) {
        const px = x + cur.x - hscroll;
        const py = y + (cur.line - first) * lineH;
        if (ed.insert) this.fill(px - 0.5, py - size * 0.82, 1.6, size * 1.0, color);
        else this.fill(px, py + 2, Math.max(cw, cur.w || cw), 1.8, color);
      }
    });
    if (lines === 1) {
      if (hscroll > 0) this.tri(x - 3, y - size * 0.3, 2.5, 'left');
      if (endPos.x - hscroll > w + 1) this.tri(x + w + 3, y - size * 0.3, 2.5, 'right');
    }
  }

  // Natural-display editor: templates (fraction, ∫, d/dx, Σ, Π) are drawn in
  // 2D, empty slots show as dotted boxes, and the line scrolls horizontally
  // to follow the cursor.
  editor2D(ed, x, y, w, { size = 15, lines = 1, cursor = true, color = INK, fracScale = lines > 1 ? 1 : 0.72 } = {}) {
    const toks = ed.tokens;
    let i = 0;
    const row = (nested) => {
      const items = [];
      while (i < toks.length) {
        const t = toks[i];
        if (t.k === 'ts' || t.k === 'tc') {
          if (nested) return { items, end: i };
          items.push({ type: 'atom', i, s: '' });
          i++;
        } else if (t.k === 'to') {
          const it = { type: 'tpl', tpl: t.tpl, open: i++, slots: [] };
          for (;;) {
            it.slots.push(row(true));
            const k = toks[i]?.k;
            i++;
            if (k !== 'ts') break;
          }
          items.push(it);
        } else {
          items.push({ type: 'atom', i, s: t.d });
          i++;
        }
      }
      return { items, end: toks.length };
    };
    const tree = row(false);
    const tw = (str, sz, wt = 500) => this.width(str, sz, wt);
    const small = (sz) => Math.max(7, sz * (fracScale < 1 ? 0.55 : 0.62));
    const measureRow = (r, sz) => {
      let rw = 0;
      let a = sz * 0.74;
      let d = sz * 0.2;
      for (const it of r.items) {
        const m = it.type === 'atom' ? { w: it.s.length * tw('0', sz), a: sz * 0.74, d: sz * 0.2 } : measureTpl(it, sz);
        it.m = m;
        rw += m.w;
        a = Math.max(a, m.a);
        d = Math.max(d, m.d);
      }
      if (!r.items.length) rw = tw('0', sz) * 0.95;
      r.m = { w: rw, a, d };
      r.size = sz;
      return r.m;
    };
    // Parentheses scaled to the height of what they enclose.
    const parens = (body, sz) => {
      const ps = Math.max(sz, (body.a + body.d) / 0.92);
      return { ps, w: tw('(', ps), b: (body.d - body.a) / 2 + ps * 0.3 };
    };
    // Each template gets slot offsets {dx, db} and decorations relative to (0, baseline).
    const measureTpl = (it, sz) => {
      const deco = [];
      const at = [];
      let w;
      let a;
      let d;
      if (it.tpl === 'frac') {
        const cs = Math.max(8, sz * fracScale);
        const [n, dd] = it.slots.map((r) => measureRow(r, cs));
        const axis = sz * 0.3;
        w = Math.max(n.w, dd.w) + 4;
        at.push({ dx: (w - n.w) / 2, db: -axis - 2 - n.d }, { dx: (w - dd.w) / 2, db: -axis + 2 + dd.a });
        deco.push({ bar: true, x: 1, y: -axis, w: w - 2 });
        a = axis + 2 + n.d + n.a;
        d = -axis + 2 + dd.a + dd.d;
      } else if (it.tpl === 'integ') {
        const ls = small(sz);
        const f = measureRow(it.slots[0], sz);
        const [lo, hi] = [it.slots[1], it.slots[2]].map((r) => measureRow(r, ls));
        const top = -(Math.max(f.a, sz * 0.8) + 3);
        const bot = Math.max(f.d, sz * 0.22) + 3;
        const sw = sz * 0.5;
        const hiB = top + hi.a * 0.6;
        const loB = bot + lo.a * 0.45;
        const lw = Math.max(lo.w, hi.w);
        const fx = sw + lw + 3;
        at.push({ dx: fx, db: 0 }, { dx: sw - 1, db: loB }, { dx: sw + 1, db: hiB });
        deco.push({ integral: true, x: 0, w: sw, top, bot });
        deco.push({ text: 'dx', x: fx + f.w + 2, b: 0, size: sz });
        w = fx + f.w + 2 + tw('dx', sz) + 1;
        a = Math.max(-top + 1, hi.a - hiB);
        d = Math.max(bot + 1, loB + lo.d);
      } else if (it.tpl === 'sum' || it.tpl === 'prod') {
        const ls = small(sz);
        const f = measureRow(it.slots[0], sz);
        const [lo, hi] = [it.slots[1], it.slots[2]].map((r) => measureRow(r, ls));
        const sym = it.tpl === 'sum' ? 'Σ' : 'Π';
        const ss = sz * 1.3;
        const symW = tw(sym, ss, 600);
        const pre = tw('x=', ls);
        const bw = Math.max(symW, hi.w, pre + lo.w) + 2;
        const symTop = -ss * 0.72;
        const hiB = symTop - 2 - hi.d;
        const loB = 2 + lo.a + 1;
        const p = parens(f, sz);
        const lx = (bw - pre - lo.w) / 2;
        at.push({ dx: bw + 1 + p.w, db: 0 }, { dx: lx + pre, db: loB }, { dx: (bw - hi.w) / 2, db: hiB });
        deco.push({ text: sym, x: (bw - symW) / 2, b: 0, size: ss, weight: 600 });
        deco.push({ text: 'x=', x: lx, b: loB, size: ls });
        deco.push({ text: '(', x: bw + 1, b: p.b, size: p.ps }, { text: ')', x: bw + 1 + p.w + f.w, b: p.b, size: p.ps });
        w = bw + 1 + 2 * p.w + f.w + 1;
        a = Math.max(hi.a - hiB, f.a, -symTop);
        d = Math.max(loB + lo.d, f.d);
      } else {
        // deriv: d/dx( f )|x=a
        const ls = small(sz);
        const ds = Math.max(8, sz * 0.72);
        const f = measureRow(it.slots[0], sz);
        const v = measureRow(it.slots[1], ls);
        const axis = sz * 0.3;
        const dw = tw('dx', ds) + 2;
        const p = parens(f, sz);
        const fx = dw + 2 + p.w;
        const barX = fx + f.w + p.w + 2;
        const top = -Math.max(f.a, sz * 0.8);
        const vb = Math.max(f.d, sz * 0.2) + v.a * 0.5;
        const pre = tw('x=', ls);
        deco.push({ text: 'd', x: (dw - tw('d', ds)) / 2, b: -axis - 2 - ds * 0.2, size: ds });
        deco.push({ bar: true, x: 0, y: -axis, w: dw });
        deco.push({ text: 'dx', x: 1, b: -axis + 2 + ds * 0.74, size: ds });
        deco.push({ text: '(', x: dw + 2, b: p.b, size: p.ps }, { text: ')', x: fx + f.w, b: p.b, size: p.ps });
        deco.push({ vline: true, x: barX, y1: top - 1, y2: vb + 1 });
        deco.push({ text: 'x=', x: barX + 2, b: vb, size: ls });
        at.push({ dx: fx, db: 0 }, { dx: barX + 2 + pre, db: vb });
        w = barX + 2 + pre + v.w + 1;
        a = Math.max(f.a, axis + 2 + ds * 0.94, -top + 1);
        d = Math.max(f.d, -axis + 2 + ds * 0.94, vb + v.d);
      }
      it.at = at;
      it.deco = deco;
      return { w, a, d };
    };
    const top = measureRow(tree, size);
    const base = lines > 1 ? Math.max(y, y - size * 0.85 + top.a) : y;
    // Cursor positions for every token index, plus draw operations.
    const pos = [];
    const ops = [];
    const placeRow = (r, px, b) => {
      const sz = r.size;
      if (!r.items.length) ops.push({ box: true, x: px + 0.5, b, s: sz, w: r.m.w - 1 });
      let cx = px;
      for (const it of r.items) {
        if (it.type === 'atom') {
          pos[it.i] = { x: cx, b, s: sz };
          if (it.s) ops.push({ text: it.s, x: cx, b, size: sz });
        } else {
          pos[it.open] = { x: cx, b, s: sz };
          for (const dc of it.deco) ops.push({ ...dc, x: cx + dc.x, b: dc.b === undefined ? undefined : b + dc.b, y: dc.y === undefined ? undefined : b + dc.y, top: b + (dc.top ?? 0), bot: b + (dc.bot ?? 0), y1: b + (dc.y1 ?? 0), y2: b + (dc.y2 ?? 0) });
          it.slots.forEach((slot, k) => placeRow(slot, cx + it.at[k].dx, b + it.at[k].db));
        }
        cx += it.m.w;
      }
      pos[r.end] = { x: r.items.length ? cx : px, b, s: sz };
    };
    placeRow(tree, 0, base);
    const cur = pos[ed.cursor] || pos[toks.length];
    const cw = tw('0', size);
    let hscroll = ed.hscroll || 0;
    if (cur.x - hscroll > w - cw) hscroll = cur.x - w + cw;
    if (cur.x - hscroll < 0) hscroll = Math.max(0, cur.x - cw * 2);
    if (top.w <= w) hscroll = 0;
    ed.hscroll = hscroll;
    const c = this.ctx;
    this.clip(x - 1, base - top.a - 2, w + 3, top.a + top.d + 5, () => {
      for (const op of ops) {
        const ox = x + op.x - hscroll;
        if (op.text) this.text(op.text, ox, op.b, { size: op.size, weight: op.weight, color });
        else if (op.bar) this.fill(ox, op.y - 0.6, op.w, 1.2, color);
        else if (op.vline) this.line(ox, op.y1, ox, op.y2, 1, null, color);
        else if (op.integral) {
          const sw = op.w;
          c.strokeStyle = color;
          c.lineWidth = 1.4;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(ox + sw * 0.95, op.top + 2.2);
          c.bezierCurveTo(ox + sw * 0.85, op.top - 0.6, ox + sw * 0.55, op.top - 0.6, ox + sw * 0.52, op.top + 4);
          c.lineTo(ox + sw * 0.48, op.bot - 4);
          c.bezierCurveTo(ox + sw * 0.45, op.bot + 0.6, ox + sw * 0.15, op.bot + 0.6, ox + sw * 0.05, op.bot - 2.2);
          c.stroke();
          c.lineCap = 'butt';
        } else if (op.box) {
          const h = op.s * 0.78;
          c.setLineDash([1, 1]);
          this.box(ox, op.b - h, Math.max(3, op.w), h, 0.9, color);
          c.setLineDash([]);
        }
      }
      if (cursor) {
        const px = x + cur.x - hscroll;
        if (ed.insert) this.fill(px - 0.5, cur.b - cur.s * 0.82, 1.6, cur.s * 1.0, color);
        else this.fill(px, cur.b + 2, tw('0', cur.s), 1.8, color);
      }
    });
    if (hscroll > 0) this.tri(x - 3, base - size * 0.3, 2.5, 'left');
    if (top.w - hscroll > w + 1) this.tri(x + w + 3, base - size * 0.3, 2.5, 'right');
  }
}
