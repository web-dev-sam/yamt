import * as v from "valibot";

import type * as Generated from "./bindings";
import type { ChunkSource } from "./ChunkSource";
import {
  toDomain,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type SourceResult,
  type WriteReply,
} from "./domain";
import { createFixtureStops } from "./fixtureOperations";
import { createFixtureSettings } from "./fixtureSettings";
import type { Log } from "./log";

type SchemaOf<T> = { readonly [K in keyof T]-?: v.GenericSchema<T[K]> };

type Records = {
  readonly fixtures: ReadonlyMap<string, FileMergeData>;
  readonly finished: Set<string>;
};

// Stryker disable all: Vite needs import.meta.glob arguments as literals
const FIXTURE_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../../fixtures/golden/*.json", "../../fixtures/showcase/*.json"],
  { eager: true, import: "default" },
);
// Stryker restore all

const CHUNK_KINDS: Readonly<Record<Generated.ChunkKind, true>> = {
  LocalOnly: true,
  RemoteOnly: true,
  BothSame: true,
  Conflict: true,
};

const EOLS: Readonly<Record<Generated.Eol, true>> = { Lf: true, CrLf: true, Mixed: true };

const SIDES: Readonly<Record<Generated.Side, true>> = { local: true, remote: true };

const NOT_TEXT: Readonly<Record<Generated.NotText, true>> = {
  Deleted: true,
  Binary: true,
  NonUtf8: true,
  TooLarge: true,
  Link: true,
  Directory: true,
};

function memberOf<T extends string>(members: Readonly<Record<T, true>>): v.GenericSchema<T> {
  return v.custom<T>(
    (input) => typeof input === "string" && Object.hasOwn(members, input),
    `expected one of ${Object.keys(members).join(", ")}`,
  );
}

const LINE_RANGE = v.object({
  start: v.number(),
  len: v.number(),
} satisfies SchemaOf<Generated.LineRange<number>>);

const CHUNK = v.object({
  id: v.number(),
  kind: memberOf(CHUNK_KINDS),
  base: LINE_RANGE,
  local: LINE_RANGE,
  remote: LINE_RANGE,
} satisfies SchemaOf<Generated.Chunk>);

const INLINE_RANGE = v.object({
  line: v.number(),
  start: v.number(),
  len: v.number(),
} satisfies SchemaOf<Generated.InlineRange<number>>);

const INLINE_POINT = v.object({
  line: v.number(),
  column: v.number(),
} satisfies SchemaOf<Generated.InlinePoint<number>>);

const REMOVAL = v.object({
  at: INLINE_POINT,
  text: v.string(),
} satisfies SchemaOf<Generated.Removal<number>>);

const SIDE_WORD_CHANGES = v.object({
  changed: v.array(INLINE_RANGE),
  removals: v.array(REMOVAL),
} satisfies SchemaOf<Generated.SideWordChanges<number>>);

const WORD_CHANGES = v.object({
  chunk: v.number(),
  local: SIDE_WORD_CHANGES,
  remote: SIDE_WORD_CHANGES,
} satisfies SchemaOf<Generated.WordChanges>);

const WAITING: v.GenericSchema<Generated.Waiting> = v.variant("kind", [
  v.object({ kind: v.literal("SideLines") }),
  v.object({
    kind: v.literal("Markers"),
    open: v.string(),
    first: memberOf(SIDES),
    between: v.array(v.string()),
    close: v.string(),
  }),
  v.object({ kind: v.literal("AsShown") }),
]);

const MERGE_CHUNK = v.object({
  chunk: CHUNK,
  middle: LINE_RANGE,
  words: WORD_CHANGES,
  waiting: WAITING,
} satisfies SchemaOf<Generated.MergeChunk>);

const MIDDLE: v.GenericSchema<Generated.Middle> = v.variant("kind", [
  v.object({ kind: v.literal("Stages"), text: v.string() }),
  v.object({ kind: v.literal("Disk"), text: v.string() }),
  v.object({ kind: v.literal("DiskNotText"), found: memberOf(NOT_TEXT) }),
]);

const FILE_MERGE_DATA = v.object({
  path: v.string(),
  middle: MIDDLE,
  local: v.string(),
  remote: v.string(),
  deleted: v.nullable(memberOf(SIDES)),
  eol: memberOf(EOLS),
  chunks: v.array(MERGE_CHUNK),
  disk_version: v.number(),
} satisfies SchemaOf<Generated.FileMergeData>);

function parseFixture(file: string, json: unknown): FileMergeData {
  const parsed = v.safeParse(FILE_MERGE_DATA, json);
  if (!parsed.success) {
    throw new Error(`fixture ${file}: ${v.summarize(parsed.issues)}`);
  }
  try {
    return toDomain(parsed.output);
  } catch (error) {
    throw new Error(`fixture ${file}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function parseFixtures(files: Readonly<Record<string, unknown>>): Map<string, FileMergeData> {
  const parsed = Object.entries(files).map(([file, json]) => parseFixture(file, json));
  parsed.sort((a, b) => a.path.localeCompare(b.path));
  return new Map(parsed.map((data) => [data.path, data]));
}

function unknownPath(path: string): SourceResult<never> {
  return { ok: false, failure: { kind: "UnknownPath", path } };
}

// The app counts lines with Rust's `str::lines`, which does not count an empty last line.
function lineCount(text: string): number {
  const breaks = text.split("\n").length - 1;
  return text === "" || text.endsWith("\n") ? breaks : breaks + 1;
}

function describeRecord(path: string, data: FileMergeData | undefined): SourceResult<FileSides> {
  if (data === undefined) {
    return unknownPath(path);
  }
  const sides: FileSides = {
    path,
    reason: null,
    local: { kind: "Text", lines: lineCount(data.local) },
    remote: { kind: "Text", lines: lineCount(data.remote) },
    diskVersion: data.diskVersion,
  };
  return { ok: true, value: sides };
}

function entries({ fixtures, finished }: Records): FileEntry[] {
  return [...fixtures.keys()].map((path): FileEntry => ({
    path,
    status: finished.has(path) ? "Resolved" : "Unresolved",
    unsupported: null,
  }));
}

function updateKnown(records: Records, path: string, update: () => void): SourceResult<WriteReply> {
  if (!records.fixtures.has(path)) {
    return unknownPath(path);
  }
  update();
  return { ok: true, value: { kind: "Written", files: entries(records) } };
}

export async function loadFixture(
  path: string,
  files: Readonly<Record<string, unknown>> = FIXTURE_FILES,
): Promise<FileMergeData> {
  const data = parseFixtures(files).get(path);
  if (data === undefined) {
    throw new Error(`no fixture for ${path}`);
  }
  return data;
}

function fixtureWrites(
  log: Log,
  records: Records,
): Pick<ChunkSource, "finishFile" | "saveFile" | "resetFile" | "takeSide"> {
  return {
    async finishFile({ path, text }) {
      return updateKnown(records, path, () => {
        records.finished.add(path);
        log.info("fixture.finish", { path, text });
      });
    },
    async saveFile({ path, text }) {
      return updateKnown(records, path, () => {
        log.info("fixture.save", { path, text, length: text.length, lines: lineCount(text) });
      });
    },
    async resetFile(path) {
      return updateKnown(records, path, () => {
        records.finished.delete(path);
      });
    },
    async takeSide(path, side) {
      return updateKnown(records, path, () => {
        records.finished.add(path);
        log.info("fixture.take", { path, side });
      });
    },
  };
}

export function createFixtureSource(
  log: Log,
  search: string,
  files: Readonly<Record<string, unknown>> = FIXTURE_FILES,
): ChunkSource {
  const records: Records = { fixtures: parseFixtures(files), finished: new Set() };
  const stops = createFixtureStops(log, search, {
    listed: () => entries(records),
    unresolveAll: () => records.finished.clear(),
  });

  return {
    listFiles: stops.listFiles,
    listStop: stops.listStop,
    continueOperation: stops.continueOperation,
    abortOperation: stops.abortOperation,
    async loadFile(path) {
      const data = records.fixtures.get(path);
      return data === undefined ? unknownPath(path) : { ok: true, value: data };
    },
    async describeFile(path) {
      return describeRecord(path, records.fixtures.get(path));
    },
    async sideNames() {
      return { local: null, remote: null };
    },
    async abortMerge() {
      log.info("fixture.abort_merge", {});
      return { ok: true, value: null };
    },
    ...fixtureWrites(log, records),
    ...createFixtureSettings(),
  };
}
