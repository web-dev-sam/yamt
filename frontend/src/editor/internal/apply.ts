import {
  Text,
  type ChangeSpec,
  type EditorState,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { setStatus, type ChunkSpan } from "./chunkField";
import { sideChanged, type Side } from "./side";
import { canApply, isResolved, statusAfterApply } from "./status";

export type SideDocs = Readonly<Record<Side, Text>>;

export type ApplyTarget = {
  readonly state: EditorState;
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly sides: SideDocs;
};

function sideLines(doc: Text, range: Chunk["local"] | Chunk["remote"]): string[] {
  return Array.from({ length: range.len }, (_, index) => doc.line(range.start + 1 + index).text);
}

function wholeLines(doc: Text, range: { from: number; to: number }, lines: string[]): ChangeSpec {
  const { from, to } = range;
  if (doc.lineAt(to).from === to) {
    return { from, to, insert: Text.of([...lines, ""]) };
  }
  if (lines.length === 0) {
    return { from: from === to ? from : Math.max(0, from - 1), to };
  }
  return { from, to, insert: Text.of(from === to ? ["", ...lines] : lines) };
}

function applyChange(target: ApplyTarget, span: ChunkSpan, side: Side): ChangeSpec {
  const lines = sideLines(target.sides[side], span.chunk[side]);
  const from = span.status === "pending" ? span.from : span.to;
  return wholeLines(target.state.doc, { from, to: span.to }, lines);
}

function spanOf(target: ApplyTarget, chunk: Chunk): ChunkSpan | undefined {
  return target.state.field(target.field).find((span) => span.chunk.id === chunk.id);
}

export function applyChunk(target: ApplyTarget, chunk: Chunk, side: Side): TransactionSpec | null {
  const span = spanOf(target, chunk);
  if (span === undefined || !canApply(span.chunk, span.status, side)) {
    return null;
  }
  return {
    changes: applyChange(target, span, side),
    effects: setStatus.of({ id: chunk.id, status: statusAfterApply(span.status, side) }),
    userEvent: "yamt.apply",
  };
}

export function applyAllNonConflicting(target: ApplyTarget, side: Side): TransactionSpec | null {
  const spans = target.state
    .field(target.field)
    .filter(
      (span) =>
        span.status === "pending" &&
        span.chunk.kind !== "Conflict" &&
        sideChanged(span.chunk, side),
    );
  if (spans.length === 0) {
    return null;
  }
  return {
    changes: target.state.changes(spans.map((span) => applyChange(target, span, side))),
    effects: spans.map((span) =>
      setStatus.of({ id: span.chunk.id, status: statusAfterApply(span.status, side) }),
    ),
    userEvent: "yamt.apply",
  };
}

export function dismissChunk(target: ApplyTarget, chunk: Chunk): TransactionSpec | null {
  const span = spanOf(target, chunk);
  if (span === undefined || isResolved(span.chunk, span.status)) {
    return null;
  }
  return {
    effects: setStatus.of({ id: chunk.id, status: "dismissed" }),
    userEvent: "yamt.dismiss",
  };
}
