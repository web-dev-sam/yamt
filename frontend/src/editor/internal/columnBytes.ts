import {
  EditorState,
  StateField,
  type Extension,
  type Text,
  type Transaction,
} from "@codemirror/state";

const ONE_BYTE_BELOW = 0x80;
const TWO_BYTES_BELOW = 0x800;
const HIGH_SURROGATE_FIRST = 0xd800;
const HIGH_SURROGATE_LAST = 0xdbff;
const LOW_SURROGATE_FIRST = 0xdc00;
const LOW_SURROGATE_LAST = 0xdfff;
const TWO_BYTES = 2;
const PAIR_BYTES = 4;
const WIDE_BYTES = 3;

export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < ONE_BYTE_BELOW) {
      bytes += 1;
    } else if (code < TWO_BYTES_BELOW) {
      bytes += TWO_BYTES;
    } else if (
      code >= HIGH_SURROGATE_FIRST &&
      code <= HIGH_SURROGATE_LAST &&
      text.charCodeAt(index + 1) >= LOW_SURROGATE_FIRST &&
      text.charCodeAt(index + 1) <= LOW_SURROGATE_LAST
    ) {
      bytes += PAIR_BYTES;
      index++;
    } else {
      bytes += WIDE_BYTES;
    }
  }
  return bytes;
}

function textBytes(text: Text, from: number, to: number): number {
  let bytes = 0;
  for (const iter = text.iterRange(from, to); !iter.next().done;) {
    bytes += utf8Length(iter.value);
  }
  return bytes;
}

function addedBytes(tr: Transaction): number {
  let added = 0;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    added += textBytes(inserted, 0, inserted.length) - textBytes(tr.startState.doc, fromA, toA);
  });
  return added;
}

export function columnLimit(limit: number, refused: () => void): Extension {
  const count = StateField.define<number>({
    create: (state) => textBytes(state.doc, 0, state.doc.length),
    update: (bytes, tr) => (tr.docChanged ? bytes + addedBytes(tr) : bytes),
  });
  const filter = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) {
      return tr;
    }
    const added = addedBytes(tr);
    if (added > 0 && tr.startState.field(count) + added > limit) {
      refused();
      return [];
    }
    return tr;
  });
  return [count, filter];
}
