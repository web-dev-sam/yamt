import type { MergeSummary } from "./useMergeController";

type Key = keyof MergeSummary;

type Words = { readonly one: string; readonly many: string };

type EveryKeyOnce<Order, Unlisted extends Key = Key> = Order extends readonly [
  infer First extends Unlisted,
  ...infer Rest,
]
  ? readonly [First, ...EveryKeyOnce<Rest, Exclude<Unlisted, First>>]
  : Order extends readonly []
    ? [Unlisted] extends [never]
      ? Order
      : never
    : never;

const LABEL_ORDER = ["changes", "conflicts", "remembered"] as const;

const SUMMARY_WORDS: Readonly<Record<EveryKeyOnce<typeof LABEL_ORDER>[number], Words>> = {
  changes: { one: "change", many: "changes" },
  conflicts: { one: "conflict", many: "conflicts" },
  remembered: { one: "remembered", many: "remembered" },
};

export function summaryLabel(summary: MergeSummary): string {
  const parts = LABEL_ORDER.filter((key) => summary[key] !== 0).map((key) => {
    const count = summary[key];
    const { one, many } = SUMMARY_WORDS[key];
    return `${count} ${count === 1 ? one : many}`;
  });
  return parts.length === 0 ? "All changes processed" : parts.join(" · ");
}
