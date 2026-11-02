import { useEventListener, useTimeoutFn } from "@vueuse/core";
import type { Directive, DirectiveBinding } from "vue";

import type { Size } from "./menuPosition";
import { tooltipPlacement } from "./operationTooltip";

export const TOOLTIP_DELAY_MS = 400;
export const TOOLTIP_WARM_MS = 300;
export const TIP_CLASSES =
  "pointer-events-none fixed z-500 w-max overflow-hidden hover-tooltip px-2 py-1 tooltip-text wrap-break-word whitespace-pre-wrap select-none";

const UNMEASURED: Size = { width: 0, height: 0 };

type Bound = {
  readonly element: HTMLElement;
  text: string | null;
  readonly unbind: readonly (() => void)[];
};

type Phase = {
  readonly kind: "waiting" | "shown";
  readonly bound: Bound;
  readonly unlisten: () => void;
};

const tooltip: { element: HTMLElement | null; phase: Phase | null; closedAt: number | null } = {
  element: null,
  phase: null,
  closedAt: null,
};
const bindings = new WeakMap<HTMLElement, Bound>();
const waiting = useTimeoutFn(
  () => {
    const { phase } = tooltip;
    if (phase !== null) {
      show(phase.bound, phase.unlisten);
    }
  },
  TOOLTIP_DELAY_MS,
  { immediate: false },
);

export function delayBefore(closedAt: number | null, now: number): number {
  return closedAt !== null && now - closedAt <= TOOLTIP_WARM_MS ? 0 : TOOLTIP_DELAY_MS;
}

function tipElement(): HTMLElement {
  if (tooltip.element === null) {
    const element = document.createElement("div");
    element.className = TIP_CLASSES;
    element.setAttribute("aria-hidden", "true");
    document.body.append(element);
    tooltip.element = element;
  }
  return tooltip.element;
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

function listen(): () => void {
  const stops = [
    useEventListener(window, ["pointerdown", "scroll"], hide, { capture: true, passive: true }),
    useEventListener(window, "keydown", keyPressed, { capture: true }),
  ];
  return () => {
    for (const stop of stops) {
      stop();
    }
  };
}

function hide(): void {
  const { phase } = tooltip;
  if (phase === null) {
    return;
  }
  waiting.stop();
  if (phase.kind === "shown") {
    tooltip.closedAt = Date.now();
    tipElement().hidden = true;
  }
  tooltip.phase = null;
  phase.unlisten();
}

function show(bound: Bound, unlisten: () => void): void {
  if (bound.text === null) {
    hide();
    return;
  }
  const element = tipElement();
  element.textContent = bound.text;
  element.hidden = false;
  place(element, bound.element);
  tooltip.phase = { kind: "shown", bound, unlisten };
}

function entered(bound: Bound): void {
  hide();
  if (bound.text === null) {
    return;
  }
  const unlisten = listen();
  if (delayBefore(tooltip.closedAt, Date.now()) === 0) {
    show(bound, unlisten);
  } else {
    tooltip.phase = { kind: "waiting", bound, unlisten };
    waiting.start();
  }
}

function hideFor(bound: Bound): void {
  if (tooltip.phase?.bound === bound) {
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
    unbind: [
      useEventListener(element, "pointerenter", () => {
        entered(bound);
      }),
      useEventListener(element, "pointerleave", () => {
        hideFor(bound);
      }),
    ],
  };
  bindings.set(element, bound);
  describe(element, bound.text);
}

function updated(element: HTMLElement, { value }: DirectiveBinding<string | null>): void {
  const bound = bindings.get(element);
  if (bound === undefined) {
    return;
  }
  bound.text = value === "" ? null : value;
  describe(element, bound.text);
  const { phase } = tooltip;
  if (phase?.kind === "shown" && phase.bound === bound) {
    show(bound, phase.unlisten);
  }
}

function beforeUnmount(element: HTMLElement): void {
  element.removeAttribute("aria-description");
  const bound = bindings.get(element);
  if (bound === undefined) {
    return;
  }
  for (const stop of bound.unbind) {
    stop();
  }
  hideFor(bound);
}

export const vTooltip: Directive<HTMLElement, string | null> = { mounted, updated, beforeUnmount };
