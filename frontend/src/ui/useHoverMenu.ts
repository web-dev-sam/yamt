import { useTimeoutFn } from "@vueuse/core";

import { MENU_ITEMS } from "./menuKeys";
import { useDropdownMenu, type DropdownMenu } from "./useDropdownMenu";

export const HOVER_CLOSE_MS = 300;

export type HoverMenu<T> = DropdownMenu<T> & {
  readonly pointerEntered: (which: T) => void;
  readonly pointerLeft: () => void;
  readonly openerClicked: (which: T) => Promise<void>;
};

export function useHoverMenu<T>(parts: {
  readonly menu: () => HTMLElement | null;
  readonly opener: (which: T) => HTMLElement | null;
}): HoverMenu<T> {
  const dropdown = useDropdownMenu(parts);
  let byHover = false;
  const closing = useTimeoutFn(
    () => {
      void dropdown.dismiss();
    },
    HOVER_CLOSE_MS,
    { immediate: false },
  );
  return {
    ...dropdown,
    pointerEntered: (which) => {
      closing.stop();
      if (dropdown.openFor.value !== which) {
        byHover = true;
        void dropdown.open(which);
      }
    },
    pointerLeft: () => {
      if (byHover && dropdown.openFor.value !== null) {
        closing.start();
      }
    },
    openerClicked: async (which) => {
      closing.stop();
      const pinning = byHover && dropdown.openFor.value === which;
      byHover = false;
      if (pinning) {
        parts.menu()?.querySelector<HTMLElement>(MENU_ITEMS)?.focus();
      } else {
        await dropdown.toggle(which);
      }
    },
  };
}
