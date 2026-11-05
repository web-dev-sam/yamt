export const MENU_ITEMS = "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]";

export const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

type MenuStep =
  | { readonly kind: "close" }
  | { readonly kind: "focus"; readonly index: number }
  | { readonly kind: "ignore" };

/** `index` moved by `step`, wrapping over `count` (> 0) items; `stepMenuItem` uses it. */
export function wrappedIndex(count: number, index: number, step: number): number {
  return (index + step + count) % count;
}

export function stepMenuItem(
  menu: { readonly count: number; readonly focused: number },
  event: Pick<KeyboardEvent, "key">,
): MenuStep {
  if (event.key === "Escape" || event.key === "Tab") {
    return { kind: "close" };
  }
  const step = ARROW_STEPS[event.key];
  if (step === undefined || menu.count === 0) {
    return { kind: "ignore" };
  }
  return { kind: "focus", index: wrappedIndex(menu.count, menu.focused, step) };
}
