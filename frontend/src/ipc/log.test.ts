import { afterEach, expect, test, vi } from "vitest";

import { createLog, type LogEntry } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("warn mirrors one console line and forwards the entry once", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const forwarded: LogEntry[] = [];
  const log = createLog((entry) => {
    forwarded.push(entry);
  });

  log.warn("scroll.drift", { lines: 3, path: "a.ts" });

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith('[warn] scroll.drift {lines: 3, path: "a.ts"}');
  expect(forwarded).toEqual([
    { level: "warn", event: "scroll.drift", fields: { lines: 3, path: "a.ts" } },
  ]);
});

test("a throwing forward never reaches the caller and mirrors the failure", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const log = createLog(() => {
    throw new Error("ipc down");
  });

  expect(() => log.error("apply.chunk", { id: 1 })).not.toThrow();
  expect(error.mock.calls).toEqual([
    ["[error] apply.chunk {id: 1}"],
    ['[error] log.forward_failed {reason: "ipc down"}'],
  ]);
});

test("a rejecting async forward mirrors the failure", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const log = createLog(async () => {
    await Promise.resolve();
    throw new Error("ipc gone");
  });

  log.error("apply.chunk", { id: 2 });

  await vi.waitFor(() => {
    expect(error.mock.calls).toEqual([
      ["[error] apply.chunk {id: 2}"],
      ['[error] log.forward_failed {reason: "ipc gone"}'],
    ]);
  });
});

test("debug is mirrored but not forwarded outside dev", () => {
  vi.stubEnv("DEV", false);
  const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
  const forwarded: LogEntry[] = [];
  const log = createLog((entry) => {
    forwarded.push(entry);
  });

  log.debug("scroll.tick");

  expect(debug).toHaveBeenCalledWith("[debug] scroll.tick {}");
  expect(forwarded).toEqual([]);
});

test("debug is forwarded in dev", () => {
  vi.stubEnv("DEV", true);
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
  const forwarded: LogEntry[] = [];
  const log = createLog((entry) => {
    forwarded.push(entry);
  });

  log.debug("scroll.tick");

  expect(forwarded).toEqual([{ level: "debug", event: "scroll.tick", fields: {} }]);
});
