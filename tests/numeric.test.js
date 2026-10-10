import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, toFraction, polyRoots, solveLinear, oneVar, linReg, lnGamma } from '../site/js/math/numeric.js';
import { decimalParts, exactInfo, formatPlain } from '../site/js/math/format.js';
import { evalBaseN, formatBase } from '../site/js/math/basen.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('solve finds roots', () => {
  close(solve((x) => x * x - 2, 1), Math.SQRT2);
  close(solve((x) => Math.cos(x) - x, 0), 0.7390851332151607);
  close(solve((x) => x ** 3 - 8, -50), 2);
  assert.equal(solve((x) => x * x + 1, 0), null);
});

test('toFraction', () => {
  assert.deepEqual(toFraction(0.75), [3, 4]);
  assert.deepEqual(toFraction(-1 / 3), [-1, 3]);
  assert.equal(toFraction(Math.PI), null);
});

test('polynomial roots', () => {
  const r = polyRoots([1, -3, 2]);
  assert.deepEqual(r.map((z) => z.re), [2, 1]);
  const c = polyRoots([1, 0, 1]);
  assert.equal(c[0].re, 0);
  close(Math.abs(c[0].im), 1);
  const cubic = polyRoots([1, -6, 11, -6]).map((z) => z.re);
  [3, 2, 1].forEach((v, i) => close(cubic[i], v));
  const triple = polyRoots([1, -3, 3, -1]);
  triple.forEach((z) => { close(z.re, 1); assert.equal(z.im, 0); });
  const quartic = polyRoots([1, 0, -5, 0, 4]).map((z) => z.re);
  [2, 1, -1, -2].forEach((v, i) => close(quartic[i], v, 1e-8));
});

test('linear systems', () => {
  const s = solveLinear([[1, 1], [1, -1]], [3, 1]);
  assert.equal(s.kind, 'unique');
  close(s.x[0], 2); close(s.x[1], 1);
  assert.equal(solveLinear([[1, 1], [2, 2]], [1, 3]).kind, 'none');
  assert.equal(solveLinear([[1, 1], [2, 2]], [1, 2]).kind, 'infinite');
});

test('statistics', () => {
  const s = oneVar([1, 2, 3, 4, 5, 6]);
  assert.equal(s.mean, 3.5);
  assert.equal(s.med, 3.5);
  assert.equal(s.q1, 2);
  assert.equal(s.q3, 5);
  const r = linReg([1, 2, 3], [2, 4, 6]);
  close(r.b, 2); close(r.a, 0); close(r.r, 1);
  close(lnGamma(6), Math.log(120));
});

test('display formatting', () => {
  assert.deepEqual(decimalParts(0.1 + 0.2), { m: '0.3', e: null });
  assert.deepEqual(decimalParts(1 / 3), { m: '0.3333333333', e: null });
  assert.deepEqual(decimalParts(1e12), { m: '1', e: 12 });
  assert.deepEqual(decimalParts(1234, { mode: 'fix', digits: 2 }), { m: '1234.00', e: null });
  assert.deepEqual(decimalParts(1234, undefined, 0), { m: '1.234', e: 3 });
  assert.deepEqual(decimalParts(1234, undefined, 1), { m: '1234', e: 0 });
  assert.equal(formatPlain(-2.5e-12), '−2.5×10⁻¹²');
  assert.deepEqual(exactInfo(0.75), { kind: 'frac', n: 3, d: 4 });
  assert.deepEqual(exactInfo(Math.PI / 6, { pi: true }), { kind: 'pi', n: 1, d: 6 });
  assert.deepEqual(exactInfo(Math.SQRT2 / 2, { surd: true }), { kind: 'surd', n: 1, d: 2, r: 2 });
  assert.equal(exactInfo(Math.PI), null);
  assert.equal(exactInfo(3), null);
});

test('base-n', () => {
  assert.equal(evalBaseN('FF+1', 16), 256);
  assert.equal(evalBaseN('1010and0110', 2), 2);
  assert.equal(evalBaseN('Not(0)', 10), -1);
  assert.equal(formatBase(-1, 16), 'FFFFFFFF');
  assert.equal(evalBaseN('ʰA×ᵇ11', 10), 30);
  assert.equal(evalBaseN('7FFFFFFF+1', 16), -2147483648);
  assert.throws(() => evalBaseN('12', 2), (e) => e.kind === 'Syntax');
  assert.throws(() => evalBaseN('1/0', 10), (e) => e.kind === 'Math');
});
