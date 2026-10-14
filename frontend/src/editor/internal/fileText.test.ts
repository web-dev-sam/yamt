import { Transaction, type TransactionSpec } from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type Chunk, type FileMergeData } from "../../ipc";
import { actionSteps, dispatchSteps, type ApplyTarget } from "./apply";
import { chunkField } from "./chunkField";
import { fileText } from "./fileText";
import { centerKind, paneState, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";
import type { Side } from "./side";

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};

const OPEN = "<<<<<<< ours";
const SEPARATOR = "=======";
const CLOSE = ">>>>>>> theirs";
const MARKERS: Chunk["waiting"] = {
  kind: "Markers",
  open: OPEN,
  between: [SEPARATOR],
  close: CLOSE,
};
const SIDE_LINES: Chunk["waiting"] = { kind: "SideLines" };

type Range = readonly [start: number, len: number];

type Change = {
  readonly kind: Chunk["kind"];
  readonly middle: Range;
  readonly local: Range;
  readonly remote: Range;
  readonly waiting?: Chunk["waiting"];
};

type Texts = { middle: string; local: string; remote: string; eol?: FileMergeData["eol"] };

function range([start, len]: Range): { start: number; len: number } {
  return { start, len };
}

async function opened(
  { middle, local, remote, eol = "Lf" }: Texts,
  changes: readonly Change[],
): Promise<ApplyTarget> {
  const record = {
    path: "file-text.ts",
    deleted: null,
    middle: { kind: "Stages", text: middle },
    local,
    remote,
    eol,
    disk_version: 0,
    chunks: changes.map((change, id) => ({
      chunk: {
        id,
        kind: change.kind,
        base: range(change.middle),
        local: range(change.local),
        remote: range(change.remote),
      },
      middle: range(change.middle),
      words: {
        chunk: id,
        local: { changed: [], removed_at: [] },
        remote: { changed: [], removed_at: [] },
      },
      waiting: change.waiting ?? (change.kind === "Conflict" ? MARKERS : SIDE_LINES),
    })),
  };
  const data = await loadFixture("file-text.ts", { "file-text.json": record });
  const field = chunkField(data.chunks);
  const docs = paneDocs(data);
  const state = paneState({
    kind: centerKind(false),
    doc: docs.center,
    eol: data.eol,
    language: null,
    settings: SETTINGS,
    extensions: [field],
  });
  return { state, field, sides: { local: docs.left, remote: docs.right } };
}

function updated(merge: ApplyTarget, spec: TransactionSpec): ApplyTarget {
  return { ...merge, state: merge.state.update(spec).state };
}

function decided(merge: ApplyTarget, kind: "apply" | "ignore", side: Side, id = 0): ApplyTarget {
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

function written(merge: ApplyTarget): string {
  return fileText(merge.state, merge.field, merge.sides);
}

const CONFLICT: Change = { kind: "Conflict", middle: [1, 1], local: [1, 1], remote: [1, 2] };

test.each([
  ["Lf", "\n"],
  ["CrLf", "\r\n"],
] as const)(
  "a conflict with both sides waiting is git's markers around both sides' lines, every line ending in the file's own break (%s)",
  async (eol, br) => {
    const diff3: Chunk["waiting"] = {
      kind: "Markers",
      open: "<<<<<<< HEAD",
      between: ["||||||| base", "base", SEPARATOR],
      close: ">>>>>>> feature",
    };
    const merge = await opened(
      {
        middle: ["a", "base", "z", ""].join(br),
        local: ["a", "L", "z", ""].join(br),
        remote: ["a", "R1", "R2", "z", ""].join(br),
        eol,
      },
      [{ ...CONFLICT, waiting: diff3 }],
    );

    expect(written(merge)).toBe(
      [
        "a",
        "<<<<<<< HEAD",
        "L",
        "||||||| base",
        "base",
        SEPARATOR,
        "R1",
        "R2",
        ">>>>>>> feature",
        "z",
        "",
      ].join(br),
    );
  },
);

test("a waiting one-sided change is written as its side's lines, and typing inside it is not", async () => {
  const merge = await opened(
    { middle: "a\nb\nc\nd\n", local: "a\nB\nc\nd\n", remote: "a\nb\nc\nD\n" },
    [
      { kind: "LocalOnly", middle: [1, 1], local: [1, 1], remote: [1, 1] },
      { kind: "RemoteOnly", middle: [3, 1], local: [3, 1], remote: [3, 1] },
    ],
  );
  const typed = updated(updated(merge, { changes: { from: 2, insert: "typed " } }), {
    changes: { from: 0, insert: "kept " },
  });

  expect(written(merge)).toBe("a\nB\nc\nD\n");
  expect(written(typed)).toBe("kept a\nB\nc\nD\n");
});

test("decided changes are written as shown, typing included", async () => {
  const merge = await opened(
    { middle: "a\nb\nz\n", local: "a\nL\nz\n", remote: "a\nR1\nR2\nz\n" },
    [CONFLICT],
  );
  const both = decided(decided(merge, "apply", "local"), "apply", "remote");
  const typed = updated(both, { changes: { from: 2, insert: "typed " } });

  expect(written(both)).toBe("a\nL\nR1\nR2\nz\n");
  expect(written(typed)).toBe("a\ntyped L\nR1\nR2\nz\n");
});

test("a half-decided conflict keeps its markers: the decided section holds the Result's lines, the waiting side its own", async () => {
  const merge = await opened(
    { middle: "a\nb\nz\n", local: "a\nL\nz\n", remote: "a\nR1\nR2\nz\n" },
    [CONFLICT],
  );
  const local = decided(merge, "apply", "local");
  const typed = updated(local, { changes: { from: 2, insert: "typed " } });
  const ignored = decided(merge, "ignore", "remote");

  expect(written(typed)).toBe(`a\n${OPEN}\ntyped L\n${SEPARATOR}\nR1\nR2\n${CLOSE}\nz\n`);
  expect(written(ignored)).toBe(`a\n${OPEN}\nL\n${SEPARATOR}\nb\n${CLOSE}\nz\n`);
});

test("a change at the end of a file without a final line break keeps the file without one", async () => {
  const conflict = await opened({ middle: "a\nb", local: "a\nL", remote: "a\nR" }, [
    { kind: "Conflict", middle: [1, 1], local: [1, 1], remote: [1, 1] },
  ]);
  const removed = await opened({ middle: "a\nb", local: "a", remote: "a\nb" }, [
    { kind: "LocalOnly", middle: [1, 1], local: [1, 0], remote: [1, 1] },
  ]);
  const replaced = await opened({ middle: "a\nb", local: "a\nB", remote: "a\nb" }, [
    { kind: "LocalOnly", middle: [1, 1], local: [1, 1], remote: [1, 1] },
  ]);

  expect(written(conflict)).toBe(`a\n${OPEN}\nL\n${SEPARATOR}\nR\n${CLOSE}`);
  expect(written(removed)).toBe("a");
  expect(written(replaced)).toBe("a\nB");
});

test("an insertion-point conflict writes its block between the lines, also at a file end without a line break", async () => {
  const inside = await opened({ middle: "a\nz\n", local: "a\nL\nz\n", remote: "a\nR\nz\n" }, [
    { kind: "Conflict", middle: [1, 0], local: [1, 1], remote: [1, 1] },
  ]);
  const atEnd = await opened({ middle: "a", local: "a\nL", remote: "a\nR" }, [
    { kind: "Conflict", middle: [1, 0], local: [1, 1], remote: [1, 1] },
  ]);

  expect(written(inside)).toBe(`a\n${OPEN}\nL\n${SEPARATOR}\nR\n${CLOSE}\nz\n`);
  expect(written(atEnd)).toBe(`a\n${OPEN}\nL\n${SEPARATOR}\nR\n${CLOSE}`);
});

test("a conflict with an empty side writes that section empty", async () => {
  const merge = await opened({ middle: "a\nb\nz\n", local: "a\nz\n", remote: "a\nB\nz\n" }, [
    { kind: "Conflict", middle: [1, 1], local: [1, 0], remote: [1, 1] },
  ]);

  expect(written(merge)).toBe(`a\n${OPEN}\n${SEPARATOR}\nB\n${CLOSE}\nz\n`);
});

test("a region yamt could not place is written as shown, typing included", async () => {
  const raw = [OPEN, "x", SEPARATOR, "y", CLOSE];
  const merge = await opened(
    { middle: ["a", ...raw, "z", ""].join("\n"), local: "a\nx\nz\n", remote: "a\ny\nz\n" },
    [
      {
        kind: "Conflict",
        middle: [1, 5],
        local: [1, 1],
        remote: [1, 1],
        waiting: { kind: "AsShown" },
      },
    ],
  );
  const typed = updated(merge, {
    changes: { from: merge.state.doc.line(3).from, insert: "typed " },
  });

  expect(written(merge)).toBe(merge.state.doc.toString());
  expect(written(typed)).toBe(["a", OPEN, "typed x", SEPARATOR, "y", CLOSE, "z", ""].join("\n"));
});

test("a line break deleted at a waiting change's edge is written back, so no marker shares a line", async () => {
  const merge = await opened(
    { middle: "a\nb\nz\n", local: "a\nL\nz\n", remote: "a\nR1\nR2\nz\n" },
    [CONFLICT],
  );
  const joinedAfter = updated(merge, { changes: { from: 3, to: 4 } });
  const joinedBefore = updated(merge, { changes: { from: 1, to: 2 } });

  expect(joinedAfter.state.doc.toString()).toBe("a\nbz\n");
  expect(written(joinedAfter)).toBe(`a\n${OPEN}\nL\n${SEPARATOR}\nR1\nR2\n${CLOSE}\nz\n`);
  expect(joinedBefore.state.doc.toString()).toBe("ab\nz\n");
  expect(written(joinedBefore)).toBe(`a\n${OPEN}\nL\n${SEPARATOR}\nR1\nR2\n${CLOSE}\nz\n`);
});
