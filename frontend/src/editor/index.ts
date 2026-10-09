import { redo, undo } from "@codemirror/commands";
import type { StateField, TransactionSpec } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { FileMergeData } from "../ipc";
import {
  applyAllNonConflicting,
  applyChunk,
  dismissChunk,
  type ApplyTarget,
  type SideDocs,
} from "./internal/apply";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { centerDecorations, sideDecorations } from "./internal/decorations";
import { chunkRows, type PaneViews } from "./internal/geometry";
import { createPane } from "./internal/pane";
import { ScrollSync } from "./internal/scrollSync";
import type { Side } from "./internal/side";
import { showStatuses, sideStatusField } from "./internal/sideStatus";
import { summarize, type MergeSummary } from "./internal/status";
import { paintStrips, type ChunkAction } from "./internal/strips";

export type { MergeSummary } from "./internal/status";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #views: PaneViews;
  readonly #sides: SideDocs;
  readonly #strips: MergeHosts["strips"];
  readonly #scroll: ScrollSync;
  #frameId: number | null = null;
  #summaryListener: ((summary: MergeSummary) => void) | null = null;

  constructor(data: FileMergeData, hosts: MergeHosts) {
    this.#field = chunkField(data.chunks);
    this.#views = this.#createViews(data, hosts);
    this.#sides = { local: this.#views.left.state.doc, remote: this.#views.right.state.doc };
    this.#strips = hosts.strips;
    this.#scroll = new ScrollSync(this.#views, () => {
      this.#requestFrame();
    });
    this.#requestFrame();
  }

  #createViews(data: FileMergeData, hosts: MergeHosts): PaneViews {
    const { language, eol } = data;
    const field = this.#field;
    const statuses = sideStatusField(data.chunks);
    const repaint = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.geometryChanged) {
        this.#requestFrame();
      }
    });
    const statusSync = EditorView.updateListener.of((update) => {
      this.#statusesChanged(update);
    });
    const shared = { eol, language };
    return {
      left: createPane({
        ...shared,
        kind: "side",
        doc: data.local,
        parent: hosts.left,
        extensions: [statuses, sideDecorations(statuses, "local"), repaint],
      }),
      center: createPane({
        ...shared,
        kind: "center",
        doc: data.base,
        parent: hosts.center,
        extensions: [field, centerDecorations(field), repaint, statusSync],
      }),
      right: createPane({
        ...shared,
        kind: "side",
        doc: data.remote,
        parent: hosts.right,
        extensions: [statuses, sideDecorations(statuses, "remote"), repaint],
      }),
    };
  }

  #target(): ApplyTarget {
    return { state: this.#views.center.state, field: this.#field, sides: this.#sides };
  }

  #dispatch(spec: TransactionSpec | null): void {
    if (spec !== null) {
      this.#views.center.dispatch(spec);
    }
  }

  #act(action: ChunkAction): void {
    this.#dispatch(
      action.kind === "apply"
        ? applyChunk(this.#target(), action.chunk, action.side)
        : dismissChunk(this.#target(), action.chunk),
    );
  }

  #statusesChanged(update: ViewUpdate): void {
    const before = update.startState.field(this.#field);
    const after = update.state.field(this.#field);
    if (after.every((span, index) => span.status === before[index]?.status)) {
      return;
    }
    const states = after.map(({ chunk, status }) => ({ chunk, status }));
    this.#views.left.dispatch({ effects: showStatuses.of(states) });
    this.#views.right.dispatch({ effects: showStatuses.of(states) });
    this.#requestFrame();
    this.#summaryListener?.(summarize(after));
  }

  #requestFrame(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const views = this.#views;
      const rows = chunkRows(views, views.center.state.field(this.#field));
      this.#scroll.sync(rows);
      paintStrips(views, this.#strips, rows, (action) => {
        this.#act(action);
      });
    });
  }

  applyAllNonConflicting(side: Side): void {
    this.#dispatch(applyAllNonConflicting(this.#target(), side));
  }

  undo(): boolean {
    return undo(this.#views.center);
  }

  redo(): boolean {
    return redo(this.#views.center);
  }

  resultText(): string {
    return this.#views.center.state.sliceDoc();
  }

  summary(): MergeSummary {
    return summarize(this.#views.center.state.field(this.#field));
  }

  onSummaryChange(listener: (summary: MergeSummary) => void): void {
    this.#summaryListener = listener;
  }

  destroy(): void {
    this.#summaryListener = null;
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
    for (const view of [this.#views.left, this.#views.center, this.#views.right]) {
      view.destroy();
    }
    for (const strip of this.#strips) {
      strip.replaceChildren();
    }
  }
}
