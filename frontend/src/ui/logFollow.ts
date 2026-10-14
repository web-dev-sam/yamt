import type { LogLine } from "../lsp";

export function droppedAbove(before: readonly LogLine[], after: readonly LogLine[]): number {
  const first = after[0];
  const at = first === undefined ? -1 : before.indexOf(first);
  return at === -1 ? before.length : at;
}
