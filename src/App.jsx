import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Binary, Braces, Calculator, ChevronDown, CircleHelp, Clock3,
  Copy, Delete, FlaskConical, FunctionSquare, History, Menu, MoreHorizontal,
  Parentheses, RotateCcw, Settings2, Sigma, Sparkles, Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { evaluateExpression, formatResult, toFraction } from './calculator'

const MODES = [
  { id: 'CALC', name: 'Calculate', icon: Calculator, description: 'General and scientific calculations' },
  { id: 'CMPLX', name: 'Complex', icon: Braces, description: 'Work with complex numbers' },
  { id: 'BASE-N', name: 'Base-N', icon: Binary, description: 'Binary, octal and hexadecimal' },
  { id: 'STAT', name: 'Statistics', icon: Sigma, description: 'Single and paired-variable data' },
  { id: 'TABLE', name: 'Table', icon: FunctionSquare, description: 'Generate a function table' },
  { id: 'EQUATION', name: 'Equation', icon: Parentheses, description: 'Polynomial and simultaneous equations' },
]

const KEYS = [
  { label: 'sin', shift: 'sin⁻¹', insert: 'sin(', shiftedInsert: 'asin(', group: 'function' },
  { label: 'cos', shift: 'cos⁻¹', insert: 'cos(', shiftedInsert: 'acos(', group: 'function' },
  { label: 'tan', shift: 'tan⁻¹', insert: 'tan(', shiftedInsert: 'atan(', group: 'function' },
  { label: 'π', shift: 'e', insert: 'π', shiftedInsert: 'e', group: 'function' },
  { label: 'x!', shift: 'nPr', insert: '!', shiftedInsert: 'nPr', group: 'function' },
  { label: '√', shift: '∛', insert: '√(', shiftedInsert: 'cbrt(', group: 'function' },
  { label: 'x²', shift: 'x³', insert: '²', shiftedInsert: '³', group: 'function' },
  { label: 'xʸ', shift: 'ʸ√x', insert: '^', shiftedInsert: '^(1÷', group: 'function' },
  { label: 'log', shift: '10ˣ', insert: 'log(', shiftedInsert: '10^(', group: 'function' },
  { label: 'ln', shift: 'eˣ', insert: 'ln(', shiftedInsert: 'e^(', group: 'function' },
  { label: '(', shift: 'Abs', insert: '(', shiftedInsert: 'abs(', group: 'function' },
  { label: ')', shift: 'nCr', insert: ')', shiftedInsert: 'nCr', group: 'function' },
  { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
  { label: 'DEL', action: 'delete', group: 'utility', icon: Delete },
  { label: 'AC', action: 'clear', group: 'utility' },
  { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
  { label: '×', insert: '×', group: 'operator' }, { label: '÷', insert: '÷', group: 'operator' },
  { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
  { label: '+', insert: '+', group: 'operator' }, { label: '−', insert: '−', group: 'operator' },
  { label: '0', insert: '0' }, { label: '.', insert: '.' }, { label: '×10ˣ', insert: 'E' },
  { label: 'Ans', insert: 'Ans', group: 'operator' }, { label: '=', action: 'equals', group: 'equals' },
]

function App() {
  const [expression, setExpression] = useState('sin(30) + √(144)')
  const [result, setResult] = useState('12.5')
  const [answer, setAnswer] = useState(12.5)
  const [shift, setShift] = useState(false)
  const [angle, setAngle] = useState('DEG')
  const [notation, setNotation] = useState('NORM')
  const [mode, setMode] = useState('CALC')
  const [isFraction, setIsFraction] = useState(false)
  const [memory, setMemory] = useState(0)
  const [history, setHistory] = useState([
    { expression: '48 ÷ 2 × (9 + 3)', result: '288', time: '2 min ago' },
    { expression: 'log(1000) + 5²', result: '28', time: '8 min ago' },
    { expression: '10 nCr 3', result: '120', time: '12 min ago' },
  ])

  const currentMode = useMemo(() => MODES.find((item) => item.id === mode), [mode])

  const calculate = (value = expression) => {
    try {
      const numeric = evaluateExpression(value, { angle, ans: answer, memory })
      const formatted = formatResult(numeric, notation)
      setAnswer(numeric)
      setResult(isFraction ? toFraction(numeric) : formatted)
      setHistory((items) => [{ expression: value, result: formatted, time: 'Just now' }, ...items.filter((item) => item.expression !== value)].slice(0, 8))
    } catch (error) {
      setResult(error.message || 'Syntax ERROR')
    }
  }

  const insert = (text) => {
    if (result.includes('ERROR')) { setExpression(text); setResult('0') }
    else setExpression((value) => value + text)
  }

  const handleKey = (key) => {
    if (key.action === 'equals') { calculate(); setShift(false); return }
    if (key.action === 'delete') { setExpression((value) => value.slice(0, -1)); setShift(false); return }
    if (key.action === 'clear') { setExpression(''); setResult('0'); setShift(false); return }
    insert(shift && key.shiftedInsert ? key.shiftedInsert : key.insert || key.label)
    setShift(false)
  }

  const toggleFraction = () => {
    const next = !isFraction
    setIsFraction(next)
    setResult(next ? toFraction(answer) : formatResult(answer, notation))
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (/^[0-9.+\-*/^()%]$/.test(event.key)) {
        event.preventDefault()
        insert(event.key === '*' ? '×' : event.key === '/' ? '÷' : event.key)
      }
      if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate() }
      if (event.key === 'Backspace') setExpression((value) => value.slice(0, -1))
      if (event.key === 'Escape') { setExpression(''); setResult('0') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="dark min-h-screen bg-background text-foreground selection:bg-violet-500/30">
      <div className="fixed inset-0 -z-0 bg-[radial-gradient(circle_at_18%_0%,rgba(124,58,237,.12),transparent_28%),radial-gradient(circle_at_88%_82%,rgba(14,165,233,.08),transparent_25%)]" />
      <header className="relative z-10 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-950/40"><FlaskConical className="size-4 text-white" /></div>
            <div><p className="text-sm font-semibold leading-none tracking-tight">Aurelia Scientific</p><p className="mt-1 text-[10px] text-muted-foreground">SC-570 Workspace</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden border-emerald-500/20 bg-emerald-500/5 text-emerald-400 sm:flex"><span className="mr-1.5 size-1.5 rounded-full bg-emerald-400" />Ready</Badge>
            <Button variant="ghost" size="icon" aria-label="Help"><CircleHelp className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="More options"><MoreHorizontal className="size-4" /></Button>
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-400"><Sparkles className="size-3.5" />Natural scientific calculation</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Calculator workspace</h1><p className="mt-1 text-sm text-muted-foreground">Type an expression or use the scientific keypad.</p></div>
          <Dialog>
            <DialogTrigger asChild><Button variant="outline" className="justify-between border-white/10 bg-white/[0.03] sm:w-48"><span className="flex items-center gap-2"><currentMode.icon className="size-4 text-violet-400" />{currentMode.name}</span><ChevronDown className="size-3.5 text-muted-foreground" /></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Choose a calculator mode</DialogTitle><DialogDescription>Select the workspace that matches your problem.</DialogDescription></DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODES.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={cn('group flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-violet-500/50 hover:bg-violet-500/5', mode === item.id ? 'border-violet-500/60 bg-violet-500/10' : 'border-white/10 bg-white/[0.02]')}><div className="rounded-lg bg-white/[0.05] p-2"><item.icon className="size-4 text-violet-400" /></div><div><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p></div></button>)}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="gap-0 overflow-hidden border-white/[0.08] bg-card/80 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-300">{mode}</Badge>
                <Badge variant="outline" className="border-white/10 text-muted-foreground">Math input</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setAngle((value) => value === 'DEG' ? 'RAD' : value === 'RAD' ? 'GRAD' : 'DEG')}>{angle}</Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setExpression(''); setResult('0') }} aria-label="Reset"><RotateCcw className="size-3.5" /></Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <div className="relative min-h-44 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#09090d] p-5 shadow-inner sm:p-6">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
                <div className="mb-7 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600"><span>Natural display</span><span>{notation} · {angle}</span></div>
                <div className="min-h-8 break-all font-mono text-base text-zinc-400 sm:text-lg">{expression || <span className="text-zinc-700">Enter an expression</span>}<span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-violet-400 align-middle" /></div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <span className="pb-1 text-xs text-zinc-600">Result</span>
                  <div className={cn('max-w-full overflow-hidden text-ellipsis font-mono text-4xl font-medium tracking-tight text-white sm:text-5xl', result.includes('ERROR') && 'text-rose-400')}>{result}</div>
                </div>
              </div>

              <div className="my-4 flex flex-wrap items-center gap-2">
                <Button variant={shift ? 'default' : 'secondary'} size="sm" className={cn('h-8 text-xs', shift && 'bg-violet-600 hover:bg-violet-500')} onClick={() => setShift(!shift)}>SHIFT</Button>
                <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={toggleFraction}>S ⇄ D</Button>
                <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => insert('Ans')}>Ans</Button>
                <div className="ml-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><Settings2 className="size-3.5" />Secondary labels turn violet with Shift</div>
              </div>

              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {KEYS.map((key, index) => {
                  const Icon = key.icon
                  return <div className="relative pt-3" key={`${key.label}-${index}`}>
                    {key.shift && <span className={cn('absolute left-1 top-0 text-[9px] font-medium text-zinc-600 transition-colors', shift && 'text-violet-400')}>{key.shift}</span>}
                    <Button
                      variant="secondary"
                      className={cn(
                        'h-11 w-full rounded-xl border border-white/[0.04] bg-white/[0.055] px-1 text-sm text-zinc-200 shadow-none hover:border-white/10 hover:bg-white/10 active:scale-[.97] sm:h-12',
                        key.group === 'function' && 'bg-violet-500/[0.07] text-violet-200 hover:bg-violet-500/[0.14]',
                        key.group === 'operator' && 'bg-sky-500/[0.07] text-sky-300 hover:bg-sky-500/[0.14]',
                        key.group === 'utility' && 'bg-zinc-700/30 text-zinc-400',
                        key.group === 'equals' && 'border-violet-400/20 bg-violet-600 text-white shadow-lg shadow-violet-950/40 hover:bg-violet-500',
                      )}
                      onClick={() => handleKey(key)}
                    >{Icon ? <Icon className="size-4" /> : key.label}</Button>
                  </div>
                })}
              </div>
              <p className="mt-5 text-center text-[11px] text-muted-foreground">Keyboard enabled · Enter to calculate · Escape to clear</p>
            </CardContent>
          </Card>

          <div className="grid content-start gap-5">
            <Card className="gap-0 border-white/[0.08] bg-card/70 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between px-5 py-4"><div><CardTitle className="flex items-center gap-2 text-sm"><History className="size-4 text-violet-400" />History</CardTitle><CardDescription className="mt-1 text-xs">Recent calculations</CardDescription></div><Button variant="ghost" size="icon" className="size-8" onClick={() => setHistory([])} aria-label="Clear history"><Trash2 className="size-3.5" /></Button></CardHeader>
              <Separator className="bg-white/[0.06]" />
              <CardContent className="max-h-[410px] overflow-auto p-2">
                {history.length ? history.map((item, index) => <button key={`${item.expression}-${index}`} onClick={() => { setExpression(item.expression); setResult(item.result) }} className="group flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition hover:bg-white/[0.05]"><div className="min-w-0"><p className="truncate font-mono text-xs text-muted-foreground">{item.expression}</p><p className="mt-1 text-[10px] text-zinc-600">{item.time}</p></div><strong className="max-w-28 truncate font-mono text-sm font-medium text-zinc-200">{item.result}</strong></button>) : <div className="grid place-items-center py-10 text-center"><Clock3 className="mb-2 size-5 text-zinc-700" /><p className="text-xs text-muted-foreground">No calculations yet</p></div>}
              </CardContent>
            </Card>

            <Card className="gap-0 border-white/[0.08] bg-card/70 backdrop-blur-xl">
              <CardHeader className="px-5 py-4"><CardTitle className="text-sm">Preferences</CardTitle><CardDescription className="mt-1 text-xs">Control output and memory</CardDescription></CardHeader>
              <Separator className="bg-white/[0.06]" />
              <CardContent className="space-y-5 p-5">
                <div><label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Angle unit</label><div className="grid grid-cols-3 rounded-lg bg-white/[0.04] p-1">{['DEG', 'RAD', 'GRAD'].map((item) => <button key={item} onClick={() => setAngle(item)} className={cn('rounded-md py-1.5 text-[11px] font-medium text-muted-foreground transition', angle === item && 'bg-violet-600 text-white shadow')}>{item}</button>)}</div></div>
                <div><label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Number format</label><div className="grid grid-cols-3 rounded-lg bg-white/[0.04] p-1">{['NORM', 'SCI', 'FIX'].map((item) => <button key={item} onClick={() => { setNotation(item); setResult(formatResult(answer, item)) }} className={cn('rounded-md py-1.5 text-[11px] font-medium text-muted-foreground transition', notation === item && 'bg-zinc-700 text-white shadow')}>{item}</button>)}</div></div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Memory M</p><p className="mt-1 font-mono text-lg">{formatResult(memory)}</p></div><div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setMemory(answer)}>Store</Button><Button variant="ghost" size="icon" className="size-7" onClick={() => setMemory(0)} aria-label="Clear memory"><Trash2 className="size-3" /></Button></div></div></div>
                <Button variant="outline" className="w-full border-white/10 bg-white/[0.02] text-xs" onClick={() => navigator.clipboard?.writeText(result)}><Copy className="size-3.5" />Copy result</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="relative z-[1] mx-auto flex max-w-7xl items-center justify-between border-t border-white/[0.06] px-6 py-6 text-[10px] text-zinc-600"><span>Aurelia Scientific · SC-570</span><span>Private, local calculation</span></footer>
    </div>
  )
}

export default App
