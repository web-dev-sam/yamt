import * as v from "valibot";

import type * as Generated from "./bindings";
import type { ChunkSource } from "./ChunkSource";
import { toDomain, type FileEntry, type FileMergeData } from "./domain";
import type { Log } from "./log";

type SchemaOf<T> = { readonly [K in keyof T]-?: v.GenericSchema<T[K]> };

const GOLDEN_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../fixtures/golden/*.json",
  { eager: true, import: "default" },
);

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

const FILE_MERGE_DATA = v.object({
  path: v.string(),
  base: v.string(),
  local: v.string(),
  remote: v.string(),
  eol: memberOf(EOLS),
  language: v.nullable(v.string()),
  chunks: v.array(CHUNK),
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

function lookup(fixtures: ReadonlyMap<string, FileMergeData>, path: string): FileMergeData {
  const data = fixtures.get(path);
  if (data === undefined) {
    throw new Error(`no fixture for ${path}`);
  }
  return data;
}

export function createFixtureSource(
  log: Log,
  files: Readonly<Record<string, unknown>> = GOLDEN_FILES,
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
      return lookup(fixtures, path);
    },
    async finishFile(path, text) {
      lookup(fixtures, path);
      finished.set(path, text);
      log.info("fixture.finish", { path, text });
      return entries();
    },
    async resetFile(path) {
      const data = lookup(fixtures, path);
      finished.delete(path);
      return data;
    },
  };
}
