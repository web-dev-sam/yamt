import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import type { Extension, SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { Span } from "../../connectors";

type Placed = { readonly range: SelectionRange; readonly top: number };
type ScrollBox = {
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly paddingTop: number;
};

export function farTop(
  { scrollTop, clientHeight, paddingTop }: ScrollBox,
  rendered: Span,
): number | null {
  const visibleTop = scrollTop - paddingTop;
  const overlaps = visibleTop < rendered.bottom && visibleTop + clientHeight > rendered.top;
  return overlaps ? null : visibleTop;
}

const placeTop = StateEffect.define<Placed>();

const placed = StateField.define<Placed | null>({
  create: () => null,
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(placeTop)) {
        next = effect.value;
      }
    }
    return next;
  },
});

// WebKitGTK 2.54 pulls back a scrollTop that shows none of the rendered lines while CodeMirror swaps
// its viewport in its scroll measure (docs/plan.md §2 #82, docs/slices/briefs/3.M-minimap-window-rework-3.md);
// a scroll request places the viewport first.
function placeFarScroll(view: EditorView): void {
  const top = view.scrollDOM.scrollTop;
  const { from, to } = view.viewport;
  const visibleTop = farTop(
    {
      scrollTop: top,
      clientHeight: view.scrollDOM.clientHeight,
      paddingTop: view.documentPadding.top,
    },
    { top: view.lineBlockAt(from).top, bottom: view.lineBlockAt(to).bottom },
  );
  if (visibleTop === null) {
    return;
  }
  const line = view.lineBlockAtHeight(visibleTop);
  const range = EditorSelection.cursor(line.from);
  view.dispatch({
    effects: [
      placeTop.of({ range, top }),
      EditorView.scrollIntoView(range, { y: "start", yMargin: line.top - visibleTop }),
    ],
  });
}

export const exactScroll: Extension = [
  placed,
  EditorView.domEventObservers({
    scroll: (_event, view) => {
      placeFarScroll(view);
    },
  }),
  EditorView.scrollHandler.of((view, range) => {
    const place = view.state.field(placed);
    if (place === null || place.range !== range) {
      return false;
    }
    view.scrollDOM.scrollTop = place.top;
    return true;
  }),
];
