import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, parse, collectVars, CalcError } from '../site/js/math/engine.js';

const ctx = (extra = {}) => ({ vars: { A: 2, B: 3, X: 4, Ans: 10 }, angle: 'deg', random: () => 0.5, ...extra });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('basic arithmetic and precedence', () => {
  assert.equal(calculate('1+2*3', ctx()), 7);
  assert.equal(calculate('(1+2)*3', ctx()), 9);
  assert.equal(calculate('2^3^2', ctx()), 512);
  assert.equal(calculate('-2²', ctx()), -4);
  assert.equal(calculate('2^-1', ctx()), 0.5);
  assert.equal(calculate('10−4−3', ctx()), 3);
  assert.equal(calculate('8÷4÷2', ctx()), 1);
});

test('implied multiplication binds tighter than division', () => {
  close(calculate('1/2π', ctx()), 1 / (2 * Math.PI));
  assert.equal(calculate('2A', ctx()), 4);
  assert.equal(calculate('2(3+1)', ctx()), 8);
  assert.equal(calculate('AB', ctx()), 6);
  assert.equal(calculate('3x', ctx()), 12);
});

test('postfix and functions', () => {
  assert.equal(calculate('5!', ctx()), 120);
  assert.equal(calculate('4⁻¹', ctx()), 0.25);
  assert.equal(calculate('3³', ctx()), 27);
  assert.equal(calculate('50%', ctx()), 0.5);
  assert.equal(calculate('sqrt(16', ctx()), 4);
  assert.equal(calculate('cbrt(-27)', ctx()), -3);
  assert.equal(calculate('root(3,8)', ctx()), 2);
  assert.equal(calculate('log(100)', ctx()), 2);
  assert.equal(calculate('log(2,8)', ctx()), 3);
  close(calculate('ln(ℯ)', ctx()), 1);
  assert.equal(calculate('abs(-3)', ctx()), 3);
  assert.equal(calculate('Int(-2.5)', ctx()), -2);
  assert.equal(calculate('Intg(-2.5)', ctx()), -3);
  assert.equal(calculate('GCD(12,18)', ctx()), 6);
  assert.equal(calculate('LCM(4,6)', ctx()), 12);
  assert.equal(calculate('5nPr2', ctx()), 20);
  assert.equal(calculate('5nCr2', ctx()), 10);
  assert.equal(calculate('2ᴇ3', ctx()), 2000);
  assert.equal(calculate('ᴇ-2', ctx()), 0.01);
  assert.equal(calculate('(-8)^(1⁄3)', ctx()), -2);
});

test('trigonometry respects angle unit and exact quarter turns', () => {
  assert.equal(calculate('sin(30)', ctx()), 0.49999999999999994);
  assert.equal(calculate('sin(180)', ctx()), 0);
  assert.equal(calculate('cos(90)', ctx()), 0);
  assert.throws(() => calculate('tan(90)', ctx()), CalcError);
  close(calculate('sin(π/2)', ctx({ angle: 'rad' })), 1);
  assert.equal(calculate('sin(π)', ctx({ angle: 'rad' })), 0);
  close(calculate('asin(1)', ctx()), 90);
  close(calculate('sin(90°)', ctx({ angle: 'rad' })), 1);
  close(calculate('cos(100)', ctx({ angle: 'grad' })), 0);
});

test('calculus helpers', () => {
  close(calculate('integ(x²,0,3)', ctx()), 9);
  close(calculate('integ(sin(x),0,π)', ctx({ angle: 'rad' })), 2);
  close(calculate('deriv(x³,2)', ctx()), 12, 1e-7);
  assert.equal(calculate('sum(x,1,100)', ctx()), 5050);
  assert.equal(calculate('prod(x,1,5)', ctx()), 120);
});

test('multi statements, Ans, constants and conversions', () => {
  const c = ctx();
  assert.equal(calculate('Ans+1', c), 11);
  assert.equal(calculate('3:Ans×2', c), 6);
  close(calculate('[c0]', c), 299792458);
  close(calculate('1{in>cm}', c), 2.54);
  close(calculate('212{F>C}', c), 100);
  assert.equal(calculate('Ran#', c), 0.5);
});

test('Pol/Rec store into X and Y', () => {
  const c = ctx();
  close(calculate('Pol(3,4)', c), 5);
  close(c.vars.Y, Math.atan2(4, 3) * 180 / Math.PI);
  close(calculate('Rec(2,90)', c), 0);
  close(c.vars.Y, 2);
});

test('errors carry kind and position', () => {
  assert.throws(() => calculate('1÷0', ctx()), (e) => e.kind === 'Math');
  assert.throws(() => calculate('sqrt(-1)', ctx()), (e) => e.kind === 'Math');
  assert.throws(() => calculate('2++', ctx()), (e) => e.kind === 'Syntax' && e.pos === 3);
  assert.throws(() => calculate('1.2.3', ctx()), (e) => e.kind === 'Syntax');
  assert.throws(() => calculate(')', ctx()), (e) => e.kind === 'Syntax' && e.pos === 0);
  assert.throws(() => calculate('171!', ctx()), (e) => e.kind === 'Math');
  assert.throws(() => calculate('10^(100)', ctx()), (e) => e.kind === 'Math');
});

test('collectVars lists free variables in order', () => {
  assert.deepEqual(collectVars(parse('B+A×2+Ans')), ['B', 'A']);
  assert.deepEqual(collectVars(parse('integ(x+A,0,B)')), ['A', 'B']);
  assert.deepEqual(collectVars(parse('x²−A=0')), ['X', 'A']);
});
