import type { Size } from "./menuPosition";

const GAP_PX = 4;
const MAX_WIDTH_PX = 480;

type TagAnchor = { readonly tagTop: number; readonly textLeft: number; readonly viewport: Size };

export type Anchor = { readonly top: number; readonly bottom: number; readonly left: number };

type TooltipPlacement = { readonly left: number; readonly top: number; readonly maxWidth: number };

export type TooltipBox = {
  readonly left: number;
  readonly bottom: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
};

export function tooltipBox({ tagTop, textLeft, viewport }: TagAnchor): TooltipBox {
  const room = Math.max(0, tagTop - GAP_PX);
  return {
    left: textLeft,
    bottom: viewport.height - room,
    maxWidth: Math.max(0, Math.min(MAX_WIDTH_PX, viewport.width - textLeft)),
    maxHeight: room,
  };
}

export function tooltipPlacement({
  anchor,
  tip,
  viewport,
}: {
  readonly anchor: Anchor;
  readonly tip: Size;
  readonly viewport: Size;
}): TooltipPlacement {
  const above = anchor.top - GAP_PX - tip.height;
  return {
    left: Math.max(0, Math.min(anchor.left, viewport.width - tip.width)),
    top: above >= 0 ? above : anchor.bottom + GAP_PX,
    maxWidth: Math.min(MAX_WIDTH_PX, viewport.width),
  };
}
