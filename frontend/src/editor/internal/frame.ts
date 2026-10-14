import { searchPanelOpen } from "@codemirror/search";
import type { StateField } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import { pushCovered } from "./covered";
import { coveredAction, type IconDrag } from "./drag";
import { syncFindSpace } from "./find";
import { chunkRows, rowsChanged, type ChunkRow, type PaneViews } from "./geometry";
import { anchorsOf, contentEnds, ScrollSync, type Anchor } from "./scrollSync";
import type { Strips } from "./strips";

type Layout = { readonly rows: readonly ChunkRow[]; readonly anchors: readonly Anchor[] };

type FrameParts = {
  readonly views: PaneViews;
  readonly spans: StateField<readonly ChunkSpan[]>;
  readonly layoutFields: readonly StateField<unknown>[];
  readonly drag: IconDrag;
  readonly strips: Strips;
};

export class Frame {
  readonly #parts: FrameParts;
  readonly #scroll: ScrollSync;
  #frameId: number | null = null;
  #layoutCache: Layout | null = null;

  constructor(parts: FrameParts) {
    this.#parts = parts;
    this.#scroll = new ScrollSync(parts.views, () => {
      this.request();
    });
  }

  changed(update: ViewUpdate): void {
    if (rowsChanged(update, this.#parts.layoutFields)) {
      this.#layoutCache = null;
    }
    if (
      update.docChanged ||
      update.geometryChanged ||
      searchPanelOpen(update.startState) !== searchPanelOpen(update.state)
    ) {
      this.request();
    }
  }

  layout(): Layout {
    if (this.#layoutCache === null) {
      const { views, spans } = this.#parts;
      const rows = chunkRows(views, views.center.state.field(spans));
      this.#layoutCache = { rows, anchors: anchorsOf(rows, contentEnds(views)) };
    }
    return this.#layoutCache;
  }

  request(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const { views, drag, strips } = this.#parts;
      syncFindSpace(views);
      const { rows, anchors } = this.layout();
      this.#scroll.sync(anchors);
      const press = drag.press;
      const covered = press === null ? null : coveredAction(press, rows, views);
      pushCovered(views, covered);
      strips.paint(views, rows, covered);
    });
  }

  destroy(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
  }
}
