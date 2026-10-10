// Instrumented algorithms. Each is a generator that mutates the array in place
// and yields events the visualiser (and the op counter) can consume:
//   cmp {i,j} · swap {i,j} · write {i} · pivot {i} · range {lo,hi} · sorted {i} · found {i}

function* bubble(a) {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      yield { op: 'cmp', i: j, j: j + 1 };
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
        yield { op: 'swap', i: j, j: j + 1 };
      }
    }
    yield { op: 'sorted', i: n - 1 - i };
    if (!swapped) break;
  }
}

function* selection(a) {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    yield { op: 'pivot', i };
    for (let j = i + 1; j < n; j++) {
      yield { op: 'cmp', i: min, j };
      if (a[j] < a[min]) min = j;
    }
    if (min !== i) {
      [a[i], a[min]] = [a[min], a[i]];
      yield { op: 'swap', i, j: min };
    }
    yield { op: 'sorted', i };
  }
}

function* insertion(a) {
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    for (;;) {
      if (j < 0) break;
      yield { op: 'cmp', i: j, j: j + 1 };
      if (a[j] <= key) break;
      a[j + 1] = a[j];
      a[j] = key;
      yield { op: 'swap', i: j, j: j + 1 };
      j--;
    }
  }
}

function* shell(a) {
  const n = a.length;
  for (let gap = n >> 1; gap > 0; gap >>= 1) {
    for (let i = gap; i < n; i++) {
      for (let j = i; j >= gap; j -= gap) {
        yield { op: 'cmp', i: j - gap, j };
        if (a[j - gap] <= a[j]) break;
        [a[j - gap], a[j]] = [a[j], a[j - gap]];
        yield { op: 'swap', i: j - gap, j };
      }
    }
  }
}

function* merge(a) {
  const aux = new Array(a.length);
  function* sort(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    yield* sort(lo, mid);
    yield* sort(mid + 1, hi);
    yield { op: 'range', lo, hi };
    for (let k = lo; k <= hi; k++) aux[k] = a[k];
    let i = lo;
    let j = mid + 1;
    for (let k = lo; k <= hi; k++) {
      if (i > mid) a[k] = aux[j++];
      else if (j > hi) a[k] = aux[i++];
      else {
        yield { op: 'cmp', i: k, j: Math.min(j, hi) };
        a[k] = aux[j] < aux[i] ? aux[j++] : aux[i++];
      }
      yield { op: 'write', i: k };
    }
  }
  yield* sort(0, a.length - 1);
}

function* quick(a) {
  // Lomuto partition, last element as pivot; explicit stack (no deep recursion).
  const stack = [[0, a.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (lo >= hi) {
      if (lo === hi) yield { op: 'sorted', i: lo };
      continue;
    }
    yield { op: 'range', lo, hi };
    yield { op: 'pivot', i: hi };
    const p = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      yield { op: 'cmp', i: j, j: hi };
      if (a[j] < p) {
        if (i !== j) {
          [a[i], a[j]] = [a[j], a[i]];
          yield { op: 'swap', i, j };
        }
        i++;
      }
    }
    if (i !== hi) {
      [a[i], a[hi]] = [a[hi], a[i]];
      yield { op: 'swap', i, j: hi };
    }
    yield { op: 'sorted', i };
    stack.push([i + 1, hi], [lo, i - 1]);
  }
}

function* heap(a) {
  const n = a.length;
  function* sift(start, end) {
    let root = start;
    for (;;) {
      let child = 2 * root + 1;
      if (child > end) return;
      if (child + 1 <= end) {
        yield { op: 'cmp', i: child, j: child + 1 };
        if (a[child] < a[child + 1]) child++;
      }
      yield { op: 'cmp', i: root, j: child };
      if (a[root] >= a[child]) return;
      [a[root], a[child]] = [a[child], a[root]];
      yield { op: 'swap', i: root, j: child };
      root = child;
    }
  }
  for (let s = (n >> 1) - 1; s >= 0; s--) yield* sift(s, n - 1);
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]];
    yield { op: 'swap', i: 0, j: end };
    yield { op: 'sorted', i: end };
    yield* sift(0, end - 1);
  }
}

function* linear(a, target) {
  for (let i = 0; i < a.length; i++) {
    yield { op: 'cmp', i, j: -1 };
    if (a[i] === target) {
      yield { op: 'found', i };
      return i;
    }
  }
  yield { op: 'found', i: -1 };
  return -1;
}

function* binary(a, target) {
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    yield { op: 'range', lo, hi };
    const mid = (lo + hi) >> 1;
    yield { op: 'cmp', i: mid, j: -1 };
    if (a[mid] === target) {
      yield { op: 'found', i: mid };
      return mid;
    }
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  yield { op: 'found', i: -1 };
  return -1;
}

export const ALGORITHMS = [
  { id: 'bubble', name: 'Bubble Sort', kind: 'sort', best: 'n', avg: 'n²', worst: 'n²', space: '1', stable: true, gen: bubble,
    note: 'Repeatedly swaps adjacent out-of-order pairs; stops early when a pass makes no swaps.' },
  { id: 'selection', name: 'Selection Sort', kind: 'sort', best: 'n²', avg: 'n²', worst: 'n²', space: '1', stable: false, gen: selection,
    note: 'Finds the minimum of the unsorted suffix and swaps it into place. Always n²/2 compares.' },
  { id: 'insertion', name: 'Insertion Sort', kind: 'sort', best: 'n', avg: 'n²', worst: 'n²', space: '1', stable: true, gen: insertion,
    note: 'Grows a sorted prefix by sliding each new element left. Great on nearly-sorted data.' },
  { id: 'shell', name: 'Shell Sort', kind: 'sort', best: 'n log n', avg: 'n^1.5', worst: 'n²', space: '1', stable: false, gen: shell,
    note: 'Insertion sort over shrinking gaps n/2, n/4, ... 1. Complexity depends on the gap sequence.' },
  { id: 'merge', name: 'Merge Sort', kind: 'sort', best: 'n log n', avg: 'n log n', worst: 'n log n', space: 'n', stable: true, gen: merge,
    note: 'Divide in halves, sort each recursively, merge. T(n) = 2T(n/2) + Θ(n).' },
  { id: 'quick', name: 'Quick Sort', kind: 'sort', best: 'n log n', avg: 'n log n', worst: 'n²', space: 'log n', stable: false, gen: quick,
    note: 'Lomuto partition around the last element. Sorted input triggers the n² worst case.' },
  { id: 'heap', name: 'Heap Sort', kind: 'sort', best: 'n log n', avg: 'n log n', worst: 'n log n', space: '1', stable: false, gen: heap,
    note: 'Builds a max-heap in O(n), then repeatedly moves the max to the end and sifts down.' },
  { id: 'linear', name: 'Linear Search', kind: 'search', best: '1', avg: 'n', worst: 'n', space: '1', stable: null, gen: linear,
    note: 'Checks every element in order until the target is found.' },
  { id: 'binary', name: 'Binary Search', kind: 'search', best: '1', avg: 'log n', worst: 'log n', space: '1', stable: null, gen: binary,
    note: 'Halves a sorted range each step. T(n) = T(n/2) + Θ(1).' },
];

export const PATTERNS = [
  { id: 'random', name: 'Random' },
  { id: 'sorted', name: 'Sorted' },
  { id: 'reversed', name: 'Reversed' },
  { id: 'nearly', name: 'Nearly sorted' },
];

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Values 1..n arranged according to the pattern.
export function makeInput(n, pattern = 'random', rand = Math.random) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const shuffle = () => {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  };
  if (pattern === 'random') shuffle();
  else if (pattern === 'reversed') a.reverse();
  else if (pattern === 'nearly') {
    const swaps = Math.max(1, Math.round(n * 0.05));
    for (let k = 0; k < swaps; k++) {
      const i = Math.floor(rand() * n);
      const j = Math.min(n - 1, i + 1 + Math.floor(rand() * 3));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }
  return a;
}

export const algorithmById = (id) => ALGORITHMS.find((a) => a.id === id);

// Run an algorithm to completion, counting comparisons and data moves.
export function countOps(alg, input, target) {
  const a = [...input];
  let cmp = 0;
  let moves = 0;
  const it = alg.gen(a, target);
  for (let r = it.next(); !r.done; r = it.next()) {
    const { op } = r.value;
    if (op === 'cmp') cmp++;
    else if (op === 'swap' || op === 'write') moves++;
  }
  return { cmp, moves, total: cmp + moves, result: a };
}

// Measure op counts across input sizes for complexity fitting.
export function measure(alg, pattern = 'random', sizes = [32, 64, 128, 256, 512, 1024], seed = 7) {
  const rand = rng(seed);
  return sizes.map((n) => {
    if (alg.kind === 'search') {
      const a = makeInput(n, 'sorted');
      const ops = countOps(alg, a, n + 1); // absent target → worst case
      return { n, ops: ops.cmp, cmp: ops.cmp, moves: 0 };
    }
    const ops = countOps(alg, makeInput(n, pattern, rand));
    return { n, ops: ops.total, cmp: ops.cmp, moves: ops.moves };
  });
}
