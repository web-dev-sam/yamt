import { wavePhase, type WaveEnds, type WavePhase } from "../../connectors";
import { STRIP_PANES, type Pane, type PaneViews } from "./geometry";
import { SIDES, type Side } from "./side";

export const WAVE_PHASE_VARS = { offset: "--fold-wave-x", period: "--fold-wave-period" } as const;

export type WaveHosts = Readonly<Record<Pane, HTMLElement>> & {
  readonly strips: readonly [Element, Element];
};

type Edges = { readonly left: number; readonly right: number };
export type WaveLayout = {
  readonly scrollers: Readonly<Record<Pane, Edges>>;
  readonly strips: Readonly<Record<Side, Edges>>;
};
type PhaseStyle = Pick<CSSStyleDeclaration, "getPropertyValue" | "setProperty" | "removeProperty">;

const PANES = ["left", "center", "right"] as const satisfies readonly Pane[];
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
  readonly #observer: ResizeObserver;

  constructor(hosts: WaveHosts, views: () => PaneViews) {
    this.#hosts = hosts;
    this.#observer = new ResizeObserver(() => {
      this.#measure(views());
    });
    for (const pane of PANES) {
      this.#observer.observe(hosts[pane]);
    }
  }

  #measure(views: PaneViews): void {
    const [local, remote] = this.#hosts.strips;
    const phases = panePhases({
      scrollers: {
        left: views.left.scrollDOM.getBoundingClientRect(),
        center: views.center.scrollDOM.getBoundingClientRect(),
        right: views.right.scrollDOM.getBoundingClientRect(),
      },
      strips: { local: local.getBoundingClientRect(), remote: remote.getBoundingClientRect() },
    });
    for (const pane of PANES) {
      writePhase(this.#hosts[pane].style, phases[pane]);
    }
  }

  destroy(): void {
    this.#observer.disconnect();
    for (const pane of PANES) {
      writePhase(this.#hosts[pane].style, null);
    }
  }
}
