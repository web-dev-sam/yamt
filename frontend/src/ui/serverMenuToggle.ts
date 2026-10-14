export function menuAfterClick<Menu extends { readonly name: string }>(
  open: Menu | null,
  clicked: Menu,
): Menu | null {
  return open?.name === clicked.name ? null : clicked;
}
