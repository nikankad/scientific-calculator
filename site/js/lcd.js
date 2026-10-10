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
  editor(ed, x, y, w, { size = 15, lines = 1, cursor = true, lineH = Math.round(size * 1.3), color = INK } = {}) {
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
}
