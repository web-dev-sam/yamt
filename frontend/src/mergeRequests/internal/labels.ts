export function labelsShown<L>(labels: readonly L[]): {
  readonly first: L | null;
  readonly rest: readonly L[];
} {
  const [first, ...rest] = labels;
  return first === undefined ? { first: null, rest: [] } : { first, rest };
}

export function moreText(count: number): string {
  return `+${count}`;
}
