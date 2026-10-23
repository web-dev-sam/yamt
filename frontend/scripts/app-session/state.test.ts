import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";

import {
  parseStartTicks,
  parseState,
  readState,
  statePath,
  writeState,
  type AppState,
  type FixtureState,
} from "./state";

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

function scratch(): string {
  const folder = mkdtempSync(join(tmpdir(), "app-session-state-test-"));
  folders.push(folder);
  return folder;
}

const APP: AppState = {
  kind: "app",
  name: "smoke",
  driverPort: 4444,
  session: "f00",
  folder: "/tmp/yamt-app-session-smoke-x",
  size: { width: 1600, height: 1000 },
  procs: [
    { role: "xvfb", pid: 101, startTicks: 5000 },
    { role: "tauri-driver", pid: 102, startTicks: 5001 },
    { role: "ffmpeg", pid: 103, startTicks: 5002 },
    { role: "focus-window", pid: 104, startTicks: 5003 },
  ],
  display: 7,
  configDir: "/tmp/yamt-app-session-smoke-x/home/.config",
  repoDir: "/tmp/yamt-app-session-smoke-x/repo",
};

const FIXTURE: FixtureState = {
  kind: "fixture",
  name: "fx",
  driverPort: 4445,
  session: null,
  folder: "/tmp/yamt-app-session-fx-y",
  size: { width: 800, height: 600 },
  procs: [{ role: "vite", pid: 201, startTicks: 9 }],
  url: "http://localhost:4000/",
};

test("a state file is one per name under /tmp/yamt-app-session", () => {
  expect(statePath("smoke")).toBe("/tmp/yamt-app-session/smoke.json");
});

test("every process survives a write and a read, in order", () => {
  const path = join(scratch(), "nested", "smoke.json");
  writeState(path, APP);
  expect(readState(path)).toEqual(APP);
  writeState(path, FIXTURE);
  expect(readState(path)).toEqual(FIXTURE);
});

test("a raw session opens no repository and reads back with none, not an empty path", () => {
  const path = join(scratch(), "raw.json");
  const raw: AppState = { ...APP, repoDir: null };
  writeState(path, raw);
  expect(readState(path)).toEqual(raw);
  expect(() => parseState(JSON.stringify({ ...APP, repoDir: 7 }))).toThrow(/field "repoDir"/);
});

test("a missing state file reads as no session; a broken one is an error naming the file", () => {
  const folder = scratch();
  expect(readState(join(folder, "none.json"))).toBeNull();
  const broken = join(folder, "broken.json");
  writeFileSync(broken, "{");
  expect(() => readState(broken)).toThrow(broken);
});

test("a process without a usable pid is refused, not dropped", () => {
  const procs = [...APP.procs, { role: "lost", startTicks: 1 }];
  expect(() => parseState(JSON.stringify({ ...APP, procs }))).toThrow(/field "pid"/);
  const zero = [...APP.procs, { role: "init", pid: 1, startTicks: 1 }];
  expect(() => parseState(JSON.stringify({ ...APP, procs: zero }))).toThrow(
    /"init": pid 1 is not a process id/,
  );
  const fraction = [{ role: "half", pid: 10.5, startTicks: 1 }];
  expect(() => parseState(JSON.stringify({ ...APP, procs: fraction }))).toThrow(/pid 10.5/);
});

test("a state of an unknown kind or without its kind's fields is refused", () => {
  expect(() => parseState(JSON.stringify({ ...APP, kind: "other" }))).toThrow(
    /unknown kind "other"/,
  );
  const { display: _display, ...withoutDisplay } = APP;
  expect(() => parseState(JSON.stringify(withoutDisplay))).toThrow(/field "display"/);
  expect(() => parseState(JSON.stringify({ ...APP, procs: {} }))).toThrow(/field "procs"/);
});

test("the partial file is renamed into place, so no reader sees half a state", () => {
  const path = join(scratch(), "fx.json");
  writeState(path, FIXTURE);
  expect(() => readFileSync(`${path}.partial`)).toThrow(/ENOENT/);
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(FIXTURE);
});

test("start ticks are field 22 of /proc/<pid>/stat, even when the command name holds ') '", () => {
  const after = "S 1 1234 1234 0 -1 4194560 100 0 0 0 1 2 0 0 20 0 1 0 987654 12345678 300";
  expect(parseStartTicks(`1234 (tauri-driver) ${after}`)).toBe(987654);
  expect(parseStartTicks(`1234 (a) b (c)) ${after}`)).toBe(987654);
  expect(() => parseStartTicks("1234 (x) S 1")).toThrow(/no start time/);
});

test("this process's own stat line has an integer start time", () => {
  expect(Number.isInteger(parseStartTicks(readFileSync("/proc/self/stat", "utf8")))).toBe(true);
});
