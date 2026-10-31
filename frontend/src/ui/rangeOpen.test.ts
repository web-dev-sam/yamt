import { expect, test } from "vitest";

import { createFixtureRangeSource, log, type Thread, type ThreadList } from "../ipc";
import { createRangeOpen, type RangeOpen } from "./rangeOpen";

async function seededList(): Promise<ThreadList> {
  const fixture = createFixtureRangeSource(log, "?range=review&threads=seeded");
  await fixture.openRange();
  const listed = await fixture.listThreads();
  if (!listed.ok) {
    throw new Error("the fixture listed no threads");
  }
  return listed.value;
}

const LIST = await seededList();

function threadAt(index: number): Thread {
  const thread = LIST.threads[index];
  if (thread === undefined) {
    throw new Error(`no thread at ${index}`);
  }
  return thread;
}

function keyAt(index: number): string {
  return `thread-${threadAt(index).id}`;
}

function openKeys(open: RangeOpen): string[] {
  return LIST.threads.flatMap(({ id }) => (open.open.value.has(id) ? [`thread-${id}`] : []));
}

test("a toggle opens all its threads when one is closed, closes all when all are open", () => {
  const open = createRangeOpen();

  open.toggle(LIST, [keyAt(0)]);
  expect(openKeys(open)).toEqual([keyAt(0)]);
  open.toggle(LIST, [keyAt(0), keyAt(1)]);
  expect(openKeys(open)).toEqual([keyAt(0), keyAt(1)]);
  open.toggle(LIST, [keyAt(0), keyAt(1)]);
  expect(openKeys(open)).toEqual([]);
  open.toggle(LIST, ["draft-7", "nothing"]);

  expect(openKeys(open)).toEqual([]);
});

test("a toggle changes only its own threads: other open threads stay open either way", () => {
  const open = createRangeOpen();

  open.toggle(LIST, [keyAt(2)]);
  open.toggle(LIST, [keyAt(0), keyAt(1)]);
  const afterOpening = openKeys(open);
  open.toggle(LIST, [keyAt(0)]);

  expect(afterOpening).toEqual([keyAt(0), keyAt(1), keyAt(2)]);
  expect(openKeys(open)).toEqual([keyAt(1), keyAt(2)]);
});

test("a thread added from a draft opens under the draft's key, other threads under their id", () => {
  const open = createRangeOpen();
  const added = threadAt(1);

  open.added(added.id, "draft-4");

  expect(open.boxOf(LIST, "draft-4")).toEqual({ kind: "thread", thread: added, open: true });
  expect(open.boxOf(LIST, keyAt(1))).toBeNull();
  expect(open.boxOf(LIST, keyAt(0))).toEqual({ kind: "thread", thread: threadAt(0), open: false });
  open.toggle(LIST, ["draft-4"]);
  expect(open.boxOf(LIST, "draft-4")).toMatchObject({ open: false });
});

test("shownFor lists a file's stored threads by key, open or collapsed", () => {
  const open = createRangeOpen();
  const { file } = threadAt(0);
  open.added(threadAt(2).id, "draft-0");

  expect(open.shownFor(LIST, file)).toEqual(
    LIST.threads.map(({ id, place }, index) => ({
      key: index === 2 ? "draft-0" : `thread-${id}`,
      place,
      shown: index === 2 ? "open" : "collapsed",
    })),
  );
  expect(open.shownFor({ threads: [] }, file)).toEqual([]);
});

test("keepListed drops threads the list no longer holds and keeps the set when it holds them all", () => {
  const open = createRangeOpen();
  open.toggle(LIST, [keyAt(0), keyAt(1)]);
  const before = open.open.value;

  open.keepListed(LIST);
  expect(open.open.value).toBe(before);

  open.keepListed({ threads: LIST.threads.slice(1) });
  expect(openKeys(open)).toEqual([keyAt(1)]);
});
