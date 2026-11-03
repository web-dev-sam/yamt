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
