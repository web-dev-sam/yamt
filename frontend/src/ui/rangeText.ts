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
} from "../ipc";

export type SentenceFile = Exclude<RangeFile, { readonly kind: "texts" }>;

export type ChangeMark = { readonly letter: string; readonly word: string };

export type LineCounts = { readonly added: string; readonly removed: string };

const BYTES_PER_MIB = 1_048_576;

export const RANGE_LIST_LABEL = "Changed files";

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

export function sideLabel({ label }: RangeSide): string {
  return label.kind === "named" ? label.name : `merge base of ${label.left} and ${label.right}`;
}

export function sideHeading(side: RangeSide): string {
  return `${sideLabel(side)} (${side.shortId})`;
}

export function emptyRangeText({ left, right }: RangeStart): string {
  return `${sideHeading(left)} and ${sideHeading(right)} have the same files.`;
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
