import type { DiffSpan } from "./compareMarks";
import type { DocPos } from "./docPos";
import type { Direction } from "./navigation";

export function nextDifference(
  spans: readonly DiffSpan[],
  cursor: DocPos,
  direction: Direction,
): DiffSpan | null {
  switch (direction) {
    case "down":
      return spans.find((span) => span.from > cursor) ?? null;
    case "up":
      return spans.findLast((span) => span.from < cursor && span.to <= cursor) ?? null;
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}
