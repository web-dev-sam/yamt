import type * as Generated from "./bindings";
import { toDifferences, toLineChange, type Difference, type LineChange } from "./compareDomain";
import { isRangeFileId, type RangeFileId } from "./domain";
import { branded } from "./validate";

type RangeSideLabel = Readonly<Generated.RangeSideLabel>;
export type RangeSide = {
  readonly label: RangeSideLabel;
  readonly shortId: string;
  readonly subject: string;
};
export type RangeChange =
  | Readonly<Exclude<Generated.RangeChange, { kind: "renamed" }>>
  | { readonly kind: "renamed"; readonly oldPath: string };
export type RangeLineCounts = Readonly<Generated.RangeLineCounts>;
export type RangeEntry = {
  readonly id: RangeFileId;
  readonly path: string;
  readonly change: RangeChange;
  readonly lines: RangeLineCounts;
};
export type RangeStart = {
  readonly range: string;
  readonly left: RangeSide;
  readonly right: RangeSide;
  readonly files: readonly RangeEntry[];
};
export type RangeEntryKind = Generated.RangeEntryKind;
export type RangeModeChange = Readonly<Generated.RangeModeChange>;
export type RangeSides = Generated.RangeSides;
export type RangeFile =
  | {
      readonly kind: "texts";
      readonly left: string;
      readonly right: string;
      readonly differences: readonly Difference[];
      readonly mode: RangeModeChange;
    }
  | Readonly<Exclude<Generated.RangeFile, { kind: "texts" }>>;
export type SearchText = {
  readonly file: RangeFileId;
  readonly left: string;
  readonly right: string;
  readonly changes: readonly LineChange[];
};
export type SearchTexts = {
  readonly files: readonly SearchText[];
  readonly next: RangeFileId | null;
};

function toRangeSide({ label, short_id: shortId, subject }: Generated.RangeSide): RangeSide {
  return { label, shortId, subject };
}

function toRangeChange(change: Generated.RangeChange): RangeChange {
  return change.kind === "renamed" ? { kind: "renamed", oldPath: change.old_path } : change;
}

function toRangeEntry(
  { id, path, change, lines }: Generated.RangeEntry,
  index: number,
): RangeEntry {
  return {
    id: branded(id, isRangeFileId, `files[${index}].id`),
    path,
    change: toRangeChange(change),
    lines,
  };
}

export function toRangeStart(raw: Generated.RangeStart): RangeStart {
  return {
    range: raw.range,
    left: toRangeSide(raw.left),
    right: toRangeSide(raw.right),
    files: raw.files.map(toRangeEntry),
  };
}

export function toRangeFile(raw: Generated.RangeFile): RangeFile {
  if (raw.kind !== "texts") {
    return raw;
  }
  const { left, right, differences, mode } = raw;
  return { kind: "texts", left, right, differences: toDifferences(differences), mode };
}

function toSearchText(
  { file, left, right, changes }: Generated.SearchText,
  index: number,
): SearchText {
  const field = `files[${index}]`;
  return {
    file: branded(file, isRangeFileId, `${field}.file`),
    left,
    right,
    changes: changes.map((change, at) => toLineChange(change, `${field}.changes[${at}]`)),
  };
}

export function toSearchTexts(raw: Generated.SearchTexts): SearchTexts {
  return {
    files: raw.files.map(toSearchText),
    next: raw.next === null ? null : branded(raw.next, isRangeFileId, "next"),
  };
}
