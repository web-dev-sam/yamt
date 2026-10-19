import type { Side } from "../ipc";
import { dragged, type PaneSplitState, type PaneWidths } from "./paneSplit";
import { useColumnDrag, type ColumnDrag, type ColumnDragHandle } from "./useColumnDrag";

type SplitWriter = Pick<PaneSplitState, "setPaneSplit" | "resetPaneSplit">;

export function dividerHandle(
  boundary: Side,
  measure: () => PaneWidths | null,
  split: SplitWriter,
): {
  accepts(event: Pick<Event, "target" | "currentTarget">): boolean;
  press(): ColumnDrag | null;
  reset(): void;
} {
  return {
    accepts: ({ target, currentTarget }) =>
      currentTarget !== null &&
      (target === currentTarget ||
        (target instanceof SVGSVGElement && target.parentNode === currentTarget)),
    press: () => {
      const widths = measure();
      if (widths === null) {
        return null;
      }
      return {
        moveBy: (dx) => {
          split.setPaneSplit(dragged(widths, boundary, dx));
        },
      };
    },
    reset: () => {
      split.resetPaneSplit();
    },
  };
}

export function usePaneDividers(
  measure: () => PaneWidths | null,
  split: SplitWriter,
): Readonly<Record<Side, ColumnDragHandle>> {
  return {
    local: useColumnDrag(dividerHandle("local", measure, split)),
    remote: useColumnDrag(dividerHandle("remote", measure, split)),
  };
}
