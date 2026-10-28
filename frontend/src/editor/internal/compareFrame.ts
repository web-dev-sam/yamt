import { searchPanelOpen } from "@codemirror/search";
import type { StateField } from "@codemirror/state";
import { BlockType, type ViewUpdate } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { Column } from "../../ipc";
import { differenceField } from "./compareFields";
import type { CompareRow, CompareStrip } from "./compareStrip";
import { COLUMNS } from "./compareViews";
import { syncFindSpace, type FindSpaceView } from "./find";
import { rangeSpan, rowsChanged, type WaveRow } from "./geometry";
import { contentEnd, ScrollSync, type Anchor, type ScrollPane } from "./scrollSync";

export type LineBlock = Span & { readonly type: BlockType | readonly LineBlock[] };
type FrameView = ScrollPane &
  FindSpaceView & {
    readonly documentTop: number;
    lineBlockAt(pos: number): LineBlock;
  };
type FrameViews = Readonly<Record<Column, FrameView>>;
type ExtraAnchors = (views: FrameViews) => readonly Anchor<Column>[];
type Waves = (views: FrameViews) => readonly WaveRow<Column>[];

type CompareLayout = {
  readonly rows: readonly CompareRow[];
  readonly anchors: readonly Anchor<Column>[];
  readonly waves: readonly WaveRow<Column>[];
};

export function textBlock(block: LineBlock): Span {
  if (typeof block.type === "number") {
    return block;
  }
  return block.type.find((part) => part.type === BlockType.Text) ?? block;
}

function columnSpan(view: FrameView, range: { readonly from: number; readonly to: number }): Span {
  const { doc } = view.state;
  if (range.from !== range.to) {
    return rangeSpan(doc, range, (pos) => view.lineBlockAt(pos));
  }
  const block = view.lineBlockAt(range.from);
  const text = textBlock(block);
  return doc.lineAt(range.from).from === range.from
    ? { top: block.top, bottom: text.top }
    : { top: text.bottom, bottom: block.bottom };
}

function measure(views: FrameViews, extra: ExtraAnchors, waves: Waves): CompareLayout {
  const { left, right } = views;
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
  const anchors = [{ left: 0, right: 0 }, ...edges, ...extra(views), ends].sort((a, b) =>
    a.left === b.left ? a.right - b.right : a.left - b.left,
  );
  return { rows, anchors, waves: waves(views) };
}

export class CompareFrame {
  readonly #views: FrameViews;
  readonly #strip: Pick<CompareStrip, "paint">;
  readonly #fields: readonly StateField<unknown>[];
  readonly #anchors: ExtraAnchors;
  readonly #waves: Waves;
  readonly #scroll: ScrollSync<Column>;
  #frameId: number | null = null;
  #layoutCache: CompareLayout | null = null;

  constructor({
    views,
    strip,
    fields,
    anchors,
    waves = () => [],
  }: {
    readonly views: FrameViews;
    readonly strip: Pick<CompareStrip, "paint">;
    readonly fields: readonly StateField<unknown>[];
    readonly anchors: ExtraAnchors;
    readonly waves?: Waves;
  }) {
    this.#views = views;
    this.#strip = strip;
    this.#fields = fields;
    this.#anchors = anchors;
    this.#waves = waves;
    this.#scroll = new ScrollSync(views, COLUMNS, () => {
      this.request();
    });
  }

  changed(update: Pick<ViewUpdate, "geometryChanged" | "startState" | "state">): void {
    const moved = rowsChanged(update, this.#fields);
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
      this.#layoutCache ??= measure(views, this.#anchors, this.#waves);
      const layout = this.#layoutCache;
      this.#scroll.sync(layout.anchors);
      this.#strip.paint(views, layout.rows, layout.waves);
    });
  }

  realign(source: Column): void {
    this.#scroll.follow(source);
  }

  destroy(): void {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#scroll.destroy();
  }
}
