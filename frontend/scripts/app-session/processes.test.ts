import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { holdsEntry, runningAppsWith } from "./processes";

test("an environment holds an entry only as a whole NUL-separated entry, never as a prefix", () => {
  const environ = "HOME=/tmp/s/home\0XDG_CONFIG_HOME=/tmp/s/home/.config\0PATH=/usr/bin\0";
  expect(holdsEntry(environ, "XDG_CONFIG_HOME=/tmp/s/home/.config")).toBe(true);
  expect(holdsEntry(environ, "XDG_CONFIG_HOME=/tmp/s/home")).toBe(false);
  expect(holdsEntry(environ, "XDG_CONFIG_HOME=/tmp/s/home/.config/yamt")).toBe(false);
  expect(holdsEntry("", "XDG_CONFIG_HOME=/tmp/s/home/.config")).toBe(false);
});

test("a running process named yamt with the entry is found with its start time; other entries and names are not", async () => {
  const folder = mkdtempSync(join(tmpdir(), "yamt-sweep-"));
  const entry = `YAMT_SWEEP_PROBE=${folder}`;
  symlinkSync("/usr/bin/sleep", join(folder, "yamt"));
  symlinkSync("/usr/bin/sleep", join(folder, "other"));
  const app = spawn(join(folder, "yamt"), ["30"], {
    env: { ...process.env, YAMT_SWEEP_PROBE: folder },
  });
  const other = spawn(join(folder, "other"), ["30"], {
    env: { ...process.env, YAMT_SWEEP_PROBE: folder },
  });
  try {
    await Promise.all([once(app, "spawn"), once(other, "spawn")]);
    const found = runningAppsWith(entry);
    expect(found.map(({ role, pid }) => ({ role, pid }))).toEqual([
      { role: "yamt child", pid: app.pid },
    ]);
    expect(found[0]?.startTicks).toBeGreaterThan(0);
    expect(runningAppsWith(`${entry}-not`)).toEqual([]);
  } finally {
    app.kill();
    other.kill();
    rmSync(folder, { recursive: true, force: true });
  }
});
