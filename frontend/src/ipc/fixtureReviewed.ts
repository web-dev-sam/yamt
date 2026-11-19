import type * as Generated from "./bindings";
import type { RangeFileId, SourceResult } from "./domain";
import type { Log } from "./log";
import type { RangeEntry, RangeFile, RangeStart } from "./rangeDomain";
import { toSinceReview, type ReviewMark, type SinceReview } from "./reviewedDomain";
import type { ReviewedSource } from "./ReviewedSource";

type Shown = { readonly start: RangeStart; readonly files: readonly RangeFile[] };

const SEEDED_MARKS: Readonly<Record<string, ReviewMark>> = {
  "docs/keys.md": "reviewed",
  "src/board/board.ts": "changedSinceReview",
  "public/logo.png": "changedSinceReview",
};

const SINCE_PATH = "src/board/board.ts";
const SINCE_START = 40;
const SINCE_LINES = 3;

const NO_WORDS: Generated.DifferenceWords = {
  left: { changed: [], removals: [] },
  right: { changed: [], removals: [] },
};

function seeded(log: Log, search: string, start: RangeStart): Map<RangeFileId, ReviewMark> {
  const asked = new URLSearchParams(search).get("reviewed");
  if (asked === null) {
    return new Map();
  }
  if (asked !== "seeded") {
    log.info("range.fixture_reviewed_miss", { value: asked });
    return new Map();
  }
  return new Map(
    start.files.flatMap(({ id, path }): [RangeFileId, ReviewMark][] => {
      const mark = SEEDED_MARKS[path];
      return mark === undefined ? [] : [[id, mark]];
    }),
  );
}

function withoutSinceLines(text: string): string {
  const lines = text.split("\n");
  return [...lines.slice(0, SINCE_START), ...lines.slice(SINCE_START + SINCE_LINES)].join("\n");
}

function sinceOf(entry: RangeEntry, loaded: RangeFile | undefined): SinceReview {
  if (loaded?.kind !== "texts") {
    return { kind: "noText" };
  }
  const current = loaded.right;
  if (entry.path !== SINCE_PATH) {
    return { kind: "texts", reviewed: current, current, differences: [] };
  }
  const difference: Generated.Difference = {
    left: { start: SINCE_START, len: 0 },
    right: { start: SINCE_START, len: SINCE_LINES },
    words: NO_WORDS,
  };
  const reviewed = withoutSinceLines(current);
  return toSinceReview({ kind: "texts", reviewed, current, differences: [difference] });
}

export function createFixtureReviewed(log: Log, search: string, shown: Shown): ReviewedSource {
  const marks = seeded(log, search, shown.start);
  function answerFor<T>(
    kind: string,
    file: RangeFileId,
    answer: (entry: RangeEntry) => T,
  ): SourceResult<T> {
    log.info("range.fixture_reviewed", { kind, file });
    const entry = shown.start.files.find(({ id }) => id === file);
    return entry === undefined
      ? { ok: false, failure: { kind: "UnknownRangeFile", file } }
      : { ok: true, value: answer(entry) };
  }
  return {
    async listReviewed() {
      log.info("range.fixture_reviewed", { kind: "list" });
      return { ok: true, value: new Map(marks) };
    },
    async markReviewed(file) {
      return answerFor("mark", file, () => {
        marks.set(file, "reviewed");
        return null;
      });
    },
    async unmarkReviewed(file) {
      return answerFor("unmark", file, () => {
        marks.delete(file);
        return null;
      });
    },
    async loadSinceReview(file) {
      return answerFor("since", file, (entry) => sinceOf(entry, shown.files[file]));
    },
  };
}
