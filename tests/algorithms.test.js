import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS, algorithmById, countOps, makeInput, measure, rng, PATTERNS } from '../site/js/algo/algorithms.js';
import { fitComplexity, masterTheorem, classifyGrowth, growthText, formatDuration, opsAt } from '../site/js/algo/bigo.js';
import { compileFn } from '../site/js/math/engine.js';

test('every sort sorts every pattern', () => {
  for (const alg of ALGORITHMS.filter((a) => a.kind === 'sort')) {
    for (const p of PATTERNS) {
      for (const n of [1, 2, 7, 64]) {
        const input = makeInput(n, p.id, rng(n));
        const { result } = countOps(alg, input);
        assert.deepEqual(result, [...input].sort((a, b) => a - b), `${alg.id} ${p.id} n=${n}`);
      }
    }
  }
});

test('searches find targets', () => {
  const a = makeInput(100, 'sorted');
  for (const id of ['linear', 'binary']) {
    const alg = algorithmById(id);
    const it = alg.gen([...a], 42);
    let r = it.next();
    while (!r.done) r = it.next();
    assert.equal(r.value, 41);
  }
});

const best = (id, pattern) => fitComplexity(measure(algorithmById(id), pattern))[0].cls.id;

test('empirical fitting recognises classic complexities', () => {
  assert.equal(best('bubble', 'random'), 'n2');
  assert.equal(best('bubble', 'sorted'), 'n');
  assert.equal(best('insertion', 'random'), 'n2');
  assert.equal(best('insertion', 'sorted'), 'n');
  assert.equal(best('selection', 'sorted'), 'n2');
  assert.equal(best('merge', 'random'), 'nlogn');
  assert.equal(best('heap', 'random'), 'nlogn');
  assert.equal(best('quick', 'random'), 'nlogn');
  assert.equal(best('quick', 'sorted'), 'n2');
  assert.equal(best('linear', 'random'), 'n');
  assert.equal(best('binary', 'random'), 'logn');
});

test('master theorem', () => {
  const m = masterTheorem(2, 2, 1);
  assert.equal(m.case, 2); assert.equal(growthText(m.p, m.k), 'n log n');
  const s = masterTheorem(7, 2, 2);
  assert.equal(s.case, 1); assert.equal(growthText(s.p, s.k), 'n²·⁸⁰⁷');
  const b = masterTheorem(1, 2, 0);
  assert.equal(growthText(b.p, b.k), 'log n');
  const c3 = masterTheorem(2, 2, 2);
  assert.equal(c3.case, 3); assert.equal(growthText(c3.p, c3.k), 'n²');
});

test('classifyGrowth', () => {
  const g = (src) => classifyGrowth(compileFn(src, { vars: {} }, 'n'));
  const txt = (r) => (r.kind === 'poly' ? growthText(r.p, r.k) : r.kind === 'exp' ? `${r.base}^n` : r.kind);
  assert.equal(txt(g('3n²+5n+7')), 'n²');
  assert.equal(txt(g('nlog(2,n)+n')), 'n log n');
  assert.equal(txt(g('ln(n)')), 'log n');
  assert.equal(txt(g('42')), '1');
  assert.equal(txt(g('sqrt(n)')), '√n');
  assert.equal(txt(g('n³ln(n)²')), 'n³ log² n');
  assert.equal(txt(g('2^n+n^1000')), 'error');
  assert.equal(txt(g('5×2^n+n²')), '2^n');
  assert.equal(txt(g('3^n')), '3^n');
  assert.equal(txt(g('n!')), 'fact');
});

test('duration formatting', () => {
  const at = Object.fromEntries(opsAt(1e6).map((r) => [r.cls.id, r.lg]));
  assert.equal(formatDuration(at.n), '1ms');
  assert.equal(formatDuration(at.n2), '16.7min');
  assert.equal(formatDuration(at['2n']), '≫universe');
});
