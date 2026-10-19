import { onClickOutside, useEventListener, useWindowFocus } from "@vueuse/core";
import { nextTick, shallowRef, watch, type ShallowRef } from "vue";

import { MENU_ITEMS, stepMenuItem } from "./menuKeys";

type DropdownParts<T> = {
  readonly menu: () => HTMLElement | null;
  readonly opener: (which: T) => HTMLElement | null;
};

type Dropdown<T> = DropdownParts<T> & {
  readonly openFor: ShallowRef<T | null>;
  readonly above: ShallowRef<boolean>;
};

export type DropdownMenu<T> = {
  readonly openFor: Readonly<ShallowRef<T | null>>;
  readonly above: Readonly<ShallowRef<boolean>>;
  readonly toggle: (which: T) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly menuKey: (event: KeyboardEvent) => void;
};

function visibleBottom(element: HTMLElement): number {
  for (let box = element.parentElement; box !== null; box = box.parentElement) {
    if (getComputedStyle(box).overflowY !== "visible") {
      return box.getBoundingClientRect().bottom;
    }
  }
  return window.innerHeight;
}

async function close<T>({ openFor, opener }: Dropdown<T>): Promise<void> {
  const which = openFor.value;
  openFor.value = null;
  if (which !== null) {
    await nextTick();
    opener(which)?.focus();
  }
}

async function closeAfterClick<T>(dropdown: Dropdown<T>): Promise<void> {
  const focused = document.activeElement;
  if (focused !== document.body && dropdown.menu()?.contains(focused) !== true) {
    dropdown.openFor.value = null;
    return;
  }
  await close(dropdown);
}

function contextMenuElsewhere<T>(dropdown: Dropdown<T>, event: MouseEvent): void {
  const target = event.target;
  const inside = target instanceof Node && dropdown.menu()?.contains(target) === true;
  if (dropdown.openFor.value !== null && !inside) {
    void closeAfterClick(dropdown);
  }
}

async function toggle<T>(dropdown: Dropdown<T>, which: T): Promise<void> {
  if (dropdown.openFor.value === which) {
    await close(dropdown);
    return;
  }
  dropdown.openFor.value = which;
  dropdown.above.value = false;
  await nextTick();
  const opened = dropdown.menu();
  if (opened === null) {
    return;
  }
  dropdown.above.value = opened.getBoundingClientRect().bottom > visibleBottom(opened);
  await nextTick();
  opened.querySelector<HTMLElement>(MENU_ITEMS)?.focus();
}

function menuKey<T>(dropdown: Dropdown<T>, event: KeyboardEvent): void {
  const items = [...(dropdown.menu()?.querySelectorAll<HTMLElement>(MENU_ITEMS) ?? [])];
  const step = stepMenuItem(
    { count: items.length, focused: items.findIndex((item) => item === event.target) },
    event,
  );
  switch (step.kind) {
    case "close":
      event.preventDefault();
      void close(dropdown);
      return;
    case "focus":
      event.preventDefault();
      items[step.index]?.focus();
      return;
    case "ignore":
      return;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

export function useDropdownMenu<T>(parts: DropdownParts<T>): DropdownMenu<T> {
  const dropdown: Dropdown<T> = { ...parts, openFor: shallowRef(null), above: shallowRef(false) };
  onClickOutside(
    parts.menu,
    () => {
      void closeAfterClick(dropdown);
    },
    {
      ignore: () => {
        const which = dropdown.openFor.value;
        const opener = which === null ? null : parts.opener(which);
        return opener === null ? [] : [opener];
      },
    },
  );
  useEventListener(
    window,
    "contextmenu",
    (event) => {
      contextMenuElsewhere(dropdown, event);
    },
    { capture: true },
  );
  watch(useWindowFocus(), (focused) => {
    if (!focused) {
      void close(dropdown);
    }
  });
  return {
    openFor: dropdown.openFor,
    above: dropdown.above,
    toggle: (which) => toggle(dropdown, which),
    close: () => close(dropdown),
    menuKey: (event) => {
      menuKey(dropdown, event);
    },
  };
}
