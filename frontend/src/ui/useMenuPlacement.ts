import { useElementSize, useWindowSize } from "@vueuse/core";
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";

import { menuPosition, type Point, type Size } from "./menuPosition";

type MenuPlacement = { readonly left: string; readonly top: string };

type Anchor = { readonly left: number; readonly top: number };

export function belowLeft(opener: HTMLElement): Point {
  const { left, bottom } = opener.getBoundingClientRect();
  return { x: left, y: bottom };
}

export function besideLeft(anchor: Anchor, panel: Size): Point {
  return { x: anchor.left - panel.width, y: anchor.top };
}

export function useMenuPlacement(
  menu: MaybeRefOrGetter<HTMLElement | null>,
  at: MaybeRefOrGetter<Point>,
): ComputedRef<MenuPlacement> {
  return usePlacement(menu, () => toValue(at));
}

export function useBesidePlacement(
  panel: MaybeRefOrGetter<HTMLElement | null>,
  anchor: MaybeRefOrGetter<Anchor>,
): ComputedRef<MenuPlacement> {
  return usePlacement(panel, (size) => besideLeft(toValue(anchor), size));
}

function usePlacement(
  element: MaybeRefOrGetter<HTMLElement | null>,
  at: (size: Size) => Point,
): ComputedRef<MenuPlacement> {
  const size = useElementSize(element, undefined, { box: "border-box" });
  const viewport = useWindowSize();
  return computed(() => {
    const menu = { width: size.width.value, height: size.height.value };
    const { x, y } = menuPosition({
      pointer: at(menu),
      menu,
      viewport: { width: viewport.width.value, height: viewport.height.value },
    });
    return { left: `${x}px`, top: `${y}px` };
  });
}
