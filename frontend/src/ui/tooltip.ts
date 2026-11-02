import type { Directive, DirectiveBinding } from "vue";

import type { Size } from "./menuPosition";
import { tooltipPlacement } from "./operationTooltip";

export const TOOLTIP_DELAY_MS = 400;
export const TOOLTIP_WARM_MS = 300;

const TIP_CLASSES =
  "pointer-events-none fixed z-500 w-max overflow-hidden hover-tooltip px-2 py-1 tooltip-text wrap-break-word whitespace-pre-wrap select-none";
const UNMEASURED: Size = { width: 0, height: 0 };

type Bound = {
  readonly element: HTMLElement;
  text: string | null;
  readonly enter: () => void;
  readonly leave: () => void;
};

type Phase =
  | {
      readonly kind: "waiting";
      readonly bound: Bound;
      readonly timer: ReturnType<typeof setTimeout>;
    }
  | { readonly kind: "shown"; readonly bound: Bound; readonly tip: HTMLElement };

const tip: { element: HTMLElement | null; phase: Phase | null; closedAt: number | null } = {
  element: null,
  phase: null,
  closedAt: null,
};
const bindings = new WeakMap<HTMLElement, Bound>();

export function delayBefore(closedAt: number | null, now: number): number {
  return closedAt !== null && now - closedAt <= TOOLTIP_WARM_MS ? 0 : TOOLTIP_DELAY_MS;
}

function tipElement(): HTMLElement {
  if (tip.element === null) {
    const element = document.createElement("div");
    element.className = TIP_CLASSES;
    element.setAttribute("aria-hidden", "true");
    document.body.append(element);
    tip.element = element;
  }
  return tip.element;
}

function place(element: HTMLElement, anchor: HTMLElement): void {
  const fixed = {
    anchor: anchor.getBoundingClientRect(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
  element.style.maxWidth = `${tooltipPlacement({ ...fixed, tip: UNMEASURED }).maxWidth}px`;
  const { width, height } = element.getBoundingClientRect();
  const { left, top } = tooltipPlacement({ ...fixed, tip: { width, height } });
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

function keyPressed(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hide();
  }
}

function listen(): void {
  window.addEventListener("pointerdown", hide, { capture: true, passive: true });
  window.addEventListener("keydown", keyPressed, { capture: true });
  window.addEventListener("scroll", hide, { capture: true, passive: true });
}

function unlisten(): void {
  window.removeEventListener("pointerdown", hide, { capture: true });
  window.removeEventListener("keydown", keyPressed, { capture: true });
  window.removeEventListener("scroll", hide, { capture: true });
}

function hide(): void {
  const { phase } = tip;
  if (phase === null) {
    return;
  }
  if (phase.kind === "waiting") {
    clearTimeout(phase.timer);
  } else {
    tip.closedAt = Date.now();
    phase.tip.hidden = true;
  }
  tip.phase = null;
  unlisten();
}

function show(bound: Bound): void {
  if (bound.text === null) {
    hide();
    return;
  }
  const element = tipElement();
  element.textContent = bound.text;
  element.hidden = false;
  place(element, bound.element);
  tip.phase = { kind: "shown", bound, tip: element };
}

function entered(bound: Bound): void {
  hide();
  if (bound.text === null) {
    return;
  }
  const delay = delayBefore(tip.closedAt, Date.now());
  if (delay === 0) {
    show(bound);
  } else {
    const timer = setTimeout(() => {
      show(bound);
    }, delay);
    tip.phase = { kind: "waiting", bound, timer };
  }
  listen();
}

function hideFor(bound: Bound): void {
  if (tip.phase?.bound === bound) {
    hide();
  }
}

function describe(element: HTMLElement, text: string | null): void {
  if (text === null || text === element.getAttribute("aria-label")) {
    element.removeAttribute("aria-description");
  } else {
    element.setAttribute("aria-description", text);
  }
}

function mounted(element: HTMLElement, { value }: DirectiveBinding<string | null>): void {
  const bound: Bound = {
    element,
    text: value === "" ? null : value,
    enter: () => {
      entered(bound);
    },
    leave: () => {
      hideFor(bound);
    },
  };
  bindings.set(element, bound);
  element.addEventListener("pointerenter", bound.enter);
  element.addEventListener("pointerleave", bound.leave);
  describe(element, bound.text);
}

function updated(element: HTMLElement, { value }: DirectiveBinding<string | null>): void {
  const bound = bindings.get(element);
  if (bound === undefined) {
    return;
  }
  bound.text = value === "" ? null : value;
  describe(element, bound.text);
  if (tip.phase?.kind === "shown" && tip.phase.bound === bound) {
    show(bound);
  }
}

function beforeUnmount(element: HTMLElement): void {
  element.removeAttribute("aria-description");
  const bound = bindings.get(element);
  if (bound === undefined) {
    return;
  }
  element.removeEventListener("pointerenter", bound.enter);
  element.removeEventListener("pointerleave", bound.leave);
  hideFor(bound);
}

export const vTooltip: Directive<HTMLElement, string | null> = { mounted, updated, beforeUnmount };
