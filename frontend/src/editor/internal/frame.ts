import { searchPanelOpen } from "@codemirror/search";
import type { StateField } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import { pushCovered } from "./covered";
import type { DocPos } from "./docPos";
import { coveredAction, type IconDrag } from "./drag";
import { syncFindSpace } from "./find";
import { displayed, type Fold } from "./foldRuns";
import { chunkRows, rowsChanged, waveRows, type Pane, type PaneViews } from "./geometry";
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
  readonly folds: Readonly<Record<"center" | "sides", StateField<readonly Fold[]>>>;
  readonly hovered: () => number | null;
  readonly drag: IconDrag;
  readonly strips: Strips;
};

function waveStarts(folds: readonly Fold[], pane: Pane): (DocPos | null)[] {
  return folds.map((fold) => displayed(fold, pane)?.from ?? null);
}

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
      const starts = {
        left: waveStarts(views.left.state.field(folds.sides), "left"),
        center: waveStarts(views.center.state.field(folds.center), "center"),
        right: waveStarts(views.right.state.field(folds.sides), "right"),
      };
      const waves = waveRows(starts, (pane, pos) => views[pane].lineBlockAt(pos).top);
      this.#layoutCache = { rows, anchors: anchorsOf(rows, contentEnds(views)), waves };
    }
    return this.#layoutCache;
  }

  request(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const { views, drag, strips, hovered } = this.#parts;
      syncFindSpace(views);
      const layout = this.layout();
      this.#scroll.sync(layout.anchors);
      const press = drag.press;
      const covered = press === null ? null : coveredAction(press, layout.rows, views);
      pushCovered(views, covered);
      strips.paint(views, layout, { covered, hovered: hovered() });
    });
  }

  destroy(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
  }
}
