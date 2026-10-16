import type { ViewUpdate } from "@codemirror/view";

import type { ChunkRow, Pane, PaneViews } from "./geometry";
import { PANES } from "./geometry";
import { changePlaces, laneBox, problemPlaces, tickAt, ticks } from "./marks";
import type { MarkTarget, Tick } from "./marks";
import { linted } from "./problems";

type Jump = (pane: Pane, target: MarkTarget) => void;

function tickElement({ top, height, kind }: Tick): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `change-mark change-mark-${kind}`;
  element.style.top = `${top}px`;
  element.style.height = `${height}px`;
  return element;
}

export class MarkLanes {
  readonly #views: PaneViews;
  readonly #lanes: Readonly<Record<Pane, HTMLDivElement>>;
  readonly #ticks: Record<Pane, readonly Tick[]> = { left: [], center: [], right: [] };
  readonly #arrows = navigator.platform.startsWith("Win");
  readonly #listeners = new AbortController();
  #shown = false;
  #dirty = true;

  constructor(views: PaneViews, shown: boolean, jump: Jump) {
    this.#views = views;
    this.#lanes = {
      left: this.#lane("left", jump),
      center: this.#lane("center", jump),
      right: this.#lane("right", jump),
    };
    this.show(shown);
  }

  changed(update: ViewUpdate, rowsMoved: boolean): boolean {
    if (!this.#shown || !(rowsMoved || linted(update.transactions))) {
      return false;
    }
    this.#dirty = true;
    return true;
  }

  show(shown: boolean): void {
    this.#shown = shown;
    this.#dirty = true;
    for (const pane of PANES) {
      this.#lanes[pane].hidden = !shown;
    }
  }

  paint(rows: readonly ChunkRow[]): void {
    if (!this.#shown || !this.#dirty) {
      return;
    }
    this.#dirty = false;
    for (const pane of PANES) {
      this.#ticks[pane] = this.#paintLane(pane, rows);
    }
  }

  destroy(): void {
    this.#listeners.abort();
    for (const pane of PANES) {
      this.#lanes[pane].remove();
    }
  }

  #lane(pane: Pane, jump: Jump): HTMLDivElement {
    const lane = document.createElement("div");
    lane.className = "change-marks";
    lane.setAttribute("aria-hidden", "true");
    const signal = this.#listeners.signal;
    lane.addEventListener(
      "mousedown",
      (event) => {
        if (event.button === 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { signal },
    );
    lane.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        const tick = tickAt(this.#ticks[pane], event.clientY - lane.getBoundingClientRect().top);
        if (tick !== null) {
          jump(pane, tick.target);
        }
      },
      { signal },
    );
    this.#views[pane].dom.append(lane);
    return lane;
  }

  #paintLane(pane: Pane, rows: readonly ChunkRow[]): readonly Tick[] {
    const view = this.#views[pane];
    const { scrollHeight, clientHeight, offsetWidth, clientWidth } = view.scrollDOM;
    const paddingTop = view.documentPadding.top;
    const box = laneBox(
      { scrollHeight, clientHeight, offsetWidth, clientWidth, paddingTop },
      this.#arrows,
    );
    const places = changePlaces(rows, pane);
    if (pane === "center") {
      places.push(...problemPlaces(view.state, (pos) => view.lineBlockAt(pos)));
    }
    const shown = ticks(places, box);
    const lane = this.#lanes[pane];
    lane.style.width = `${box.width}px`;
    lane.style.height = `${box.height}px`;
    lane.replaceChildren(...shown.map(tickElement));
    return shown;
  }
}
