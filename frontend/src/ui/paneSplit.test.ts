import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { createPaneSplit, dragged, EQUAL_SPLIT, paneColumns } from "./paneSplit";

const KEY = "yamt.panes.split";

afterEach(() => {
  vi.restoreAllMocks();
});

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  readonly items: Map<string, string>;
} {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

function spyWarnings(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    lines.push(line);
  });
  return lines;
}

test("equal thirds are the starting split", () => {
  expect(EQUAL_SPLIT).toEqual({ local: 1 / 3, remote: 1 / 3 });
});

test("a missing key gives thirds and writes nothing", () => {
  const storage = memoryStorage({ other: "x" });

  expect(createPaneSplit(storage).paneSplit.value).toEqual(EQUAL_SPLIT);
  expect([...storage.items.entries()]).toEqual([["other", "x"]]);
});

test("a stored split is read back", () => {
  const storage = memoryStorage({ [KEY]: '{"local":0.3,"remote":0.25}' });

  expect(createPaneSplit(storage).paneSplit.value).toEqual({ local: 0.3, remote: 0.25 });
});

test.each([
  ["empty", ""],
  ["not JSON", "x"],
  ["null", "null"],
  ["a number", "0.3"],
  ["an array", "[]"],
  ["an empty object", "{}"],
  ["string numbers", '{"local":"0.3","remote":"0.3"}'],
  ["local a string", '{"local":"0.3","remote":0.3}'],
  ["remote a string", '{"local":0.3,"remote":"0.3"}'],
  ["no remote", '{"local":0.3}'],
  ["no local", '{"remote":0.3}'],
  ["a zero Result", '{"local":0.5,"remote":0.5}'],
  ["a Result under 1 %", '{"local":0.5,"remote":0.495}'],
  ["a negative local", '{"local":-0.1,"remote":0.3}'],
  ["a negative remote", '{"local":0.3,"remote":-0.1}'],
  ["local under 1 %", '{"local":0.005,"remote":0.3}'],
  ["remote under 1 %", '{"local":0.3,"remote":0.005}'],
  ["an infinite share", '{"local":1e400,"remote":0.3}'],
])("a stored value that is %s gives thirds without a warning", (_name, raw) => {
  const warnings = spyWarnings();

  expect(createPaneSplit(memoryStorage({ [KEY]: raw })).paneSplit.value).toEqual(EQUAL_SPLIT);
  expect(warnings).toEqual([]);
});

test("the edges of the valid range are kept", () => {
  expect(
    createPaneSplit(memoryStorage({ [KEY]: '{"local":0.01,"remote":0.98}' })).paneSplit.value,
  ).toEqual({ local: 0.01, remote: 0.98 });
  expect(
    createPaneSplit(memoryStorage({ [KEY]: '{"local":0.98,"remote":0.01}' })).paneSplit.value,
  ).toEqual({ local: 0.98, remote: 0.01 });
});

test("a set split is written and a second start reads it; reset gives thirds", () => {
  const storage = memoryStorage();
  const first = createPaneSplit(storage);

  first.setPaneSplit({ local: 0.4, remote: 0.25 });
  expect(first.paneSplit.value).toEqual({ local: 0.4, remote: 0.25 });
  expect(storage.items.get(KEY)).toBe('{"local":0.4,"remote":0.25}');
  expect(createPaneSplit(storage).paneSplit.value).toEqual({ local: 0.4, remote: 0.25 });

  first.resetPaneSplit();
  expect(first.paneSplit.value).toEqual(EQUAL_SPLIT);
  expect(createPaneSplit(storage).paneSplit.value).toEqual(EQUAL_SPLIT);
});

test("a storage that throws gives thirds, still sets the split in memory, and warns", () => {
  const warnings = spyWarnings();
  const failing: StorageLike = {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("quota exceeded");
    },
    removeItem: () => {
      throw new Error("storage disabled");
    },
  };

  const split = createPaneSplit(failing);
  expect(split.paneSplit.value).toEqual(EQUAL_SPLIT);
  expect(warnings).toEqual([
    '[warn] panes.storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  split.setPaneSplit({ local: 0.2, remote: 0.3 });
  expect(split.paneSplit.value).toEqual({ local: 0.2, remote: 0.3 });
  expect(warnings).toHaveLength(2);
});

test("a drag of the local divider moves Local and Result and keeps Remote's pixels", () => {
  const split = dragged({ local: 300, center: 400, remote: 300 }, "local", 100);

  expect(split).toEqual({ local: 0.4, remote: 0.3 });
  expect(split.remote * 1000).toBe(300);
});

test("the local divider stops at 220 px for Result and for Local", () => {
  const widths = { local: 300, center: 400, remote: 300 };

  const right = dragged(widths, "local", 250);
  expect(right.local * 1000).toBe(480);
  expect((1 - right.local - right.remote) * 1000).toBeCloseTo(220, 9);
  expect(right.remote * 1000).toBe(300);

  const left = dragged(widths, "local", -200);
  expect(left.local * 1000).toBe(220);
  expect(left.remote * 1000).toBe(300);
});

test("on a narrow row the minimum is a third, so a drag from thirds changes nothing", () => {
  const widths = { local: 200, center: 200, remote: 200 };

  expect(dragged(widths, "local", 50)).toEqual({ local: 1 / 3, remote: 1 / 3 });
  expect(dragged(widths, "local", -50)).toEqual({ local: 1 / 3, remote: 1 / 3 });
  expect(dragged(widths, "remote", 50)).toEqual({ local: 1 / 3, remote: 1 / 3 });
});

test("a pair narrower than two minimums splits evenly and stays total", () => {
  const widths = { local: 300, center: 100, remote: 600 };

  for (const dx of [-500, 0, 500]) {
    const split = dragged(widths, "local", dx);
    expect(split).toEqual({ local: 0.2, remote: 0.6 });
    expect(1 - split.local - split.remote).toBeGreaterThanOrEqual(0.01);
  }
});

test("the remote divider mirrors the local one", () => {
  const widths = { local: 300, center: 400, remote: 300 };

  expect(dragged(widths, "remote", -100)).toEqual({ local: 0.3, remote: 0.4 });
  expect(dragged(widths, "remote", 50)).toEqual({ local: 0.3, remote: 0.25 });
  const left = dragged(widths, "remote", -250);
  expect(left.remote * 1000).toBe(480);
  expect(left.local * 1000).toBe(300);
  expect(dragged(widths, "remote", 200).remote * 1000).toBe(220);
});

test("a press without a move gives the measured shares", () => {
  const widths = { local: 250, center: 500, remote: 250 };

  expect(dragged(widths, "local", 0)).toEqual({ local: 0.25, remote: 0.25 });
  expect(dragged(widths, "remote", 0)).toEqual({ local: 0.25, remote: 0.25 });
});

test("the strip grid has five tracks with the strips' 2.5rem in each pane's minimum", () => {
  const least = "min(220px, calc((100% - 2 * 2.5rem) / 3))";

  expect(paneColumns({ local: 0.2, remote: 0.3 }, "strip")).toBe(
    `minmax(${least}, 20fr) 2.5rem minmax(${least}, 50fr) 2.5rem minmax(${least}, 30fr)`,
  );
});

test("the choice grid has five tracks with 1px gaps in each pane's minimum", () => {
  const least = "min(220px, calc((100% - 2 * 1px) / 3))";

  expect(paneColumns({ local: 0.25, remote: 0.5 }, "gap")).toBe(
    `minmax(${least}, 25fr) 1px minmax(${least}, 25fr) 1px minmax(${least}, 50fr)`,
  );
});

test("every fr factor is at least 1 at the edges of the valid range", () => {
  for (const split of [
    { local: 0.01, remote: 0.98 },
    { local: 0.98, remote: 0.01 },
    { local: 0.495, remote: 0.495 },
  ]) {
    const factors = [...paneColumns(split, "strip").matchAll(/([\d.]+)fr/gu)].map((match) =>
      Number(match[1]),
    );
    expect(factors).toHaveLength(3);
    expect(Math.min(...factors)).toBeGreaterThanOrEqual(1);
  }
});
