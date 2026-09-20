const FUNCTIONS = {
  sin: (x, angle) => Math.sin(toRadians(x, angle)),
  cos: (x, angle) => Math.cos(toRadians(x, angle)),
  tan: (x, angle) => Math.tan(toRadians(x, angle)),
  asin: (x, angle) => fromRadians(Math.asin(x), angle),
  acos: (x, angle) => fromRadians(Math.acos(x), angle),
  atan: (x, angle) => fromRadians(Math.atan(x), angle),
  log: Math.log10,
  ln: Math.log,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
}

function toRadians(value, unit) {
  if (unit === 'DEG') return (value * Math.PI) / 180
  if (unit === 'GRAD') return (value * Math.PI) / 200
  return value
}

function fromRadians(value, unit) {
  if (unit === 'DEG') return (value * 180) / Math.PI
  if (unit === 'GRAD') return (value * 200) / Math.PI
  return value
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error('Math ERROR')
  let result = 1
  for (let i = 2; i <= n; i += 1) result *= i
  return result
}

function combination(n, r) {
  if (![n, r].every(Number.isInteger) || n < 0 || r < 0 || r > n) throw new Error('Math ERROR')
  const k = Math.min(r, n - r)
  let result = 1
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i
  return result
}

function permutation(n, r) {
  if (![n, r].every(Number.isInteger) || n < 0 || r < 0 || r > n) throw new Error('Math ERROR')
  let result = 1
  for (let i = 0; i < r; i += 1) result *= n - i
  return result
}

function tokenize(input, ans = 0, memory = 0) {
  const text = input
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('−', '-')
    .replaceAll('²', '^2')
    .replaceAll('³', '^3')
    .replaceAll('√', 'sqrt')
    .replaceAll('π', 'pi')
    .replaceAll('Ans', `(${ans})`)
    .replaceAll('M', `(${memory})`)

  const tokens = []
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    const space = rest.match(/^\s+/)
    if (space) { i += space[0].length; continue }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/i)
    if (number) { tokens.push({ type: 'number', value: Number(number[0]) }); i += number[0].length; continue }
    const op = rest.match(/^(nCr|nPr|[+\-*/^%!,()])/i)
    if (op) { tokens.push({ type: 'op', value: op[0] }); i += op[0].length; continue }
    const name = rest.match(/^[A-Za-z]+/)
    if (name) { tokens.push({ type: 'name', value: name[0].toLowerCase() }); i += name[0].length; continue }
    throw new Error('Syntax ERROR')
  }
  return insertImplicitMultiplication(tokens)
}

function insertImplicitMultiplication(tokens) {
  const output = []
  const canEnd = (t) => t && (t.type === 'number' || (t.type === 'name' && !FUNCTIONS[t.value]) || (t.type === 'op' && [')', '!', '%'].includes(t.value)))
  const canStart = (t) => t && (t.type === 'number' || t.type === 'name' || (t.type === 'op' && t.value === '('))
  tokens.forEach((token, index) => {
    const previous = output.at(-1)
    if (canEnd(previous) && canStart(token)) output.push({ type: 'op', value: '*' })
    output.push(token)
  })
  return output
}

export function evaluateExpression(input, options = {}) {
  const { angle = 'DEG', ans = 0, memory = 0 } = options
  if (!input.trim()) return 0
  const tokens = tokenize(input, ans, memory)
  let position = 0
  const peek = () => tokens[position]
  const take = () => tokens[position++]

  function parsePrimary() {
    const token = take()
    if (!token) throw new Error('Syntax ERROR')
    if (token.type === 'number') return token.value
    if (token.type === 'op' && token.value === '(') {
      const value = parseAdditive()
      if (take()?.value !== ')') throw new Error('Syntax ERROR')
      return value
    }
    if (token.type === 'op' && token.value === '-') return -parsePrimary()
    if (token.type === 'op' && token.value === '+') return parsePrimary()
    if (token.type === 'name') {
      if (token.value === 'pi') return Math.PI
      if (token.value === 'e') return Math.E
      const fn = FUNCTIONS[token.value]
      if (!fn) throw new Error('Syntax ERROR')
      if (take()?.value !== '(') throw new Error('Syntax ERROR')
      const value = parseAdditive()
      if (take()?.value !== ')') throw new Error('Syntax ERROR')
      return fn(value, angle)
    }
    throw new Error('Syntax ERROR')
  }

  function parsePostfix() {
    let value = parsePrimary()
    while (peek()?.type === 'op' && ['!', '%'].includes(peek().value)) {
      const operator = take().value
      value = operator === '!' ? factorial(value) : value / 100
    }
    return value
  }

  function parsePower() {
    let value = parsePostfix()
    if (peek()?.value === '^') { take(); value **= parsePower() }
    return value
  }

  function parseProduct() {
    let value = parsePower()
    while (peek() && ['*', '/', 'nCr', 'nPr'].includes(peek().value)) {
      const operator = take().value
      const right = parsePower()
      if (operator === '*') value *= right
      if (operator === '/') value /= right
      if (operator.toLowerCase() === 'ncr') value = combination(value, right)
      if (operator.toLowerCase() === 'npr') value = permutation(value, right)
    }
    return value
  }

  function parseAdditive() {
    let value = parseProduct()
    while (peek() && ['+', '-'].includes(peek().value)) {
      const operator = take().value
      const right = parseProduct()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const result = parseAdditive()
  if (position !== tokens.length || Number.isNaN(result) || !Number.isFinite(result)) throw new Error('Math ERROR')
  return Object.is(result, -0) ? 0 : result
}

export function formatResult(value, notation = 'NORM') {
  if (!Number.isFinite(value)) return 'Math ERROR'
  if (notation === 'SCI') return value.toExponential(9).replace(/\.0+(?=e)|(?<=\.\d*?)0+(?=e)/g, '').replace('e+', '×10^')
  if (notation === 'FIX') return value.toFixed(4)
  const abs = Math.abs(value)
  if ((abs !== 0 && abs < 1e-9) || abs >= 1e12) return value.toExponential(9).replace(/\.0+e/, 'e').replace('e+', '×10^')
  return Number(value.toPrecision(12)).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })
}

export function toFraction(value, maxDenominator = 10000) {
  if (!Number.isFinite(value)) return String(value)
  const sign = value < 0 ? '−' : ''
  let x = Math.abs(value)
  if (Number.isInteger(x)) return `${sign}${x}`
  let h1 = 1; let h2 = 0; let k1 = 0; let k2 = 1
  let b = x
  do {
    const a = Math.floor(b)
    const h = a * h1 + h2
    const k = a * k1 + k2
    if (k > maxDenominator) break
    h2 = h1; h1 = h; k2 = k1; k1 = k
    const fraction = b - a
    if (fraction < 1e-12) break
    b = 1 / fraction
  } while (true)
  return `${sign}${h1}/${k1}`
}
