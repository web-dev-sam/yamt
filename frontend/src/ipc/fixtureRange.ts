import * as v from "valibot";

import type * as Generated from "./bindings";
import { DIFFERENCE, memberOf, parsedCases } from "./fixture";
import { createFixtureReview } from "./fixtureReview";
import { createFixtureSettings } from "./fixtureSettings";
import type { Log } from "./log";
import {
  toRangeFile,
  toRangeStart,
  type RangeFile,
  type RangeSide,
  type RangeStart,
  type SearchText,
} from "./rangeDomain";
import type { RangeSource } from "./RangeSource";

type Case = { readonly start: RangeStart; readonly files: readonly RangeFile[] };

// Stryker disable all: Vite needs import.meta.glob arguments as literals
const CASE_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../fixtures/range/*.json",
  { eager: true, import: "default" },
);
// Stryker restore all

const DEFAULT_CASE = "review";

const NULL_SHORT_ID = "0000000";

const ENTRY_KINDS: Readonly<Record<Generated.RangeEntryKind, true>> = {
  file: true,
  executable: true,
  link: true,
  submodule: true,
};

const RANGE_SIDES: Readonly<Record<Generated.RangeSides, true>> = {
  left: true,
  right: true,
  both: true,
};

const ENTRY_KIND = memberOf(ENTRY_KINDS);

const RANGE_SIDE: v.GenericSchema<Generated.RangeSide> = v.object({
  label: v.variant("kind", [
    v.object({ kind: v.literal("named"), name: v.string() }),
    v.object({ kind: v.literal("mergeBase"), left: v.string(), right: v.string() }),
  ]),
  short_id: v.string(),
  subject: v.string(),
});

const RANGE_ENTRY: v.GenericSchema<Generated.RangeEntry> = v.object({
  id: v.number(),
  path: v.string(),
  change: v.variant("kind", [
    v.object({ kind: v.literal("added") }),
    v.object({ kind: v.literal("modified") }),
    v.object({ kind: v.literal("deleted") }),
    v.object({ kind: v.literal("renamed"), old_path: v.string() }),
  ]),
  lines: v.variant("kind", [
    v.object({ kind: v.literal("counted"), added: v.number(), removed: v.number() }),
    v.object({ kind: v.literal("notCounted") }),
  ]),
});

const RANGE_FILE: v.GenericSchema<Generated.RangeFile> = v.variant("kind", [
  v.object({
    kind: v.literal("texts"),
    left: v.string(),
    right: v.string(),
    differences: v.array(DIFFERENCE),
    mode: v.variant("kind", [
      v.object({ kind: v.literal("same") }),
      v.object({ kind: v.literal("changed"), old: ENTRY_KIND, new: ENTRY_KIND }),
    ]),
  }),
  v.object({ kind: v.literal("binary") }),
  v.object({ kind: v.literal("tooLarge"), limit: v.number() }),
  v.object({ kind: v.literal("notUtf8"), sides: memberOf(RANGE_SIDES) }),
  v.object({ kind: v.literal("modeOnly"), old: ENTRY_KIND, new: ENTRY_KIND }),
  v.object({ kind: v.literal("kindChanged"), old: ENTRY_KIND, new: ENTRY_KIND }),
  v.object({
    kind: v.literal("submodule"),
    old: v.nullable(v.string()),
    new: v.nullable(v.string()),
  }),
]);

const CASE = v.object({
  start: v.object({
    range: v.string(),
    left: RANGE_SIDE,
    right: RANGE_SIDE,
    files: v.array(RANGE_ENTRY),
  }),
  files: v.array(RANGE_FILE),
});

function missingCase(name: string): Case {
  const side: RangeSide = {
    label: { kind: "named", name: "HEAD" },
    shortId: NULL_SHORT_ID,
    subject: "",
  };
  return { start: { range: name, left: side, right: side, files: [] }, files: [] };
}

function shownCase(log: Log, search: string, cases: ReadonlyMap<string, Case>): Case {
  const asked = new URLSearchParams(search).get("range");
  const name = asked === null || asked === "" ? DEFAULT_CASE : asked;
  const found = cases.get(name);
  if (found !== undefined) {
    return found;
  }
  log.info("range.fixture_miss", { case: name, known: [...cases.keys()].join(", ") });
  return missingCase(name);
}

function searchTextsOf({ start, files }: Case): readonly SearchText[] {
  return start.files.flatMap(({ id }) => {
    const loaded = files[id];
    if (loaded?.kind !== "texts") {
      return [];
    }
    const { left, right, differences } = loaded;
    const changes = differences.map((difference) => ({
      left: difference.left,
      right: difference.right,
    }));
    return [{ file: id, left, right, changes }];
  });
}

export function createFixtureRangeSource(
  log: Log,
  search: string,
  files: Readonly<Record<string, unknown>> = CASE_FILES,
): RangeSource {
  const cases = parsedCases(CASE, "range fixture", files, ({ start, files: loaded }) => ({
    start: toRangeStart(start),
    files: loaded.map(toRangeFile),
  }));
  const shown = shownCase(log, search, cases);
  const textFiles = searchTextsOf(shown);
  return {
    async openRange() {
      return { ok: true, value: shown.start };
    },
    async loadRangeFile(file) {
      const found = shown.files[file];
      return found === undefined
        ? { ok: false, failure: { kind: "UnknownRangeFile", file } }
        : { ok: true, value: found };
    },
    async searchTexts(from) {
      if (from > shown.files.length) {
        return { ok: false, failure: { kind: "UnknownRangeFile", file: from } };
      }
      const files = textFiles.filter(({ file }) => file >= from);
      return { ok: true, value: { files, next: null } };
    },
    ...createFixtureReview(log, search, shown.start),
    ...createFixtureSettings(),
  };
}
