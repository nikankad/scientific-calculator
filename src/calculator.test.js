import { describe, expect, it } from 'vitest'
import { evaluateExpression, formatResult, toFraction } from './calculator'

describe('scientific expression engine', () => {
  it('respects operator precedence', () => expect(evaluateExpression('2+3×4')).toBe(14))
  it('supports implicit multiplication', () => expect(evaluateExpression('2(9+3)')).toBe(24))
  it('evaluates degrees', () => expect(evaluateExpression('sin(30)', { angle: 'DEG' })).toBeCloseTo(.5))
  it('evaluates powers and roots', () => expect(evaluateExpression('√(144)+5²')).toBe(37))
  it('supports combinations', () => expect(evaluateExpression('10nCr3')).toBe(120))
  it('supports answer recall', () => expect(evaluateExpression('Ans×2', { ans: 7 })).toBe(14))
  it('formats fractions', () => expect(toFraction(1 / 3)).toBe('1/3'))
  it('formats normal values', () => expect(formatResult(12.5)).toBe('12.5'))
})
