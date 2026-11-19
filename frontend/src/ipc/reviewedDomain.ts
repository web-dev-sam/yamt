import type * as Generated from "./bindings";
import { toDifferences, type Difference } from "./compareDomain";
import { isRangeFileId, type RangeFileId } from "./domain";
import { branded } from "./validate";

export type ReviewMark = Generated.ReviewMark;
export type ReviewMarks = ReadonlyMap<RangeFileId, ReviewMark>;
export type SinceReview =
  | {
      readonly kind: "texts";
      readonly reviewed: string;
      readonly current: string;
      readonly differences: readonly Difference[];
    }
  | { readonly kind: "noText" };

export function toReviewMarks(raw: readonly Generated.FileReview[]): ReviewMarks {
  const marks = new Map<RangeFileId, ReviewMark>();
  raw.forEach(({ file, mark }, index) => {
    const id = branded(file, isRangeFileId, `[${index}].file`);
    if (marks.has(id)) {
      throw new Error(`[${index}].file ${id} is marked twice`);
    }
    marks.set(id, mark);
  });
  return marks;
}

export function toSinceReview(raw: Generated.SinceReview): SinceReview {
  switch (raw.kind) {
    case "texts":
      return {
        kind: "texts",
        reviewed: raw.reviewed,
        current: raw.current,
        differences: toDifferences(raw.differences),
      };
    case "noText":
      return raw;
  }
}
