import type { Parsed } from "./argv";

type MergeRequestNames = Readonly<Record<"title" | "source" | "target", string>>;
export type Review = { readonly of: string; readonly names: MergeRequestNames | null };

const NAME_FLAGS = ["mr-title", "mr-source", "mr-target"];

function mergeRequestNames(parsed: Parsed, review: string | undefined): MergeRequestNames | null {
  const [title, source, target] = NAME_FLAGS.map((flag) => parsed.values.get(flag));
  if (title === undefined && source === undefined && target === undefined) return null;
  if (title === undefined || source === undefined || target === undefined || review === undefined) {
    throw new Error(
      "start-app --mr-title, --mr-source and --mr-target go together, with --review-of",
    );
  }
  return { title, source, target };
}

export function parseReview(parsed: Parsed): Review | null {
  const of = parsed.values.get("review-of");
  const names = mergeRequestNames(parsed, of);
  return of === undefined ? null : { of, names };
}

export function reviewArgs(review: Review | null): readonly string[] {
  if (review === null) return [];
  const reviewOf = `--review-of=${review.of}`;
  if (review.names === null) return [reviewOf];
  const { title, source, target } = review.names;
  return [reviewOf, `--mr-title=${title}`, `--mr-source=${source}`, `--mr-target=${target}`];
}
