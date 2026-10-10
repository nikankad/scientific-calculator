// 1: Calculate — natural-display scientific calculator.
import { parse, evaluate, collectVars, CalcError, divRem } from '../math/engine.js';
import { solve } from '../math/numeric.js';
import { decimalLayout, exactInfo, exactLayout, dmsLayout, factorLayout, formatPlain } from '../math/format.js';
import { LineEditor } from '../editor.js';
import { tokenFor, ANS_PREFIX, editKey } from '../tokens.js';
import { W, H, TOP } from '../lcd.js';
import { ListScreen, drawError } from '../ui/screens.js';

const optnItems = (insert) => {
  const group = (label, actions) => ({
    label,
    sub: actions.map(([text, a]) => ({ label: text, action: () => insert(tokenFor(a)) })),
  });
  return [
    group('Hyperbolic Func', [['sinh', 'sinh'], ['cosh', 'cosh'], ['tanh', 'tanh'], ['sinh⁻¹', 'asinh'], ['cosh⁻¹', 'acosh'], ['tanh⁻¹', 'atanh']]),
    group('Angle Unit', [['° (degree)', 'degm'], ['ʳ (radian)', 'radm'], ['ᵍ (gradian)', 'gradm']]),
    group('Numerical Calc', [['∫(f(x),a,b)', 'integ'], ['d/dx(f(x),a)', 'deriv'], ['Σ(f(x),a,b)', 'sum'], ['Π(f(x),a,b)', 'prod']]),
    group('Probability', [['nPr', 'nPr'], ['nCr', 'nCr'], ['x!', 'fact'], ['Ran#', 'Ran#'], ['RanInt(a,b)', 'RanInt']]),
    group('Numeric Func', [['Abs(', 'Abs'], ['Int(', 'Int'], ['Intg(', 'Intg'], ['Rnd(', 'Rnd'], ['RndFix(x,n)', 'RndFix'], ['GCD(a,b)', 'GCD'], ['LCM(a,b)', 'LCM'], ['Pol(x,y)', 'Pol'], ['Rec(r,θ)', 'Rec']]),
  ];
};

export class CalcMode {
  static title = 'Calculate';
  static icon = 'calc';
  static tag = 'MATH';

  constructor(app) {
    this.app = app;
    const saved = app.store.calc || {};
    this.ed = new LineEditor(saved.tokens || []);
    this.history = (saved.history || []).map((h) => ({ tokens: h.tokens, result: null }));
    this.result = null;
    this.hIndex = -1;
    this.error = null;
    this.prompt = null;
  }

  persist() {
    this.app.store.calc = {
      tokens: this.ed.tokens,
      history: this.history.slice(0, 20).map((h) => ({ tokens: h.tokens })),
    };
  }

  status() {
    const canUp = this.history.length > 0 && (this.result || this.ed.empty || this.hIndex >= 0) && this.hIndex < this.history.length - 1;
    return { up: !this.prompt && !this.error && canUp, down: !this.prompt && this.hIndex > 0 };
  }

  // ---------- input ----------

  insertToken(tok, action = null) {
    if (this.prompt) {
      this.prompt.ed.put(tok);
      return;
    }
    if (this.result) {
      this.result = null;
      this.ed.clear();
      if (action && ANS_PREFIX.has(action)) this.ed.put(tokenFor('Ans'));
    }
    this.hIndex = -1;
    this.ed.put(tok);
  }

  onKey(a) {
    if (this.error) return this.errorKey(a);
    if (this.prompt) return this.promptKey(a);
    switch (a) {
      case 'AC':
        this.ed.clear();
        this.result = null;
        this.hIndex = -1;
        return;
      case '=':
        if (this.result?.solve) return this.startSolve();
        return this.exec();
      case '≈':
        return this.exec({ decimal: true });
      case 'DEL':
        if (this.result) {
          this.result = null;
          this.ed.end();
          return;
        }
        this.ed.del();
        return;
      case 'LEFT':
      case 'RIGHT':
        if (this.result) {
          this.result = null;
          this.ed.cursor = a === 'LEFT' ? this.ed.tokens.length : 0;
          return;
        }
        editKey(this.ed, a);
        return;
      case 'INS':
      case 'UNDO':
        this.result = null;
        editKey(this.ed, a);
        return;
      case 'UP':
      case 'DOWN':
        if (!this.result && this.ed.slotNav(a)) return;
        return this.historyNav(a);
      case 'SD':
        return this.toggleSD();
      case 'mixed':
        if (this.result?.info) this.result.mixed = !this.result.mixed;
        return;
      case 'ENG':
      case 'ENGL':
        if (!this.result && !this.ed.empty) this.exec();
        if (this.result && !this.result.pairs) {
          const r = this.result;
          if (a === 'ENG') r.eng = r.eng === null ? 0 : Math.min(r.eng + 1, 3);
          else r.eng = r.eng === null ? -1 : Math.max(r.eng - 1, -3);
        }
        return;
      case 'FACT':
        if (this.result && Number.isInteger(this.result.value) && this.result.value > 1) this.result.fact = !this.result.fact;
        else if (this.result) this.app.toast('Math ERROR');
        return;
      case 'dms':
        if (this.result) {
          this.result.dms = !this.result.dms;
          return;
        }
        break;
      case 'M+':
      case 'M-':
        return this.memory(a);
      case 'CALC':
        return this.startCalc();
      case 'SOLVE':
        return this.startSolve();
      case 'OPTN':
        return this.options();
      default:
        break;
    }
    const tok = tokenFor(a);
    if (tok) this.insertToken(tok, a);
  }

  errorKey(a) {
    if (a === 'AC') {
      this.error = null;
      this.ed.clear();
      this.result = null;
    } else if (a === 'LEFT' || a === 'RIGHT') {
      this.ed.cursor = this.ed.indexOfPos(this.error.pos);
      this.error = null;
      this.result = null;
    }
  }

  historyNav(a) {
    if (!this.history.length) return;
    if (!(this.result || this.ed.empty || this.hIndex >= 0)) return;
    let i = this.hIndex;
    if (a === 'UP') i = Math.min(i + 1, this.history.length - 1);
    else if (i > 0) i--;
    else return;
    this.hIndex = i;
    const h = this.history[i];
    this.ed.set(h.tokens);
    if (!h.result) {
      try {
        h.result = this.makeResult(evaluate(parse(this.ed.text()), this.app.ctx({ vars: { ...this.app.vars } })), this.ed.text());
      } catch {
        h.result = null;
      }
    }
    this.result = h.result ? { ...h.result } : null;
  }

  // ---------- evaluation ----------

  makeResult(value, src, { decimal = false, pairs = null } = {}) {
    const angle = this.app.settings.angle;
    const flags = {
      pi: /π/.test(src) || (angle === 'rad' && /a(sin|cos|tan)\(/.test(src)),
      surd: /sqrt\(|root\(|cbrt\(|sin\(|cos\(|tan\(|\^/.test(src),
    };
    const info = decimal || pairs ? null : exactInfo(value, flags);
    return { value, info, view: 'exact', mixed: false, eng: null, dms: false, fact: false, pairs };
  }

  exec({ decimal = false } = {}) {
    const src = this.ed.text();
    if (!src.trim()) return;
    const ctx = this.app.ctx();
    try {
      const ast = parse(src);
      const last = ast.body[ast.body.length - 1];
      if (last.type === 'eq') throw new CalcError('Syntax', last.pos);
      const value = evaluate(ast, ctx);
      let pairs = null;
      if (last.type === 'call' && last.name === 'Pol') pairs = [['r=', this.app.vars.X], ['θ=', this.app.vars.Y]];
      if (last.type === 'call' && last.name === 'Rec') pairs = [['x=', this.app.vars.X], ['y=', this.app.vars.Y]];
      if (last.type === 'bin' && last.op === 'rem') {
        const [q, r] = divRem(evaluate(last.l, ctx), evaluate(last.r, ctx));
        pairs = [['Q=', q], ['R=', r]];
      }
      this.app.vars.Ans = value;
      this.result = this.makeResult(value, src, { decimal, pairs });
      this.history.unshift({ tokens: this.ed.tokens.slice(), result: { ...this.result } });
      this.history.length = Math.min(this.history.length, 30);
      this.hIndex = -1;
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      this.error = e;
    }
  }

  toggleSD() {
    const r = this.result;
    if (!r || r.pairs) return;
    if (!r.info) {
      r.info = exactInfo(r.value, { pi: true, surd: true });
      if (r.info) {
        r.view = 'exact';
        return;
      }
    }
    if (r.info) r.view = r.view === 'exact' ? 'dec' : 'exact';
    r.eng = null;
  }

  currentValue() {
    if (this.result) return this.result.value;
    if (this.ed.empty) return this.app.vars.Ans;
    this.exec();
    return this.result ? this.result.value : null;
  }

  memory(a) {
    const v = this.currentValue();
    if (v === null) return;
    this.app.vars.M += a === 'M+' ? v : -v;
    this.app.toast(`M = ${formatPlain(this.app.vars.M, this.app.settings.format)}`);
  }

  storeValue(name) {
    const v = this.currentValue();
    if (v === null) return;
    this.app.vars[name] = v;
    this.app.toast(`${formatPlain(v, this.app.settings.format)} → ${name}`);
  }

  options() {
    const items = optnItems((tok) => this.insertToken(tok));
    this.app.push(new ListScreen(this.app, {
      title: 'OPTN',
      items: items.map((g) => ({
        label: g.label,
        action: () => this.app.push(new ListScreen(this.app, { title: g.label, items: g.sub })),
      })),
    }));
  }

  // ---------- CALC / SOLVE prompts ----------

  parseOrError() {
    const src = this.ed.text();
    if (!src.trim()) return null;
    try {
      return parse(src);
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      this.error = e;
      return null;
    }
  }

  startCalc() {
    this.result = null;
    const ast = this.parseOrError();
    if (!ast) return;
    const vars = collectVars(ast);
    if (!vars.length) return this.exec();
    this.prompt = { kind: 'calc', vars, i: 0, ed: new LineEditor(), ast };
  }

  startSolve() {
    this.result = null;
    const ast = this.parseOrError();
    if (!ast) return;
    const vars = collectVars(ast).filter((v) => v !== 'X');
    vars.push('X');
    this.prompt = { kind: 'solve', vars, i: 0, ed: new LineEditor(), ast };
  }

  promptKey(a) {
    const p = this.prompt;
    if (a === 'AC') {
      this.prompt = null;
      return;
    }
    if (a === 'UP' || a === 'DOWN') {
      p.i = (p.i + (a === 'UP' ? p.vars.length - 1 : 1)) % p.vars.length;
      p.ed = new LineEditor();
      return;
    }
    if (a !== '=') {
      editKey(p.ed, a);
      return;
    }
    const name = p.vars[p.i];
    if (!p.ed.empty) {
      try {
        this.app.vars[name] = evaluate(parse(p.ed.text()), this.app.ctx());
      } catch (e) {
        if (!(e instanceof CalcError)) throw e;
        this.app.toast(`${e.kind} ERROR`);
        return;
      }
    }
    p.i++;
    p.ed = new LineEditor();
    if (p.i < p.vars.length) return;
    this.prompt = null;
    if (p.kind === 'calc') return this.exec();
    this.runSolve(p.ast);
  }

  runSolve(ast) {
    const ctx = this.app.ctx();
    const f = (x) => evaluate(ast, { ...ctx, vars: { ...ctx.vars }, local: { X: x } });
    const root = solve(f, this.app.vars.X);
    if (root === null) {
      this.error = new CalcError("Can't Solve");
      return;
    }
    let lr = 0;
    try {
      lr = f(root);
    } catch {
      lr = 0;
    }
    const x = Math.abs(root) < 1e-13 ? 0 : root;
    this.app.vars.X = x;
    this.result = { ...this.makeResult(x, '', { pairs: [['x=', x], ['L−R=', Math.abs(lr) < 1e-15 ? 0 : lr]] }), solve: true };
  }

  // ---------- rendering ----------

  resultLayout(r) {
    const s = this.app.settings;
    if (r.fact) return factorLayout(r.value) || decimalLayout(r.value, s.format);
    if (r.dms) return dmsLayout(r.value);
    if (r.eng !== null) return decimalLayout(r.value, s.format, r.eng);
    if (r.info && r.view === 'exact') return exactLayout(r.info, r.mixed !== (s.frac === 'mixed'));
    return decimalLayout(r.value, s.format);
  }

  render(lcd) {
    if (this.error) return drawError(lcd, this.error.kind);
    if (this.prompt) return this.renderPrompt(lcd);
    const r = this.result;
    lcd.editor(this.ed, 4, TOP + 17, W - 10, { size: 15, lines: r ? (r.pairs ? 1 : 2) : 4, cursor: !r && this.app.blink });
    if (!r) return;
    if (r.pairs) {
      r.pairs.forEach(([label, v], i) => {
        const y = 86 + i * 26;
        lcd.text(label, 6, y, { size: 15, weight: 600 });
        lcd.drawFit(decimalLayout(v, this.app.settings.format), W - 4, y + 4, W - 60, [18, 15, 12]);
      });
      return;
    }
    lcd.drawFit(this.resultLayout(r), W - 4, H - 5, W - 10);
  }

  renderPrompt(lcd) {
    const p = this.prompt;
    const name = p.vars[p.i];
    lcd.fitText(this.ed.display(), 4, TOP + 14, W - 8, { size: 11 });
    if (p.kind === 'solve' && name === 'X') lcd.text('Solve for x', 4, TOP + 34, { size: 12, weight: 600 });
    const y = 98;
    const label = `${name === 'X' ? 'x' : name}=`;
    const lw = lcd.text(label, 6, y, { size: 16, weight: 600 });
    if (p.ed.empty) {
      lcd.drawFit(decimalLayout(this.app.vars[name] ?? 0, this.app.settings.format), W - 6, y + 3, W - 30 - lw, [18, 15]);
      if (this.app.blink) lcd.fill(lw + 9, y - 13, 1.6, 15);
    } else {
      lcd.editor(p.ed, lw + 10, y, W - lw - 20, { size: 16, cursor: this.app.blink });
    }
    lcd.text(`${p.i + 1}/${p.vars.length}  [=]:Next  [▲▼]`, W / 2, H - 4, { size: 9, align: 'center' });
  }
}
