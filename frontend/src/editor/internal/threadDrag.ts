import { BlockType, type EditorView } from "@codemirror/view";

import {
  onePlace,
  type Column,
  type Difference,
  type ThreadLine,
  type ThreadPlace,
} from "../../ipc";
import { hiddenLeft } from "./columnFolds";
import type { ColumnViews } from "./compareViews";
import { placeBetween, shownEnd } from "./diffOrder";
import type { LineSpan } from "./foldRuns";
import { anchorAt } from "./threadAnchor";
import { pressedLine } from "./threadNumbers";

export type DragEvents = {
  readonly moved: (place: ThreadPlace) => void;
  readonly released: (place: ThreadPlace) => void;
  readonly cancelled: () => void;
};

type DragWiring = {
  readonly views: ColumnViews;
  readonly differences: readonly Difference[];
  readonly events: DragEvents;
};

type Held = {
  readonly press: ThreadLine;
  readonly hidden: readonly LineSpan[];
  end: ThreadLine;
  clientX: number;
  clientY: number;
};

const HALF = 0.5;
const CAPTURE = { capture: true } as const;

function textLineAt(view: EditorView, clientY: number): number | null {
  const height = clientY - view.documentTop;
  const block = view.elementAtHeight(height);
  if (block.type !== BlockType.Text || height < block.top || height >= block.bottom) {
    return null;
  }
  return pressedLine(view.state.doc, block.from);
}

function pointedLine(
  views: ColumnViews,
  differences: readonly Difference[],
  clientX: number,
  clientY: number,
): ThreadLine | null {
  const middle =
    (views.left.dom.getBoundingClientRect().right + views.right.dom.getBoundingClientRect().left) *
    HALF;
  const column: Column = clientX < middle ? "left" : "right";
  const box = views[column].scrollDOM.getBoundingClientRect();
  const y = Math.min(Math.max(clientY, box.top), box.bottom - 1);
  const other: Column = column === "left" ? "right" : "left";
  for (const each of [column, other]) {
    const line = textLineAt(views[each], y);
    if (line !== null) {
      return anchorAt(differences, each, line);
    }
  }
  return null;
}

export class ThreadDrag {
  readonly #views: ColumnViews;
  readonly #differences: readonly Difference[];
  readonly #events: DragEvents;
  #held: Held | null = null;
  #frame: number | null = null;

  constructor({ views, differences, events }: DragWiring) {
    this.#views = views;
    this.#differences = differences;
    this.#events = events;
  }

  start(press: ThreadLine, event: MouseEvent): void {
    this.#stop();
    const hidden = hiddenLeft(this.#views.left.state);
    this.#held = { press, hidden, end: press, clientX: event.clientX, clientY: event.clientY };
    document.addEventListener("pointermove", this.#move, CAPTURE);
    document.addEventListener("pointerup", this.#up, CAPTURE);
    document.addEventListener("pointercancel", this.#cancel, CAPTURE);
    document.addEventListener("keydown", this.#key, CAPTURE);
    window.addEventListener("blur", this.#cancel);
    for (const view of [this.#views.left, this.#views.right]) {
      view.scrollDOM.addEventListener("scroll", this.#request);
    }
    this.#events.moved(onePlace(press));
  }

  destroy(): void {
    this.#stop();
  }

  #stop(): void {
    this.#held = null;
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    document.removeEventListener("pointermove", this.#move, CAPTURE);
    document.removeEventListener("pointerup", this.#up, CAPTURE);
    document.removeEventListener("pointercancel", this.#cancel, CAPTURE);
    document.removeEventListener("keydown", this.#key, CAPTURE);
    window.removeEventListener("blur", this.#cancel);
    for (const view of [this.#views.left, this.#views.right]) {
      view.scrollDOM.removeEventListener("scroll", this.#request);
    }
  }

  #place(held: Held): ThreadPlace {
    return placeBetween(this.#differences, held.press, held.end);
  }

  #endAt(held: Held): void {
    const pointer = pointedLine(this.#views, this.#differences, held.clientX, held.clientY);
    if (pointer !== null) {
      held.end = shownEnd(this.#differences, held.hidden, held.press, pointer);
    }
  }

  // A column measures itself in its own scroll handler (@codemirror/view DOMObserver.onScroll), and its measures
  // asked for earlier in a frame run first, so a frame's read sees the heights CodeMirror measured.
  readonly #request = (): void => {
    this.#frame ??= requestAnimationFrame(() => {
      this.#frame = null;
      const held = this.#held;
      if (held !== null) {
        this.#endAt(held);
        this.#events.moved(this.#place(held));
      }
    });
  };

  readonly #move = (event: PointerEvent): void => {
    if (this.#held !== null) {
      this.#held.clientX = event.clientX;
      this.#held.clientY = event.clientY;
    }
    this.#request();
  };

  readonly #up = (): void => {
    const held = this.#held;
    this.#stop();
    if (held !== null) {
      this.#endAt(held);
      this.#events.released(this.#place(held));
    }
  };

  readonly #cancel = (): void => {
    this.#stop();
    this.#events.cancelled();
  };

  readonly #key = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.#cancel();
  };
}
