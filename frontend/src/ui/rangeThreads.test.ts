import { expect, test } from "vitest";

import {
  changedThreadLine,
  createFixtureRangeSource,
  log,
  unchangedThreadLine,
  type RangeFileId,
  type RangeSource,
  type SourceFailure,
  type Message,
  type Thread,
} from "../ipc";
import type { Problem } from "./problem";
import { createRangeStore, MOUNTED_FILES } from "./rangeStore";
import { createRangeThreads, isChangeable, isQueued, type RangeThreads } from "./rangeThreads";

type Edit = (fixture: RangeSource) => Partial<RangeSource>;

type Opened = {
  readonly threads: RangeThreads;
  readonly problems: Problem[];
  readonly board: RangeFileId;
  readonly other: RangeFileId;
};

const SEEDED = "?range=review&threads=seeded";
const UNKNOWN: SourceFailure = { kind: "UnknownRangeFile", file: 99 };

async function opened(search = "?range=review", edit: Edit = () => ({})): Promise<Opened> {
  const fixture = createFixtureRangeSource(log, search);
  const start = await fixture.openRange();
  if (!start.ok) {
    throw new Error("the fixture did not open");
  }
  const { files } = start.value;
  function idOf(path: string): RangeFileId {
    const entry = files.find((each) => each.path === path);
    if (entry === undefined) {
      throw new Error(`no ${path}`);
    }
    return entry.id;
  }
  const problems: Problem[] = [];
  const threads = createRangeThreads({ ...fixture, ...edit(fixture) }, (problem) => {
    problems.push(problem);
  });
  await threads.load();
  return { threads, problems, board: idOf("src/board/board.ts"), other: idOf("config") };
}

function threadAt(threads: RangeThreads, index: number): Thread {
  const thread = threads.list.value.threads[index];
  if (thread === undefined) {
    throw new Error(`no thread at ${index}`);
  }
  return thread;
}

function texts(thread: Thread): string[] {
  return thread.messages.map(({ body }) => (body.kind === "note" ? body.text : "ai"));
}

function messageOf(thread: Thread): Message {
  const [first] = thread.messages;
  if (first === undefined) {
    throw new Error("no message");
  }
  return first;
}

function manyFiles(count: number): unknown {
  const paths = Array.from({ length: count }, (_, index) => `src/f${index}.ts`);
  const side = { label: { kind: "named", name: "main" }, short_id: "1b2cfed", subject: "Start" };
  return {
    start: {
      range: "main...feature",
      left: side,
      right: { ...side, label: { kind: "named", name: "feature" }, short_id: "2b3b4b5" },
      files: paths.map((path, id) => ({
        id,
        path,
        change: { kind: "modified" },
        lines: { kind: "counted", added: 1, removed: 1 },
      })),
    },
    files: paths.map((path) => ({
      kind: "texts",
      left: `${path}\n`,
      right: `${path}!\n`,
      differences: [],
      mode: { kind: "same" },
    })),
  };
}

test("a draft's Comment adds the thread and its key becomes the stored id with the text kept", async () => {
  const { threads, board } = await opened();
  const line = changedThreadLine("right", 3);
  threads.startThread(board, line);
  expect(threads.shownFor(board)).toEqual([{ key: "draft-0", line, shown: "draft" }]);
  expect(threads.boxOf("draft-0")).toEqual({
    kind: "draft",
    draft: { kind: "thread", file: board, line, text: "", focus: 0 },
  });

  threads.writeDraft("draft-0", "Why 300?");
  await threads.addThread("draft-0", "Why 300?");

  const thread = threadAt(threads, 0);
  expect(texts(thread)).toEqual(["Why 300?"]);
  expect(thread.line).toEqual(line);
  expect(threads.drafts.value.size).toBe(0);
  expect(threads.open.value).toEqual(new Set([thread.id]));
  expect(threads.shownFor(board)).toEqual([{ key: "draft-0", line, shown: "open" }]);
  expect(threads.boxOf("draft-0")).toEqual({ kind: "thread", thread, open: true });
});

test("a refused Comment keeps the draft with its text and reports the add", async () => {
  const { threads, problems, board } = await opened("?range=review", () => ({
    addThread: async () => ({ ok: false, failure: UNKNOWN }),
  }));
  threads.startThread(board, changedThreadLine("left", 1));

  await threads.addThread("draft-0", "Why 300?");

  expect(threads.list.value.threads).toEqual([]);
  expect(threads.drafts.value.get("draft-0")).toMatchObject({ kind: "thread", text: "Why 300?" });
  expect(problems).toEqual([{ action: "threads", step: "add", cause: UNKNOWN }]);
});

test("a second Comment while the first is in flight sends nothing more", async () => {
  let calls = 0;
  const { threads, board } = await opened("?range=review", (fixture) => ({
    addThread: async (file, line, text) => {
      calls += 1;
      return fixture.addThread(file, line, text);
    },
  }));
  threads.startThread(board, changedThreadLine("left", 1));

  await Promise.all([threads.addThread("draft-0", "a"), threads.addThread("draft-0", "a")]);

  expect(calls).toBe(1);
  expect(threads.list.value.threads).toHaveLength(1);
});

test("after a refused Comment the next Comment on that draft is sent and stored once", async () => {
  let calls = 0;
  const { threads, problems, board } = await opened("?range=review", (fixture) => ({
    addThread: async (file, line, text) => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, failure: UNKNOWN };
      }
      return fixture.addThread(file, line, text);
    },
  }));
  threads.startThread(board, changedThreadLine("left", 1));

  await threads.addThread("draft-0", "a");
  await threads.addThread("draft-0", "a");

  expect(calls).toBe(2);
  expect(problems).toHaveLength(1);
  expect(threads.list.value.threads.map(texts)).toEqual([["a"]]);
  expect(threads.drafts.value.size).toBe(0);
});

test("a Comment on a key with no draft makes no call and reports nothing", async () => {
  let calls = 0;
  const { threads, problems } = await opened("?range=review", (fixture) => ({
    addThread: async (file, line, text) => {
      calls += 1;
      return fixture.addThread(file, line, text);
    },
  }));

  await threads.addThread("draft-9", "x");

  expect(calls).toBe(0);
  expect(problems).toEqual([]);
  expect(threads.drafts.value.size).toBe(0);
});

test("a refused Comment whose draft was dropped while it ran brings no draft back", async () => {
  const openers: (() => void)[] = [];
  const gate = new Promise<void>((resolve) => {
    openers.push(resolve);
  });
  const { threads, problems, board } = await opened("?range=review", () => ({
    addThread: async () => {
      await gate;
      return { ok: false, failure: UNKNOWN };
    },
  }));
  threads.startThread(board, changedThreadLine("left", 1));
  const adding = threads.addThread("draft-0", "late");
  threads.dropDraft("draft-0");

  for (const open of openers) {
    open();
  }
  await adding;

  expect(threads.drafts.value.size).toBe(0);
  expect(problems).toEqual([{ action: "threads", step: "add", cause: UNKNOWN }]);
});

test("a second press on a line with an open draft focuses it, with no second draft", async () => {
  const { threads, board, other } = await opened();
  const line = unchangedThreadLine("left", { left: 4, right: 6 });
  threads.startThread(board, line);
  threads.writeDraft("draft-0", "half");

  threads.startThread(board, unchangedThreadLine("left", { left: 4, right: 6 }));

  expect([...threads.drafts.value]).toEqual([
    ["draft-0", { kind: "thread", file: board, line, text: "half", focus: 1 }],
  ]);

  threads.startThread(board, unchangedThreadLine("right", { left: 4, right: 6 }));
  threads.startThread(board, changedThreadLine("left", 5));
  threads.startThread(other, line);
  expect([...threads.drafts.value.keys()]).toEqual(["draft-0", "draft-1", "draft-2", "draft-3"]);
});

test("a dropped draft leaves the line; writing a missing draft creates nothing", async () => {
  const { threads, board } = await opened();
  threads.startThread(board, changedThreadLine("left", 1));

  threads.dropDraft("draft-0");
  threads.writeDraft("draft-0", "late");

  expect(threads.drafts.value.size).toBe(0);
  expect(threads.shownFor(board)).toEqual([]);
});

test("stored threads come back collapsed; open and collapse per thread and per line", async () => {
  const { threads, board } = await opened(SEEDED);
  const keys = ["thread-0", "thread-1", "thread-2", "thread-3"];
  expect(threads.shownFor(board).map(({ key, shown }) => [key, shown])).toEqual(
    keys.map((key) => [key, "collapsed"]),
  );

  threads.toggle(["thread-0"]);
  expect([...threads.open.value]).toEqual([threadAt(threads, 0).id]);
  expect(threads.boxOf("thread-0")).toMatchObject({ kind: "thread", open: true });

  threads.toggle(["thread-0", "thread-1"]);
  expect(threads.open.value.size).toBe(2);

  threads.toggle(["thread-0", "thread-1"]);
  expect(threads.open.value.size).toBe(0);

  threads.toggle(["draft-7", "nothing"]);
  expect(threads.open.value.size).toBe(0);
  expect(threads.boxOf("nothing")).toBeNull();
});

test("counts per file ignore drafts", async () => {
  const { threads, board, other } = await opened(SEEDED);
  threads.startThread(other, changedThreadLine("left", 0));
  threads.startThread(board, changedThreadLine("left", 0));

  expect([...threads.counts.value]).toEqual([[board, 4]]);

  await threads.addThread("draft-0", "here");

  expect(threads.counts.value.get(other)).toBe(1);
  expect(threads.counts.value.get(board)).toBe(4);
  expect(threads.shownFor(other)).toEqual([
    { key: "draft-0", line: changedThreadLine("left", 0), shown: "open" },
  ]);
  expect(threads.shownFor(board).map(({ key }) => key)).toEqual([
    "thread-0",
    "thread-1",
    "thread-2",
    "thread-3",
    "draft-1",
  ]);
});

test("blank text is never sent", async () => {
  const sent: string[] = [];
  const { threads, board } = await opened(SEEDED, (fixture) => ({
    addThread: async (file, line, text) => {
      sent.push("thread");
      return fixture.addThread(file, line, text);
    },
    addNote: async (thread, text) => {
      sent.push("note");
      return fixture.addNote(thread, text);
    },
    queueMessage: async (message, text) => {
      sent.push("queue");
      return fixture.queueMessage(message, text);
    },
  }));
  const thread = threadAt(threads, 3);
  const [message] = thread.messages;
  if (message === undefined) {
    throw new Error("no message");
  }
  threads.startThread(board, changedThreadLine("left", 0));

  await threads.addThread("draft-0", "  \n");
  await threads.addNote(thread.id, "\t");
  await threads.queue(message.id, "");

  expect(sent).toEqual([]);
  expect(threads.drafts.value.has("draft-0")).toBe(true);
});

test("a note is added to its thread and its draft text cleared; a refused note keeps it", async () => {
  const { threads } = await opened(SEEDED);
  const { id } = threadAt(threads, 0);
  threads.writeNote(id, "More?");
  expect(threads.noteText(id)).toBe("More?");

  await threads.addNote(id, "More?");

  expect(texts(threadAt(threads, 0))).toEqual(["Why does the overdue check go?", "More?"]);
  expect(threads.noteText(id)).toBe("");

  const refused = await opened(SEEDED, () => ({
    addNote: async (thread) => ({ ok: false, failure: { kind: "UnknownThread", thread } }),
  }));
  await refused.threads.addNote(id, "Lost?");
  expect(refused.threads.noteText(id)).toBe("Lost?");
  expect(refused.problems).toEqual([
    { action: "threads", step: "note", cause: { kind: "UnknownThread", thread: id } },
  ]);
});

test("each thread keeps its own reply text", async () => {
  const { threads } = await opened(SEEDED);
  const [a, b] = [threadAt(threads, 0).id, threadAt(threads, 1).id];

  threads.writeNote(a, "x");
  threads.writeNote(b, "y");

  expect(threads.noteText(a)).toBe("x");
  expect(threads.noteText(b)).toBe("y");
});

test("a press on the same line number in the other column opens a second draft", async () => {
  const { threads, board } = await opened();

  threads.startThread(board, changedThreadLine("left", 3));
  threads.startThread(board, changedThreadLine("right", 3));

  expect([...threads.drafts.value.keys()]).toEqual(["draft-0", "draft-1"]);
});

test("writing a blank note drops its draft", async () => {
  const { threads } = await opened(SEEDED);
  const { id } = threadAt(threads, 0);
  threads.writeNote(id, "x");

  threads.writeNote(id, " ");

  expect(threads.drafts.value.size).toBe(0);
});

test("queue and unqueue change the posting and the queued count; a pending one reports", async () => {
  const { threads, problems } = await opened(SEEDED);
  expect(threads.queued.value).toBe(2);
  const [open] = threadAt(threads, 3).messages;
  const [pending] = threadAt(threads, 2).messages;
  if (open === undefined || pending === undefined) {
    throw new Error("no message");
  }

  await threads.queue(open.id, "Is it still used?");
  expect(threadAt(threads, 3).messages[0]?.posting).toEqual({
    kind: "queued",
    text: "Is it still used?",
  });
  expect(threads.queued.value).toBe(3);

  await threads.unqueue(open.id);
  expect(threads.queued.value).toBe(2);

  await threads.queue(pending.id, "again");
  await threads.unqueue(pending.id);
  expect(problems).toEqual([
    { action: "threads", step: "queue", cause: { kind: "MessagePending", message: pending.id } },
    { action: "threads", step: "unqueue", cause: { kind: "MessagePending", message: pending.id } },
  ]);
});

test("a half-edited Post text outlives a collapse and a reopen of its thread", async () => {
  const { threads } = await opened(SEEDED);
  const thread = threadAt(threads, 3);
  const { id } = messageOf(thread);
  const key = `thread-${thread.id}`;
  threads.toggle([key]);
  expect(threads.postDraft(id)).toBeNull();

  threads.writePost(id, "Is it");
  threads.writePost(id, "Is it still");
  threads.toggle([key]);
  expect(threads.boxOf(key)).toMatchObject({ kind: "thread", open: false });
  threads.toggle([key]);

  expect(threads.boxOf(key)).toMatchObject({ kind: "thread", open: true });
  expect(threads.postDraft(id)).toBe("Is it still");
});

test("an emptied Post text keeps its editor open; Cancel drops it", async () => {
  const { threads } = await opened(SEEDED);
  const { id } = messageOf(threadAt(threads, 3));
  threads.writePost(id, "x");

  threads.writePost(id, "");
  expect(threads.postDraft(id)).toBe("");

  threads.dropPost(id);
  expect(threads.postDraft(id)).toBeNull();
});

test("a queued Post closes its editor; a refused or blank Queue keeps the text", async () => {
  const { threads } = await opened(SEEDED);
  const open = messageOf(threadAt(threads, 3));
  const pending = messageOf(threadAt(threads, 2));
  threads.writePost(open.id, "Is it still used?");
  threads.writePost(pending.id, "again");

  await threads.queue(open.id, "  ");
  expect(threads.postDraft(open.id)).toBe("Is it still used?");
  await threads.queue(pending.id, "again");
  expect(threads.postDraft(pending.id)).toBe("again");

  await threads.queue(open.id, "Is it still used?");
  expect(threads.postDraft(open.id)).toBeNull();
  expect(threads.postDraft(pending.id)).toBe("again");
});

test("a Post text outlives its file's view: 16 other files evict file 0 and the text is still there", async () => {
  const fixture = createFixtureRangeSource(log, "?range=review", {
    "../../fixtures/range/review.json": manyFiles(MOUNTED_FILES + 1),
  });
  const store = createRangeStore(fixture, "dark", null);
  await store.startUp();
  const [first, ...others] = store.start.value?.files ?? [];
  if (first === undefined) {
    throw new Error("no file");
  }
  store.threads.startThread(first.id, changedThreadLine("right", 0));
  await store.threads.addThread("draft-0", "Why?");
  const { id } = messageOf(threadAt(store.threads, 0));
  store.threads.writePost(id, "Why is");

  for (const entry of others) {
    store.showFile(entry.path);
  }

  expect(store.visited.value).not.toContain(first);
  expect(store.threads.postDraft(id)).toBe("Why is");
});

test("a failed list reports it and keeps the empty list", async () => {
  const { threads, problems } = await opened(SEEDED, () => ({
    listThreads: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
  }));

  expect(threads.list.value.threads).toEqual([]);
  expect(problems).toEqual([{ action: "threads", step: "list", cause: { kind: "WorkerStopped" } }]);
});

test("a Cancel while Comment is in flight still adds and opens the thread", async () => {
  const openers: (() => void)[] = [];
  const gate = new Promise<void>((resolve) => {
    openers.push(resolve);
  });
  const { threads, board } = await opened("?range=review", (fixture) => ({
    addThread: async (file, line, text) => {
      await gate;
      return fixture.addThread(file, line, text);
    },
  }));
  const line = changedThreadLine("left", 2);
  threads.startThread(board, line);
  const adding = threads.addThread("draft-0", "late");
  threads.dropDraft("draft-0");

  for (const open of openers) {
    open();
  }
  await adding;

  expect(texts(threadAt(threads, 0))).toEqual(["late"]);
  expect(threads.shownFor(board)).toEqual([{ key: "draft-0", line, shown: "open" }]);
});

test("replace mirrors a send's list", async () => {
  const { threads } = await opened(SEEDED);
  const list = { threads: [threadAt(threads, 0)] };

  threads.replace(list);

  expect(threads.list.value).toBe(list);
});

test("queued and refused postings sit in the queue; not queued and pending do not", () => {
  const pending = { text: "a", draftNote: 4, mergeRequest: "!12", link: "https://x" };
  expect(isQueued({ kind: "queued", text: "a" })).toBe(true);
  expect(isQueued({ kind: "refused", text: "a", reason: "gone" })).toBe(true);
  expect(isQueued({ kind: "notQueued" })).toBe(false);
  expect(isQueued({ kind: "pending", ...pending })).toBe(false);
});

test("your notes not yet on GitLab can change; a pending note and an AI answer cannot", async () => {
  const { threads } = await opened(SEEDED);

  expect(threads.list.value.threads.flatMap(({ messages }) => messages.map(isChangeable))).toEqual([
    true,
    true,
    false,
    true,
    false,
  ]);
});

test("an edit stores the new text, closes its box and keeps a queued note queued with that text", async () => {
  const { threads, problems } = await opened(SEEDED);
  const queued = messageOf(threadAt(threads, 0));
  const open = messageOf(threadAt(threads, 3));
  threads.writeEdit(queued.id, "Why is the check gone?");

  expect(await threads.editNote(queued.id, "Why is the check gone?")).toBe(true);
  expect(await threads.editNote(open.id, "Still used?")).toBe(true);

  expect(messageOf(threadAt(threads, 0))).toMatchObject({
    body: { kind: "note", text: "Why is the check gone?" },
    posting: { kind: "queued", text: "Why is the check gone?" },
  });
  expect(messageOf(threadAt(threads, 3))).toMatchObject({
    body: { kind: "note", text: "Still used?" },
    posting: { kind: "notQueued" },
  });
  expect(threads.editDraft(queued.id)).toBeNull();
  expect(threads.queued.value).toBe(2);
  expect(problems).toEqual([]);
});

test("a blank edit makes no call and keeps its box open", async () => {
  const calls: string[] = [];
  const { threads } = await opened(SEEDED, (fixture) => ({
    editNote: async (message, text) => {
      calls.push(text);
      return fixture.editNote(message, text);
    },
  }));
  const { id } = messageOf(threadAt(threads, 3));
  threads.writeEdit(id, " \n");

  expect(await threads.editNote(id, " \n")).toBe(false);

  expect(calls).toEqual([]);
  expect(threads.editDraft(id)).toBe(" \n");
});

test("a refused edit or delete is reported, changes nothing and keeps the edit box", async () => {
  const { threads, problems } = await opened(SEEDED);
  const before = threads.list.value;
  const pending = messageOf(threadAt(threads, 2));
  const answer = threadAt(threads, 3).messages[1];
  if (answer === undefined) {
    throw new Error("no answer");
  }
  threads.writeEdit(pending.id, "again");

  expect(await threads.editNote(pending.id, "again")).toBe(false);
  await threads.deleteMessage(answer.id);

  expect(threads.list.value).toBe(before);
  expect(threads.editDraft(pending.id)).toBe("again");
  expect(problems).toEqual([
    { action: "threads", step: "edit", cause: { kind: "MessagePending", message: pending.id } },
    { action: "threads", step: "delete", cause: { kind: "NotANote", message: answer.id } },
  ]);
});

test("a message's Edit and Post boxes are never open at once", async () => {
  const { threads } = await opened(SEEDED);
  const { id } = messageOf(threadAt(threads, 3));

  threads.writePost(id, "post");
  threads.writeEdit(id, "edit");
  expect([threads.postDraft(id), threads.editDraft(id)]).toEqual([null, "edit"]);

  threads.writePost(id, "post");
  expect([threads.postDraft(id), threads.editDraft(id)]).toEqual(["post", null]);

  threads.dropPost(id);
  threads.writeEdit(id, "edit");
  threads.dropEdit(id);
  expect([threads.postDraft(id), threads.editDraft(id)]).toEqual([null, null]);
});

test("deleting a note keeps a thread that still has a message", async () => {
  const { threads, board } = await opened(SEEDED);
  const thread = threadAt(threads, 3);
  const { id } = messageOf(thread);
  threads.toggle([`thread-${thread.id}`]);

  await threads.deleteMessage(id);

  expect(texts(threadAt(threads, 3))).toEqual(["ai"]);
  expect(threads.open.value).toEqual(new Set([thread.id]));
  expect(threads.counts.value.get(board)).toBe(4);
});

test("deleting a thread's last note removes the thread, its line, its count, its open state and its drafts", async () => {
  const { threads, board, problems } = await opened(SEEDED);
  const gone = threadAt(threads, 0);
  const kept = threadAt(threads, 1);
  const note = messageOf(gone);
  const other = messageOf(kept);
  threads.toggle([`thread-${gone.id}`, `thread-${kept.id}`]);
  threads.writeNote(gone.id, "reply");
  threads.writeNote(kept.id, "kept reply");
  threads.writeEdit(note.id, "half");
  threads.writePost(other.id, "kept post");
  threads.startThread(board, changedThreadLine("right", 1));

  await threads.deleteMessage(note.id);

  expect(threads.list.value.threads.map(({ id }) => id)).toEqual([1, 2, 3]);
  expect(threads.shownFor(board).map(({ key }) => key)).toEqual([
    "thread-1",
    "thread-2",
    "thread-3",
    "draft-0",
  ]);
  expect(threads.counts.value.get(board)).toBe(3);
  expect(threads.open.value).toEqual(new Set([kept.id]));
  expect(threads.boxOf(`thread-${gone.id}`)).toBeNull();
  expect([...threads.drafts.value.keys()].toSorted()).toEqual([
    "draft-0",
    `note-${kept.id}`,
    `post-${other.id}`,
  ]);
  expect(problems).toEqual([]);
});
