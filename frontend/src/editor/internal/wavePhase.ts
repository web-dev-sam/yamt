import { wavePhase, type WaveEnds, type WavePhase } from "../../connectors";
import { PANES, STRIP_PANES, type Pane } from "./geometry";
import { SIDES, type Side } from "./side";

export const WAVE_PHASE_VARS = { offset: "--fold-wave-x", period: "--fold-wave-period" } as const;

export type WaveHosts = Readonly<Record<Pane, HTMLElement>> & {
  readonly strips: readonly [Element, Element];
};

type Edges = { readonly left: number; readonly right: number };
type Measured = { getBoundingClientRect(): Edges };
type MeasuredPanes = Readonly<Record<Pane, { readonly scrollDOM: Measured }>>;
export type WaveLayout = {
  readonly scrollers: Readonly<Record<Pane, Edges>>;
  readonly strips: Readonly<Record<Side, Edges>>;
};
type PhaseStyle = Pick<CSSStyleDeclaration, "getPropertyValue" | "setProperty" | "removeProperty">;

const PHASE_KEYS = ["offset", "period"] as const satisfies readonly (keyof WavePhase)[];

function stripEdge(pane: Pane, strips: WaveLayout["strips"], edge: keyof Edges): number | null {
  const side = SIDES.find((each) => STRIP_PANES[each][edge] === pane);
  return side === undefined ? null : strips[side][edge];
}

export function paneEnds(strips: WaveLayout["strips"]): Readonly<Record<Pane, WaveEnds | null>> {
  function ends(pane: Pane): WaveEnds | null {
    const leaves = stripEdge(pane, strips, "left");
    const enters = stripEdge(pane, strips, "right");
    if (enters === null) {
      return leaves === null ? null : { kind: "leaves", at: leaves };
    }
    return leaves === null ? { kind: "enters", at: enters } : { kind: "through", enters, leaves };
  }
  return { left: ends("left"), center: ends("center"), right: ends("right") };
}

export function panePhases(layout: WaveLayout): Readonly<Record<Pane, WavePhase | null>> {
  const ends = paneEnds(layout.strips);
  function phase(pane: Pane): WavePhase | null {
    const paneEnd = ends[pane];
    return paneEnd === null ? null : wavePhase(layout.scrollers[pane].left, paneEnd);
  }
  return { left: phase("left"), center: phase("center"), right: phase("right") };
}

export function layoutOf(
  views: MeasuredPanes,
  [local, remote]: readonly [Measured, Measured],
  ratio: number,
): WaveLayout {
  // WebKit paints each box, and the mask's origin in it, at whole device pixels (plan §2 #64).
  function snapped(element: Measured): Edges {
    const { left, right } = element.getBoundingClientRect();
    return { left: Math.round(left * ratio) / ratio, right: Math.round(right * ratio) / ratio };
  }
  return {
    scrollers: {
      left: snapped(views.left.scrollDOM),
      center: snapped(views.center.scrollDOM),
      right: snapped(views.right.scrollDOM),
    },
    strips: { local: snapped(local), remote: snapped(remote) },
  };
}

export function phaseStyle(phase: WavePhase): Readonly<Record<keyof WavePhase, string>> {
  return { offset: `${phase.offset}px`, period: `${phase.period}px` };
}

export function writePhase(style: PhaseStyle, phase: WavePhase | null): void {
  const values = phase === null ? null : phaseStyle(phase);
  for (const key of PHASE_KEYS) {
    const name = WAVE_PHASE_VARS[key];
    if (values === null) {
      style.removeProperty(name);
    } else if (style.getPropertyValue(name) !== values[key]) {
      style.setProperty(name, values[key]);
    }
  }
}

export class WavePhases {
  readonly #hosts: WaveHosts;
  readonly #views: () => MeasuredPanes;
  readonly #observer: ResizeObserver;
  #resolution: MediaQueryList;

  constructor(hosts: WaveHosts, views: () => MeasuredPanes) {
    this.#hosts = hosts;
    this.#views = views;
    this.#observer = new ResizeObserver(() => {
      this.#measure();
    });
    for (const pane of PANES) {
      this.#observer.observe(hosts[pane]);
    }
    this.#resolution = this.#watchResolution();
  }

  readonly #resolutionChanged = (): void => {
    this.#resolution.removeEventListener("change", this.#resolutionChanged);
    this.#resolution = this.#watchResolution();
    this.#measure();
  };

  #watchResolution(): MediaQueryList {
    const query = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    query.addEventListener("change", this.#resolutionChanged);
    return query;
  }

  #measure(): void {
    const layout = layoutOf(this.#views(), this.#hosts.strips, devicePixelRatio);
    const phases = panePhases(layout);
    for (const pane of PANES) {
      writePhase(this.#hosts[pane].style, phases[pane]);
    }
  }

  destroy(): void {
    this.#observer.disconnect();
    this.#resolution.removeEventListener("change", this.#resolutionChanged);
    for (const pane of PANES) {
      writePhase(this.#hosts[pane].style, null);
    }
  }
}
