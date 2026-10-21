import { expect, test, vi } from "vitest";

import {
  createFixtureCompareSource,
  log,
  nextColumnVersion,
  type Column,
  type ColumnVersions,
} from "../../ipc";
import { SETTLE_PAUSE_MS, Settle, type Timers } from "./compareSettle";

type FakeTimers = {
  readonly timers: Timers;
  readonly advance: (ms: number) => void;
  readonly pending: () => number;
};

function fakeTimers(): FakeTimers {
  let now = 0;
  let nextId = 1;
  const due = new Map<number, { readonly at: number; readonly run: () => void }>();
  return {
    timers: {
      set: (run, ms) => {
        const id = nextId++;
        due.set(id, { at: now + ms, run });
        return id;
      },
      clear: (id) => {
        due.delete(id);
      },
    },
    advance: (ms) => {
      now += ms;
      for (const [id, timer] of due) {
        if (timer.at <= now) {
          due.delete(id);
          timer.run();
        }
      }
    },
    pending: () => due.size,
  };
}

async function startVersions(): Promise<ColumnVersions> {
  const source = createFixtureCompareSource(log, "", {});
  const start = await source.openCompare();
  if (!start.ok) {
    throw new Error("fixture compare did not open");
  }
  const tab = await source.loadTab(start.value.list.shown);
  if (!tab.ok) {
    throw new Error("fixture compare lost its tab");
  }
  return tab.value.comparison.versions;
}

test("one settle after the pause, with exactly the columns edited since the last one", async () => {
  const fake = fakeTimers();
  const settled = vi.fn<(columns: readonly Column[]) => void>();
  const settle = new Settle(await startVersions(), settled, fake.timers);

  settle.edited("left");
  fake.advance(SETTLE_PAUSE_MS - 1);
  settle.edited("left");
  fake.advance(SETTLE_PAUSE_MS - 1);
  expect(settled).not.toHaveBeenCalled();
  fake.advance(1);
  expect(settled.mock.calls).toEqual([[["left"]]]);

  settle.edited("right");
  fake.advance(SETTLE_PAUSE_MS);
  expect(settled.mock.calls).toEqual([[["left"]], [["right"]]]);
});

test("an edit raises only its own column's version; a reply with an old right version is refused", async () => {
  const start = await startVersions();
  const settle = new Settle(start, () => {}, fakeTimers().timers);

  settle.edited("right");

  expect(settle.versions()).toEqual({ left: start.left, right: nextColumnVersion(start.right) });
  expect(settle.accepts(start)).toBe(false);
  expect(settle.accepts({ left: start.left, right: nextColumnVersion(start.right) })).toBe(true);
  expect(
    settle.accepts({ left: nextColumnVersion(start.left), right: settle.versions().right }),
  ).toBe(false);
});

test("settleNow hands over the edited columns and cancels the pause", async () => {
  const fake = fakeTimers();
  const settled = vi.fn<(columns: readonly Column[]) => void>();
  const settle = new Settle(await startVersions(), settled, fake.timers);

  settle.edited("right");
  settle.edited("left");

  expect(settle.settleNow()).toEqual(["left", "right"]);
  expect(fake.pending()).toBe(0);
  expect(settle.settleNow()).toEqual([]);
  fake.advance(SETTLE_PAUSE_MS);
  expect(settled).not.toHaveBeenCalled();
});

test("destroy cancels the pause and forgets the edits", async () => {
  const fake = fakeTimers();
  const settled = vi.fn<(columns: readonly Column[]) => void>();
  const settle = new Settle(await startVersions(), settled, fake.timers);

  settle.edited("left");
  settle.destroy();

  expect(fake.pending()).toBe(0);
  expect(settle.settleNow()).toEqual([]);
});
