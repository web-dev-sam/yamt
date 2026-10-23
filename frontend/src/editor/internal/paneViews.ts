import type { Language } from "@codemirror/language";
import type { Extension, StateField, Text } from "@codemirror/state";
import { tooltips } from "@codemirror/view";

import type { FileMergeData } from "../../ipc";
import type { ChunkAction } from "./apply";
import type { ChunkSpan } from "./chunkField";
import { coveredDecorations } from "./covered";
import { centerDecorations, focusDecorations, sideDecorations } from "./decorations";
import { exactScroll } from "./exactScroll";
import type { Folds } from "./foldView";
import { SIDE_PANE, type ChunkRow, type Pane, type PaneViews } from "./geometry";
import { modClicks } from "./modClick";
import { centerKind, createPane, type PaneSettings } from "./pane";
import { removalTooltip } from "./removalTooltip";
import type { Side } from "./side";
import { sideRunner, type SideCommand } from "./sideKeys";
import { sideStatusField } from "./sideStatus";
import type { ChunkState } from "./status";

export type ViewSources = {
  readonly data: FileMergeData;
  readonly docs: Readonly<Record<Pane, Text>>;
  readonly hosts: Readonly<Record<Pane, HTMLElement>>;
  readonly language: Language | null;
};

export type PaneWiring = {
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly folds: Folds;
  readonly readOnly: boolean;
  readonly settings: PaneSettings;
  readonly center: Extension;
  readonly repaint: Extension;
  readonly run: (side: Side, command: SideCommand) => void;
  readonly rows: () => readonly ChunkRow[];
  readonly act: (action: ChunkAction) => void;
};

export function everyPane(): Extension {
  return [
    // Under a transformed or contained ancestor CodeMirror lays fixed tooltips out inside the
    // pane (@codemirror/view tooltips readMeasure, makeAbsolute), squeezing their text.
    tooltips({ parent: document.body }),
    exactScroll,
  ];
}

function sideExtensions(
  statuses: StateField<readonly ChunkState[]>,
  side: Side,
  wiring: PaneWiring,
): Extension {
  const { folds, readOnly, rows, act } = wiring;
  return [
    statuses,
    sideDecorations(statuses, side),
    focusDecorations(statuses, side),
    coveredDecorations(side),
    folds.side(SIDE_PANE[side]),
    sideRunner.of((command) => {
      wiring.run(side, command);
    }),
    wiring.repaint,
    removalTooltip(),
    everyPane(),
    readOnly ? [] : modClicks(side, { rows, act }),
  ];
}

export function createPaneViews(
  { data, docs, hosts, language }: ViewSources,
  wiring: PaneWiring,
): PaneViews {
  const { field, folds, settings } = wiring;
  const shared = { eol: data.eol, language, settings };
  const center = createPane({
    ...shared,
    kind: centerKind(wiring.readOnly),
    doc: docs.center,
    parent: hosts.center,
    extensions: [field, centerDecorations(field), folds.center(), everyPane(), wiring.center],
  });
  const statuses = sideStatusField(
    center.state.field(field).map(({ chunk, status }) => ({ chunk, status })),
  );
  return {
    left: createPane({
      ...shared,
      kind: "side",
      doc: docs.left,
      parent: hosts.left,
      extensions: sideExtensions(statuses, "local", wiring),
    }),
    center,
    right: createPane({
      ...shared,
      kind: "side",
      doc: docs.right,
      parent: hosts.right,
      extensions: sideExtensions(statuses, "remote", wiring),
    }),
  };
}
