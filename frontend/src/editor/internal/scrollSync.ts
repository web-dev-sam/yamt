import type { EditorView } from "@codemirror/view";

import type { Span } from "../../connectors";
import type { Pane, PaneViews } from "./geometry";

export type Anchor = Readonly<Record<Pane, number>>;

const PANES = ["left", "center", "right"] as const satisfies readonly Pane[];
const ANCHOR_AT = 0.5;

function shifted(anchor: Anchor, by: number): Anchor {
  return { left: anchor.left + by, center: anchor.center + by, right: anchor.right + by };
}

function edge(row: Readonly<Record<Pane, Span>>, side: keyof Span): Anchor {
  return { left: row.left[side], center: row.center[side], right: row.right[side] };
}

export function anchorsOf(rows: readonly Readonly<Record<Pane, Span>>[], ends: Anchor): Anchor[] {
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
  #syncing: readonly Pane[] = [];
  #release: number | null = null;

  constructor(views: PaneViews, requestFrame: () => void) {
    this.#views = views;
    for (const pane of PANES) {
      views[pane].scrollDOM.addEventListener(
        "scroll",
        () => {
          if (!this.#syncing.includes(pane)) {
            this.#source = pane;
          }
          requestFrame();
        },
        { passive: true, signal: this.#listeners.signal },
      );
    }
  }

  sync(rows: readonly Readonly<Record<Pane, Span>>[]): void {
    const source = this.#source;
    if (source === null) {
      return;
    }
    this.#source = null;
    const views = this.#views;
    const at = targets(anchorsOf(rows, ends(views)), source, middle(views[source]));
    const followers = PANES.filter((pane) => pane !== source);
    for (const pane of followers) {
      const { scrollDOM, documentPadding } = views[pane];
      scrollDOM.scrollTop = at[pane] + documentPadding.top - scrollDOM.clientHeight * ANCHOR_AT;
    }
    this.#syncing = followers;
    if (this.#release !== null) {
      cancelAnimationFrame(this.#release);
    }
    this.#release = requestAnimationFrame(() => {
      this.#release = null;
      this.#syncing = [];
    });
  }

  destroy(): void {
    this.#listeners.abort();
    if (this.#release !== null) {
      cancelAnimationFrame(this.#release);
    }
  }
}
