import "../theme.css";
import { bandPath, type Span } from "../../connectors";
import type { Column } from "../../ipc";
import { crossesStrip } from "./gap";
import type { ChangeTone } from "./tone";

export type CompareRow = Readonly<Record<Column, Span>> & { readonly tone: ChangeTone };
export type StripPanes = Readonly<Record<Column, { readonly documentTop: number }>>;

const SVG_NS = "http://www.w3.org/2000/svg";

function shiftedSpan({ top, bottom }: Span, by: number): Span {
  return { top: top + by, bottom: bottom + by };
}

function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault();
}

export class CompareStrip {
  readonly #strip: SVGSVGElement;
  readonly #layer = document.createElementNS(SVG_NS, "g");
  readonly #bands = new Map<string, SVGPathElement>();

  constructor(strip: SVGSVGElement) {
    this.#strip = strip;
    strip.replaceChildren(this.#layer);
    strip.addEventListener("mousedown", keepEditorFocus);
  }

  paint(panes: StripPanes, rows: readonly CompareRow[]): void {
    const strip = this.#strip;
    const stripTop = strip.getBoundingClientRect().top;
    const width = strip.clientWidth;
    const height = strip.clientHeight;
    const kept = new Set<string>();
    rows.forEach((row, index) => {
      const left = shiftedSpan(row.left, panes.left.documentTop - stripTop);
      const right = shiftedSpan(row.right, panes.right.documentTop - stripTop);
      const top = Math.min(left.top, right.top);
      if (!crossesStrip(top, Math.max(left.bottom, right.bottom), height)) {
        return;
      }
      const key = `${index} ${row.tone}`;
      kept.add(key);
      let path = this.#bands.get(key);
      if (path === undefined) {
        path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", `chunk-${row.tone} chunk-band`);
        this.#bands.set(key, path);
        this.#layer.append(path);
      }
      path.setAttribute("d", bandPath({ left, right }, width));
    });
    for (const [key, path] of this.#bands) {
      if (!kept.has(key)) {
        path.remove();
        this.#bands.delete(key);
      }
    }
  }

  destroy(): void {
    this.#strip.removeEventListener("mousedown", keepEditorFocus);
    this.#strip.replaceChildren();
  }
}
