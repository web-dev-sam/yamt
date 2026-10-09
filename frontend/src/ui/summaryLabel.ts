import type { MergeSummary } from "./useMergeController";

function counted(count: number, noun: string): string | null {
  if (count === 0) {
    return null;
  }
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

export function summaryLabel(summary: MergeSummary): string {
  const parts = [counted(summary.changes, "change"), counted(summary.conflicts, "conflict")].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? "All changes processed" : parts.join(" · ");
}
