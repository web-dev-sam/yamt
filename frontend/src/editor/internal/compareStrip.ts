import "../theme.css";
import type { Span } from "../../connectors";
import type { Column } from "../../ipc";
import { placedBand } from "./gap";
import { dropMissing, keepEditorFocus } from "./strips";
import type { ChangeTone } from "./tone";

export type CompareRow = Readonly<Record<Column, Span>> & { readonly tone: ChangeTone };
export type StripPanes = Readonly<Record<Column, { readonly documentTop: number }>>;

const SVG_NS = "http://www.w3.org/2000/svg";

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
    const shifts = {
      left: panes.left.documentTop - stripTop,
      right: panes.right.documentTop - stripTop,
    };
    const size = { width: strip.clientWidth, height: strip.clientHeight };
    const kept = new Set<string>();
    rows.forEach((row, index) => {
      const d = placedBand(row.left, row.right, shifts, size);
      if (d === null) {
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
      path.setAttribute("d", d);
    });
    dropMissing(this.#bands, kept, (path) => {
      path.remove();
    });
  }

  destroy(): void {
    this.#strip.removeEventListener("mousedown", keepEditorFocus);
    this.#strip.replaceChildren();
  }
}
