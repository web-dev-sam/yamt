import type { MergeSummary } from "./useMergeController";

function counted(count: number, noun: string, plural: string): string | null {
  if (count === 0) {
    return null;
  }
  return `${count} ${count === 1 ? noun : plural}`;
}

export function summaryLabel(summary: MergeSummary): string {
  const parts = [
    counted(summary.changes, "change", "changes"),
    counted(summary.conflicts, "conflict", "conflicts"),
    counted(summary.remembered, "remembered", "remembered"),
  ].filter((part) => part !== null);
  return parts.length === 0 ? "All changes processed" : parts.join(" · ");
}
