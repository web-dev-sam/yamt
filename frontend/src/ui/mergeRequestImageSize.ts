import type { DescriptionInline } from "../ipc";

export type ImageSize = NonNullable<Extract<DescriptionInline, { kind: "image" }>["size"]>;
type ImageLength = Extract<ImageSize, { kind: "width" }>["width"];
type ImageStyle = Readonly<Record<string, string>>;

export type NaturalSize = { readonly width: number; readonly height: number };

const WHOLE_PERCENT = 100;
const OWN_SIZE: ImageStyle = { height: "auto", maxWidth: "100%" };

function lengthText(length: ImageLength): string {
  return length.kind === "pixels"
    ? `${length.value}px`
    : `${Math.min(length.value, WHOLE_PERCENT)}%`;
}

function widthStyle(width: ImageLength): ImageStyle {
  return { width: lengthText(width), ...OWN_SIZE };
}

function heightStyle(height: number, natural: NaturalSize | null): ImageStyle {
  if (natural === null || natural.height === 0) {
    return { height: `${height}px` };
  }
  return { width: `${(height * natural.width) / natural.height}px`, ...OWN_SIZE };
}

function naturalRatio(natural: NaturalSize | null): ImageStyle {
  return natural === null || natural.height === 0
    ? {}
    : { aspectRatio: `${natural.width} / ${natural.height}` };
}

function bothStyle(width: ImageLength, height: number, natural: NaturalSize | null): ImageStyle {
  const ratio =
    width.kind === "pixels" ? { aspectRatio: `${width.value} / ${height}` } : naturalRatio(natural);
  return { width: lengthText(width), ...ratio, ...OWN_SIZE };
}

/** CSS for an image of `size` (null: its own size, today's `max-w-full h-auto`); `natural` once it loaded. A height
 *  in % is ignored, as on GitLab's page: it computes to auto in a column of auto height (CSS 2.1 §10.5). */
export function imageStyle(size: ImageSize | null, natural: NaturalSize | null): ImageStyle {
  if (size === null) {
    return OWN_SIZE;
  }
  switch (size.kind) {
    case "width":
      return widthStyle(size.width);
    case "height":
      return size.height.kind === "pixels" ? heightStyle(size.height.value, natural) : OWN_SIZE;
    case "both":
      return size.height.kind === "pixels"
        ? bothStyle(size.width, size.height.value, natural)
        : widthStyle(size.width);
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}
