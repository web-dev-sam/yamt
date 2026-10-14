import type { EditorState, StateField, Text, Transaction } from "@codemirror/state";

import type { SideDocs } from "./apply";
import type { ChunkSpan } from "./chunkField";
import { fileText } from "./fileText";
import { lineSpan } from "./lineSpan";
import { paneText } from "./pane";
import { sideChanged, SIDES } from "./side";
import type { ChunkStatus } from "./status";

export type ResultSnapshot = {
  asShown(): string;
  fileText(): string;
  readonly unsaved: boolean;
  markSaved(): void;
};

type Point = { readonly doc: Text; readonly statuses: readonly ChunkStatus[] };

type Result = {
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly sides: SideDocs;
  readonly current: () => EditorState;
};

type Update = Pick<Transaction, "docChanged" | "startState" | "state">;

function pointOf(state: EditorState, field: Result["field"]): Point {
  return { doc: state.doc, statuses: state.field(field).map(({ status }) => status) };
}

function typedWhileAllWait(
  { chunk, status, from, to }: ChunkSpan,
  doc: Text,
  opened: Text,
): boolean {
  if (
    chunk.waiting.kind === "AsShown" ||
    SIDES.some((side) => sideChanged(chunk, side) && status[side] !== "pending")
  ) {
    return false;
  }
  const atOpen = lineSpan(opened, chunk.middle);
  return doc.sliceString(from, to) !== opened.sliceString(atOpen.from, atOpen.to);
}

function isUnsaved(
  point: Point,
  opened: Text,
  state: EditorState,
  field: Result["field"],
): boolean {
  if (!state.doc.eq(point.doc)) {
    return true;
  }
  const spans = state.field(field);
  return (
    spans.some(({ status }, index) => {
      const saved = point.statuses[index];
      return saved?.local !== status.local || saved.remote !== status.remote;
    }) || spans.some((span) => typedWhileAllWait(span, state.doc, opened))
  );
}

export class SavedPoint {
  readonly #result: Result;
  readonly #opened: Text;
  #point: Point;
  #unsaved = false;
  #listener: ((unsaved: boolean) => void) | null = null;

  constructor(result: Result) {
    const state = result.current();
    this.#result = result;
    this.#opened = state.doc;
    this.#point = pointOf(state, result.field);
  }

  updated({ docChanged, startState, state }: Update): void {
    const { field } = this.#result;
    if (docChanged || startState.field(field) !== state.field(field)) {
      this.#check(state);
    }
  }

  snapshot(): ResultSnapshot {
    const { field, sides, current } = this.#result;
    const state = current();
    return {
      asShown: () => paneText(state),
      fileText: () => fileText(state, field, sides),
      unsaved: isUnsaved(this.#point, this.#opened, state, field),
      markSaved: () => {
        this.#point = pointOf(state, field);
        this.#check(current());
      },
    };
  }

  onUnsavedChange(listener: ((unsaved: boolean) => void) | null): void {
    this.#listener = listener;
  }

  #check(state: EditorState): void {
    const unsaved = isUnsaved(this.#point, this.#opened, state, this.#result.field);
    if (unsaved !== this.#unsaved) {
      this.#unsaved = unsaved;
      this.#listener?.(unsaved);
    }
  }
}
