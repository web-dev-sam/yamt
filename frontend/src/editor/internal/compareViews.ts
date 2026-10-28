import { Text, type EditorState, type Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { Column, Difference } from "../../ipc";
import { columnLimit } from "./columnBytes";
import { differenceField, showDifferences } from "./compareFields";
import { columnMarks } from "./compareMarks";
import { paneState, preferenceEffects, type PaneSettings } from "./pane";
import { everyPane } from "./paneViews";
import { removalTooltip } from "./removalTooltip";

export type ColumnViews = Readonly<Record<Column, EditorView>>;

type ColumnTexts = Readonly<Record<Column, string>>;
type ColumnHosts = Readonly<Record<Column, HTMLElement>>;

export type ColumnWiring = {
  readonly settings: PaneSettings;
  readonly columnLimit: number;
  readonly refused: (column: Column) => void;
  readonly updated: (column: Column, update: ViewUpdate) => void;
};

export type ReadOnlyWiring = {
  readonly settings: PaneSettings;
  readonly updated: (column: Column, update: ViewUpdate) => void;
  readonly extensions: (column: Column) => Extension;
};

type ColumnSource = { readonly column: Column; readonly text: string };

export const COLUMNS = ["left", "right"] as const satisfies readonly Column[];

const LINE_BREAK = /\r\n?|\n/;

function columnState({
  text,
  kind,
  settings,
  extensions,
}: {
  readonly text: string;
  readonly kind: "center" | "readOnlyCenter";
  readonly settings: PaneSettings;
  readonly extensions: Extension;
}): EditorState {
  return paneState({
    kind,
    doc: Text.of(text.split(LINE_BREAK)),
    eol: "Lf",
    language: null,
    settings,
    extensions,
  });
}

function updatedListener(
  column: Column,
  updated: (column: Column, update: ViewUpdate) => void,
): Extension {
  return EditorView.updateListener.of((update) => {
    updated(column, update);
  });
}

export function editableColumnState(
  { column, text }: ColumnSource,
  wiring: ColumnWiring,
): EditorState {
  return columnState({
    text,
    kind: "center",
    settings: wiring.settings,
    extensions: [
      differenceField,
      columnLimit(wiring.columnLimit, () => {
        wiring.refused(column);
      }),
      removalTooltip(),
      everyPane(),
      updatedListener(column, wiring.updated),
    ],
  });
}

export function readOnlyColumnState(
  { column, text }: ColumnSource,
  wiring: ReadOnlyWiring,
): EditorState {
  return columnState({
    text,
    kind: "readOnlyCenter",
    settings: wiring.settings,
    extensions: [
      differenceField,
      removalTooltip(),
      everyPane(),
      updatedListener(column, wiring.updated),
      wiring.extensions(column),
    ],
  });
}

function columnViews(hosts: ColumnHosts, state: (column: Column) => EditorState): ColumnViews {
  return {
    left: new EditorView({ state: state("left"), parent: hosts.left }),
    right: new EditorView({ state: state("right"), parent: hosts.right }),
  };
}

export function createColumnViews(
  texts: ColumnTexts,
  hosts: ColumnHosts,
  wiring: ColumnWiring,
): ColumnViews {
  return columnViews(hosts, (column) =>
    editableColumnState({ column, text: texts[column] }, wiring),
  );
}

export function createReadOnlyColumnViews(
  texts: ColumnTexts,
  hosts: ColumnHosts,
  wiring: ReadOnlyWiring,
): ColumnViews {
  return columnViews(hosts, (column) =>
    readOnlyColumnState({ column, text: texts[column] }, wiring),
  );
}

export function showColumnDifferences(
  views: ColumnViews,
  differences: readonly Difference[],
): void {
  for (const column of COLUMNS) {
    const view = views[column];
    const marks = columnMarks(view.state.doc, differences, column);
    view.dispatch({ effects: showDifferences.of(marks) });
  }
}

export function setColumnPreferences(views: ColumnViews, settings: PaneSettings): void {
  const effects = preferenceEffects("center", settings);
  for (const column of COLUMNS) {
    views[column].dispatch({ effects });
  }
}
