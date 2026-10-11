import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import { gapArrows, type ChunkRow, type PaneViews } from "./geometry";
import type { IconPress } from "./strips";

type Press = IconPress & { readonly pointerId: number; readonly clientY: number };

type DragEvents = {
  readonly changed: () => void;
  readonly released: (press: Press) => void;
};

type IconRow = { readonly top: number; readonly chunk: Chunk };

export function coveredChunks(
  rows: readonly IconRow[],
  {
    pressed,
    pointerTop,
    lineHeight,
  }: { readonly pressed: Chunk; readonly pointerTop: number; readonly lineHeight: number },
): Chunk[] {
  const press = rows.find((row) => row.chunk.id === pressed.id);
  if (press === undefined) {
    return [];
  }
  const low = Math.min(press.top, pointerTop);
  const high = Math.max(press.top, pointerTop);
  return rows.filter(({ top }) => top <= high && top + lineHeight > low).map((row) => row.chunk);
}

export function coveredAction(
  press: Press,
  rows: readonly ChunkRow[],
  views: PaneViews,
): ChunkAction {
  const view = press.side === "local" ? views.left : views.right;
  return {
    kind: press.kind,
    side: press.side,
    chunks: coveredChunks(gapArrows(rows, press.side), {
      pressed: press.chunk,
      pointerTop: press.clientY - view.documentTop,
      lineHeight: view.defaultLineHeight,
    }),
  };
}

export class IconDrag {
  readonly #strips: readonly [SVGSVGElement, SVGSVGElement];
  readonly #events: DragEvents;
  #press: Press | null = null;

  constructor(strips: readonly [SVGSVGElement, SVGSVGElement], events: DragEvents) {
    this.#strips = strips;
    this.#events = events;
    for (const strip of strips) {
      strip.addEventListener("pointermove", this.#move);
      strip.addEventListener("pointerup", this.#release);
      strip.addEventListener("pointercancel", this.#cancel);
      strip.addEventListener("lostpointercapture", this.#cancel);
    }
  }

  get press(): Press | null {
    return this.#press;
  }

  start(press: IconPress, event: PointerEvent): void {
    if (this.#press !== null) {
      return;
    }
    this.#strips[press.side === "local" ? 0 : 1].setPointerCapture(event.pointerId);
    this.#press = { ...press, pointerId: event.pointerId, clientY: event.clientY };
    this.#events.changed();
  }

  readonly #move = (event: PointerEvent): void => {
    if (this.#press?.pointerId === event.pointerId) {
      this.#press = { ...this.#press, clientY: event.clientY };
      this.#events.changed();
    }
  };

  readonly #release = (event: PointerEvent): void => {
    const press = this.#press;
    if (press?.pointerId === event.pointerId) {
      this.#press = null;
      this.#events.released({ ...press, clientY: event.clientY });
      this.#events.changed();
    }
  };

  readonly #cancel = (event: PointerEvent): void => {
    if (this.#press?.pointerId === event.pointerId) {
      this.#press = null;
      this.#events.changed();
    }
  };

  destroy(): void {
    this.#press = null;
    for (const strip of this.#strips) {
      strip.removeEventListener("pointermove", this.#move);
      strip.removeEventListener("pointerup", this.#release);
      strip.removeEventListener("pointercancel", this.#cancel);
      strip.removeEventListener("lostpointercapture", this.#cancel);
    }
  }
}
