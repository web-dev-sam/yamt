import { StateEffect, StateField, type EditorState, type Text } from "@codemirror/state";
import { BlockType, Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { Column } from "../../ipc";
import type { LineBlock } from "./compareFrame";
import { contentEnd, type Anchor } from "./scrollSync";
import type { ThreadRow } from "./threadRows";
import { ThreadRowWidget, type RowCells } from "./threadWidget";

export type LineCount = { readonly line: number; readonly keys: readonly string[] };

export type ColumnThreads = {
  readonly column: Column;
  readonly rows: readonly ThreadRow[];
  readonly counts: readonly LineCount[];
  readonly cells: RowCells;
};

type AnchorView = { readonly state: EditorState; lineBlockAt(pos: number): LineBlock };

export const showThreadRows = StateEffect.define<ColumnThreads>();

export function rowDecorations(doc: Text, threads: ColumnThreads | null): DecorationSet {
  if (threads === null) {
    return Decoration.none;
  }
  const { column, rows, cells } = threads;
  const widgets = rows.map((row, index) => {
    const widget = new ThreadRowWidget(row, column, cells);
    const place = Math.min(row.place[column], doc.lines);
    return place === 0
      ? Decoration.widget({ widget, block: true, side: index - rows.length }).range(0)
      : Decoration.widget({ widget, block: true, side: 1 + index }).range(doc.line(place).to);
  });
  return Decoration.set(widgets, true);
}

export const threadField = StateField.define<ColumnThreads | null>({
  create: () => null,
  update(threads, tr) {
    let shown = threads;
    for (const effect of tr.effects) {
      if (effect.is(showThreadRows)) {
        shown = effect.value;
      }
    }
    return shown;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) =>
      rowDecorations(state.doc, state.field(field)),
    ),
});

function textBlock(block: LineBlock): Span {
  if (typeof block.type === "number") {
    return block;
  }
  return block.type.find((part) => part.type === BlockType.Text) ?? block;
}

function bottomAbove(view: AnchorView, place: number): number {
  const { doc } = view.state;
  return textBlock(view.lineBlockAt(doc.line(Math.min(place, doc.lines)).from)).bottom;
}

function topBelow(view: AnchorView, place: number): number {
  const { doc } = view.state;
  return place < doc.lines
    ? textBlock(view.lineBlockAt(doc.line(place + 1).from)).top
    : contentEnd(view);
}

export function threadAnchors(views: Readonly<Record<Column, AnchorView>>): Anchor<Column>[] {
  const rows = views.left.state.field(threadField, false)?.rows ?? [];
  return rows
    .filter((row) => row.unchanged)
    .flatMap(({ place }) => [
      { left: bottomAbove(views.left, place.left), right: bottomAbove(views.right, place.right) },
      { left: topBelow(views.left, place.left), right: topBelow(views.right, place.right) },
    ]);
}
