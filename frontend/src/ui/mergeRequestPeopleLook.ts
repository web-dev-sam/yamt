export type PictureSize = "row" | "stack" | "box";
type Box = { readonly width: string; readonly height: string };

export const PICTURE_PX: Readonly<Record<PictureSize, number>> = { row: 24, stack: 20, box: 20 };

export const TURN_MARK = "font-semibold text-primary";

export function pictureBox(size: PictureSize): Box {
  const side = `${PICTURE_PX[size]}px`;
  return { width: side, height: side };
}
