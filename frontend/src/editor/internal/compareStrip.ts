import "../theme.css";
import type { Span } from "../../connectors";
import type { Column } from "../../ipc";
import { joinPaints, placedBand } from "./gap";
import type { WaveRow } from "./geometry";
import { LINE_HEIGHT_PX } from "./pane";
import { dropMissing, keepEditorFocus, WaveLayer } from "./strips";
import type { ChangeTone } from "./tone";

export type CompareRow = Readonly<Record<Column, Span>> & { readonly tone: ChangeTone };
export type StripPanes = Readonly<Record<Column, { readonly documentTop: number }>>;

const SVG_NS = "http://www.w3.org/2000/svg";

export class CompareStrip {
  readonly #strip: SVGSVGElement;
  readonly #layer = document.createElementNS(SVG_NS, "g");
  readonly #bands = new Map<string, SVGPathElement>();
  readonly #waves: WaveLayer | null;

  constructor(strip: SVGSVGElement, hovered?: () => number | null) {
    this.#strip = strip;
    this.#waves = hovered === undefined ? null : new WaveLayer(hovered);
    if (this.#waves === null) {
      strip.replaceChildren(this.#layer);
    } else {
      strip.replaceChildren(this.#layer, this.#waves.node);
    }
    strip.addEventListener("mousedown", keepEditorFocus);
  }

  paint(panes: StripPanes, rows: readonly CompareRow[], waves: readonly WaveRow<Column>[]): void {
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
    this.#waves?.paint(joinPaints(waves, shifts, { ...size, lineHeight: LINE_HEIGHT_PX }));
  }

  destroy(): void {
    this.#strip.removeEventListener("mousedown", keepEditorFocus);
    this.#strip.replaceChildren();
  }
}
