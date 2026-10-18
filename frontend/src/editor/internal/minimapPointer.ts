import { centredScrollTop, draggedScrollTop, rowAt, type MinimapLayout } from "./minimapLayout";
import { LINE_HEIGHT_PX } from "./pane";

type PointerParts = {
  readonly box: Pick<HTMLElement, "addEventListener"> & {
    getBoundingClientRect(): { readonly top: number };
  };
  readonly slider: Pick<
    HTMLElement,
    "addEventListener" | "setPointerCapture" | "hasPointerCapture" | "releasePointerCapture"
  > & { readonly classList: Pick<DOMTokenList, "add" | "remove"> };
  readonly scroller: {
    scrollTop: number;
    readonly clientHeight: number;
    scrollBy(options: ScrollToOptions): void;
  };
  readonly layout: () => MinimapLayout | null;
  readonly follow: () => void;
};

type Drag = { readonly start: MinimapLayout; readonly startY: number; readonly pointerId: number };

const ACTIVE_CLASS = "active";

export function wheelPixels(
  deltaMode: number,
  scroller: Pick<HTMLElement, "clientHeight">,
): number {
  switch (deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return LINE_HEIGHT_PX;
    case WheelEvent.DOM_DELTA_PAGE:
      return scroller.clientHeight;
    default:
      return 1;
  }
}

function primary(event: PointerEvent): boolean {
  return event.button === 0 || event.pointerType !== "mouse";
}

function keepFocus(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

export class MinimapPointer {
  readonly #parts: PointerParts;
  readonly #listeners = new AbortController();
  #drag: Drag | null = null;

  constructor(parts: PointerParts) {
    this.#parts = parts;
    const { box, slider } = parts;
    const signal = this.#listeners.signal;
    box.addEventListener("mousedown", keepFocus, { signal });
    box.addEventListener("pointerdown", (event) => this.#press(event), { signal });
    box.addEventListener("wheel", (event) => this.#wheel(event), { signal, passive: true });
    slider.addEventListener("pointerdown", (event) => this.#startDrag(event), { signal });
    slider.addEventListener("pointermove", (event) => this.#dragTo(event), { signal });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
      slider.addEventListener(type, () => this.release(), { signal });
    }
  }

  release(): void {
    const drag = this.#drag;
    if (drag === null) {
      return;
    }
    this.#drag = null;
    const { slider } = this.#parts;
    slider.classList.remove(ACTIVE_CLASS);
    if (slider.hasPointerCapture(drag.pointerId)) {
      slider.releasePointerCapture(drag.pointerId);
    }
  }

  destroy(): void {
    this.release();
    this.#listeners.abort();
  }

  #press(event: PointerEvent): void {
    const { box, scroller, layout, follow } = this.#parts;
    const shown = layout();
    if (shown === null || !primary(event)) {
      return;
    }
    const row = rowAt(shown, event.clientY - box.getBoundingClientRect().top);
    scroller.scrollTop = centredScrollTop(row, shown.input);
    follow();
  }

  #startDrag(event: PointerEvent): void {
    const { slider, layout } = this.#parts;
    const start = layout();
    if (start === null || !primary(event)) {
      return;
    }
    event.stopPropagation();
    slider.setPointerCapture(event.pointerId);
    slider.classList.add(ACTIVE_CLASS);
    this.#drag = { start, startY: event.clientY, pointerId: event.pointerId };
  }

  #dragTo(event: PointerEvent): void {
    const drag = this.#drag;
    if (drag === null) {
      return;
    }
    this.#parts.scroller.scrollTop = draggedScrollTop(drag.start, event.clientY - drag.startY);
    this.#parts.follow();
  }

  #wheel(event: WheelEvent): void {
    const { scroller, follow } = this.#parts;
    const pixels = wheelPixels(event.deltaMode, scroller);
    scroller.scrollBy({ left: event.deltaX * pixels, top: event.deltaY * pixels });
    follow();
  }
}
