import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { numberField, recordOf, stringField, type JsonRecord } from "./json";

const STATE_DIR = "/tmp/yamt-app-session";
// proc(5): field 22 of /proc/<pid>/stat is starttime; the fields after comm's ") " start at field 3.
const COMM_END = ") ";
const START_TIME_INDEX = 19;

export type Size = { readonly width: number; readonly height: number };

/** A process this tool started: its group leader and its start time, so a reused pid is never killed. */
export type Proc = { readonly role: string; readonly pid: number; readonly startTicks: number };

type Common = {
  readonly name: string;
  readonly driverPort: number;
  readonly session: string | null;
  readonly folder: string;
  readonly size: Size;
  readonly procs: readonly Proc[];
};

export type AppState = Common & {
  readonly kind: "app";
  readonly display: number;
  readonly configDir: string;
  readonly repoDir: string;
};

export type FixtureState = Common & { readonly kind: "fixture"; readonly url: string };

export type SessionState = AppState | FixtureState;

export function statePath(name: string): string {
  return join(STATE_DIR, `${name}.json`);
}

export function parseStartTicks(stat: string): number {
  const fields = stat.slice(stat.lastIndexOf(COMM_END) + COMM_END.length).split(" ");
  const ticks = Number(fields[START_TIME_INDEX]);
  if (!Number.isInteger(ticks)) {
    throw new Error(`no start time in /proc stat line: ${stat}`);
  }
  return ticks;
}

function parseProc(value: unknown): Proc {
  const record = recordOf(value, "process");
  const pid = numberField(record, "pid");
  if (!Number.isInteger(pid) || pid <= 1) {
    throw new Error(`process "${stringField(record, "role")}": pid ${pid} is not a process id`);
  }
  return { role: stringField(record, "role"), pid, startTicks: numberField(record, "startTicks") };
}

function parseCommon(record: JsonRecord): Common {
  const procs = record["procs"];
  if (!Array.isArray(procs)) {
    throw new Error(`field "procs": expected a list, got ${JSON.stringify(procs)}`);
  }
  const size = recordOf(record["size"], "size");
  return {
    name: stringField(record, "name"),
    driverPort: numberField(record, "driverPort"),
    session: record["session"] === null ? null : stringField(record, "session"),
    folder: stringField(record, "folder"),
    size: { width: numberField(size, "width"), height: numberField(size, "height") },
    procs: procs.map(parseProc),
  };
}

export function parseState(text: string): SessionState {
  const record = recordOf(JSON.parse(text), "state file");
  const common = parseCommon(record);
  const kind = record["kind"];
  if (kind === "app") {
    return {
      ...common,
      kind,
      display: numberField(record, "display"),
      configDir: stringField(record, "configDir"),
      repoDir: stringField(record, "repoDir"),
    };
  }
  if (kind === "fixture") {
    return { ...common, kind, url: stringField(record, "url") };
  }
  throw new Error(`state file: unknown kind ${JSON.stringify(kind)}`);
}

export function readState(path: string): SessionState | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return parseState(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

export function writeState(path: string, state: SessionState): void {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.partial`;
  writeFileSync(partial, `${JSON.stringify(state)}\n`);
  renameSync(partial, path);
}
