const DEFAULT_UNIT = "  ";
const LEADING_SPACE = /^[ \t]*/;

export function indentUnitOf(text: string): string {
  const steps = new Map<number, number>();
  let tabLines = 0;
  let spaceLines = 0;
  let previous = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    const leading = LEADING_SPACE.exec(line)?.[0] ?? "";
    if (leading.startsWith("\t")) {
      tabLines += 1;
      continue;
    }
    const width = leading.length;
    if (width > 1) {
      spaceLines += 1;
    }
    const step = width - previous;
    if (step > 1) {
      steps.set(step, (steps.get(step) ?? 0) + 1);
    }
    previous = width;
  }
  if (tabLines > spaceLines) {
    return "\t";
  }
  return " ".repeat(mostCommon(steps) ?? DEFAULT_UNIT.length);
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
