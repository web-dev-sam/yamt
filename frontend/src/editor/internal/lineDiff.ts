export type LineEdit = {
  readonly from: number;
  readonly to: number;
  readonly lines: readonly string[];
};

type Box = {
  readonly aFrom: number;
  readonly aTo: number;
  readonly bFrom: number;
  readonly bTo: number;
};

type Point = { readonly x: number; readonly y: number };

type Search = {
  readonly a: readonly string[];
  readonly b: readonly string[];
  readonly box: Box;
  readonly n: number;
  readonly m: number;
  readonly delta: number;
  readonly offset: number;
};

type Walk = { readonly v: Int32Array; kStart: number; kEnd: number; readonly reverse: boolean };

const UNSEEN = -1;
const DIAGONAL_STEP = 2;

function at(v: Int32Array, index: number): number {
  return v[index] ?? UNSEEN;
}

function same(search: Search, x: number, y: number, reverse: boolean): boolean {
  const { a, b, box } = search;
  return reverse
    ? a[box.aTo - 1 - x] === b[box.bTo - 1 - y]
    : a[box.aFrom + x] === b[box.bFrom + y];
}

function trimmed(a: readonly string[], b: readonly string[], box: Box): Box {
  let { aFrom, aTo, bFrom, bTo } = box;
  while (aFrom < aTo && bFrom < bTo && a[aFrom] === b[bFrom]) {
    aFrom += 1;
    bFrom += 1;
  }
  while (aFrom < aTo && bFrom < bTo && a[aTo - 1] === b[bTo - 1]) {
    aTo -= 1;
    bTo -= 1;
  }
  return { aFrom, aTo, bFrom, bTo };
}

function walk(size: number, reverse: boolean, offset: number): Walk {
  const v = new Int32Array(size).fill(UNSEEN);
  v[offset + 1] = 0;
  return { v, kStart: 0, kEnd: 0, reverse };
}

function meeting(search: Search, other: Walk, k: number, x: number): Point | null {
  const index = search.offset + search.delta - k;
  const seen = at(other.v, index);
  if (seen === UNSEEN) {
    return null;
  }
  if (other.reverse) {
    return x >= search.n - seen ? { x, y: x - k } : null;
  }
  return seen >= search.n - x ? { x: seen, y: seen - (search.delta - k) } : null;
}

function step(search: Search, own: Walk, other: Walk, d: number): Point | null {
  const checks = (search.delta % DIAGONAL_STEP !== 0) !== own.reverse;
  for (let k = -d + own.kStart; k <= d - own.kEnd; k += DIAGONAL_STEP) {
    const index = search.offset + k;
    const down = k === -d || (k !== d && at(own.v, index - 1) < at(own.v, index + 1));
    let x = down ? at(own.v, index + 1) : at(own.v, index - 1) + 1;
    let y = x - k;
    while (x < search.n && y < search.m && same(search, x, y, own.reverse)) {
      x += 1;
      y += 1;
    }
    own.v[index] = x;
    if (x > search.n) {
      own.kEnd += DIAGONAL_STEP;
    } else if (y > search.m) {
      own.kStart += DIAGONAL_STEP;
    } else if (checks) {
      const met = meeting(search, other, k, x);
      if (met !== null) {
        return met;
      }
    }
  }
  return null;
}

// The middle snake of Myers' linear-space refinement, in the form of diff-match-patch's
// diff_bisect (https://github.com/google/diff-match-patch, Myers 1986 §4b).
function split(a: readonly string[], b: readonly string[], box: Box): Point | null {
  const n = box.aTo - box.aFrom;
  const m = box.bTo - box.bFrom;
  const maxD = Math.ceil((n + m) / DIAGONAL_STEP);
  const search: Search = { a, b, box, n, m, delta: n - m, offset: maxD };
  const size = DIAGONAL_STEP * (maxD + 1);
  const forward = walk(size, false, maxD);
  const reverse = walk(size, true, maxD);
  for (let d = 0; d < maxD; d += 1) {
    const met = step(search, forward, reverse, d) ?? step(search, reverse, forward, d);
    if (met !== null) {
      return { x: box.aFrom + met.x, y: box.bFrom + met.y };
    }
  }
  return null;
}

function diffBox(a: readonly string[], b: readonly string[], whole: Box, out: Box[]): void {
  const box = trimmed(a, b, whole);
  const { aFrom, aTo, bFrom, bTo } = box;
  if (aFrom === aTo && bFrom === bTo) {
    return;
  }
  const middle = aFrom === aTo || bFrom === bTo ? null : split(a, b, box);
  if (middle === null) {
    const last = out.at(-1);
    if (last !== undefined && last.aTo === aFrom && last.bTo === bFrom) {
      out[out.length - 1] = { ...last, aTo, bTo };
    } else {
      out.push(box);
    }
    return;
  }
  diffBox(a, b, { aFrom, aTo: middle.x, bFrom, bTo: middle.y }, out);
  diffBox(a, b, { aFrom: middle.x, aTo, bFrom: middle.y, bTo }, out);
}

export function lineDiff(old: readonly string[], next: readonly string[]): LineEdit[] {
  const boxes: Box[] = [];
  diffBox(old, next, { aFrom: 0, aTo: old.length, bFrom: 0, bTo: next.length }, boxes);
  return boxes.map(({ aFrom, aTo, bFrom, bTo }) => ({
    from: aFrom,
    to: aTo,
    lines: next.slice(bFrom, bTo),
  }));
}
