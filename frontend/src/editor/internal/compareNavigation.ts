import type { Text } from "@codemirror/state";

import type { DiffSpan } from "./compareMarks";
import type { DocPos } from "./docPos";
import type { Direction } from "./navigation";

export function nextDifference(
  doc: Text,
  spans: readonly DiffSpan[],
  cursor: DocPos,
  direction: Direction,
): DiffSpan | null {
  switch (direction) {
    case "down":
      return spans.find((span) => span.from > cursor) ?? null;
    case "up": {
      const lineStart = doc.lineAt(cursor).from;
      return spans.findLast((span) => span.from < cursor && span.to <= lineStart) ?? null;
    }
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}
