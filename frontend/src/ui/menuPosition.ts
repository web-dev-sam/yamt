export type Point = { readonly x: number; readonly y: number };

export type Size = { readonly width: number; readonly height: number };

type Placement = { readonly pointer: Point; readonly menu: Size; readonly viewport: Size };

export function menuPosition({ pointer, menu, viewport }: Placement): Point {
  return {
    x: Math.max(0, Math.min(pointer.x, viewport.width - menu.width)),
    y: Math.max(0, Math.min(pointer.y, viewport.height - menu.height)),
  };
}
