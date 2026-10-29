import { wavePhase, type WaveEnds, type WavePhase } from "../../connectors";
import { STRIP_PANES, type Pane } from "./geometry";
import { SIDES, type Side } from "./side";

export const WAVE_PHASE_VARS = { offset: "--fold-wave-x", period: "--fold-wave-period" } as const;

export type WaveHosts = Readonly<Record<Pane, HTMLElement>> & {
  readonly strips: readonly [Element, Element];
};

type Edges = { readonly left: number; readonly right: number };
type Measured = { getBoundingClientRect(): Edges };
type MeasuredViews<P extends string> = Readonly<Record<P, { readonly scrollDOM: Measured }>>;
type MeasuredPanes = MeasuredViews<Pane>;
type Link<S, P extends string> = { readonly strip: S; readonly pane: P };
export type WaveChain<P extends string> = {
  readonly first: P;
  readonly next: readonly Link<Element, P>[];
};
export type WaveLayout = {
  readonly scrollers: Readonly<Record<Pane, Edges>>;
  readonly strips: Readonly<Record<Side, Edges>>;
};
type PhaseStyle = Pick<CSSStyleDeclaration, "getPropertyValue" | "setProperty" | "removeProperty">;

const PHASE_KEYS = ["offset", "period"] as const satisfies readonly (keyof WavePhase)[];

function mergeChain<S>(strips: Readonly<Record<Side, S>>): {
  readonly first: Pane;
  readonly next: readonly Link<S, Pane>[];
} {
  return {
    first: STRIP_PANES.local.left,
    next: SIDES.map((side) => ({ strip: strips[side], pane: STRIP_PANES[side].right })),
  };
}

function paneEnd(enters: number | null, leaves: number | null): WaveEnds | null {
  if (enters === null) {
    return leaves === null ? null : { kind: "leaves", at: leaves };
  }
  return leaves === null ? { kind: "enters", at: enters } : { kind: "through", enters, leaves };
}

export function chainEnds<P extends string>(
  first: P,
  next: readonly Link<Edges, P>[],
): ReadonlyMap<P, WaveEnds> {
  const ends = new Map<P, WaveEnds>();
  [first, ...next.map(({ pane }) => pane)].forEach((pane, index) => {
    const end = paneEnd(next[index - 1]?.strip.right ?? null, next[index]?.strip.left ?? null);
    if (end !== null) {
      ends.set(pane, end);
    }
  });
  return ends;
}

export function paneEnds(strips: WaveLayout["strips"]): Readonly<Record<Pane, WaveEnds | null>> {
  const { first, next } = mergeChain(strips);
  const ends = chainEnds(first, next);
  return {
    left: ends.get("left") ?? null,
    center: ends.get("center") ?? null,
    right: ends.get("right") ?? null,
  };
}

function chainPhases<P extends string>(
  first: P,
  next: readonly Link<Edges, P>[],
  scroller: (pane: P) => Edges,
): ReadonlyMap<P, WavePhase> {
  return new Map(
    [...chainEnds(first, next)].map(([pane, end]) => [pane, wavePhase(scroller(pane).left, end)]),
  );
}

export function panePhases(layout: WaveLayout): Readonly<Record<Pane, WavePhase | null>> {
  const { first, next } = mergeChain(layout.strips);
  const phases = chainPhases(first, next, (pane) => layout.scrollers[pane]);
  return {
    left: phases.get("left") ?? null,
    center: phases.get("center") ?? null,
    right: phases.get("right") ?? null,
  };
}

// WebKit paints each box, and the mask's origin in it, at whole device pixels (plan §2 #64).
function snapped(element: Measured, ratio: number): Edges {
  const { left, right } = element.getBoundingClientRect();
  return { left: Math.round(left * ratio) / ratio, right: Math.round(right * ratio) / ratio };
}

export function layoutOf(
  views: MeasuredPanes,
  [local, remote]: readonly [Measured, Measured],
  ratio: number,
): WaveLayout {
  return {
    scrollers: {
      left: snapped(views.left.scrollDOM, ratio),
      center: snapped(views.center.scrollDOM, ratio),
      right: snapped(views.right.scrollDOM, ratio),
    },
    strips: { local: snapped(local, ratio), remote: snapped(remote, ratio) },
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

export class ChainPhases<P extends string> {
  readonly #chain: WaveChain<P>;
  readonly #panes: readonly P[];
  readonly #hosts: Readonly<Record<P, HTMLElement>>;
  readonly #views: () => MeasuredViews<P>;
  readonly #observer: ResizeObserver;
  #resolution: MediaQueryList;

  constructor(
    chain: WaveChain<P>,
    hosts: Readonly<Record<P, HTMLElement>>,
    views: () => MeasuredViews<P>,
  ) {
    this.#chain = chain;
    this.#panes = [chain.first, ...chain.next.map(({ pane }) => pane)];
    this.#hosts = hosts;
    this.#views = views;
    this.#observer = new ResizeObserver(() => {
      this.#measure();
    });
    for (const pane of this.#panes) {
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
    const ratio = devicePixelRatio;
    const views = this.#views();
    const next = this.#chain.next.map(({ strip, pane }) => ({
      strip: snapped(strip, ratio),
      pane,
    }));
    const phases = chainPhases(this.#chain.first, next, (pane) =>
      snapped(views[pane].scrollDOM, ratio),
    );
    for (const pane of this.#panes) {
      writePhase(this.#hosts[pane].style, phases.get(pane) ?? null);
    }
  }

  destroy(): void {
    this.#observer.disconnect();
    this.#resolution.removeEventListener("change", this.#resolutionChanged);
    for (const pane of this.#panes) {
      writePhase(this.#hosts[pane].style, null);
    }
  }
}

export class WavePhases extends ChainPhases<Pane> {
  constructor(hosts: WaveHosts, views: () => MeasuredPanes) {
    const [local, remote] = hosts.strips;
    super(mergeChain({ local, remote }), hosts, views);
  }
}
