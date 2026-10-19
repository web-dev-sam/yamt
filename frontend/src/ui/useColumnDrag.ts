import { tryOnScopeDispose } from "@vueuse/core";
import { shallowRef, type Ref, type ShallowRef } from "vue";

export type DotsState = "rest" | "hover" | "drag";
export type ColumnDrag = { moveBy(dx: number): void };

export type ColumnHandle = {
  accepts(event: PointerEvent | MouseEvent): boolean;
  press(event: PointerEvent): ColumnDrag | null;
  reset(): void;
};

type ClassRoot = { readonly classList: Pick<DOMTokenList, "add" | "remove"> };

type ListenedEvent =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "lostpointercapture"
  | "pointerover"
  | "pointerleave"
  | "mousedown"
  | "dblclick";

export type ColumnDragHandle = {
  readonly listeners: Readonly<Record<ListenedEvent, (event: Event) => void>>;
  readonly dots: Readonly<Ref<DotsState>>;
};

type Dragging = {
  readonly pointerId: number;
  readonly pressX: number;
  readonly drag: ColumnDrag;
  readonly root: ClassRoot;
};

type DragState = {
  readonly handle: ColumnHandle;
  readonly root: ClassRoot | undefined;
  readonly dots: ShallowRef<DotsState>;
  dragging: Dragging | null;
};

export const COLUMN_RESIZING_CLASS = "col-resizing";
const MAIN_BUTTON = 0;

function isMainPress(state: DragState, event: MouseEvent): boolean {
  return event.button === MAIN_BUTTON && state.handle.accepts(event);
}

function pressed(state: DragState, event: Event): void {
  if (state.dragging !== null || !(event instanceof PointerEvent) || !isMainPress(state, event)) {
    return;
  }
  event.preventDefault();
  const drag = state.handle.press(event);
  if (drag === null) {
    return;
  }
  if (event.currentTarget instanceof Element) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  const root = state.root ?? document.documentElement;
  root.classList.add(COLUMN_RESIZING_CLASS);
  state.dragging = { pointerId: event.pointerId, pressX: event.clientX, drag, root };
  state.dots.value = "drag";
}

function moved(state: DragState, event: Event): void {
  const { dragging } = state;
  if (
    dragging !== null &&
    event instanceof PointerEvent &&
    event.pointerId === dragging.pointerId
  ) {
    dragging.drag.moveBy(event.clientX - dragging.pressX);
  }
}

function stop(state: DragState, dots: DotsState): void {
  if (state.dragging === null) {
    return;
  }
  state.dragging.root.classList.remove(COLUMN_RESIZING_CLASS);
  state.dragging = null;
  state.dots.value = dots;
}

function ended(state: DragState, event: Event): void {
  if (event instanceof PointerEvent && event.pointerId === state.dragging?.pointerId) {
    stop(state, "hover");
  }
}

function hovered(state: DragState, event: Event): void {
  if (state.dragging === null && event instanceof MouseEvent) {
    state.dots.value = state.handle.accepts(event) ? "hover" : "rest";
  }
}

function left(state: DragState): void {
  if (state.dragging === null) {
    state.dots.value = "rest";
  }
}

function mousePressed(state: DragState, event: Event): void {
  if (event instanceof MouseEvent && isMainPress(state, event)) {
    event.preventDefault();
  }
}

function doubleClicked(state: DragState, event: Event): void {
  if (event instanceof MouseEvent && state.handle.accepts(event)) {
    state.handle.reset();
  }
}

export function useColumnDrag(handle: ColumnHandle, root?: ClassRoot): ColumnDragHandle {
  const state: DragState = { handle, root, dots: shallowRef<DotsState>("rest"), dragging: null };
  tryOnScopeDispose(() => {
    stop(state, "rest");
  });
  function end(event: Event): void {
    ended(state, event);
  }
  return {
    listeners: {
      pointerdown: (event) => {
        pressed(state, event);
      },
      pointermove: (event) => {
        moved(state, event);
      },
      pointerup: end,
      pointercancel: end,
      lostpointercapture: end,
      pointerover: (event) => {
        hovered(state, event);
      },
      pointerleave: () => {
        left(state);
      },
      mousedown: (event) => {
        mousePressed(state, event);
      },
      dblclick: (event) => {
        doubleClicked(state, event);
      },
    },
    dots: state.dots,
  };
}
