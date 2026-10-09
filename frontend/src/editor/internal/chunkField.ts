import { invertedEffects } from "@codemirror/commands";
import { StateEffect, StateField, type ChangeDesc } from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { lineStart } from "./lineStart";
import { CHANGED_SIDES, chunkTone, type Tone } from "./tone";

type DocPos = number & { readonly __brand: "DocPos" };

export type ChunkSpan = {
  readonly id: Chunk["id"];
  readonly kind: Chunk["kind"];
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

function mapSpans(spans: readonly ChunkSpan[], changes: ChangeDesc): readonly ChunkSpan[] {
  return spans.map((span) => ({
    ...span,
    from: toDocPos(changes.mapPos(span.from, -1)),
    to: toDocPos(changes.mapPos(span.to, -1)),
  }));
}

const restoreSpans = StateEffect.define<readonly ChunkSpan[]>({ map: mapSpans });

export function chunkField(chunks: readonly Chunk[]): StateField<readonly ChunkSpan[]> {
  return StateField.define<readonly ChunkSpan[]>({
    create: (state) =>
      chunks.map((chunk) => ({
        id: chunk.id,
        kind: chunk.kind,
        tone: chunkTone(chunk, CHANGED_SIDES[chunk.kind][0]),
        from: toDocPos(lineStart(state.doc, chunk.base.start)),
        to: toDocPos(lineStart(state.doc, chunk.base.start + chunk.base.len)),
      })),
    update(spans, tr) {
      let next = tr.docChanged ? mapSpans(spans, tr.changes) : spans;
      for (const effect of tr.effects) {
        if (effect.is(restoreSpans)) {
          next = effect.value;
        }
      }
      return next;
    },
    provide: (field) =>
      invertedEffects.of((tr) =>
        tr.docChanged ? [restoreSpans.of(tr.startState.field(field))] : [],
      ),
  });
}
