import type { EditorView } from "@codemirror/view";

import type { Column } from "../../ipc";
import { differenceField } from "./compareFields";
import { nextDifference } from "./compareNavigation";
import { COLUMNS, type ColumnViews } from "./compareViews";
import { toDocPos } from "./docPos";
import { rangeSpan } from "./geometry";
import type { Direction } from "./navigation";
import { revealSpan } from "./viewport";

type Focusable = {
  readonly dom: Pick<Node, "contains">;
  readonly root: Pick<DocumentOrShadowRoot, "activeElement">;
};

export function keyboardColumn(views: Readonly<Record<Column, Focusable>>): Column | null {
  return (
    COLUMNS.find((column) => {
      const view = views[column];
      return view.dom.contains(view.root.activeElement);
    }) ?? null
  );
}

export function arrowColumn(views: Readonly<Record<Column, Focusable>>): Column {
  return keyboardColumn(views) ?? "left";
}

export function moveToDifference(views: ColumnViews, direction: Direction): void {
  revealDifference(views[arrowColumn(views)], direction);
}

function revealDifference(view: EditorView, direction: Direction): void {
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
  revealSpan(
    view,
    rangeSpan(state.doc, target, (pos) => view.lineBlockAt(pos)),
  );
  if (!view.hasFocus) {
    view.focus();
  }
}
