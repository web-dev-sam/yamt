import chevronsLeftIcon from "~icons/lucide/chevrons-left?raw";
import chevronsRightIcon from "~icons/lucide/chevrons-right?raw";
import cornerLeftDownIcon from "~icons/lucide/corner-left-down?raw";
import cornerRightDownIcon from "~icons/lucide/corner-right-down?raw";
import xIcon from "~icons/lucide/x?raw";

import type { Chunk } from "../../ipc";
import type { ChunkAction } from "./apply";
import { arrowTitles, type Arrow, type ArrowShape, type ButtonLayout } from "./gap";
import type { Side } from "./side";
import type { ApplyMode } from "./status";

export type IconPress = {
  readonly kind: ChunkAction["kind"];
  readonly chunk: Chunk;
  readonly side: Side;
};
export type OnPress = (press: IconPress, event: PointerEvent) => void;
export type ArrowRow = ArrowShape & {
  readonly node: SVGGElement;
  readonly buttons: readonly (readonly [SVGGElement, IconPress])[];
};

const SVG_NS = "http://www.w3.org/2000/svg";
export const ACTION_WIDTH_PX = 19;
const ICON_PX = 17;
const HALF = 0.5;
const APPLY_ICON: Readonly<Record<Side, Readonly<Record<ApplyMode, string>>>> = {
  local: { replace: chevronsRightIcon, append: cornerRightDownIcon },
  remote: { replace: chevronsLeftIcon, append: cornerLeftDownIcon },
};
const parsedIcons = new Map<string, SVGSVGElement>();

function parsedIcon(markup: string): SVGSVGElement {
  const cached = parsedIcons.get(markup);
  if (cached !== undefined) {
    return cached;
  }
  const holder = document.createElementNS(SVG_NS, "g");
  holder.innerHTML = markup;
  const icon = holder.firstElementChild;
  if (!(icon instanceof SVGSVGElement)) {
    throw new Error("icon markup is not an <svg>");
  }
  parsedIcons.set(markup, icon);
  return icon;
}

function iconElement(markup: string, lineHeight: number): SVGSVGElement {
  const icon = document.importNode(parsedIcon(markup), true);
  icon.setAttribute("x", String((ACTION_WIDTH_PX - ICON_PX) * HALF));
  icon.setAttribute("y", String((lineHeight - ICON_PX) * HALF));
  icon.setAttribute("width", String(ICON_PX));
  icon.setAttribute("height", String(ICON_PX));
  return icon;
}

export function isCovered(covered: ChunkAction | null, press: IconPress): boolean {
  return (
    covered !== null &&
    covered.kind === press.kind &&
    covered.side === press.side &&
    covered.chunks.some((chunk) => chunk.id === press.chunk.id)
  );
}

function actionButton(
  button: { x: number; lineHeight: number; icon: string; title: string },
  press: IconPress,
  onPress: OnPress,
): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `chunk-action chunk-action-${press.kind}`);
  group.setAttribute("transform", `translate(${button.x} 0)`);
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = button.title;
  const hit = document.createElementNS(SVG_NS, "rect");
  hit.setAttribute("width", String(ACTION_WIDTH_PX));
  hit.setAttribute("height", String(button.lineHeight));
  group.append(title, hit, iconElement(button.icon, button.lineHeight));
  group.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      onPress(press, event);
    }
  });
  return group;
}

export function arrowRow(
  {
    arrow,
    side,
    platform,
  }: { readonly arrow: Arrow; readonly side: Side; readonly platform: string },
  layout: ButtonLayout,
  onPress: OnPress,
): ArrowRow {
  const { chunk, mode, decidesOther } = arrow;
  const { applyX, ignoreX, lineHeight } = layout;
  const titles = arrowTitles(arrow, platform);
  const apply: IconPress = { kind: "apply", chunk, side };
  const ignore: IconPress = { kind: "ignore", chunk, side };
  const applyIcon = { icon: APPLY_ICON[side][mode], title: titles.apply };
  const applyButton = actionButton({ x: applyX, lineHeight, ...applyIcon }, apply, onPress);
  const ignoreIcon = { icon: xIcon, title: titles.ignore };
  const ignoreButton = actionButton({ x: ignoreX, lineHeight, ...ignoreIcon }, ignore, onPress);
  const node = document.createElementNS(SVG_NS, "g");
  node.append(applyButton, ignoreButton);
  return {
    node,
    mode,
    decidesOther,
    layout,
    buttons: [
      [applyButton, apply],
      [ignoreButton, ignore],
    ],
  };
}
