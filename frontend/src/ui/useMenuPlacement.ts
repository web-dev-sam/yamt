import { useElementSize, useWindowSize } from "@vueuse/core";
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";

import { menuPosition, type Point } from "./menuPosition";

type MenuPlacement = { readonly left: string; readonly top: string };

export function belowLeft(opener: HTMLElement): Point {
  const { left, bottom } = opener.getBoundingClientRect();
  return { x: left, y: bottom };
}

export function useMenuPlacement(
  menu: MaybeRefOrGetter<HTMLElement | null>,
  at: MaybeRefOrGetter<Point>,
): ComputedRef<MenuPlacement> {
  const size = useElementSize(menu, undefined, { box: "border-box" });
  const viewport = useWindowSize();
  return computed(() => {
    const { x, y } = menuPosition({
      pointer: toValue(at),
      menu: { width: size.width.value, height: size.height.value },
      viewport: { width: viewport.width.value, height: viewport.height.value },
    });
    return { left: `${x}px`, top: `${y}px` };
  });
}
