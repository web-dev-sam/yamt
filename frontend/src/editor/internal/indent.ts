const DEFAULT_WIDTH = 2;
const SMALLEST_INDENT_STEP = 2;

export function indentUnitOf(lines: Iterable<string>): string {
  const steps = new Map<number, number>();
  let tabLines = 0;
  let spaceLines = 0;
  let previous = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    if (line.startsWith("\t")) {
      tabLines += 1;
      continue;
    }
    const width = line.length - line.trimStart().length;
    if (width >= SMALLEST_INDENT_STEP) {
      spaceLines += 1;
    }
    const step = width - previous;
    if (step >= SMALLEST_INDENT_STEP) {
      steps.set(step, (steps.get(step) ?? 0) + 1);
    }
    previous = width;
  }
  if (tabLines > spaceLines) {
    return "\t";
  }
  return " ".repeat(mostCommon(steps) ?? DEFAULT_WIDTH);
}

function mostCommon(counts: ReadonlyMap<number, number>): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
