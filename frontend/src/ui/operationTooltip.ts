import type { Size } from "./menuPosition";

const GAP_PX = 4;
const MAX_WIDTH_PX = 480;

type Anchor = { readonly tagTop: number; readonly textLeft: number; readonly viewport: Size };

export type TooltipBox = {
  readonly left: number;
  readonly bottom: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
};

export function tooltipBox({ tagTop, textLeft, viewport }: Anchor): TooltipBox {
  const room = Math.max(0, tagTop - GAP_PX);
  return {
    left: textLeft,
    bottom: viewport.height - room,
    maxWidth: Math.max(0, Math.min(MAX_WIDTH_PX, viewport.width - textLeft)),
    maxHeight: room,
  };
}
