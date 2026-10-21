import { Text } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { Column } from "../../ipc";
import { columnLimit } from "./columnBytes";
import { differenceField } from "./compareFields";
import { nextDifference } from "./compareNavigation";
import { toDocPos } from "./docPos";
import { rangeSpan } from "./geometry";
import type { Direction } from "./navigation";
import { createPane, type PaneSettings } from "./pane";
import { everyPane } from "./paneViews";
import { removalTooltip } from "./removalTooltip";
import { revealScrollTop, visibleArea } from "./viewport";

export type ColumnViews = Readonly<Record<Column, EditorView>>;

export type ColumnWiring = {
  readonly settings: PaneSettings;
  readonly columnLimit: number;
  readonly refused: (column: Column) => void;
  readonly updated: (column: Column, update: ViewUpdate) => void;
};

export const COLUMNS = ["left", "right"] as const satisfies readonly Column[];

const LINE_BREAK = /\r\n?|\n/;

function createColumn(
  column: Column,
  { text, parent }: { readonly text: string; readonly parent: HTMLElement },
  wiring: ColumnWiring,
): EditorView {
  return createPane({
    kind: "center",
    doc: Text.of(text.split(LINE_BREAK)),
    eol: "Lf",
    language: null,
    settings: wiring.settings,
    parent,
    extensions: [
      differenceField,
      columnLimit(wiring.columnLimit, () => {
        wiring.refused(column);
      }),
      removalTooltip(),
      everyPane(),
      EditorView.updateListener.of((update) => {
        wiring.updated(column, update);
      }),
    ],
  });
}

export function createColumnViews(
  texts: Readonly<Record<Column, string>>,
  hosts: Readonly<Record<Column, HTMLElement>>,
  wiring: ColumnWiring,
): ColumnViews {
  return {
    left: createColumn("left", { text: texts.left, parent: hosts.left }, wiring),
    right: createColumn("right", { text: texts.right, parent: hosts.right }, wiring),
  };
}

export function keyboardColumn(views: ColumnViews): Column | null {
  return (
    COLUMNS.find((column) => {
      const view = views[column];
      return view.dom.contains(view.root.activeElement);
    }) ?? null
  );
}

export function revealDifference(view: EditorView, direction: Direction): void {
  const { state } = view;
  const target = nextDifference(
    state.doc,
    state.field(differenceField).spans,
    toDocPos(state.selection.main.head),
    direction,
  );
  if (target === null) {
    return;
  }
  view.dispatch({ selection: { anchor: target.from } });
  const span = rangeSpan(state.doc, target, (pos) => view.lineBlockAt(pos));
  const top = revealScrollTop(span, {
    area: visibleArea(view),
    lineHeight: view.defaultLineHeight,
    paddingTop: view.documentPadding.top,
  });
  if (top !== null) {
    view.scrollDOM.scrollTop = top;
  }
  if (!view.hasFocus) {
    view.focus();
  }
}
