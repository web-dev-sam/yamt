import { afterEach, expect, test, vi } from "vitest";

import { createLog, type LogEntry } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
});

test("warn mirrors one console line and forwards the entry once", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const forwarded: LogEntry[] = [];
  const log = createLog((entry) => forwarded.push(entry));

  log.warn("scroll.drift", { lines: 3, path: "a.ts" });

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith('[warn] scroll.drift {lines: 3, path: "a.ts"}');
  expect(forwarded).toEqual([
    { level: "warn", event: "scroll.drift", fields: { lines: 3, path: "a.ts" } },
  ]);
});

test("a throwing forward never reaches the caller", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const log = createLog(() => {
    throw new Error("ipc down");
  });

  expect(() => log.error("apply.chunk", { id: 1 })).not.toThrow();
});
