import { useEventListener } from "@vueuse/core";
import { shallowRef, type ComputedRef, type MaybeRefOrGetter, type ShallowRef } from "vue";

import type { Point } from "./menuPosition";
import { belowLeft, useMenuPlacement } from "./useMenuPlacement";

type HoverBoxParts = {
  readonly area: () => HTMLElement | null;
  readonly opener: () => HTMLElement | null;
  readonly box: MaybeRefOrGetter<HTMLElement | null>;
};

type Held = HoverBoxParts & {
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
};

function show(held: Held): void {
  const opener = held.opener();
  if (!held.open.value && opener !== null) {
    held.at.value = belowLeft(opener);
    held.open.value = true;
  }
}

function hideUnlessHeld(held: Held): void {
  if (!held.pointerInside && !held.focusInside) {
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
  if (event.key === "Escape" && held.open.value) {
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
    open: shallowRef(false),
    at: shallowRef({ x: 0, y: 0 }),
    pointerInside: false,
    focusInside: false,
  };
  useScrollOutside(parts.area, () => {
    if (held.open.value) {
      close(held);
    }
  });
  return {
    open: held.open,
    placement: useMenuPlacement(parts.box, held.at),
    on: areaListeners(held),
    close: () => {
      close(held);
    },
  };
}
