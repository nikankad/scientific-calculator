// Keypad layout. `s` = SHIFT label (gold), `a` = ALPHA label (red),
// `b` = Base-N label (blue). main/shift/alpha/base are the dispatched actions.

const bx = '<span class="bx"></span>';
const sbx = '<span class="bx sm"></span>';
const x = '<em>x</em>';

export const TOP_KEYS = [
  { id: 'shift', kind: 'round', top: '<span class="g">SHIFT</span>', main: 'SHIFT' },
  { id: 'alpha', kind: 'round', top: '<span class="r">ALPHA</span>', main: 'ALPHA' },
  { id: 'menu', kind: 'round', top: '<span>MENU</span> <span class="g">SETUP</span>', main: 'MENU', shift: 'SETUP' },
  { id: 'on', kind: 'round', top: '<span>ON</span>', main: 'ON' },
];

export const ROW_B = [
  { id: 'optn', face: 'OPTN', s: 'QR', main: 'OPTN', shift: 'QR' },
  { id: 'calc', face: 'CALC', s: 'SOLVE', a: '=', main: 'CALC', shift: 'SOLVE', alpha: 'eqsign' },
  { id: 'integ', face: `<span class="int">∫</span>${sbx}<span class="lim"><i></i><i></i></span>`, s: `<span class="frac-l">d/d${x}</span>`, a: ':', main: 'integ', shift: 'deriv', alpha: ':' },
  { id: 'xvar', face: `<em class="big">x</em>`, s: 'Σ', a: 'Π', main: 'x', shift: 'sum', alpha: 'prod' },
];

export const FN_ROWS = [
  [
    { id: 'frac', face: `<span class="frac">${sbx}<i></i>${sbx}</span>`, s: 'a b/c', a: '÷R', main: 'frac', shift: 'mixed', alpha: 'divR' },
    { id: 'sqrt', face: `√${bx}`, s: `∛${sbx}`, main: 'sqrt', shift: 'cbrt' },
    { id: 'sq', face: `${x}<sup>2</sup>`, s: `${x}<sup>3</sup>`, b: 'DEC', main: 'sq', shift: 'cube', base: 'DEC' },
    { id: 'pow', face: `${x}<sup>${sbx}</sup>`, s: `<sup>${sbx}</sup>√${sbx}`, b: 'HEX', main: 'pow', shift: 'root', base: 'HEX' },
    { id: 'logab', face: `log<sub>${sbx}</sub>${bx}`, s: `10<sup>${sbx}</sup>`, b: 'BIN', main: 'logab', shift: 'pow10', base: 'BIN' },
    { id: 'ln', face: 'ln', s: `e<sup>${sbx}</sup>`, b: 'OCT', main: 'ln', shift: 'exp', base: 'OCT' },
  ],
  [
    { id: 'neg', face: '(−)', s: 'log', a: 'A', main: 'neg', shift: 'log', alpha: 'A' },
    { id: 'dms', face: '° ′ ″', s: 'FACT', a: 'B', main: 'dms', shift: 'FACT', alpha: 'B' },
    { id: 'inv', face: `${x}<sup>−1</sup>`, s: `${x}!`, a: 'C', main: 'inv', shift: 'fact', alpha: 'C' },
    { id: 'sin', face: 'sin', s: 'sin⁻¹', a: 'D', main: 'sin', shift: 'asin', alpha: 'D' },
    { id: 'cos', face: 'cos', s: 'cos⁻¹', a: 'E', main: 'cos', shift: 'acos', alpha: 'E' },
    { id: 'tan', face: 'tan', s: 'tan⁻¹', a: 'F', main: 'tan', shift: 'atan', alpha: 'F' },
  ],
  [
    { id: 'sto', face: 'STO', s: 'RECALL', main: 'STO', shift: 'RECALL' },
    { id: 'eng', face: 'ENG', s: '←', main: 'ENG', shift: 'ENGL' },
    { id: 'lp', face: '(', s: 'Abs', main: '(', shift: 'Abs' },
    { id: 'rp', face: ')', s: ',', a: 'X', main: ')', shift: ',', alpha: 'X' },
    { id: 'sd', face: 'S⇔D', s: 'a<small>b/c</small>⇔<small>d/c</small>', a: 'Y', main: 'SD', shift: 'mixed', alpha: 'Y' },
    { id: 'mplus', face: 'M+', s: 'M−', a: 'M', main: 'M+', shift: 'M-', alpha: 'M' },
  ],
];

export const NUM_ROWS = [
  [
    { id: '7', face: '7', s: 'CONST', main: '7', shift: 'CONST' },
    { id: '8', face: '8', s: 'CONV', main: '8', shift: 'CONV' },
    { id: '9', face: '9', s: 'RESET', main: '9', shift: 'RESET' },
    { id: 'del', face: 'DEL', kind: 'blue', s: 'INS', a: 'UNDO', main: 'DEL', shift: 'INS', alpha: 'UNDO' },
    { id: 'ac', face: 'AC', kind: 'blue', s: 'OFF', main: 'AC', shift: 'OFF' },
  ],
  [
    { id: '4', face: '4', main: '4' },
    { id: '5', face: '5', main: '5' },
    { id: '6', face: '6', main: '6' },
    { id: 'mul', face: '×', s: 'nPr', a: 'GCD', main: '*', shift: 'nPr', alpha: 'GCD' },
    { id: 'div', face: '÷', s: 'nCr', a: 'LCM', main: '/', shift: 'nCr', alpha: 'LCM' },
  ],
  [
    { id: '1', face: '1', main: '1' },
    { id: '2', face: '2', main: '2' },
    { id: '3', face: '3', main: '3' },
    { id: 'plus', face: '+', s: 'Pol', a: 'Int', main: '+', shift: 'Pol', alpha: 'Int' },
    { id: 'minus', face: '−', s: 'Rec', a: 'Intg', main: '-', shift: 'Rec', alpha: 'Intg' },
  ],
  [
    { id: '0', face: '0', s: 'Rnd', a: 'RndFix', main: '0', shift: 'Rnd', alpha: 'RndFix' },
    { id: 'dot', face: '.', s: 'Ran#', a: 'RanInt', main: '.', shift: 'Ran#', alpha: 'RanInt' },
    { id: 'exp10', face: `×10<sup>${x}</sup>`, s: 'π', a: 'e', main: 'exp10', shift: 'pi', alpha: 'e' },
    { id: 'ans', face: 'Ans', s: '%', main: 'Ans', shift: 'pct' },
    { id: 'eq', face: '=', s: '≈', main: '=', shift: '≈' },
  ],
];

export const DPAD = [
  { id: 'up', main: 'UP' },
  { id: 'right', main: 'RIGHT' },
  { id: 'down', main: 'DOWN' },
  { id: 'left', main: 'LEFT' },
];

// Physical keyboard → key id (or a direct action prefixed with "!").
export const KEYBOARD = {
  0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  '.': 'dot', ',': '!,', '+': 'plus', '-': 'minus', '*': 'mul', x: 'xvar', X: 'xvar', '/': 'div',
  '^': 'pow', '(': 'lp', ')': 'rp', Enter: 'eq', '=': 'eq', Backspace: 'del', Escape: 'ac', Delete: 'ac',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  s: 'sin', c: 'cos', t: 'tan', l: 'ln', g: 'logab', q: 'sqrt', r: 'sqrt', m: 'menu', o: 'optn', a: 'ans',
  p: '!pi', e: '!e', '!': '!fact', '%': '!pct', E: 'exp10',
};

export const ALL_KEYS = [...TOP_KEYS, ...ROW_B, ...FN_ROWS.flat(), ...NUM_ROWS.flat(), ...DPAD];
