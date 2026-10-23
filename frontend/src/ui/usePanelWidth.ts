import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";

import { createFileListWidth, FILE_LIST_BOUNDS } from "./fileListWidth";
import { useColumnDrag, type ColumnDrag, type ColumnDragBinding } from "./useColumnDrag";

type WidthStyle = typeof FILE_LIST_BOUNDS & { readonly width?: string };

export function usePanelWidth(panel: MaybeRefOrGetter<HTMLElement | null>): {
  readonly widthStyle: ComputedRef<WidthStyle>;
  readonly resize: ColumnDragBinding;
} {
  const stored = createFileListWidth();
  const resize = useColumnDrag({
    accepts: (event) => event.target === event.currentTarget,
    press: startResize,
    reset: () => {
      stored.resetWidth();
    },
  });

  function startResize(): ColumnDrag | null {
    const element = toValue(panel);
    if (element === null) {
      return null;
    }
    const pressWidth = element.getBoundingClientRect().width;
    return {
      moveBy: (dx) => {
        stored.setWidth(pressWidth + dx, window.innerWidth);
      },
    };
  }

  return {
    widthStyle: computed(() =>
      stored.width.value === null
        ? FILE_LIST_BOUNDS
        : { ...FILE_LIST_BOUNDS, width: `${stored.width.value}px` },
    ),
    resize,
  };
}
