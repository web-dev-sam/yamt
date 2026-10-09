import type { StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { FileMergeData } from "../ipc";
import { chunkField, type ChunkSpan } from "./internal/chunkField";
import { centerDecorations, sideDecorations } from "./internal/decorations";
import { chunkRows, type PaneViews } from "./internal/geometry";
import { createPane } from "./internal/pane";
import { ScrollSync } from "./internal/scrollSync";
import { paintStrips } from "./internal/strips";

export type MergeHosts = {
  readonly left: HTMLElement;
  readonly center: HTMLElement;
  readonly right: HTMLElement;
  readonly strips: readonly [SVGSVGElement, SVGSVGElement];
};

export class MergeController {
  readonly #field: StateField<readonly ChunkSpan[]>;
  readonly #views: PaneViews;
  readonly #strips: MergeHosts["strips"];
  readonly #scroll: ScrollSync;
  #frameId: number | null = null;

  constructor(data: FileMergeData, hosts: MergeHosts) {
    const { language, chunks } = data;
    const field = chunkField(chunks);
    const repaint = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.geometryChanged) {
        this.#requestFrame();
      }
    });
    this.#field = field;
    this.#views = {
      left: createPane({
        kind: "side",
        doc: data.local,
        language,
        parent: hosts.left,
        extensions: [sideDecorations(chunks, "local"), repaint],
      }),
      center: createPane({
        kind: "center",
        doc: data.base,
        language,
        parent: hosts.center,
        extensions: [field, centerDecorations(field), repaint],
      }),
      right: createPane({
        kind: "side",
        doc: data.remote,
        language,
        parent: hosts.right,
        extensions: [sideDecorations(chunks, "remote"), repaint],
      }),
    };
    this.#strips = hosts.strips;
    this.#scroll = new ScrollSync(this.#views, () => {
      this.#requestFrame();
    });
    this.#requestFrame();
  }

  #requestFrame(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const views = this.#views;
      const rows = chunkRows(views, views.center.state.field(this.#field));
      this.#scroll.sync(rows);
      paintStrips(views, this.#strips, rows);
    });
  }

  destroy(): void {
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
