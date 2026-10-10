// Calculator state machine: SHIFT/ALPHA, the screen stack, settings,
// variables, persistence and the status bar.
import { W, PAPER } from './lcd.js';
import { ListScreen, MenuScreen, ConfirmScreen, DigitScreen, ContrastScreen, valueLayout } from './ui/screens.js';
import { CONSTANTS, CONVERSIONS } from './math/units.js';
import { VARS, constToken, convToken, tokenFor } from './tokens.js';
import { formatPlain } from './math/format.js';

const STORAGE_KEY = 'nova-calc-v1';
const defaultSettings = () => ({ angle: 'deg', format: { mode: 'norm', digits: 0 }, frac: 'improper', contrast: 0 });
const freshVars = () => Object.fromEntries([...VARS, 'Ans'].map((v) => [v, 0]));

export class App {
  constructor(lcd, modeList, hooks = {}) {
    this.lcd = lcd;
    this.modeList = modeList;
    this.hooks = hooks;
    this.shift = false;
    this.alpha = false;
    this.on = true;
    this.sto = null;
    this.blink = true;
    this.dirty = true;
    this.toastMsg = null;
    this.settings = defaultSettings();
    this.vars = freshVars();
    this.store = {};
    this.load();
    this.instances = [];
    this.stack = [];
    this.setMode(Math.min(this.store.mode ?? 0, modeList.length - 1));
    this.applyContrast();
    setInterval(() => {
      this.blink = !this.blink;
      this.dirty = true;
    }, 530);
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (this.on && this.top.tick) this.top.tick(dt);
      if (this.toastMsg && t > this.toastMsg.until) {
        this.toastMsg = null;
        this.dirty = true;
      }
      if (this.dirty) this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get top() {
    return this.stack[this.stack.length - 1];
  }

  get mode() {
    return this.stack[0];
  }

  ctx(extra = {}) {
    return { vars: this.vars, angle: this.settings.angle, format: this.settings.format, random: Math.random, ...extra };
  }

  push(screen) {
    this.stack.push(screen);
    this.dirty = true;
  }

  pop(screen) {
    if (this.stack.length > 1 && (!screen || this.top === screen)) this.stack.pop();
    this.dirty = true;
  }

  setMode(i) {
    this.modeIndex = i;
    this.instances[i] ??= new this.modeList[i](this);
    this.stack = [this.instances[i]];
    this.instances[i].enter?.();
    this.store.mode = i;
    this.dirty = true;
  }

  toast(msg, ms = 1500) {
    this.toastMsg = { msg, until: performance.now() + ms };
    this.dirty = true;
  }

  // ---------- input ----------

  press(def) {
    this.blink = true;
    this.dirty = true;
    if (!this.on) {
      if (def.main === 'ON') this.turnOn();
      return;
    }
    if (def.main === 'SHIFT') {
      this.shift = !this.shift;
      this.alpha = false;
      return;
    }
    if (def.main === 'ALPHA') {
      this.alpha = !this.alpha;
      this.shift = false;
      return;
    }
    if (this.sto) {
      const cb = this.sto;
      this.sto = null;
      this.shift = this.alpha = false;
      if (def.alpha && VARS.includes(def.alpha)) cb(def.alpha);
      return;
    }
    const mapped = this.top.mapKey?.(def, this.shift, this.alpha) ?? null;
    const action = mapped ?? ((this.shift && def.shift) || (this.alpha && def.alpha) || def.main);
    this.shift = false;
    this.alpha = false;
    this.dispatch(action);
  }

  dispatch(a) {
    this.blink = true;
    this.dirty = true;
    if (!this.on) {
      if (a === 'ON') this.turnOn();
      return;
    }
    switch (a) {
      case 'ON':
        this.turnOn();
        break;
      case 'OFF':
        this.on = false;
        this.save();
        break;
      case 'MENU':
        if (this.top instanceof MenuScreen) this.pop();
        else {
          this.stack = this.stack.filter((s) => !(s instanceof MenuScreen));
          this.push(new MenuScreen(this));
        }
        break;
      case 'SETUP':
        this.openSetup();
        break;
      case 'RESET':
        this.openReset();
        break;
      case 'QR':
        this.share();
        break;
      case 'CONST':
        if (this.top.insertToken) this.pickConstant();
        else this.top.onKey(a);
        break;
      case 'CONV':
        if (this.top.insertToken) this.pickConversion();
        else this.top.onKey(a);
        break;
      case 'RECALL':
        if (this.top.insertToken) this.recall();
        else this.top.onKey(a);
        break;
      case 'STO':
        if (this.top.storeValue) {
          const target = this.top;
          this.sto = (name) => target.storeValue(name);
        } else this.top.onKey(a);
        break;
      default:
        this.top.onKey(a);
    }
    this.scheduleSave();
  }

  turnOn() {
    this.on = true;
    this.shift = this.alpha = false;
    this.sto = null;
    this.dirty = true;
  }

  // ---------- shared screens ----------

  openSetup() {
    const s = this.settings;
    const fmtName = () => (s.format.mode === 'norm' ? 'Norm' : `${s.format.mode === 'fix' ? 'Fix' : 'Sci'} ${s.format.digits}`);
    this.push(new ListScreen(this, {
      title: 'SETUP',
      items: () => [
        { label: 'Angle Unit', right: { deg: 'Degree', rad: 'Radian', grad: 'Gradian' }[s.angle], action: () => this.push(new ListScreen(this, {
          title: 'Angle Unit',
          sel: ['deg', 'rad', 'grad'].indexOf(s.angle),
          items: ['Degree', 'Radian', 'Gradian'].map((label, i) => ({ label, action: () => { s.angle = ['deg', 'rad', 'grad'][i]; } })),
        })) },
        { label: 'Number Format', right: fmtName(), action: () => this.push(new ListScreen(this, {
          title: 'Number Format',
          items: [
            { label: 'Norm', action: () => { s.format = { mode: 'norm', digits: 0 }; } },
            { label: 'Fix', action: () => this.push(new DigitScreen(this, { prompt: 'Fix 0~9?', onDigit: (d) => { s.format = { mode: 'fix', digits: d }; } })) },
            { label: 'Sci', action: () => this.push(new DigitScreen(this, { prompt: 'Sci 0~9?', onDigit: (d) => { s.format = { mode: 'sci', digits: d }; } })) },
          ],
        })) },
        { label: 'Fraction Result', right: s.frac === 'mixed' ? 'ab/c' : 'd/c', action: () => this.push(new ListScreen(this, {
          title: 'Fraction Result',
          items: [
            { label: 'ab/c (mixed)', action: () => { s.frac = 'mixed'; } },
            { label: 'd/c (improper)', action: () => { s.frac = 'improper'; } },
          ],
        })) },
        { label: 'Contrast', action: () => this.push(new ContrastScreen(this)) },
      ],
    }));
  }

  openReset() {
    const confirm = (title, fn) => this.push(new ConfirmScreen(this, { title, message: 'Reset?', onYes: () => { fn(); this.toast('Reset done'); } }));
    this.push(new ListScreen(this, {
      title: 'RESET',
      items: [
        { label: 'Setup Data', action: () => confirm('Setup Data', () => { this.settings = defaultSettings(); this.applyContrast(); }) },
        { label: 'Variable Memory', action: () => confirm('Variable Memory', () => { this.vars = freshVars(); }) },
        { label: 'Initialize All', action: () => confirm('Initialize All', () => {
          this.settings = defaultSettings();
          this.vars = freshVars();
          this.store = {};
          this.instances = [];
          this.applyContrast();
          this.setMode(0);
        }) },
      ],
    }));
  }

  pickConstant() {
    const target = this.top;
    this.push(new ListScreen(this, {
      title: 'CONSTANT',
      size: 12,
      rowH: 15,
      items: CONSTANTS.map((c) => ({ label: `${c.label}  ${c.name}`, c })),
      onSelect: (item) => target.insertToken(constToken(item.c)),
    }));
  }

  pickConversion() {
    const target = this.top;
    this.push(new ListScreen(this, {
      title: 'CONVERSION',
      size: 12,
      rowH: 15,
      items: CONVERSIONS.map((c) => ({ label: c.label, c })),
      onSelect: (item) => target.insertToken(convToken(item.c)),
    }));
  }

  recall() {
    const target = this.top;
    this.push(new ListScreen(this, {
      title: 'RECALL',
      numbered: false,
      size: 13,
      rowH: 16,
      items: VARS.map((v) => ({ label: `${v}=`, right: formatPlain(this.vars[v], this.settings.format), v })),
      onSelect: (item) => target.insertToken(tokenFor(item.v)),
    }));
  }

  share() {
    const url = location.href.split('#')[0];
    navigator.clipboard?.writeText(url).then(
      () => this.toast('Link copied'),
      () => this.toast(url.replace(/^https?:\/\//, ''), 3000),
    );
  }

  applyContrast() {
    this.hooks.onContrast?.(this.settings.contrast);
  }

  // ---------- persistence ----------

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.assign(this.settings, data.settings || {});
      Object.assign(this.vars, data.vars || {});
      this.store = data.store || {};
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 400);
  }

  save() {
    this.instances.forEach((m) => m?.persist?.());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: this.settings, vars: this.vars, store: this.store }));
    } catch {
      /* ignore */
    }
  }

  // ---------- rendering ----------

  render() {
    this.dirty = false;
    const lcd = this.lcd;
    lcd.begin();
    if (!this.on) return;
    this.top.render(lcd, this);
    this.drawStatus(lcd);
    if (this.toastMsg) {
      const msg = this.toastMsg.msg;
      const w = lcd.width(msg, 12, 600) + 16;
      const x = (W - w) / 2;
      lcd.fill(x, 56, w, 22);
      lcd.shadow(false);
      lcd.text(msg, W / 2, 71, { size: 12, weight: 600, align: 'center', color: PAPER });
      lcd.shadow(true);
    }
  }

  drawStatus(lcd) {
    const st = { ...(this.mode.status?.() || {}), ...(this.top !== this.mode ? this.top.status?.() || {} : {}) };
    let x = 2;
    const badge = (s) => {
      x += lcd.badge(s, x, 1, { size: 8, h: 10 }) + 3;
    };
    const plain = (s) => {
      x += lcd.text(s, x, 9, { size: 9, weight: 700 }) + 5;
    };
    if (this.shift) badge('S');
    if (this.alpha) badge('A');
    if (this.sto) badge('STO');
    if (this.vars.M !== 0) plain('M');
    const angle = st.angle ?? { deg: 'D', rad: 'R', grad: 'G' }[this.settings.angle];
    if (angle) badge(angle);
    if (this.settings.format.mode !== 'norm') plain(this.settings.format.mode === 'fix' ? 'FIX' : 'SCI');
    if (st.flag) plain(st.flag);
    const tag = st.tag ?? this.mode.constructor.tag;
    let rx = W - 2;
    if (st.up || st.down) {
      if (st.up) lcd.tri(rx - 4, 4, 3, 'up');
      if (st.down) lcd.tri(rx - 4, 9.5, 3, 'down');
      rx -= 11;
    }
    if (tag) lcd.text(tag, rx, 9, { size: 9, weight: 700, align: 'right' });
  }

  // Helpers shared by modes.
  layout(v, flags) {
    return valueLayout(v, this, flags);
  }
}
