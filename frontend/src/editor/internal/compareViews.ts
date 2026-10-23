import { Text } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { Column } from "../../ipc";
import { columnLimit } from "./columnBytes";
import { differenceField } from "./compareFields";
import { createPane, type PaneSettings } from "./pane";
import { everyPane } from "./paneViews";
import { removalTooltip } from "./removalTooltip";

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
