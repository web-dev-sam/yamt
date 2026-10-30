import { expect, test, vi } from "vitest";

import type { ChunkSource } from "./ChunkSource";
import type { SourceResult } from "./domain";
import { createFixtureSource } from "./fixture";
import type {
  ContinueReply,
  Listing,
  MergeView,
  OperationKind,
  OperationView,
  ProgressView,
} from "./index";
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

test.each<[string, OperationKind]>([
  ["", "Merge"],
  ["?operation=merge", "Merge"],
  ["?operation=squash", "SquashMerge"],
  ["?operation=rebase", "Rebase"],
  ["?operation=cherry-pick", "CherryPick"],
  ["?operation=revert", "Revert"],
  ["?operation=am", "Am"],
  ["?operation=unknown", "Merge"],
])("%j lists the fixtures under that operation: %s", async (search, kind) => {
  const listing = await filesListed(sourceAt(search));

  expect(listing.operation?.kind).toBe(kind);
  expect(listing.files).toEqual([{ path: "a.ts", status: "Unresolved", unsupported: null }]);
  expect(listing.diskChanges).toEqual([]);
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
  return [await source.listStop(), await source.continueOperation(), await source.abortOperation()];
}

function everyCommandRefused(kind: "MergeFinished" | "MergeAborted"): SourceResult<unknown>[] {
  return Array.from({ length: 3 }, () => ({ ok: false, failure: { kind } }));
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
  const third = valueOf(await source.continueOperation());

  expect(stopped).toEqual({
    kind: "Stopped",
    message:
      "Stopped at 8b4e7d0...  Show reminders on the board\nYou can amend the commit now, with\n\n  git commit --amend\n\nOnce you are satisfied with your changes, run\n\n  git rebase --continue\n",
  });
  expect([empty.files, empty.operation?.kind]).toEqual([[], "Rebase"]);
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

  expect(await source.abortOperation()).toEqual({ ok: true, value: { leftovers: [] } });

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
  expect(entries).toEqual([]);
});

const DEVELOP = { kind: "branch", name: "develop" } as const;

test.each<[string, Pick<MergeView, "returnTo" | "branchBefore">]>([
  ["created", { returnTo: DEVELOP, branchBefore: { kind: "created" } }],
  ["moved", { returnTo: DEVELOP, branchBefore: { kind: "movedFrom", id: "3f1c2a9" } }],
  ["unchanged", { returnTo: DEVELOP, branchBefore: { kind: "unchanged" } }],
  ["detached", { returnTo: { kind: "commit", id: "9b0d4e1" }, branchBefore: { kind: "created" } }],
  ["same", { returnTo: null, branchBefore: { kind: "unchanged" } }],
])(
  "?mergeRequest=%s lists the merge of main into feature/due-dates it names",
  async (name, start) => {
    const listed = await filesListed(sourceAt(`?operation=merge&mergeRequest=${name}`));

    expect(listed.mergeRequest).toEqual({ branch: "feature/due-dates", target: "main", ...start });
    expect(listed.operation).toEqual({
      kind: "Merge",
      merging: { kind: "Branch", name: "main" },
      into: { kind: "Branch", name: "feature/due-dates" },
    });
    expect(listed.files.map((file) => file.path)).toEqual(["a.ts"]);
  },
);

test.each(["", "?mergeRequest=nonsense", "?operation=rebase&mergeRequest=created"])(
  "%j lists no merge request",
  async (search) => {
    expect((await filesListed(sourceAt(search))).mergeRequest).toBeNull();
  },
);

test("?clean lists no file at any step", async () => {
  const source = sourceAt("?operation=rebase&clean");

  expect((await filesListed(source)).files).toEqual([]);
  await source.continueOperation();
  expect((await filesListed(source)).files).toEqual([]);
});

test("a merge yamt started answers ReadyToPush, then MergeFinished to every stop command, and Pushed once", async () => {
  const { log, entries } = quietLog();
  const source = sourceAt("?mergeRequest=created&clean", log);

  expect(await source.pushMergedBranch()).toEqual({ ok: false, failure: { kind: "NoOperation" } });
  expect(await source.continueOperation()).toEqual({
    ok: true,
    value: { kind: "ReadyToPush", branch: "feature/due-dates" },
  });
  expect(await everyStopCommand(source)).toEqual(everyCommandRefused("MergeFinished"));
  expect(await source.pushMergedBranch()).toEqual({ ok: true, value: { kind: "pushed" } });
  expect(await source.pushMergedBranch()).toEqual({
    ok: false,
    failure: { kind: "MergeFinished" },
  });
  expect(entries.map((entry) => entry.event)).toEqual([
    "fixture.continue_finished",
    "fixture.push",
  ]);
});

test("?push=rejected fails the first push with git's words, then pushes", async () => {
  const source = sourceAt("?mergeRequest=created&push=rejected");
  await source.continueOperation();

  expect(await source.pushMergedBranch()).toEqual({
    ok: true,
    value: { kind: "failed", message: "[rejected] (fetch first)" },
  });
  expect(await source.pushMergedBranch()).toEqual({ ok: true, value: { kind: "pushed" } });
});

test("closeEndedMerge after ReadyToPush keeps the commit local: no push follows and every command answers MergeFinished", async () => {
  const { log, entries } = quietLog();
  const source = sourceAt("?mergeRequest=created&push=rejected", log);
  await source.continueOperation();

  expect(await source.closeEndedMerge()).toEqual({ ok: true, value: null });
  expect(await source.pushMergedBranch()).toEqual({
    ok: false,
    failure: { kind: "MergeFinished" },
  });
  expect(await everyStopCommand(source)).toEqual(everyCommandRefused("MergeFinished"));
  expect(entries.map((entry) => entry.event)).toEqual([
    "fixture.continue_finished",
    "fixture.close_ended_merge",
  ]);
});

test("?leftovers answers Abort with what was not put back, then every command answers MergeAborted", async () => {
  const source = sourceAt("?mergeRequest=created&leftovers");

  expect(await source.abortOperation()).toEqual({
    ok: true,
    value: {
      leftovers: [
        { kind: "notReturned", to: DEVELOP },
        { kind: "branchKept", branch: "feature/due-dates" },
      ],
    },
  });
  expect(await source.closeEndedMerge()).toEqual({ ok: true, value: null });
  expect(await everyStopCommand(source)).toEqual(everyCommandRefused("MergeAborted"));
  expect(await source.pushMergedBranch()).toEqual({
    ok: false,
    failure: { kind: "MergeAborted" },
  });
});
