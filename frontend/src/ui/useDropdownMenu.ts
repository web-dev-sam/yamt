import { onClickOutside, useEventListener, useWindowFocus } from "@vueuse/core";
import { computed, nextTick, shallowRef, watch, type ShallowRef } from "vue";

import { MENU_ITEMS, stepMenuItem } from "./menuKeys";

type DropdownParts<T> = {
  readonly menu: () => HTMLElement | null;
  readonly opener: (which: T) => HTMLElement | null;
};

type Opened<T> = { readonly which: T; readonly focus: "kept" | "moved" };

type Dropdown<T> = DropdownParts<T> & {
  readonly opened: ShallowRef<Opened<T> | null>;
  readonly above: ShallowRef<boolean>;
};

export type DropdownMenu<T> = {
  readonly openFor: Readonly<ShallowRef<T | null>>;
  readonly opened: Readonly<ShallowRef<Opened<T> | null>>;
  readonly above: Readonly<ShallowRef<boolean>>;
  readonly toggle: (which: T) => Promise<void>;
  readonly open: (which: T) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly dismiss: () => Promise<void>;
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

async function close<T>({ opened, opener }: Dropdown<T>): Promise<void> {
  const was = opened.value;
  opened.value = null;
  if (was !== null) {
    await nextTick();
    opener(was.which)?.focus();
  }
}

async function dismiss<T>(dropdown: Dropdown<T>): Promise<void> {
  if (dropdown.menu()?.contains(document.activeElement) === true) {
    await close(dropdown);
    return;
  }
  dropdown.opened.value = null;
}

async function closeAfterClick<T>(dropdown: Dropdown<T>): Promise<void> {
  const focusLeftForBody =
    dropdown.opened.value?.focus === "moved" && document.activeElement === document.body;
  await (focusLeftForBody ? close(dropdown) : dismiss(dropdown));
}

function contextMenuElsewhere<T>(dropdown: Dropdown<T>, event: MouseEvent): void {
  const target = event.target;
  const inside = target instanceof Node && dropdown.menu()?.contains(target) === true;
  if (dropdown.opened.value !== null && !inside) {
    void closeAfterClick(dropdown);
  }
}

async function open<T>(dropdown: Dropdown<T>, opened: Opened<T>): Promise<void> {
  dropdown.opened.value = opened;
  dropdown.above.value = false;
  await nextTick();
  const menu = dropdown.menu();
  if (menu !== null) {
    dropdown.above.value = menu.getBoundingClientRect().bottom > visibleBottom(menu);
  }
}

async function toggle<T>(dropdown: Dropdown<T>, which: T): Promise<void> {
  const was = dropdown.opened.value;
  const isOpen = was !== null && was.which === which;
  if (isOpen && was.focus === "moved") {
    await close(dropdown);
    return;
  }
  if (isOpen) {
    dropdown.opened.value = { which, focus: "moved" };
  } else {
    await open(dropdown, { which, focus: "moved" });
    await nextTick();
  }
  dropdown.menu()?.querySelector<HTMLElement>(MENU_ITEMS)?.focus();
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

function windowFocusChanged<T>(dropdown: Dropdown<T>, focused: boolean): void {
  if (!focused) {
    void (dropdown.opened.value?.focus === "kept" ? dismiss(dropdown) : close(dropdown));
  }
}

export function useDropdownMenu<T>(parts: DropdownParts<T>): DropdownMenu<T> {
  const dropdown: Dropdown<T> = { ...parts, opened: shallowRef(null), above: shallowRef(false) };
  onClickOutside(
    parts.menu,
    () => {
      void closeAfterClick(dropdown);
    },
    {
      ignore: () => {
        const opened = dropdown.opened.value;
        const opener = opened === null ? null : parts.opener(opened.which);
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
    windowFocusChanged(dropdown, focused);
  });
  return {
    openFor: computed(() => dropdown.opened.value?.which ?? null),
    opened: dropdown.opened,
    above: dropdown.above,
    toggle: (which) => toggle(dropdown, which),
    open: (which) => open(dropdown, { which, focus: "kept" }),
    close: () => close(dropdown),
    dismiss: () => dismiss(dropdown),
    menuKey: (event) => {
      menuKey(dropdown, event);
    },
  };
}
