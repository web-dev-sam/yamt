import type { MergeHosts } from "./index";

const MOUNTED = "data-pane-harness";

function box(style: string): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute("style", style);
  return node;
}

function strip(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "display: block; width: 100%; height: 100%");
  return svg;
}

export function mount(): MergeHosts {
  const wrapper = box(
    "position: fixed; inset: 40px 0 auto 0; height: 400px; display: grid; grid-template-columns: 1fr 40px 1fr 40px 1fr; will-change: transform",
  );
  wrapper.setAttribute(MOUNTED, "");
  const pane = "min-width: 0; min-height: 0; height: 400px";
  const hosts: MergeHosts = {
    left: box(pane),
    center: box(pane),
    right: box(pane),
    strips: [strip(), strip()],
  };
  const [leftStrip, rightStrip] = hosts.strips.map((svg) => {
    const layer = box("min-height: 0; will-change: transform");
    layer.append(svg);
    return layer;
  });
  wrapper.append(hosts.left, leftStrip ?? "", hosts.center, rightStrip ?? "", hosts.right);
  document.body.append(wrapper);
  return hosts;
}

export function unmountAll(): void {
  document.querySelectorAll(`[${MOUNTED}]`).forEach((wrapper) => wrapper.remove());
}

export function found<T extends Element>(node: T | null | undefined, what: string): T {
  if (node === null || node === undefined) {
    throw new Error(`no ${what}`);
  }
  return node;
}

export function covers(tooltip: HTMLElement, x: number, y: number): boolean {
  return tooltip.contains(document.elementFromPoint(x, y));
}
