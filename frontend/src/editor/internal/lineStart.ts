import type { Text } from "@codemirror/state";

export function lineStart(doc: Text, line: number): number {
  return line < doc.lines ? doc.line(line + 1).from : doc.length;
}
