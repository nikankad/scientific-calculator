// 7: Algorithms — step-by-step visualisation of sorts and searches with live
// comparison/move counters and complexity cards.
import { ALGORITHMS, PATTERNS, makeInput, countOps } from '../algo/algorithms.js';
import { W, H, TOP, INK, PAPER, GHOST } from '../lcd.js';
import { ListScreen, wrapText, drawHint } from '../ui/screens.js';

const SIZES = [8, 12, 16, 24, 32, 48, 64, 96, 128];

class VizScreen {
  constructor(app, alg, n, pattern) {
    Object.assign(this, { app, alg, n, pattern });
    this.reset();
  }

  reset() {
    const { alg, n } = this;
    this.arr = makeInput(n, alg.id === 'binary' ? 'sorted' : this.pattern);
    this.target = alg.kind === 'search' ? this.arr[Math.floor(Math.random() * n)] : undefined;
    const total = countOps(alg, this.arr, this.target);
    const events = total.total + n;
    this.speed = Math.max(3, Math.min(4000, events / 9));
    this.gen = alg.gen(this.arr, this.target);
    this.cmp = 0;
    this.moves = 0;
    this.hl = [];
    this.pivot = -1;
    this.range = null;
    this.found = null;
    this.sorted = new Set();
    this.done = false;
    this.playing = true;
    this.acc = 0;
  }

  status() {
    return { tag: 'ALGO' };
  }

  step() {
    const r = this.gen.next();
    if (r.done) {
      this.done = true;
      this.playing = false;
      this.hl = [];
      this.pivot = -1;
      if (this.alg.kind === 'sort') {
        this.range = null;
        for (let i = 0; i < this.n; i++) this.sorted.add(i);
      }
      return;
    }
    const e = r.value;
    switch (e.op) {
      case 'cmp':
        this.cmp++;
        this.hl = [e.i, e.j].filter((i) => i >= 0);
        break;
      case 'swap':
        this.moves++;
        this.hl = [e.i, e.j];
        break;
      case 'write':
        this.moves++;
        this.hl = [e.i];
        break;
      case 'pivot':
        this.pivot = e.i;
        break;
      case 'range':
        this.range = [e.lo, e.hi];
        break;
      case 'sorted':
        this.sorted.add(e.i);
        break;
      case 'found':
        this.found = e.i;
        this.hl = [];
        break;
      default:
        break;
    }
  }

  tick(dt) {
    if (!this.playing) return;
    this.acc += dt * this.speed;
    let steps = Math.floor(this.acc);
    this.acc -= steps;
    while (steps-- > 0 && !this.done) this.step();
    this.app.dirty = true;
  }

  onKey(a) {
    switch (a) {
      case '=':
        if (this.done) this.reset();
        else this.playing = !this.playing;
        return;
      case 'RIGHT':
        this.playing = false;
        if (!this.done) this.step();
        return;
      case 'LEFT':
        this.reset();
        this.playing = false;
        return;
      case '+':
      case 'UP':
        this.speed = Math.min(20000, this.speed * 2);
        return;
      case '-':
      case 'DOWN':
        this.speed = Math.max(0.5, this.speed / 2);
        return;
      case 'AC':
        this.app.pop(this);
        return;
      default:
        break;
    }
  }

  render(lcd) {
    const { n, arr } = this;
    const head = this.alg.kind === 'search' ? `${this.alg.name}  find ${this.target}` : `${this.alg.name}  n=${n}`;
    lcd.text(head, 3, TOP + 9, { size: 9, weight: 700 });
    const state = this.done ? 'DONE' : this.playing ? `▶ ${this.speed >= 10 ? Math.round(this.speed) : this.speed.toFixed(1)}/s` : '❚❚ PAUSE';
    lcd.text(state, W - 3, TOP + 9, { size: 9, weight: 700, align: 'right' });
    const top = TOP + 15;
    const bottom = H - 22;
    const areaH = bottom - top;
    const bw = (W - 4) / n;
    const gap = bw >= 4 ? 1 : 0;
    const hl = new Set(this.hl);
    for (let i = 0; i < n; i++) {
      const h = Math.max(1, (arr[i] / n) * areaH);
      const x = 2 + i * bw;
      const y = bottom - h;
      const isFound = this.found === i;
      if (hl.has(i)) {
        lcd.box(x, y, Math.max(1.5, bw - gap), h, Math.min(1.4, bw / 2));
        lcd.tri(x + (bw - gap) / 2, bottom + 4, Math.max(1.6, Math.min(3, bw / 2)), 'up');
      } else if (isFound) {
        lcd.fill(x, y, bw - gap, h);
      } else {
        const outside = this.range && (i < this.range[0] || i > this.range[1]);
        const final = this.sorted.has(i) || (this.alg.kind === 'search' && !outside);
        lcd.fill(x, y, Math.max(1, bw - gap), h, final && !outside ? INK : GHOST);
      }
      if (i === this.pivot && !this.done) lcd.tri(x + (bw - gap) / 2, y - 3, Math.max(1.6, Math.min(3, bw / 2)), 'down');
    }
    if (this.range) {
      const [lo, hi] = this.range;
      const x1 = 2 + lo * bw;
      const x2 = 2 + (hi + 1) * bw - gap;
      lcd.line(x1, bottom + 7, x2, bottom + 7, 1);
      lcd.line(x1, bottom + 5, x1, bottom + 8, 1);
      lcd.line(x2, bottom + 5, x2, bottom + 8, 1);
    }
    let msg = `cmp ${this.cmp}`;
    if (this.alg.kind === 'sort') msg += `   moves ${this.moves}`;
    if (this.found !== null) msg += this.found >= 0 ? `   found @${this.found}` : '   not found';
    lcd.fill(0, H - 12, W, 12);
    lcd.shadow(false);
    lcd.text(msg, 4, H - 3, { size: 9, weight: 600, color: PAPER });
    lcd.text('[=]▶❚❚ [▶]step [±]speed', W - 4, H - 3, { size: 8, align: 'right', color: PAPER });
    lcd.shadow(true);
  }
}

class InfoScreen {
  constructor(app, alg, owner) {
    Object.assign(this, { app, alg, owner });
  }

  status() {
    return { tag: 'ALGO' };
  }

  onKey(a) {
    const o = this.owner;
    if (a === 'LEFT' || a === 'RIGHT') {
      const i = SIZES.indexOf(o.n);
      o.n = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + (a === 'LEFT' ? -1 : 1)))];
    } else if (a === 'OPTN' && this.alg.id !== 'binary') {
      this.app.push(new ListScreen(this.app, {
        title: 'INPUT ORDER',
        sel: PATTERNS.findIndex((p) => p.id === o.pattern),
        items: PATTERNS.map((p) => ({ label: p.name, action: () => { o.pattern = p.id; } })),
      }));
    } else if (a === '=') this.app.push(new VizScreen(this.app, this.alg, o.n, o.pattern));
    else if (a === 'AC') this.app.pop(this);
  }

  render(lcd) {
    const a = this.alg;
    lcd.text(a.name, 4, TOP + 15, { size: 14, weight: 700 });
    if (a.stable !== null) lcd.badge(a.stable ? 'STABLE' : 'UNSTABLE', W - (a.stable ? 46 : 58), TOP + 5, { size: 8, h: 11 });
    const rows = [['Best', a.best], ['Average', a.avg], ['Worst', a.worst], ['Space', a.space]];
    rows.forEach(([k, v], i) => {
      const y = TOP + 32 + i * 14;
      lcd.text(k, 6, y, { size: 11 });
      lcd.text(`O(${v})`, 84, y, { size: 12, weight: 700 });
    });
    const lines = wrapText(lcd, a.note, 128, 8.5);
    lines.slice(0, 6).forEach((ln, i) => lcd.text(ln, W - 134, TOP + 30 + i * 11, { size: 8.5 }));
    lcd.line(W - 140, TOP + 21, W - 140, TOP + 84, 0.8, [1, 1.5]);
    const pat = PATTERNS.find((p) => p.id === this.owner.pattern).name;
    const extra = a.id === 'binary' ? 'sorted' : pat;
    lcd.text(`n=${this.owner.n} [◀▶]   input: ${extra}${a.id === 'binary' ? '' : ' [OPTN]'}`, 6, H - 18, { size: 9 });
    drawHint(lcd, '[=] Run visualisation   [AC] Back');
  }
}

export class AlgorithmsMode extends ListScreen {
  static title = 'Algorithms';
  static icon = 'algo';
  static tag = 'ALGO';

  constructor(app) {
    super(app, {
      title: 'ALGORITHMS',
      root: true,
      size: 13,
      rowH: 16,
      items: ALGORITHMS.map((alg) => ({ label: alg.name, right: `O(${alg.avg})`, alg })),
      onSelect: (item) => app.push(new InfoScreen(app, item.alg, this)),
    });
    this.n = 32;
    this.pattern = 'random';
  }
}
