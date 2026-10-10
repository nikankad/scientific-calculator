// Builds the keypad, wires pointer + keyboard input and starts the app.
import { LCD } from './lcd.js';
import { App } from './app.js';
import { TOP_KEYS, ROW_B, FN_ROWS, NUM_ROWS, KEYBOARD, ALL_KEYS } from './keys.js';
import { CalcMode } from './modes/calc.js';
import { GraphMode } from './modes/graph.js';
import { TableMode } from './modes/table.js';
import { BaseNMode } from './modes/basen.js';
import { EquationMode } from './modes/equation.js';
import { StatsMode } from './modes/stats.js';
import { AlgorithmsMode } from './modes/algorithms.js';
import { BigOMode } from './modes/bigo.js';

const MODES = [CalcMode, GraphMode, TableMode, BaseNMode, EquationMode, StatsMode, AlgorithmsMode, BigOMode];
const keyById = Object.fromEntries(ALL_KEYS.map((k) => [k.id, k]));
const $ = (sel) => document.querySelector(sel);

let app;

function labelHtml(k) {
  if (k.top) return k.top;
  return [k.s && `<span class="g">${k.s}</span>`, k.a && `<span class="r">${k.a}</span>`, k.b && `<span class="b">${k.b}</span>`]
    .filter(Boolean)
    .join('');
}

function bindPress(el, id) {
  const release = () => el.classList.remove('pressed');
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    navigator.vibrate?.(6);
    app.press(keyById[id]);
  });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}

function makeKey(k, extra = '') {
  const cell = document.createElement('div');
  cell.className = `cell cell-${k.id}`;
  const lbl = document.createElement('div');
  const html = labelHtml(k);
  lbl.className = `lbl${(html.match(/<span class="[grb]">/g) || []).length > 1 ? ' two' : ''}`;
  lbl.innerHTML = html;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `key ${k.kind || extra}`;
  btn.dataset.key = k.id;
  btn.setAttribute('aria-label', k.id);
  btn.innerHTML = k.face ? `<span class="face">${k.face}</span>` : '';
  bindPress(btn, k.id);
  cell.append(lbl, btn);
  return cell;
}

function dpad() {
  const C = [75, 50];
  const HW = 71;
  const HH = 46;
  const v = (s) => ({
    T: [C[0], C[1] - HH * s], R: [C[0] + HW * s, C[1]], B: [C[0], C[1] + HH * s], L: [C[0] - HW * s, C[1]],
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const o = v(0.96);
  const i = v(0.4);
  const em = (p) => ({ TR: mid(p.T, p.R), RB: mid(p.R, p.B), BL: mid(p.B, p.L), LT: mid(p.L, p.T) });
  const om = em(o);
  const im = em(i);
  const path = (pts) => `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L')}Z`;
  const segs = {
    up: [om.LT, o.T, om.TR, im.TR, i.T, im.LT],
    right: [om.TR, o.R, om.RB, im.RB, i.R, im.TR],
    down: [om.RB, o.B, om.BL, im.BL, i.B, im.RB],
    left: [om.BL, o.L, om.LT, im.LT, i.L, im.BL],
  };
  const arrows = {
    up: [[75, 15], [70, 21], [80, 21]],
    down: [[75, 85], [70, 79], [80, 79]],
    left: [[16, 50], [23, 46], [23, 54]],
    right: [[134, 50], [127, 46], [127, 54]],
  };
  const full = v(1.04);
  const inner = v(0.36);
  return `<svg class="dpad" viewBox="0 0 150 100" aria-label="cursor keys">
    <defs>
      <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fbfbfc"/><stop offset=".45" stop-color="#c9cbd0"/><stop offset="1" stop-color="#7d8087"/>
      </linearGradient>
      <radialGradient id="hub" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#3a3c41"/><stop offset="1" stop-color="#0c0c0e"/></radialGradient>
    </defs>
    <path d="${path([full.T, full.R, full.B, full.L])}" fill="#0b0b0c" stroke="#0b0b0c" stroke-width="10" stroke-linejoin="round"/>
    ${Object.entries(segs).map(([id, pts]) => `<path class="seg" data-key="${id}" d="${path(pts)}" fill="url(#metal)" stroke="#111214" stroke-width="2.4" stroke-linejoin="round"/>`).join('')}
    ${Object.values(arrows).map((pts) => `<path d="${path(pts)}" fill="#5c5f66" pointer-events="none"/>`).join('')}
    <path d="${path([inner.T, inner.R, inner.B, inner.L])}" fill="url(#hub)" stroke="#000" stroke-width="3" stroke-linejoin="round" pointer-events="none"/>
  </svg>`;
}

function buildKeypad() {
  const top = $('#padTop');
  const [shift, alpha, menu, on] = TOP_KEYS.map((k) => makeKey(k, 'round'));
  const [optn, calc, integ, xvar] = ROW_B.map((k) => makeKey(k, 'fn'));
  const pad = document.createElement('div');
  pad.className = 'cell cell-dpad';
  pad.innerHTML = dpad();
  top.append(shift, alpha, pad, menu, on, optn, calc, integ, xvar);
  pad.querySelectorAll('.seg').forEach((seg) => bindPress(seg, seg.dataset.key));
  const fn = $('#padFn');
  FN_ROWS.flat().forEach((k) => fn.append(makeKey(k, 'fn')));
  const num = $('#padNum');
  NUM_ROWS.flat().forEach((k) => num.append(makeKey(k, 'num')));
}

function flash(id) {
  const el = document.querySelector(`[data-key="${id}"]`);
  if (!el) return;
  el.classList.add('pressed');
  setTimeout(() => el.classList.remove('pressed'), 110);
}

function bindKeyboard() {
  let shiftAlone = false;
  let altAlone = false;
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'Shift') {
      shiftAlone = true;
      return;
    }
    if (e.key === 'Alt') {
      altAlone = true;
      e.preventDefault();
      return;
    }
    shiftAlone = false;
    altAlone = false;
    if (e.ctrlKey || e.metaKey) return;
    const target = KEYBOARD[e.key];
    if (!target) return;
    e.preventDefault();
    if (target.startsWith('!')) {
      app.dispatch(target.slice(1));
      return;
    }
    flash(target);
    app.press(keyById[target]);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && shiftAlone) {
      flash('shift');
      app.press(keyById.shift);
    }
    if (e.key === 'Alt' && altAlone) {
      flash('alpha');
      app.press(keyById.alpha);
    }
    shiftAlone = altAlone = false;
  });
}

function fit() {
  const stage = $('#stage');
  const calcEl = $('#calc');
  calcEl.style.transform = 'none';
  const w = calcEl.offsetWidth;
  const h = calcEl.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const byWidth = (vw - 16) / w;
  const byHeight = (vh - 24) / h;
  const s = Math.min(1.25, byWidth, vw < 600 ? Math.max(byHeight, byWidth * 0.9) : byHeight);
  calcEl.style.transform = `scale(${s})`;
  stage.style.width = `${w * s}px`;
  stage.style.height = `${h * s}px`;
  app?.lcd.resize();
  if (app) app.dirty = true;
}

function bindHelp() {
  const panel = $('#help');
  $('#helpBtn').addEventListener('click', () => panel.toggleAttribute('open'));
  $('#helpClose').addEventListener('click', () => panel.removeAttribute('open'));
}

async function start() {
  buildKeypad();
  const canvas = $('#lcd');
  const lcd = new LCD(canvas);
  app = new App(lcd, MODES, {
    onContrast: (c) => {
      canvas.style.filter = `contrast(${1 + c * 0.09}) brightness(${1 - c * 0.025})`;
    },
  });
  fit();
  window.addEventListener('resize', fit);
  bindKeyboard();
  bindHelp();
  try {
    await document.fonts.ready;
  } catch {
    /* fonts unavailable */
  }
  app.dirty = true;
  window.calculator = app;
  window.pressKey = (id) => app.press(keyById[id]);
}

start();
