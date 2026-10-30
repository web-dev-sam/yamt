import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { holdsEntry, runningAppsWith, sessionEntry } from "./processes";

const ENTRY = sessionEntry("/tmp/yamt-app-session-a-1");

test("an environment holds an entry only as a whole NUL-separated entry, never as a prefix", () => {
  const environ = "HOME=/tmp/s/home\0YAMT_APP_SESSION=/tmp/yamt-app-session-a-1\0PATH=/usr/bin\0";
  expect(holdsEntry(environ, ENTRY)).toBe(true);
  expect(holdsEntry(environ, sessionEntry("/tmp/yamt-app-session-a"))).toBe(false);
  expect(holdsEntry(environ, sessionEntry("/tmp/yamt-app-session-a-1/home"))).toBe(false);
  expect(holdsEntry("", ENTRY)).toBe(false);
});

test("the session key is its own variable naming the session folder, so two sessions sharing a --home differ", () => {
  expect(ENTRY).toEqual({ name: "YAMT_APP_SESSION", value: "/tmp/yamt-app-session-a-1" });
  expect(sessionEntry("/tmp/yamt-app-session-b-2")).not.toEqual(ENTRY);
});

test("a running process named yamt with the entry is found with its start time; other entries and names are not", async () => {
  const folder = mkdtempSync(join(tmpdir(), "yamt-sweep-"));
  const entry = sessionEntry(folder);
  symlinkSync("/usr/bin/sleep", join(folder, "yamt"));
  symlinkSync("/usr/bin/sleep", join(folder, "other"));
  const env = { ...process.env, [entry.name]: entry.value };
  const app = spawn(join(folder, "yamt"), ["30"], { env });
  const other = spawn(join(folder, "other"), ["30"], { env });
  try {
    await Promise.all([once(app, "spawn"), once(other, "spawn")]);
    const found = runningAppsWith(entry);
    expect(found.map(({ role, pid }) => ({ role, pid }))).toEqual([
      { role: "yamt child", pid: app.pid },
    ]);
    expect(found[0]?.startTicks).toBeGreaterThan(0);
    expect(runningAppsWith(sessionEntry(`${folder}-not`))).toEqual([]);
  } finally {
    app.kill();
    other.kill();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("a process whose environ, stat or name cannot be read (another user's, or gone) is skipped, as is a /proc entry that is no process id; the others are found", () => {
  const root = mkdtempSync(join(tmpdir(), "yamt-proc-"));
  const stat = readFileSync("/proc/self/stat", "utf8");
  const environ = `${ENTRY.name}=${ENTRY.value}\0`;
  for (const name of ["4101", "4102", "4103", "4104", "self"]) {
    mkdirSync(join(root, name));
  }
  for (const name of ["4101", "4102", "4103", "self"]) {
    writeFileSync(join(root, name, "comm"), "yamt\n");
  }
  for (const name of ["4101", "4102", "4104", "self"]) {
    writeFileSync(join(root, name, "stat"), stat);
  }
  for (const name of ["4102", "4103", "4104", "self"]) {
    writeFileSync(join(root, name, "environ"), environ);
  }
  try {
    expect(runningAppsWith(ENTRY, root).map(({ pid }) => pid)).toEqual([4102]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
