import type { Text } from "@codemirror/state";

import type { Chunk } from "../../ipc";

export function lineSpan(
  doc: Text,
  range: Chunk["middle"] | Chunk["local"] | Chunk["remote"],
): { from: number; to: number } {
  const end = range.start + range.len;
  return {
    from: range.start < doc.lines ? doc.line(range.start + 1).from : doc.length,
    to: end < doc.lines ? doc.line(end + 1).from : doc.length,
  };
}
