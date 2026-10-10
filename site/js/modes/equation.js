// 5: Equation — polynomial roots (degree 2–4) and linear systems (2–3 unknowns).
import { polyRoots, solveLinear } from '../math/numeric.js';
import { formatPlain } from '../math/format.js';
import { ListScreen, FormScreen, ValuesScreen, TextScreen } from '../ui/screens.js';

const SUB = ['₁', '₂', '₃'];

const TYPES = [
  { label: 'ax²+bx+c=0', kind: 'poly', deg: 2, defaults: [1, -3, 2] },
  { label: 'ax³+bx²+cx+d=0', kind: 'poly', deg: 3, defaults: [1, -6, 11, -6] },
  { label: 'ax⁴+bx³+cx²+dx+e=0', kind: 'poly', deg: 4, defaults: [1, 0, -5, 0, 4] },
  { label: '2 Unknowns', title: 'a₁x+b₁y=c₁', kind: 'lin', n: 2, defaults: [1, 1, 3, 1, -1, 1] },
  { label: '3 Unknowns', title: 'a₁x+b₁y+c₁z=d₁', kind: 'lin', n: 3, defaults: [2, 1, -1, 8, -3, -1, 2, -11, -2, 1, 2, -3] },
];

function complexText(z, fmt) {
  const f = (v) => formatPlain(v, fmt, 9);
  if (z.im === 0) return null;
  const re = z.re === 0 ? '' : f(z.re);
  const sign = z.im < 0 ? '−' : re ? '+' : '';
  return `${re}${sign}${f(Math.abs(z.im))}i`;
}

export class EquationMode extends ListScreen {
  static title = 'Equation';
  static icon = 'eqn';
  static tag = 'EQN';

  constructor(app) {
    super(app, {
      title: 'EQUATION TYPE',
      root: true,
      items: TYPES.map((t) => ({ label: t.label, type: t })),
      onSelect: (item) => this.open(item.type),
    });
    this.forms = {};
  }

  open(type) {
    const key = type.label;
    if (!this.forms[key]) {
      const fields = [];
      if (type.kind === 'poly') {
        for (let i = 0; i <= type.deg; i++) {
          const name = 'abcde'[i];
          fields.push({ key: name, label: `${name}=`, kind: 'num', value: type.defaults[i] });
        }
      } else {
        const letters = type.n === 2 ? 'abc' : 'abcd';
        for (let r = 0; r < type.n; r++) {
          for (let c = 0; c < letters.length; c++) {
            fields.push({ key: `${r}${c}`, label: `${letters[c]}${SUB[r]}=`, kind: 'num', value: type.defaults[r * letters.length + c] });
          }
        }
      }
      this.forms[key] = new FormScreen(this.app, {
        title: type.title || type.label,
        fields,
        hint: '[=] Next / Solve   [AC] Back',
        onSubmit: (vals) => this.solve(type, vals),
      });
    }
    this.app.push(this.forms[key]);
  }

  solve(type, vals) {
    const app = this.app;
    const fmt = app.settings.format;
    if (type.kind === 'poly') {
      const coef = 'abcde'.slice(0, type.deg + 1).split('').map((k) => vals[k]);
      if (coef[0] === 0) {
        app.toast('a must be ≠ 0');
        return;
      }
      const roots = polyRoots(coef);
      const rows = roots.map((z, i) => ({ label: `x${SUB[i] ?? i + 1}=`, value: complexText(z, fmt) ?? z.re }));
      if (type.deg === 2) {
        const [a, b, c] = coef;
        const vx = -b / (2 * a);
        rows.push({ label: a > 0 ? 'x-Min=' : 'x-Max=', value: vx });
        rows.push({ label: a > 0 ? 'y-Min=' : 'y-Max=', value: c - (b * b) / (4 * a) });
      }
      app.push(new ValuesScreen(app, { title: type.label, rows, flags: { surd: true }, hint: '[▲▼] Scroll   [AC] Back' }));
      return;
    }
    const n = type.n;
    const A = [];
    const b = [];
    for (let r = 0; r < n; r++) {
      A.push(Array.from({ length: n }, (_, c) => vals[`${r}${c}`]));
      b.push(vals[`${r}${n}`]);
    }
    const res = solveLinear(A, b);
    if (res.kind !== 'unique') {
      app.push(new TextScreen(app, {
        lines: [{ s: res.kind === 'none' ? 'No Solution' : 'Infinite Solution', size: 16, weight: 700, align: 'center', gap: 30 }],
        hint: '[AC] Back',
      }));
      return;
    }
    app.push(new ValuesScreen(app, {
      title: type.label,
      rows: res.x.map((v, i) => ({ label: `${'xyz'[i]}=`, value: v })),
      flags: { surd: true },
      hint: '[AC] Back',
    }));
  }
}
