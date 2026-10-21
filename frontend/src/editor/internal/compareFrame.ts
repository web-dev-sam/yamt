import { searchPanelOpen } from "@codemirror/search";
import type { ViewUpdate } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { Column } from "../../ipc";
import { differenceField } from "./compareFields";
import type { CompareRow, CompareStrip } from "./compareStrip";
import { COLUMNS } from "./compareViews";
import { syncFindSpace, type FindSpaceView } from "./find";
import { rangeSpan, rowsChanged } from "./geometry";
import { contentEnd, ScrollSync, type Anchor, type ScrollPane } from "./scrollSync";

type FrameView = ScrollPane &
  FindSpaceView & {
    readonly documentTop: number;
    lineBlockAt(pos: number): Span;
  };
type FrameViews = Readonly<Record<Column, FrameView>>;

type CompareLayout = {
  readonly rows: readonly CompareRow[];
  readonly anchors: readonly Anchor<Column>[];
};

function columnSpan(view: FrameView, range: { readonly from: number; readonly to: number }): Span {
  return rangeSpan(view.state.doc, range, (pos) => view.lineBlockAt(pos));
}

function measure({ left, right }: FrameViews): CompareLayout {
  const rightSpans = right.state.field(differenceField).spans;
  const rows = left.state.field(differenceField).spans.flatMap((span, index) => {
    const other = rightSpans[index];
    return other === undefined
      ? []
      : [{ left: columnSpan(left, span), right: columnSpan(right, other), tone: span.tone }];
  });
  const edges = rows.flatMap((row) => [
    { left: row.left.top, right: row.right.top },
    { left: row.left.bottom, right: row.right.bottom },
  ]);
  const ends = { left: contentEnd(left), right: contentEnd(right) };
  return { rows, anchors: [{ left: 0, right: 0 }, ...edges, ends] };
}

export class CompareFrame {
  readonly #views: FrameViews;
  readonly #strip: Pick<CompareStrip, "paint">;
  readonly #scroll: ScrollSync<Column>;
  #frameId: number | null = null;
  #layoutCache: CompareLayout | null = null;

  constructor({
    views,
    strip,
  }: {
    readonly views: FrameViews;
    readonly strip: Pick<CompareStrip, "paint">;
  }) {
    this.#views = views;
    this.#strip = strip;
    this.#scroll = new ScrollSync(views, COLUMNS, () => {
      this.request();
    });
  }

  changed(update: Pick<ViewUpdate, "geometryChanged" | "startState" | "state">): void {
    const moved = rowsChanged(update, [differenceField]);
    if (moved) {
      this.#layoutCache = null;
    }
    if (moved || searchPanelOpen(update.startState) !== searchPanelOpen(update.state)) {
      this.request();
    }
  }

  request(): void {
    this.#frameId ??= requestAnimationFrame(() => {
      this.#frameId = null;
      const views = this.#views;
      syncFindSpace([views.left, views.right]);
      this.#layoutCache ??= measure(views);
      const layout = this.#layoutCache;
      this.#scroll.sync(layout.anchors);
      this.#strip.paint(views, layout.rows);
    });
  }

  destroy(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
  }
}
