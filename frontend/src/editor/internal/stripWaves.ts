import { WAVE_HOVER_STROKE_PX, WAVE_STROKE_PX } from "../../connectors";
import { FOLD_RUN_ATTRIBUTE, HOVER_CLASS } from "./folding";
import type { WavePaint } from "./gap";
import { LINE_HEIGHT_PX } from "./pane";

const SVG_NS = "http://www.w3.org/2000/svg";
const PATH_CLASSES = ["strip-wave-hit", "strip-wave-line"] as const;

function waveNode(run: number, hovered: number | null): SVGGElement {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute(FOLD_RUN_ATTRIBUTE, String(run));
  group.classList.toggle(HOVER_CLASS, run === hovered);
  for (const name of PATH_CLASSES) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", name);
    group.append(path);
  }
  return group;
}

export class StripWaves {
  readonly layer = document.createElementNS(SVG_NS, "g");
  readonly #nodes = new Map<number, SVGGElement>();
  readonly #hovered: () => number | null;

  constructor(hovered: () => number | null) {
    this.#hovered = hovered;
    this.layer.style.setProperty("--strip-wave-hit", `${LINE_HEIGHT_PX}px`);
    this.layer.style.setProperty("--strip-wave-stroke", `${WAVE_STROKE_PX}px`);
    this.layer.style.setProperty("--strip-wave-hover-stroke", `${WAVE_HOVER_STROKE_PX}px`);
  }

  paint(paints: readonly WavePaint[]): void {
    const kept = new Set(paints.map(({ run }) => run));
    for (const [run, group] of this.#nodes) {
      if (!kept.has(run)) {
        group.remove();
        this.#nodes.delete(run);
      }
    }
    for (const { run, d } of paints) {
      let group = this.#nodes.get(run);
      if (group === undefined) {
        group = waveNode(run, this.#hovered());
        this.#nodes.set(run, group);
        this.layer.append(group);
      }
      for (const path of group.children) {
        path.setAttribute("d", d);
      }
    }
  }
}
