import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { loadCompareFixture, nextColumnVersion, type Column, type ColumnVersions } from "../../ipc";
import { SETTLE_PAUSE_MS, Settle } from "./compareSettle";

async function startVersions(): Promise<ColumnVersions> {
  return (await loadCompareFixture("words")).comparison.versions;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("one settle after the pause, with exactly the columns edited since the last one", async () => {
  const settled = vi.fn<(columns: readonly Column[]) => void>();
  const settle = new Settle(await startVersions(), settled);

  settle.edited("left");
  vi.advanceTimersByTime(SETTLE_PAUSE_MS - 1);
  settle.edited("left");
  vi.advanceTimersByTime(SETTLE_PAUSE_MS - 1);
  expect(settled).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(settled.mock.calls).toEqual([[["left"]]]);

  settle.edited("right");
  vi.advanceTimersByTime(SETTLE_PAUSE_MS);
  expect(settled.mock.calls).toEqual([[["left"]], [["right"]]]);
});

test("an edit raises only its own column's version; a reply with an old right version is refused", async () => {
  const start = await startVersions();
  const settle = new Settle(start, () => {});

  settle.edited("right");

  expect(settle.versions()).toEqual({ left: start.left, right: nextColumnVersion(start.right) });
  expect(settle.accepts(start)).toBe(false);
  expect(settle.accepts({ left: start.left, right: nextColumnVersion(start.right) })).toBe(true);
  expect(
    settle.accepts({ left: nextColumnVersion(start.left), right: settle.versions().right }),
  ).toBe(false);
});

test("settleNow hands over the edited columns and cancels the pause", async () => {
  const settled = vi.fn<(columns: readonly Column[]) => void>();
  const settle = new Settle(await startVersions(), settled);

  settle.edited("right");
  settle.edited("left");

  expect(settle.settleNow()).toEqual(["left", "right"]);
  expect(vi.getTimerCount()).toBe(0);
  expect(settle.settleNow()).toEqual([]);
  vi.advanceTimersByTime(SETTLE_PAUSE_MS);
  expect(settled).not.toHaveBeenCalled();
});

test("destroy cancels the pause and forgets the edits", async () => {
  const settle = new Settle(await startVersions(), () => {});

  settle.edited("left");
  settle.destroy();

  expect(vi.getTimerCount()).toBe(0);
  expect(settle.settleNow()).toEqual([]);
});
