import {
  ChangeSet,
  EditorSelection,
  Text,
  Transaction,
  type ChangeSpec,
  type EditorState,
  type StateEffect,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { placeSpans, setStatus, type ChunkSpan } from "./chunkField";
import { toDocPos } from "./docPos";
import { otherSide, type Side } from "./side";
import {
  applyMode,
  canBulkApply,
  decidesOtherSide,
  isSideOpen,
  statusAfterApply,
  statusAfterIgnore,
} from "./status";

export type ChunkAction = {
  readonly kind: "apply" | "ignore";
  readonly side: Side;
  readonly chunks: readonly Chunk[];
};

export type Reach = "side" | "conflict";

export type SideDocs = Readonly<Record<Side, Text>>;

export type ApplyTarget = {
  readonly state: EditorState;
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly sides: SideDocs;
};

export type VisibleLines = { readonly first: number; readonly last: number };

export type Steps = readonly TransactionSpec[];

export function sideLines(doc: Text, range: Chunk["local"] | Chunk["remote"]): string[] {
  return Array.from({ length: range.len }, (_, index) => doc.line(range.start + 1 + index).text);
}

export function wholeLines(
  doc: Text,
  { from, to }: { from: number; to: number },
  lines: readonly string[],
): ChangeSpec {
  const fromMidLine = doc.lineAt(from).from !== from;
  const atFileEnd = to === doc.length && doc.lineAt(to).from !== to;
  if (atFileEnd && lines.length === 0) {
    return { from: fromMidLine ? from : Math.max(0, from - 1), to };
  }
  const before = fromMidLine ? [""] : [];
  const after = atFileEnd ? [] : [""];
  return { from, to, insert: Text.of([...before, ...lines, ...after]) };
}

function applyChange(target: ApplyTarget, span: ChunkSpan, side: Side): ChangeSpec {
  const lines = sideLines(target.sides[side], span.chunk[side]);
  const from = applyMode(span.status, side) === "replace" ? span.from : span.to;
  return wholeLines(target.state.doc, { from, to: span.to }, lines);
}

type ChainedAction = {
  readonly changes: ChangeSet;
  readonly effect: StateEffect<readonly ChunkSpan[]>;
};

type SideDecision = {
  readonly chunk: Chunk;
  readonly kind: ChunkAction["kind"];
  readonly side: Side;
};

const OPPOSITE: Readonly<Record<ChunkAction["kind"], ChunkAction["kind"]>> = {
  apply: "ignore",
  ignore: "apply",
};

function startOnOwnLine(
  state: EditorState,
  field: StateField<readonly ChunkSpan[]>,
  id: Chunk["id"],
): EditorState {
  const spans = state.field(field).map((span) => {
    const line = state.doc.lineAt(span.from);
    return span.chunk.id !== id || span.from === span.to || line.from === span.from
      ? span
      : { ...span, from: toDocPos(line.to + 1) };
  });
  return state.update({ effects: placeSpans.of(spans) }).state;
}

function chainedChanges(target: ApplyTarget, decisions: readonly SideDecision[]): ChainedAction {
  let state = target.state;
  let changes = ChangeSet.empty(state.doc.length);
  for (const { chunk, kind, side } of decisions) {
    const span = state.field(target.field).find((current) => current.chunk.id === chunk.id);
    if (span === undefined) {
      throw new Error(`chunk ${chunk.id} is not in the chunk field`);
    }
    if (isSideOpen(chunk, span.status, side)) {
      const replaces = kind === "apply" && applyMode(span.status, side) === "replace";
      const status =
        kind === "apply"
          ? statusAfterApply(chunk, span.status, side)
          : statusAfterIgnore(chunk, span.status, side);
      const click = state.update({
        changes: kind === "apply" ? applyChange({ ...target, state }, span, side) : [],
        effects: setStatus.of({ id: chunk.id, status }),
      });
      changes = changes.compose(click.changes);
      state = replaces ? startOnOwnLine(click.state, target.field, chunk.id) : click.state;
    }
  }
  return { changes, effect: placeSpans.of(state.field(target.field)) };
}

function sideDecisions(
  { chunk, status }: ChunkSpan,
  { kind, side }: ChunkAction,
  reach: Reach,
): SideDecision[] {
  const own = { chunk, kind, side };
  return reach === "conflict" && decidesOtherSide(chunk, status, side)
    ? [own, { chunk, kind: OPPOSITE[kind], side: otherSide(side) }]
    : [own];
}

function chosenSpans(target: ApplyTarget, { side, chunks }: ChunkAction): ChunkSpan[] {
  const ids = new Set(chunks.map((chunk) => chunk.id));
  return target.state
    .field(target.field)
    .filter((span) => ids.has(span.chunk.id) && isSideOpen(span.chunk, span.status, side));
}

// History restores the selection from before the action's transaction, so the cursor moves in a
// transaction of its own (@codemirror/commands history: HistEvent.startSelection).
function moveCursor(pos: number): TransactionSpec {
  return {
    selection: EditorSelection.cursor(pos),
    annotations: Transaction.addToHistory.of(false),
  };
}

// A selection step after the action lands in the action's HistEvent.selectionsAfter: redo restores
// it instead of mapping the start selection with assoc 1, and later typing no longer joins the
// action's undo step (@codemirror/commands history: HistoryState.addChanges, pop).
function recordSelection(selection: EditorSelection): TransactionSpec {
  return { selection };
}

function bulkCursorTarget(state: EditorState, visible: VisibleLines): number | null {
  const line = state.doc.lineAt(state.selection.main.head).number;
  return line >= visible.first && line <= visible.last ? null : state.doc.line(visible.first).from;
}

export function dispatchSteps(dispatch: (spec: TransactionSpec) => void, steps: Steps): void {
  for (const spec of steps) {
    dispatch(spec);
  }
}

export function actionSteps(target: ApplyTarget, action: ChunkAction, reach: Reach): Steps {
  const spans = chosenSpans(target, action);
  const last = spans.at(-1);
  if (last === undefined) {
    return [];
  }
  const { changes, effect } = chainedChanges(
    target,
    spans.flatMap((span) => sideDecisions(span, action, reach)),
  );
  return [
    moveCursor(last.from),
    { changes, effects: effect, userEvent: `yamt.${action.kind}` },
    recordSelection(EditorSelection.single(last.from).map(changes)),
  ];
}

export function bulkApplySteps({
  target,
  side,
  visible,
}: {
  readonly target: ApplyTarget;
  readonly side: Side;
  readonly visible: VisibleLines;
}): Steps {
  const decisions = target.state
    .field(target.field)
    .filter((span) => canBulkApply(span.chunk, span.status, side))
    .map((span): SideDecision => ({ chunk: span.chunk, kind: "apply", side }));
  if (decisions.length === 0) {
    return [];
  }
  const { changes, effect } = chainedChanges(target, decisions);
  const action = { changes, effects: effect, userEvent: "yamt.apply" };
  const cursor = bulkCursorTarget(target.state, visible);
  if (cursor === null) {
    return [action, recordSelection(target.state.selection.map(changes))];
  }
  return [moveCursor(cursor), action, recordSelection(EditorSelection.single(cursor).map(changes))];
}
