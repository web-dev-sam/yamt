import type { Extension } from "@codemirror/state";
import { keymap, type EditorView } from "@codemirror/view";

import type { ChunkAction } from "./apply";
import { SIDE_PANE, type ChunkRow, type PaneViews } from "./geometry";
import { isModHeld } from "./modClick";
import {
  afterDecisionFocus,
  alone,
  changeAt,
  crossTo,
  handoverTo,
  stepAlone,
  stepFrom,
  type Direction,
  type SideMark,
  type Target,
} from "./navigation";
import { otherSide, SIDES, type Side } from "./side";
import { setMark, sideMarks } from "./sideMark";
import { isSideOpen, type ChunkState } from "./status";
import { revealScrollTop, visibleArea } from "./viewport";
import { wheelStep, type WheelSum } from "./wheel";

export type SideCommand =
  | { readonly kind: "decide"; readonly decision: "apply" | "ignore" }
  | { readonly kind: "step"; readonly direction: Direction }
  | { readonly kind: "toward"; readonly side: Side };

type FocusSources = {
  readonly views: PaneViews;
  readonly states: () => readonly ChunkState[];
  readonly rows: () => readonly ChunkRow[];
  readonly decide: (action: ChunkAction) => void;
  readonly readOnly: boolean;
  readonly hidden: Side | null;
};

const APPLY: SideCommand = { kind: "decide", decision: "apply" };
const IGNORE: SideCommand = { kind: "decide", decision: "ignore" };

export const SIDE_KEYS: Readonly<Record<string, SideCommand>> = {
  Enter: APPLY,
  Space: APPLY,
  Backspace: IGNORE,
  Delete: IGNORE,
  x: IGNORE,
  ArrowDown: { kind: "step", direction: "down" },
  ArrowUp: { kind: "step", direction: "up" },
  ArrowLeft: { kind: "toward", side: "local" },
  ArrowRight: { kind: "toward", side: "remote" },
};

export function sideKeys(run: (command: SideCommand) => void): Extension {
  return keymap.of(
    Object.entries(SIDE_KEYS).map(([key, command]) => ({
      key,
      preventDefault: true,
      run: () => {
        run(command);
        return true;
      },
    })),
  );
}

export class SideFocus {
  readonly #sources: FocusSources;
  readonly #listeners = new AbortController();
  #wheelSum: WheelSum = null;

  constructor(sources: FocusSources) {
    this.#sources = sources;
    const platform = navigator.platform;
    const signal = this.#listeners.signal;
    for (const side of SIDES) {
      const { scrollDOM, contentDOM } = this.#view(side);
      const pressed = (event: MouseEvent): void => {
        this.#pressed(side, event, platform);
      };
      const wheel = (event: WheelEvent): void => {
        this.#wheel(side, event, platform);
      };
      function scrollerFocused(): void {
        contentDOM.focus({ preventScroll: true });
      }
      scrollDOM.addEventListener("mousedown", pressed, { capture: true, signal });
      scrollDOM.addEventListener("wheel", wheel, { passive: false, signal });
      scrollDOM.addEventListener("focus", scrollerFocused, { signal });
    }
  }

  run(side: Side, command: SideCommand): void {
    switch (command.kind) {
      case "decide":
        this.#decideKey(side, command.decision);
        return;
      case "step":
        this.#step(side, command.direction);
        return;
      case "toward":
        this.#cross(side, command.side);
        return;
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  }

  deciding(dispatch: () => void): void {
    const before = this.#sources.states();
    const focused = SIDES.find((side) => this.#view(side).hasFocus) ?? null;
    if (focused === null) {
      dispatch();
      return;
    }
    const beforeMark = this.#mark(focused);
    dispatch();
    const next = afterDecisionFocus({
      beforeMark,
      afterMark: this.#mark(focused),
      handover: handoverTo(
        { before, after: this.#sources.states() },
        { focused, hidden: this.#sources.hidden },
      ),
    });
    switch (next.kind) {
      case "handover":
        this.#focusOn(next.side, alone(this.#mark(next.side)));
        return;
      case "reveal":
        this.#reveal(focused);
        return;
      case "stay":
        return;
      default: {
        const _exhaustive: never = next;
        return _exhaustive;
      }
    }
  }

  destroy(): void {
    this.#listeners.abort();
  }

  #view(side: Side): EditorView {
    return this.#sources.views[SIDE_PANE[side]];
  }

  #mark(side: Side): SideMark {
    return this.#view(side).state.field(sideMarks[side]);
  }

  #focusOn(side: Side, mark: SideMark): void {
    const view = this.#view(side);
    view.dispatch({ effects: setMark.of(mark) });
    if (!view.hasFocus) {
      view.focus();
    }
  }

  #decideKey(side: Side, decision: "apply" | "ignore"): void {
    const mark = this.#mark(side);
    const state =
      mark.kind === "change"
        ? this.#sources.states().find(({ chunk }) => chunk.id === mark.id)
        : undefined;
    if (
      this.#sources.readOnly ||
      state === undefined ||
      !isSideOpen(state.chunk, state.status, side)
    ) {
      return;
    }
    this.#sources.decide({ kind: decision, side, chunks: [state.chunk] });
  }

  #step(side: Side, direction: Direction): void {
    const mark = this.#mark(side);
    let target: Target | null;
    if (mark.kind === "change") {
      const id = stepFrom(this.#sources.states(), { side, id: mark.id, direction });
      target = id === null ? null : { side, id };
    } else {
      const other = otherSide(side);
      target = stepAlone(this.#sources.rows(), {
        side,
        fallback: other === this.#sources.hidden ? null : other,
        areas: {
          local: visibleArea(this.#view("local")),
          remote: visibleArea(this.#view("remote")),
        },
        direction,
      });
    }
    if (target !== null) {
      this.#focusOn(target.side, { kind: "change", id: target.id });
      this.#reveal(target.side);
    }
  }

  #cross(side: Side, toSide: Side): void {
    if (toSide === side || toSide === this.#sources.hidden) {
      return;
    }
    const mark = crossTo(this.#sources.states(), {
      from: this.#mark(side),
      to: this.#mark(toSide),
      toSide,
    });
    this.#focusOn(toSide, mark);
    this.#reveal(toSide);
  }

  #pressed(side: Side, event: MouseEvent, platform: string): void {
    const view = this.#view(side);
    if (event.button !== 0 || event.target === view.scrollDOM) {
      return;
    }
    const id = changeAt(this.#sources.rows(), side, event.clientY - view.documentTop);
    if (id !== null && !this.#sources.readOnly && isModHeld(event, platform)) {
      return;
    }
    const mark: SideMark = id === null ? alone(this.#mark(side)) : { kind: "change", id };
    view.dispatch({ effects: setMark.of(mark) });
  }

  #wheel(side: Side, event: WheelEvent, platform: string): void {
    if (!isModHeld(event, platform)) {
      return;
    }
    event.preventDefault();
    if (!this.#view(side).hasFocus) {
      this.#focusOn(side, alone(this.#mark(side)));
    }
    const { sum, step } = wheelStep(this.#wheelSum, event);
    this.#wheelSum = sum;
    if (step !== null) {
      this.#step(side, step);
    }
  }

  #reveal(side: Side): void {
    const mark = this.#mark(side);
    const row =
      mark.kind === "change"
        ? this.#sources.rows().find(({ chunk }) => chunk.id === mark.id)
        : undefined;
    if (row === undefined) {
      return;
    }
    const view = this.#view(side);
    const scrollTop = revealScrollTop(row[SIDE_PANE[side]], {
      area: visibleArea(view),
      lineHeight: view.defaultLineHeight,
      paddingTop: view.documentPadding.top,
    });
    if (scrollTop !== null) {
      view.scrollDOM.scrollTop = scrollTop;
    }
  }
}
