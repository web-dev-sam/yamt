import { undo } from "@codemirror/commands";
import {
  Transaction,
  type EditorState,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type Chunk } from "../../ipc";
import { actionSteps, dispatchSteps, type SideDocs } from "./apply";
import { chunkField, type ChunkSpan } from "./chunkField";
import { centerKind, paneState, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";
import { SavedPoint } from "./savedPoint";
import type { Side } from "./side";

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};

const MIDDLE = "a\nb\nc\nd\nz\n";
const LOCAL = "a\nB\nc\nL\nz\n";
const REMOTE = "a\nb\nc\nR\nz\n";
const ONE_SIDED = 0;
const CONFLICT = 1;

type SpanField = StateField<readonly ChunkSpan[]>;

class Result {
  state: EditorState;
  readonly field: SpanField;
  readonly sides: SideDocs;
  readonly saved: SavedPoint;
  readonly heard: boolean[] = [];
  #time = 0;

  constructor(state: EditorState, field: SpanField, sides: SideDocs) {
    this.state = state;
    this.field = field;
    this.sides = sides;
    this.saved = new SavedPoint({ field, sides, current: () => this.state });
    this.saved.onUnsavedChange((unsaved) => {
      this.heard.push(unsaved);
    });
  }

  get unsaved(): boolean {
    return this.saved.snapshot().unsaved;
  }

  dispatch(spec: TransactionSpec): void {
    this.#time += 1000;
    this.#apply(this.state.update(spec, { annotations: Transaction.time.of(this.#time) }));
  }

  type(at: number, text: string): void {
    this.dispatch({ changes: { from: at, insert: text } });
  }

  decide(kind: "apply" | "ignore", side: Side, id: number): void {
    const span: ChunkSpan | undefined = this.state.field(this.field)[id];
    if (span === undefined) {
      throw new Error(`no chunk ${id}`);
    }
    const target = { state: this.state, field: this.field, sides: this.sides };
    dispatchSteps(
      (spec) => {
        this.dispatch(spec);
      },
      actionSteps(target, { kind, side, chunks: [span.chunk] }, "side"),
    );
  }

  undo(): void {
    undo({
      state: this.state,
      dispatch: (tr) => {
        this.#apply(tr);
      },
    });
  }

  #apply(tr: Transaction): void {
    this.state = tr.state;
    this.saved.updated(tr);
  }
}

function lineFrom(result: Result, line: number): number {
  return result.state.doc.line(line).from;
}

function chunkRecord(id: number, kind: Chunk["kind"], line: number): unknown {
  const range = { start: line, len: 1 };
  return {
    chunk: { id, kind, base: range, local: range, remote: range },
    middle: range,
    words: {
      chunk: id,
      local: { changed: [], removals: [] },
      remote: { changed: [], removals: [] },
    },
    waiting:
      kind === "Conflict"
        ? {
            kind: "Markers",
            open: "<<<<<<< ours",
            first: "local",
            between: ["======="],
            close: ">>>>>>> theirs",
          }
        : { kind: "SideLines" },
  };
}

async function opened(): Promise<Result> {
  const record = {
    path: "saved.ts",
    deleted: null,
    middle: { kind: "Stages", text: MIDDLE },
    local: LOCAL,
    remote: REMOTE,
    eol: "Lf",
    disk_version: 0,
    chunks: [chunkRecord(ONE_SIDED, "LocalOnly", 1), chunkRecord(CONFLICT, "Conflict", 3)],
  };
  const data = await loadFixture("saved.ts", { "saved.json": record });
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
  return new Result(state, field, { local: docs.left, remote: docs.right });
}

test("typing outside a change lights the dot; undoing it back clears it", async () => {
  const result = await opened();
  expect(result.unsaved).toBe(false);

  result.type(lineFrom(result, 5), "typed ");
  expect(result.unsaved).toBe(true);

  result.undo();
  expect(result.unsaved).toBe(false);
  expect(result.heard).toEqual([true, false]);
});

test("ignoring a one-sided change lights the dot though the text stays the same", async () => {
  const result = await opened();
  const before = result.state.doc;

  result.decide("ignore", "local", ONE_SIDED);

  expect(result.state.doc.eq(before)).toBe(true);
  expect(result.unsaved).toBe(true);
  expect(result.heard).toEqual([true]);
});

test("applying a change and undoing it leaves nothing unsaved", async () => {
  const result = await opened();

  result.decide("apply", "local", CONFLICT);
  expect(result.unsaved).toBe(true);
  result.undo();

  expect(result.state.doc.toString()).toBe(MIDDLE);
  expect(result.unsaved).toBe(false);
  expect(result.heard).toEqual([true, false]);
});

test("a save clears the dot, then undo past the save lights it again", async () => {
  const result = await opened();
  result.type(lineFrom(result, 5), "typed ");

  result.saved.snapshot().markSaved("fileText");
  expect(result.unsaved).toBe(false);
  result.undo();

  expect(result.unsaved).toBe(true);
  expect(result.heard).toEqual([true, false, true]);
});

test("typing during the write keeps the dot: the saved point is the snapshot that was sent", async () => {
  const result = await opened();
  result.type(lineFrom(result, 5), "first ");
  const sent = result.saved.snapshot();

  result.type(lineFrom(result, 5), "second ");
  sent.markSaved("fileText");

  expect(result.unsaved).toBe(true);
  expect(result.heard).toEqual([true]);
});

test.each([
  ["a one-sided change", ONE_SIDED, 2],
  ["a conflict", CONFLICT, 4],
])(
  "typing inside %s whose sides all wait keeps the dot after a save, since the file does not get it",
  async (_name, id, line) => {
    const result = await opened();
    result.type(lineFrom(result, line), "typed ");
    const sent = result.saved.snapshot();

    sent.markSaved("fileText");

    expect(sent.fileText()).not.toContain("typed");
    expect(result.unsaved).toBe(true);

    result.decide("apply", "local", id);
    result.saved.snapshot().markSaved("fileText");
    expect(result.unsaved).toBe(false);
  },
);

test.each([
  ["a one-sided change", ONE_SIDED, 2],
  ["a conflict", CONFLICT, 4],
])(
  "typing inside %s whose sides all wait is on disk after a write of the Result as shown, so the dot clears",
  async (_name, id, line) => {
    const result = await opened();
    result.type(lineFrom(result, line), "typed ");
    const sent = result.saved.snapshot();

    sent.markSaved("asShown");

    expect(sent.asShown()).toContain("typed");
    expect(result.state.field(result.field)[id]?.status).toEqual({
      local: "pending",
      remote: "pending",
    });
    expect(result.unsaved).toBe(false);
    expect(result.heard).toEqual([true, false]);
  },
);

test("typing in the decided section of a half-decided conflict is written, so a save clears the dot", async () => {
  const result = await opened();
  result.decide("apply", "local", CONFLICT);
  result.type(lineFrom(result, 4), "typed ");
  const sent = result.saved.snapshot();

  sent.markSaved("fileText");

  expect(sent.fileText()).toContain("typed L");
  expect(result.unsaved).toBe(false);
});

test("a listener taken away hears nothing more", async () => {
  const result = await opened();
  result.saved.onUnsavedChange(null);

  result.type(0, "x");

  expect(result.unsaved).toBe(true);
  expect(result.heard).toEqual([]);
});
