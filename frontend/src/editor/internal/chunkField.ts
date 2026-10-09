import { invertedEffects } from "@codemirror/commands";
import { StateEffect, StateField, type ChangeDesc, type Text } from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { lineSpan } from "./lineSpan";
import { chunkTone, type Tone } from "./tone";

type DocPos = number & { readonly __brand: "DocPos" };

export type ChunkSpan = {
  readonly chunk: Chunk;
  readonly tone: Tone;
  readonly from: DocPos;
  readonly to: DocPos;
};

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
): readonly ChunkSpan[] {
  const mapped = spans.map((span) => ({
    ...span,
    from: toDocPos(changes.mapPos(span.from, -1)),
    to: toDocPos(changes.mapPos(span.to, endsMidLine(span, doc) ? 1 : -1)),
  }));
  return mapped.map((span, index) => {
    const next = mapped[index + 1];
    return next === undefined || span.to <= next.from ? span : { ...span, to: next.from };
  });
}

const restoreSpans = StateEffect.define<readonly ChunkSpan[]>({
  map: (spans, changes) => mapSpans(spans, changes, null),
});

export function chunkField(chunks: readonly Chunk[]): StateField<readonly ChunkSpan[]> {
  return StateField.define<readonly ChunkSpan[]>({
    create: (state) =>
      chunks.map((chunk) => {
        const { from, to } = lineSpan(state.doc, chunk.base);
        return {
          chunk,
          tone: chunkTone(chunk, "center"),
          from: toDocPos(from),
          to: toDocPos(to),
        };
      }),
    update(spans, tr) {
      // History appends a merged event's older inverted effects after the newer ones
      // (@codemirror/commands HistoryState.addChanges), so the last snapshot is the oldest state.
      const restore = tr.effects.findLast((effect) => effect.is(restoreSpans));
      if (restore !== undefined) {
        return restore.value;
      }
      return tr.docChanged ? mapSpans(spans, tr.changes, tr.startState.doc) : spans;
    },
    provide: (field) =>
      invertedEffects.of((tr) =>
        tr.docChanged ? [restoreSpans.of(tr.startState.field(field))] : [],
      ),
  });
}
