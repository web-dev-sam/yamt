import { Transaction } from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type Chunk } from "../../ipc";
import { actionSteps, dispatchSteps, type ApplyTarget } from "./apply";
import { chunkField } from "./chunkField";
import { centerKind, paneState } from "./pane";
import { paneDocs } from "./paneDocs";
import type { Side } from "./side";
import { summarize, type MergeSummary } from "./status";

const REMEMBERED = 0;
const PLAIN = 1;

function conflict(id: number, line: number, waiting: Chunk["waiting"]): unknown {
  const range = { start: line, len: 1 };
  return {
    chunk: { id, kind: "Conflict", base: range, local: range, remote: range },
    middle: range,
    words: {
      chunk: id,
      local: { changed: [], removals: [] },
      remote: { changed: [], removals: [] },
    },
    waiting,
  };
}

async function opened(): Promise<ApplyTarget> {
  const record = {
    path: "remembered.ts",
    deleted: null,
    middle: { kind: "Disk", text: "a\nrerere\nb\nL2\nc\n" },
    local: "a\nL1\nb\nL2\nc\n",
    remote: "a\nR1\nb\nR2\nc\n",
    eol: "Lf",
    disk_version: 0,
    chunks: [
      conflict(REMEMBERED, 1, { kind: "Remembered" }),
      conflict(PLAIN, 3, { kind: "AsShown" }),
    ],
  };
  const data = await loadFixture("remembered.ts", { "remembered.json": record });
  const field = chunkField(data.chunks);
  const docs = paneDocs(data);
  const state = paneState({
    kind: centerKind(false),
    doc: docs.center,
    eol: data.eol,
    language: null,
    settings: { preferences: { theme: "dark", keys: DEFAULT_KEYS }, platform: "Linux x86_64" },
    extensions: [field],
  });
  return { state, field, sides: { local: docs.left, remote: docs.right } };
}

function decided(
  merge: ApplyTarget,
  kind: "apply" | "ignore",
  side: Side,
  id: number,
): ApplyTarget {
  const chunk = merge.state.field(merge.field)[id]?.chunk;
  if (chunk === undefined) {
    throw new Error(`no chunk ${id}`);
  }
  let { state } = merge;
  dispatchSteps(
    (spec) => {
      state = state.update(spec, { annotations: Transaction.time.of(0) }).state;
    },
    actionSteps(merge, { kind, side, chunks: [chunk] }, "side"),
  );
  return { ...merge, state };
}

function summaryOf(merge: ApplyTarget): MergeSummary {
  return summarize(merge.state.field(merge.field));
}

test("a conflict git rerere filled in counts as remembered, apart from a plain conflict (catches it counted as a conflict)", async () => {
  expect(summaryOf(await opened())).toEqual({ changes: 0, conflicts: 1, remembered: 1 });
});

test("a side decided on a remembered conflict moves it out of remembered: half-decided it is a conflict, then resolved (catches it staying remembered)", async () => {
  const applied = decided(await opened(), "apply", "local", REMEMBERED);
  expect(summaryOf(applied)).toEqual({ changes: 0, conflicts: 2, remembered: 0 });

  const ignored = decided(await opened(), "ignore", "remote", REMEMBERED);
  expect(summaryOf(ignored)).toEqual({ changes: 0, conflicts: 2, remembered: 0 });

  const settled = decided(applied, "ignore", "remote", REMEMBERED);
  expect(summaryOf(settled)).toEqual({ changes: 0, conflicts: 1, remembered: 0 });
});

test("deciding the plain conflict leaves the remembered one counted as remembered", async () => {
  const taken = decided(await opened(), "apply", "remote", PLAIN);
  expect(summaryOf(decided(taken, "ignore", "local", PLAIN))).toEqual({
    changes: 0,
    conflicts: 0,
    remembered: 1,
  });
});
