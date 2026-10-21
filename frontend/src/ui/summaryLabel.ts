import type { MergeSummary } from "./useMergeController";

type Words = { readonly one: string; readonly many: string };

const SUMMARY_WORDS: Readonly<Record<keyof MergeSummary, Words>> = {
  changes: { one: "change", many: "changes" },
  conflicts: { one: "conflict", many: "conflicts" },
  remembered: { one: "remembered", many: "remembered" },
};

const LABEL_ORDER: readonly (keyof MergeSummary)[] = ["changes", "conflicts", "remembered"];

export function summaryLabel(summary: MergeSummary): string {
  const parts = LABEL_ORDER.filter((key) => summary[key] !== 0).map((key) => {
    const count = summary[key];
    const { one, many } = SUMMARY_WORDS[key];
    return `${count} ${count === 1 ? one : many}`;
  });
  return parts.length === 0 ? "All changes processed" : parts.join(" · ");
}
