import type { HitPlace } from "./jobLog";

export const NO_RESULTS = "No results";

/** The first current match: the last one in the log (rule 6); null when there is none. */
export function firstHit(count: number): number | null {
  return count > 0 ? count - 1 : null;
}

/** Enter (forward) / Shift+Enter (backwards), wrapping at both ends; `count` ≥ 1, `current` in [0, count). */
export function steppedHit(current: number, count: number, backwards: boolean): number {
  return (current + (backwards ? count - 1 : 1)) % count;
}

/** "3 of 17" for current 2 of 17 (`count` ≥ 1). */
export function hitCountText(current: number, count: number): string {
  return `${current + 1} of ${count}`;
}

const HALF = 0.5;

function firstWhere(count: number, reached: (index: number) => boolean): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = Math.floor((low + high) * HALF);
    if (reached(middle)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}

/** The first of `count` lines whose `edge` is below `y`, `count` when none is; `edge` grows with the line. */
export function firstLineBelow(count: number, edge: (line: number) => number, y: number): number {
  return firstWhere(count, (line) => edge(line) > y);
}

/** The places on lines `first` to `end` (exclusive); `places` in line order, as `hitPlaces` gives them. */
export function placesOnLines(
  places: readonly HitPlace[],
  first: number,
  end: number,
): readonly HitPlace[] {
  function firstOn(line: number): number {
    return firstWhere(places.length, (index) => (places[index]?.line ?? line) >= line);
  }
  return places.slice(firstOn(first), firstOn(end));
}
