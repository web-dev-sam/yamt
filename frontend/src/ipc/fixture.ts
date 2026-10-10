import * as v from "valibot";

import type * as Generated from "./bindings";
import type { ChunkSource } from "./ChunkSource";
import { toDomain, type FileEntry, type FileMergeData, type SourceResult } from "./domain";
import type { Log } from "./log";

type SchemaOf<T> = { readonly [K in keyof T]-?: v.GenericSchema<T[K]> };

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

const SIDE_WORD_CHANGES = v.object({
  changed: v.array(INLINE_RANGE),
  removed_at: v.array(INLINE_POINT),
} satisfies SchemaOf<Generated.SideWordChanges<number>>);

const WORD_CHANGES = v.object({
  chunk: v.number(),
  local: SIDE_WORD_CHANGES,
  remote: SIDE_WORD_CHANGES,
} satisfies SchemaOf<Generated.WordChanges>);

const FILE_MERGE_DATA = v.object({
  path: v.string(),
  base: v.string(),
  local: v.string(),
  remote: v.string(),
  eol: memberOf(EOLS),
  chunks: v.array(CHUNK),
  word_changes: v.array(WORD_CHANGES),
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

export function createFixtureSource(
  log: Log,
  files: Readonly<Record<string, unknown>> = FIXTURE_FILES,
): ChunkSource {
  const fixtures = parseFixtures(files);
  const finished = new Map<string, string>();

  function entries(): FileEntry[] {
    return [...fixtures.keys()].map((path): FileEntry => ({
      path,
      status: finished.has(path) ? "Resolved" : "Unresolved",
      unsupported: null,
    }));
  }

  return {
    async listFiles() {
      return entries();
    },
    async loadFile(path) {
      const data = fixtures.get(path);
      return data === undefined ? unknownPath(path) : { ok: true, value: data };
    },
    async finishFile(path, text) {
      if (!fixtures.has(path)) {
        return unknownPath(path);
      }
      finished.set(path, text);
      log.info("fixture.finish", { path, text });
      return { ok: true, value: entries() };
    },
    async resetFile(path) {
      if (!fixtures.has(path)) {
        return unknownPath(path);
      }
      finished.delete(path);
      return { ok: true, value: entries() };
    },
  };
}
