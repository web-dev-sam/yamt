import type { EditorView } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { Pane, PaneViews } from "./geometry";

export type Anchor = Readonly<Record<Pane, number>>;
type SpanRow = Readonly<Record<Pane, Span>>;

const PANES = ["left", "center", "right"] as const satisfies readonly Pane[];
const ANCHOR_AT = 0.5;

function shifted(anchor: Anchor, by: number): Anchor {
  return { left: anchor.left + by, center: anchor.center + by, right: anchor.right + by };
}

function edge(row: SpanRow, side: keyof Span): Anchor {
  return { left: row.left[side], center: row.center[side], right: row.right[side] };
}

export function anchorsOf(rows: readonly SpanRow[], ends: Anchor): Anchor[] {
  const start = { left: 0, center: 0, right: 0 };
  return [start, ...rows.flatMap((row) => [edge(row, "top"), edge(row, "bottom")]), ends];
}

export function targets(anchors: readonly Anchor[], source: Pane, y: number): Anchor {
  let before: Anchor | undefined;
  for (const after of anchors) {
    if (after[source] >= y) {
      if (before === undefined || after[source] === y) {
        return shifted(after, y - after[source]);
      }
      const t = (y - before[source]) / (after[source] - before[source]);
      return {
        left: before.left + (after.left - before.left) * t,
        center: before.center + (after.center - before.center) * t,
        right: before.right + (after.right - before.right) * t,
      };
    }
    before = after;
  }
  return before === undefined
    ? { left: y, center: y, right: y }
    : shifted(before, y - before[source]);
}

function contentEnd(view: EditorView): number {
  return view.lineBlockAt(view.state.doc.length).bottom;
}

function ends(views: PaneViews): Anchor {
  return {
    left: contentEnd(views.left),
    center: contentEnd(views.center),
    right: contentEnd(views.right),
  };
}

function middle(view: EditorView): number {
  const { scrollTop, clientHeight } = view.scrollDOM;
  return scrollTop + clientHeight * ANCHOR_AT - view.documentPadding.top;
}

export class ScrollSync {
  readonly #views: PaneViews;
  readonly #listeners = new AbortController();
  #source: Pane | null = null;
  #echoes: readonly Pane[] = [];
  #clearEchoes: number | null = null;
  #syncedTops: Readonly<Record<Pane, number>> | null = null;
  #anchors: { readonly rows: readonly SpanRow[]; readonly anchors: Anchor[] } | null = null;

  constructor(views: PaneViews, requestFrame: () => void) {
    this.#views = views;
    for (const pane of PANES) {
      views[pane].scrollDOM.addEventListener(
        "scroll",
        () => {
          if (!this.#echoes.includes(pane)) {
            this.#source = pane;
          }
          requestFrame();
        },
        { passive: true, signal: this.#listeners.signal },
      );
    }
  }

  sync(rows: readonly SpanRow[]): void {
    const source = this.#source;
    this.#source = null;
    const views = this.#views;
    if (source === null || views[source].scrollDOM.scrollTop === this.#syncedTops?.[source]) {
      return;
    }
    const at = targets(this.#anchorsOf(rows), source, middle(views[source]));
    const followers = PANES.filter((pane) => pane !== source);
    for (const pane of followers) {
      const { scrollDOM, documentPadding } = views[pane];
      scrollDOM.scrollTop = at[pane] + documentPadding.top - scrollDOM.clientHeight * ANCHOR_AT;
    }
    this.#syncedTops = {
      left: views.left.scrollDOM.scrollTop,
      center: views.center.scrollDOM.scrollTop,
      right: views.right.scrollDOM.scrollTop,
    };
    this.#echoes = followers;
    if (this.#clearEchoes !== null) {
      cancelAnimationFrame(this.#clearEchoes);
    }
    this.#clearEchoes = requestAnimationFrame(() => {
      this.#clearEchoes = null;
      this.#echoes = [];
    });
  }

  #anchorsOf(rows: readonly SpanRow[]): Anchor[] {
    if (this.#anchors?.rows === rows) {
      return this.#anchors.anchors;
    }
    const anchors = anchorsOf(rows, ends(this.#views));
    this.#anchors = { rows, anchors };
    return anchors;
  }

  destroy(): void {
    this.#listeners.abort();
    if (this.#clearEchoes !== null) {
      cancelAnimationFrame(this.#clearEchoes);
    }
  }
}
