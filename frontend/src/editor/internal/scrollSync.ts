import type { EditorState } from "@codemirror/state";

import type { Span } from "../../connectors";
import type { Pane, PaneViews } from "./geometry";

export type Anchor<P extends string> = Readonly<Record<P, number>>;
type SpanRow = Readonly<Record<Pane, Span>>;
export type ScrollPane = {
  readonly scrollDOM: EventTarget & { scrollTop: number; readonly clientHeight: number };
  readonly documentPadding: { readonly top: number };
};

const ANCHOR_AT = 0.5;

function edge(row: SpanRow, side: keyof Span): Anchor<Pane> {
  return { left: row.left[side], center: row.center[side], right: row.right[side] };
}

export function anchorsOf(rows: readonly SpanRow[], ends: Anchor<Pane>): Anchor<Pane>[] {
  const start = { left: 0, center: 0, right: 0 };
  return [start, ...rows.flatMap((row) => [edge(row, "top"), edge(row, "bottom")]), ends];
}

function shifted<P extends string>(anchor: Anchor<P>, by: number): (pane: P) => number {
  return (pane) => anchor[pane] + by;
}

export function targets<P extends string>(
  anchors: readonly Anchor<P>[],
  source: P,
  y: number,
): (pane: P) => number {
  let before: Anchor<P> | undefined;
  for (const after of anchors) {
    if (after[source] >= y) {
      if (before === undefined || after[source] === y) {
        return shifted(after, y - after[source]);
      }
      const from = before;
      const t = (y - from[source]) / (after[source] - from[source]);
      return (pane) => from[pane] + (after[pane] - from[pane]) * t;
    }
    before = after;
  }
  return before === undefined ? () => y : shifted(before, y - before[source]);
}

export function contentEnd(view: {
  readonly state: EditorState;
  lineBlockAt(pos: number): Span;
}): number {
  return view.lineBlockAt(view.state.doc.length).bottom;
}

export function contentEnds(views: PaneViews): Anchor<Pane> {
  return {
    left: contentEnd(views.left),
    center: contentEnd(views.center),
    right: contentEnd(views.right),
  };
}

function middle(view: ScrollPane): number {
  const { scrollTop, clientHeight } = view.scrollDOM;
  return scrollTop + clientHeight * ANCHOR_AT - view.documentPadding.top;
}

export class ScrollSync<P extends string> {
  readonly #views: Readonly<Record<P, ScrollPane>>;
  readonly #panes: readonly P[];
  readonly #requestFrame: () => void;
  readonly #listeners = new AbortController();
  #source: P | null = null;
  #followed = false;
  #echoes: readonly P[] = [];
  #clearEchoes: number | null = null;
  #syncedTops: ReadonlyMap<P, number> | null = null;

  constructor(
    views: Readonly<Record<P, ScrollPane>>,
    panes: readonly P[],
    requestFrame: () => void,
  ) {
    this.#views = views;
    this.#panes = panes;
    this.#requestFrame = requestFrame;
    for (const pane of panes) {
      views[pane].scrollDOM.addEventListener(
        "scroll",
        () => {
          if (!this.#followed && !this.#echoes.includes(pane)) {
            this.#source = pane;
          }
          requestFrame();
        },
        { passive: true, signal: this.#listeners.signal },
      );
    }
  }

  follow(source: P): void {
    this.#source = source;
    this.#followed = true;
    this.#syncedTops = null;
    this.#requestFrame();
  }

  sync(anchors: readonly Anchor<P>[]): void {
    const source = this.#source;
    this.#source = null;
    this.#followed = false;
    const views = this.#views;
    if (source === null || views[source].scrollDOM.scrollTop === this.#syncedTops?.get(source)) {
      return;
    }
    const at = targets(anchors, source, middle(views[source]));
    const followers = this.#panes.filter((pane) => pane !== source);
    for (const pane of followers) {
      const { scrollDOM, documentPadding } = views[pane];
      scrollDOM.scrollTop = at(pane) + documentPadding.top - scrollDOM.clientHeight * ANCHOR_AT;
    }
    const tops = new Map(this.#panes.map((pane) => [pane, views[pane].scrollDOM.scrollTop]));
    this.#syncedTops = tops;
    this.#echoes = followers;
    if (this.#clearEchoes !== null) {
      cancelAnimationFrame(this.#clearEchoes);
    }
    this.#clearEchoes = requestAnimationFrame(() => {
      this.#endEchoes(source, tops);
    });
  }

  // WebKitGTK 2.54 can pull a follower back while CodeMirror swaps its viewport, and the moved follower's
  // scroll event is an echo (docs/plan.md §2 #82, docs/slices/briefs/range-collapse-columns-rework-2.md):
  // its source leads once more.
  #endEchoes(source: P, tops: ReadonlyMap<P, number>): void {
    this.#clearEchoes = null;
    const views = this.#views;
    const moved = this.#echoes.some((pane) => views[pane].scrollDOM.scrollTop !== tops.get(pane));
    this.#echoes = [];
    if (moved && !this.#followed) {
      this.follow(source);
    }
  }

  destroy(): void {
    this.#listeners.abort();
    if (this.#clearEchoes !== null) {
      cancelAnimationFrame(this.#clearEchoes);
    }
  }
}
