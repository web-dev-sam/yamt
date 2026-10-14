import type { EditorState, StateField, Text, Transaction } from "@codemirror/state";

import type { SideDocs } from "./apply";
import type { ChunkSpan } from "./chunkField";
import { dropsShownText, fileText } from "./fileText";
import { lineSpan } from "./lineSpan";
import { paneText } from "./pane";
import type { ChunkStatus } from "./status";

type WrittenText = "asShown" | "fileText";

export type ResultSnapshot = {
  asShown(): string;
  fileText(): string;
  readonly unsaved: boolean;
  markSaved(written: WrittenText): void;
};

type Point = {
  readonly doc: Text;
  readonly statuses: readonly ChunkStatus[];
  readonly written: WrittenText;
};

type Result = {
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly sides: SideDocs;
  readonly current: () => EditorState;
};

type Update = Pick<Transaction, "docChanged" | "startState" | "state">;

function pointOf(state: EditorState, field: Result["field"], written: WrittenText): Point {
  return { doc: state.doc, statuses: state.field(field).map(({ status }) => status), written };
}

function typedButDropped(span: ChunkSpan, doc: Text, opened: Text): boolean {
  if (!dropsShownText(span)) {
    return false;
  }
  const atOpen = lineSpan(opened, span.chunk.middle);
  return doc.sliceString(span.from, span.to) !== opened.sliceString(atOpen.from, atOpen.to);
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
  const decisionsChanged = spans.some(({ status }, index) => {
    const saved = point.statuses[index];
    return saved?.local !== status.local || saved.remote !== status.remote;
  });
  return (
    decisionsChanged ||
    (point.written === "fileText" && spans.some((span) => typedButDropped(span, state.doc, opened)))
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
    this.#point = pointOf(state, result.field, "fileText");
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
      markSaved: (written) => {
        this.#point = pointOf(state, field, written);
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
