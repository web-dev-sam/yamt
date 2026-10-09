import { invertedEffects } from "@codemirror/commands";
import {
  StateEffect,
  StateField,
  type ChangeDesc,
  type Text,
  type Transaction,
} from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { lineSpan } from "./lineSpan";
import { isResolved, type ChunkState, type ChunkStatus } from "./status";
import { chunkTone, type Tone } from "./tone";

type DocPos = number & { readonly __brand: "DocPos" };
type StatusChanges = ReadonlyMap<Chunk["id"], ChunkStatus>;

export type ChunkSpan = ChunkState & {
  readonly tone: Tone;
  readonly from: DocPos;
  readonly to: DocPos;
};

export const setStatus = StateEffect.define<{
  readonly id: Chunk["id"];
  readonly status: ChunkStatus;
}>();

function isDocPos(n: number): n is DocPos {
  return Number.isSafeInteger(n) && n >= 0;
}

function toDocPos(n: number): DocPos {
  if (!isDocPos(n)) {
    throw new Error(`${n} is not a document position`);
  }
  return n;
}

function endsMidLine(span: ChunkSpan, doc: Text | null): boolean {
  return doc !== null && span.from < span.to && doc.lineAt(span.to).from !== span.to;
}

function mapSpans(
  spans: readonly ChunkSpan[],
  changes: ChangeDesc,
  doc: Text | null,
  applied: StatusChanges,
): readonly ChunkSpan[] {
  let floor = 0;
  const mapped = spans.map((span) => {
    const isApplied = applied.has(span.chunk.id);
    const from = Math.max(changes.mapPos(span.from, -1), floor);
    const to = Math.max(
      changes.mapPos(span.to, isApplied || endsMidLine(span, doc) ? 1 : -1),
      from,
    );
    if (isApplied) {
      floor = to;
    }
    return { ...span, from: toDocPos(from), to: toDocPos(to) };
  });
  return mapped.map((span, index) => {
    const next = mapped[index + 1];
    return next === undefined || span.to <= next.from ? span : { ...span, to: next.from };
  });
}

function collapsedByUser(before: ChunkSpan | undefined, after: ChunkSpan): boolean {
  return (
    before !== undefined &&
    before.from < before.to &&
    after.from === after.to &&
    !isResolved(before.chunk, before.status)
  );
}

function updateSpans(spans: readonly ChunkSpan[], tr: Transaction): readonly ChunkSpan[] {
  const changed = new Map<Chunk["id"], ChunkStatus>();
  for (const effect of tr.effects) {
    if (effect.is(setStatus)) {
      changed.set(effect.value.id, effect.value.status);
    }
  }
  if (!tr.docChanged && changed.size === 0) {
    return spans;
  }
  const mapped = tr.docChanged ? mapSpans(spans, tr.changes, tr.startState.doc, changed) : spans;
  return mapped.map((span, index) => {
    const status =
      changed.get(span.chunk.id) ??
      (collapsedByUser(spans[index], span) ? "dismissed" : span.status);
    return status === span.status ? span : { ...span, status };
  });
}

const restoreSpans = StateEffect.define<readonly ChunkSpan[]>({
  map: (spans, changes) => mapSpans(spans, changes, null, new Map()),
});

export function chunkField(chunks: readonly Chunk[]): StateField<readonly ChunkSpan[]> {
  return StateField.define<readonly ChunkSpan[]>({
    create: (state) =>
      chunks.map((chunk) => {
        const { from, to } = lineSpan(state.doc, chunk.base);
        return {
          chunk,
          tone: chunkTone(chunk, "center"),
          status: "pending",
          from: toDocPos(from),
          to: toDocPos(to),
        };
      }),
    update(spans, tr) {
      // History appends a merged event's older inverted effects after the newer ones
      // (@codemirror/commands HistoryState.addChanges), so the last snapshot is the oldest state.
      const restore = tr.effects.findLast((effect) => effect.is(restoreSpans));
      return restore === undefined ? updateSpans(spans, tr) : restore.value;
    },
    provide: (field) =>
      invertedEffects.of((tr) =>
        tr.docChanged ||
        tr.effects.some((effect) => effect.is(setStatus) || effect.is(restoreSpans))
          ? [restoreSpans.of(tr.startState.field(field))]
          : [],
      ),
  });
}
