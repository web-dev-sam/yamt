import { searchPanelOpen } from "@codemirror/search";
import type { StateField } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import { pushCovered } from "./covered";
import { coveredAction, type IconDrag } from "./drag";
import { syncFindSpace } from "./find";
import { waveStarts, type FoldFields } from "./folds";
import { chunkRows, rowsChanged, waveRows, type PaneViews } from "./geometry";
import type { ChunkRow, WaveRow } from "./geometry";
import { anchorsOf, contentEnds, ScrollSync, type Anchor } from "./scrollSync";
import type { Strips } from "./strips";

type Layout = {
  readonly rows: readonly ChunkRow[];
  readonly anchors: readonly Anchor[];
  readonly waves: readonly WaveRow[];
};

type FrameParts = {
  readonly views: PaneViews;
  readonly spans: StateField<readonly ChunkSpan[]>;
  readonly folds: FoldFields;
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
    const { spans, folds } = this.#parts;
    if (rowsChanged(update, [spans, folds.center, folds.sides])) {
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
      const { views, spans, folds } = this.#parts;
      const rows = chunkRows(views, views.center.state.field(spans));
      const starts = waveStarts(folds, views);
      const waves = waveRows(starts, (pane, pos) => views[pane].lineBlockAt(pos).top);
      this.#layoutCache = { rows, anchors: anchorsOf(rows, contentEnds(views)), waves };
    }
    return this.#layoutCache;
  }

  request(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const { views, drag, strips } = this.#parts;
      syncFindSpace(views);
      const layout = this.layout();
      this.#scroll.sync(layout.anchors);
      const press = drag.press;
      const covered = press === null ? null : coveredAction(press, layout.rows, views);
      pushCovered(views, covered);
      strips.paint(views, layout, covered);
    });
  }

  destroy(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
  }
}
