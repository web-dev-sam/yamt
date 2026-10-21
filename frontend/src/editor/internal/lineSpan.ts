import type { Text } from "@codemirror/state";

export function lineSpan(
  doc: Text,
  range: { readonly start: number; readonly len: number },
): { from: number; to: number } {
  const end = range.start + range.len;
  return {
    from: range.start < doc.lines ? doc.line(range.start + 1).from : doc.length,
    to: end < doc.lines ? doc.line(end + 1).from : doc.length,
  };
}
