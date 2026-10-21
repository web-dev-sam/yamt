import { expect, test, vi } from "vitest";

import type { ChunkSource } from "./ChunkSource";
import type { SourceResult } from "./domain";
import { createFixtureSource } from "./fixture";
import type { ContinueReply, Listing, OperationKind, OperationView, ProgressView } from "./index";
import { createLog, type Log, type LogEntry } from "./log";

const FIRST_STEP: ProgressView = { step: 1, total: 3 };
const FINISHED: ContinueReply = { kind: "Finished" };

const FILE = {
  path: "a.ts",
  middle: { kind: "Stages", text: "b\n" },
  local: "l\n",
  remote: "r\n",
  deleted: null,
  eol: "Lf",
  chunks: [],
  disk_version: 0,
};

function quietLog(): { log: Log; entries: LogEntry[] } {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const entries: LogEntry[] = [];
  const log = createLog((entry) => {
    entries.push(entry);
  });
  return { log, entries };
}

function sourceAt(search: string, log: Log = quietLog().log): ChunkSource {
  return createFixtureSource(log, search, { "a.json": FILE });
}

function valueOf<T>(result: SourceResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, got ${JSON.stringify(result.failure)}`);
  }
  return result.value;
}

async function filesListed(source: ChunkSource): Promise<Extract<Listing, { kind: "Files" }>> {
  const listing = valueOf(await source.listStop());
  if (listing.kind !== "Files") {
    throw new Error("expected files, got MovedOn");
  }
  return listing;
}

async function operationAt(source: ChunkSource): Promise<OperationView | null> {
  return (await filesListed(source)).operation;
}

test.each<[string, OperationKind, boolean]>([
  ["", "Merge", true],
  ["?operation=merge", "Merge", true],
  ["?operation=squash", "SquashMerge", false],
  ["?operation=rebase", "Rebase", false],
  ["?operation=cherry-pick", "CherryPick", false],
  ["?operation=revert", "Revert", false],
  ["?operation=am", "Am", false],
  ["?operation=unknown", "Merge", true],
])("%j lists the fixtures under that operation: %s", async (search, kind, merging) => {
  const source = sourceAt(search);

  const listing = await filesListed(source);

  expect(listing.operation?.kind).toBe(kind);
  expect(listing.files).toEqual([{ path: "a.ts", status: "Unresolved", unsupported: null }]);
  expect(listing.diskChanges).toEqual([]);
  expect(valueOf(await source.listFiles()).merging).toBe(merging);
});

test.each<[string, ProgressView | undefined]>([
  ["?operation=rebase", FIRST_STEP],
  ["?operation=cherry-pick", FIRST_STEP],
  ["?operation=revert", FIRST_STEP],
  ["?operation=am", FIRST_STEP],
  ["?operation=merge", undefined],
  ["?operation=squash", undefined],
])("%j starts at its first step", async (search, progress) => {
  const operation = await operationAt(sourceAt(search));

  expect(operation !== null && "progress" in operation ? operation.progress : undefined).toEqual(
    progress,
  );
});

test("a rebase replays its own commit on the left and names the branch and what it goes onto", async () => {
  const listing = await filesListed(sourceAt("?operation=rebase"));

  expect(listing.operation).toEqual({
    kind: "Rebase",
    branch: "feature/reminders",
    onto: { kind: "Branch", name: "main" },
    replaying: listing.sides.local,
    progress: FIRST_STEP,
    editor_steps_ahead: false,
  });
  expect(listing.sides.local?.kind).toBe("Commit");
  expect(listing.sides.remote).toBeNull();
  expect((await operationAt(sourceAt("?operation=rebase&rewords"))) ?? {}).toMatchObject({
    editor_steps_ahead: true,
  });
});

test("a merge's sides stay unnamed as in today's fixtures", async () => {
  expect((await filesListed(sourceAt(""))).sides).toEqual({ local: null, remote: null });
});

async function resolvedAndContinued(source: ChunkSource): Promise<unknown[]> {
  const { diskVersion } = valueOf(await source.loadFile("a.ts"));
  await source.finishFile({ path: "a.ts", text: "done\n", diskVersion });
  const reply = valueOf(await source.continueOperation());
  const { files, operation, sides } = await filesListed(source);
  const replaying = operation?.kind === "Rebase" ? operation.replaying : null;
  const progress = operation?.kind === "Rebase" ? operation.progress : null;
  return [reply.kind, files[0]?.status, progress, sides.local === replaying];
}

async function everyStopCommand(source: ChunkSource): Promise<SourceResult<unknown>[]> {
  return [
    await source.listStop(),
    await source.listFiles(),
    await source.continueOperation(),
    await source.abortOperation(),
  ];
}

function everyCommandRefused(kind: "MergeFinished" | "MergeAborted"): SourceResult<unknown>[] {
  return Array.from({ length: 4 }, () => ({ ok: false, failure: { kind } }));
}

test("a rebase advances 1 → 2 → 3, lists the files unresolved again each time, then finishes once", async () => {
  const { log, entries } = quietLog();
  const source = sourceAt("?operation=rebase", log);

  const second = await resolvedAndContinued(source);
  const third = await resolvedAndContinued(source);
  const finished = await source.continueOperation();

  expect(second).toEqual(["Stopped", "Unresolved", { step: 2, total: 3 }, true]);
  expect(third).toEqual(["Stopped", "Unresolved", { step: 3, total: 3 }, true]);
  expect(finished).toEqual({ ok: true, value: FINISHED });
  expect(entries.filter((entry) => entry.event === "fixture.continue_finished")).toEqual([
    { level: "info", event: "fixture.continue_finished", fields: { operation: "rebase" } },
  ]);
  expect(await everyStopCommand(source)).toEqual(everyCommandRefused("MergeFinished"));
});

test("?empty makes the second step a stop without files, with git's edit message, and the third lists them again", async () => {
  const source = sourceAt("?operation=rebase&empty");

  const stopped = valueOf(await source.continueOperation());
  const empty = await filesListed(source);
  const files = valueOf(await source.listFiles()).files;
  const third = valueOf(await source.continueOperation());

  expect(stopped).toEqual({
    kind: "Stopped",
    message:
      "Stopped at 8b4e7d0...  Show reminders on the board\nYou can amend the commit now, with\n\n  git commit --amend\n\nOnce you are satisfied with your changes, run\n\n  git rebase --continue\n",
  });
  expect([empty.files, empty.operation?.kind, files]).toEqual([[], "Rebase", []]);
  expect(third).toEqual({
    kind: "Stopped",
    message: "CONFLICT (content): Merge conflict at step 3 of 3",
  });
  expect((await filesListed(source)).files.map((file) => file.path)).toEqual(["a.ts"]);
});

test.each(["", "?operation=squash"])("%j finishes at the first Continue", async (search) => {
  const source = sourceAt(search);

  expect(await source.continueOperation()).toEqual({ ok: true, value: FINISHED });
  expect(await everyStopCommand(source)).toEqual(everyCommandRefused("MergeFinished"));
});

test("abortOperation answers done, logs the abort once, then every command answers MergeAborted", async () => {
  const { log, entries } = quietLog();
  const source = sourceAt("?operation=revert", log);

  expect(await source.abortOperation()).toEqual({ ok: true, value: null });

  expect(await everyStopCommand(source)).toEqual(everyCommandRefused("MergeAborted"));
  expect(entries).toEqual([
    { level: "info", event: "fixture.abort_operation", fields: { operation: "revert" } },
  ]);
});

test("none lists no operation and has nothing to continue or abort", async () => {
  const { log, entries } = quietLog();
  const source = sourceAt("?operation=none", log);
  const nothing = { ok: false, failure: { kind: "NoOperation" } };

  expect(await operationAt(source)).toBeNull();
  expect(await source.continueOperation()).toEqual(nothing);
  expect(await source.abortOperation()).toEqual(nothing);
  expect(valueOf(await source.listFiles()).merging).toBe(false);
  expect(entries).toEqual([]);
});
