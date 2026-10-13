import { numberField, recordOf } from "./json";

const HALF = 2;

export type Placement = {
  readonly x: number;
  readonly y: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly chromeWidth: number;
  readonly chromeHeight: number;
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
};

export type ScrollTo =
  | { readonly kind: "top" }
  | { readonly kind: "bottom" }
  | { readonly kind: "px"; readonly px: number };

export type Point = { readonly x: number; readonly y: number };

export const REVEAL_SCRIPT = `
const element = arguments[0];
element.scrollIntoView({ block: "nearest", inline: "nearest" });
const rect = element.getBoundingClientRect();
return {
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
  screenX: window.screenX,
  screenY: window.screenY,
  chromeWidth: window.outerWidth - window.innerWidth,
  chromeHeight: window.outerHeight - window.innerHeight,
  scrollTop: element.scrollTop,
  scrollHeight: element.scrollHeight,
  clientHeight: element.clientHeight,
};`;

export function parsePlacement(value: unknown): Placement {
  const record = recordOf(value, "element placement");
  return {
    x: numberField(record, "x"),
    y: numberField(record, "y"),
    screenX: numberField(record, "screenX"),
    screenY: numberField(record, "screenY"),
    chromeWidth: numberField(record, "chromeWidth"),
    chromeHeight: numberField(record, "chromeHeight"),
    scrollTop: numberField(record, "scrollTop"),
    scrollHeight: numberField(record, "scrollHeight"),
    clientHeight: numberField(record, "clientHeight"),
  };
}

export function viewportPoint(placement: Placement): Point {
  return { x: Math.round(placement.x), y: Math.round(placement.y) };
}

/** The window frame is taken as even on the left and right, with the rest of it on top. */
export function screenPoint(placement: Placement): Point {
  const border = placement.chromeWidth / HALF;
  return {
    x: Math.round(placement.screenX + border + placement.x),
    y: Math.round(placement.screenY + placement.chromeHeight - border + placement.y),
  };
}

export function scrollDelta(to: ScrollTo, placement: Placement): number {
  switch (to.kind) {
    case "top":
      return -placement.scrollTop;
    case "bottom":
      return placement.scrollHeight - placement.clientHeight - placement.scrollTop;
    case "px":
      return to.px - placement.scrollTop;
    default: {
      const _exhaustive: never = to;
      return _exhaustive;
    }
  }
}
