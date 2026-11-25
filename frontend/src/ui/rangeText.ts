import type {
  RangeChange,
  RangeEntry,
  RangeEntryKind,
  RangeFile,
  RangeLineCounts,
  RangeModeChange,
  RangeSide,
  RangeSides,
  RangeStart,
  ReviewMark,
} from "../ipc";
import { mergeRequestReference } from "./mergeRequestsText";

export type SentenceFile = Exclude<RangeFile, { readonly kind: "texts" }>;

export type ChangeMark = { readonly letter: string; readonly word: string };

export type LineCounts = { readonly added: string; readonly removed: string };

export type ColumnName =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly branchedOff: string | null;
      readonly shortId: string;
      readonly subject: string;
    }
  | { readonly kind: "commit"; readonly shortId: string; readonly subject: string };

export type ColumnNames = { readonly left: ColumnName; readonly right: ColumnName };

export type HeadingLine =
  | {
      readonly kind: "mergeRequest";
      readonly reference: string;
      readonly title: string;
      readonly source: string;
      readonly target: string;
    }
  | {
      readonly kind: "unnamedMergeRequest";
      readonly reference: string;
      readonly source: string;
      readonly target: string;
    }
  | {
      readonly kind: "typed";
      readonly left: string;
      readonly dots: ".." | "...";
      readonly right: string;
    };

type Sides = Pick<RangeStart, "heading" | "left" | "right">;

const BYTES_PER_MIB = 1_048_576;

export const RANGE_LIST_LABEL = "Changed files";

export const RANGE_HEADING_LABEL = "What this window compares";

export const REVIEWED_LABEL = "Reviewed";
export const REVIEW_FROM_START_LABEL = "Review from start";
export const SINCE_REVIEW_NOTE = "Changed since you reviewed it";
export const SINCE_REVIEW_HEADING = "As you reviewed it";
export const SINCE_NO_TEXT =
  "This file changed since you reviewed it, and one of the two versions is not text. Review from start shows the whole change.";

export const REVIEW_MARK_WORDS: Readonly<Record<ReviewMark, string>> = {
  reviewed: "reviewed",
  changedSinceReview: "changed since reviewed",
};

export const FOLDER_REVIEWED_WORD = "every file reviewed";

export const LEFT_TO_REVIEW_WORD = "left to review";

const CHANGE_MARKS: Readonly<Record<RangeChange["kind"], ChangeMark>> = {
  added: { letter: "A", word: "added" },
  modified: { letter: "M", word: "modified" },
  deleted: { letter: "D", word: "deleted" },
  renamed: { letter: "R", word: "renamed" },
};

const KIND_WORDS: Readonly<Record<RangeEntryKind, string>> = {
  file: "file",
  executable: "executable file",
  link: "symbolic link",
  submodule: "submodule",
};

const NOT_UTF8: Readonly<Record<RangeSides, string>> = {
  left: "The left side is not UTF-8 text.",
  right: "The right side is not UTF-8 text.",
  both: "Neither side is UTF-8 text.",
};

export function changeMark(change: RangeChange): ChangeMark {
  return CHANGE_MARKS[change.kind];
}

export function reviewedCount({ reviewed, of }: { reviewed: number; of: number }): string {
  return `${reviewed} of ${of} reviewed`;
}

export function sideLabel({ label }: RangeSide): string {
  return label.kind === "named" ? label.name : `merge base of ${label.left} and ${label.right}`;
}

function namedColumn(
  { shortId, subject }: RangeSide,
  { name, branchedOff }: { readonly name: string; readonly branchedOff: string | null },
): ColumnName {
  return { kind: "named", name, branchedOff, shortId, subject };
}

function typedColumn(side: RangeSide): ColumnName {
  const { label } = side;
  return label.kind === "named"
    ? namedColumn(side, { name: label.name, branchedOff: null })
    : namedColumn(side, { name: label.left, branchedOff: label.right });
}

function commitColumn({ shortId, subject }: RangeSide): ColumnName {
  return { kind: "commit", shortId, subject };
}

export function columnNames({ heading, left, right }: Sides): ColumnNames {
  switch (heading.kind) {
    case "typed":
      return { left: typedColumn(left), right: typedColumn(right) };
    case "mergeRequest": {
      const { source, target } = heading.names;
      return {
        left: namedColumn(left, { name: target, branchedOff: source }),
        right: namedColumn(right, { name: source, branchedOff: null }),
      };
    }
    case "unnamedMergeRequest":
      return { left: commitColumn(left), right: commitColumn(right) };
    default: {
      const _exhaustive: never = heading;
      return _exhaustive;
    }
  }
}

export function branchedOffNote(branch: string): string {
  return `where ${branch} branched off`;
}

export function columnText(column: ColumnName): string {
  if (column.kind === "commit") {
    return column.shortId;
  }
  const { name, branchedOff, shortId } = column;
  return branchedOff === null
    ? `${name} (${shortId})`
    : `${name}, ${branchedOffNote(branchedOff)} (${shortId})`;
}

function typedLine({ left, right }: Pick<RangeStart, "left" | "right">): HeadingLine {
  const { label } = left;
  return {
    kind: "typed",
    left: label.kind === "named" ? label.name : label.left,
    dots: label.kind === "named" ? ".." : "...",
    right: right.label.kind === "named" ? right.label.name : right.label.right,
  };
}

export function headingLine(start: Sides): HeadingLine {
  const { heading, left, right } = start;
  switch (heading.kind) {
    case "typed":
      return typedLine(start);
    case "mergeRequest":
      return {
        kind: "mergeRequest",
        reference: mergeRequestReference(heading.iid),
        ...heading.names,
      };
    case "unnamedMergeRequest":
      return {
        kind: "unnamedMergeRequest",
        reference: mergeRequestReference(heading.iid),
        source: right.shortId,
        target: left.shortId,
      };
    default: {
      const _exhaustive: never = heading;
      return _exhaustive;
    }
  }
}

export function emptyRangeText(start: Sides): string {
  const { left, right } = columnNames(start);
  return `${columnText(left)} and ${columnText(right)} have the same files.`;
}

export function fileHeading({ path, change }: Pick<RangeEntry, "path" | "change">): string {
  return change.kind === "renamed" ? `${change.oldPath} → ${path}` : path;
}

export function lineCounts(lines: RangeLineCounts): LineCounts | null {
  return lines.kind === "counted"
    ? { added: `+${lines.added}`, removed: `−${lines.removed}` }
    : null;
}

function withArticle(kind: RangeEntryKind): string {
  const word = KIND_WORDS[kind];
  return /^[aeiou]/u.test(word) ? `an ${word}` : `a ${word}`;
}

export function modeNote(mode: RangeModeChange): string | null {
  return mode.kind === "changed"
    ? `Mode changed: ${KIND_WORDS[mode.old]} → ${KIND_WORDS[mode.new]}`
    : null;
}

export function fileSentence(file: SentenceFile): string {
  switch (file.kind) {
    case "binary":
      return "Binary file: not shown.";
    case "tooLarge":
      return `Larger than ${file.limit / BYTES_PER_MIB} MiB: not shown.`;
    case "notUtf8":
      return NOT_UTF8[file.sides];
    case "modeOnly":
      return `Only the file mode changed: ${KIND_WORDS[file.old]} → ${KIND_WORDS[file.new]}.`;
    case "kindChanged":
      return `Changed from ${withArticle(file.old)} to ${withArticle(file.new)}.`;
    case "submodule":
      return `Submodule: ${file.old ?? "none"} → ${file.new ?? "none"}`;
    default: {
      const _exhaustive: never = file;
      return _exhaustive;
    }
  }
}
