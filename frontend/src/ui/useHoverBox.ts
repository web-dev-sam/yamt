import { useEventListener } from "@vueuse/core";
import { shallowRef, toValue, type ComputedRef, type MaybeRefOrGetter, type ShallowRef } from "vue";

import type { Point } from "./menuPosition";
import { belowLeft, useMenuPlacement } from "./useMenuPlacement";

type HoverBoxParts = {
  readonly area: () => HTMLElement | null;
  readonly opener: () => HTMLElement | null;
  readonly box: MaybeRefOrGetter<HTMLElement | null>;
  /** While true (a side panel is open): leaving with the pointer or focus, a window blur and a scroll outside never
   *  close the box; a `pointerdown` outside the area closes it (C2, RK73). Absent: today's rule. */
  readonly pinned?: () => boolean;
};

type Held = Omit<HoverBoxParts, "pinned"> & {
  readonly pinned: () => boolean;
  readonly open: ShallowRef<boolean>;
  readonly at: ShallowRef<Point>;
  pointerInside: boolean;
  focusInside: boolean;
};

export type HoverBox = {
  readonly open: Readonly<ShallowRef<boolean>>;
  readonly placement: ComputedRef<{ readonly left: string; readonly top: string }>;
  readonly on: {
    readonly pointerenter: () => void;
    readonly pointerleave: () => void;
    readonly focusin: (event: FocusEvent) => void;
    readonly focusout: (event: FocusEvent) => void;
    readonly keydown: (event: KeyboardEvent) => void;
  };
  readonly close: () => void;
  /** Call before removing a control that may hold focus: focus inside the box moves to the box itself. */
  readonly keepFocus: () => void;
};

function show(held: Held): void {
  const opener = held.opener();
  if (!held.open.value && opener !== null) {
    held.at.value = belowLeft(opener);
    held.open.value = true;
  }
}

function hideUnlessHeld(held: Held): void {
  if (!held.pointerInside && !held.focusInside && !held.pinned()) {
    held.open.value = false;
  }
}

function contains(area: HTMLElement | null, target: EventTarget | null): boolean {
  return target instanceof Node && area?.contains(target) === true;
}

function close(held: Held): void {
  held.focusInside = document.activeElement === held.opener();
  held.open.value = false;
}

function keepFocus(held: Held): void {
  const box = toValue(held.box);
  // A removed control's focus goes to the body without a focusout, so focusInside would stay true for good
  // (HTML "focus fixup rule": https://html.spec.whatwg.org/multipage/interaction.html#focus-fixup-rule).
  if (box?.contains(document.activeElement) === true) {
    box.focus();
  }
}

function focusEntered(held: Held, event: FocusEvent): void {
  if (!contains(held.area(), event.relatedTarget)) {
    held.focusInside = true;
    show(held);
  }
}

function focusLeft(held: Held, event: FocusEvent): void {
  if (!contains(held.area(), event.relatedTarget)) {
    held.focusInside = false;
    hideUnlessHeld(held);
  }
}

function keyPressed(held: Held, event: KeyboardEvent): void {
  if (event.key === "Escape" && !event.defaultPrevented && held.open.value) {
    event.preventDefault();
    held.open.value = false;
    held.opener()?.focus();
  }
}

function areaListeners(held: Held): HoverBox["on"] {
  return {
    pointerenter: () => {
      held.pointerInside = true;
      show(held);
    },
    pointerleave: () => {
      held.pointerInside = false;
      hideUnlessHeld(held);
    },
    focusin: (event) => {
      focusEntered(held, event);
    },
    focusout: (event) => {
      focusLeft(held, event);
    },
    keydown: (event) => {
      keyPressed(held, event);
    },
  };
}

export function useScrollOutside(area: () => HTMLElement | null, scrolled: () => void): void {
  useEventListener(
    window,
    "scroll",
    (event) => {
      if (!contains(area(), event.target)) {
        scrolled();
      }
    },
    { capture: true, passive: true },
  );
}

export function useHoverBox(parts: HoverBoxParts): HoverBox {
  const held: Held = {
    ...parts,
    pinned: parts.pinned ?? (() => false),
    open: shallowRef(false),
    at: shallowRef({ x: 0, y: 0 }),
    pointerInside: false,
    focusInside: false,
  };
  useScrollOutside(parts.area, () => {
    if (held.open.value && !held.pinned()) {
      close(held);
    }
  });
  useEventListener(
    () => (held.open.value && held.pinned() ? document : null),
    "pointerdown",
    (event) => {
      if (!contains(held.area(), event.target)) {
        close(held);
      }
    },
    { capture: true },
  );
  return {
    open: held.open,
    placement: useMenuPlacement(parts.box, held.at),
    on: areaListeners(held),
    close: () => {
      close(held);
    },
    keepFocus: () => {
      keepFocus(held);
    },
  };
}
