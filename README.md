# NOVA nx-991GX — scientific graphing calculator

A ClassWiz-style scientific calculator that runs in the browser, with a dot-matrix LCD, the full key layout (SHIFT / ALPHA layers, cursor pad, MENU / SETUP), graphing, and two extra modes for computer science: **Algorithms** and **Big-O**.

**Live:** https://nikankad.github.io/scientific-calculator/

## Modes (press MENU)

1. **Calculate**: natural-display results (fractions, √ surds, π multiples, S⇔D), CALC, SOLVE, ∫, d/dx, Σ, Π, Pol/Rec, ÷R, nPr/nCr, GCD/LCM, ENG, FACT, DMS, STO/RECALL, M+, constants and unit conversions, history.
2. **Graph**: Y1–Y3, pan and zoom, trace, roots, minimum/maximum, intersection, y-intercept, several zoom presets.
3. **Table**: f(x) and g(x) over a start/end/step range.
4. **Base-N**: DEC/HEX/BIN/OCT with 32-bit two's complement, and/or/xor/xnor/Not/Neg.
5. **Equation**: polynomial roots of degree 2–4 (including complex roots) and 2–3 unknown linear systems.
6. **Statistics**: data editor, 1-variable statistics with quartiles, linear regression, box plots and scatter plots.
7. **Algorithms**: animated bubble, selection, insertion, shell, merge, quick and heap sort, plus linear and binary search. Shows live comparison and move counters, complexity cards, and lets you choose the input order.
8. **Big-O**: growth curves (linear or log scale), operation counts and running time at n, empirical complexity fitting of real algorithm runs, the Master theorem solver, and an asymptotic classifier for any T(n).

## Development

There are no dependencies and no build step. The app is static HTML/CSS and ES modules in `site/`.

```bash
npm start   # serves site/ at http://localhost:8080
npm test    # node --test
```

Pushing to `main` runs the tests and deploys `site/` to GitHub Pages (see `.github/workflows/deploy-pages.yml`).
