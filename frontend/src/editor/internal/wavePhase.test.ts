import { expect, test, vi } from "vitest";

import { wavePhase } from "../../connectors";
import { layoutOf, paneEnds, panePhases, phaseStyle, writePhase, WavePhases } from "./wavePhase";
import type { WaveHosts, WaveLayout } from "./wavePhase";

const LAYOUT: WaveLayout = {
  scrollers: {
    left: { left: 260.4, right: 699.4 },
    center: { left: 739.4, right: 1178.4 },
    right: { left: 1218.4, right: 1657.4 },
  },
  strips: { local: { left: 700.4, right: 738.4 }, remote: { left: 1179.4, right: 1217.4 } },
};

function shifted(layout: WaveLayout, by: number): WaveLayout {
  function move({ left, right }: { left: number; right: number }): { left: number; right: number } {
    return { left: left + by, right: right + by };
  }
  const { scrollers, strips } = layout;
  return {
    scrollers: {
      left: move(scrollers.left),
      center: move(scrollers.center),
      right: move(scrollers.right),
    },
    strips: { local: move(strips.local), remote: move(strips.remote) },
  };
}

type FakeStyle = { style: Parameters<typeof writePhase>[0]; writes: string[] };
type Rect = { left: number; right: number };

function fakeStyle(): FakeStyle {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
    writes,
    style: {
      getPropertyValue: (name) => values.get(name) ?? "",
      setProperty: (name, value) => {
        writes.push(`${name}: ${value ?? ""}`);
        values.set(name, value ?? "");
      },
      removeProperty: (name) => {
        writes.push(`${name} removed`);
        values.delete(name);
        return "";
      },
    },
  };
}

test("each pane meets the strip edges next to it: the left leaves, the middle enters and leaves, the right enters", () => {
  expect(paneEnds(LAYOUT.strips)).toEqual({
    left: { kind: "leaves", at: 700.4 },
    center: { kind: "through", enters: 738.4, leaves: 1179.4 },
    right: { kind: "enters", at: 1217.4 },
  });
});

test("the phases come from the scrollers' left edges and the strips' edges", () => {
  expect(panePhases(LAYOUT)).toEqual({
    left: wavePhase(260.4, { kind: "leaves", at: 700.4 }),
    center: wavePhase(739.4, { kind: "through", enters: 738.4, leaves: 1179.4 }),
    right: wavePhase(1218.4, { kind: "enters", at: 1217.4 }),
  });
});

test("a pane whose text stops 15 px short of its strip has the same phases", () => {
  const { scrollers } = LAYOUT;
  const scrollbars: WaveLayout = {
    ...LAYOUT,
    scrollers: {
      left: { ...scrollers.left, right: scrollers.left.right - 15 },
      center: { ...scrollers.center, right: scrollers.center.right - 15 },
      right: { ...scrollers.right, right: scrollers.right.right - 15 },
    },
  };

  expect(panePhases(scrollbars)).toEqual(panePhases(LAYOUT));
});

test("a layout moved as a whole keeps every offset", () => {
  const before = panePhases(LAYOUT);
  for (const by of [-260.4, 0.37, 333.3]) {
    const after = panePhases(shifted(LAYOUT, by));
    for (const pane of ["left", "center", "right"] as const) {
      expect(after[pane]?.offset).toBeCloseTo(before[pane]?.offset ?? NaN, 9);
      expect(after[pane]?.period).toBeCloseTo(before[pane]?.period ?? NaN, 9);
    }
  }
});

test("a phase is written as two pixel lengths", () => {
  expect(phaseStyle({ offset: 7.5, period: 19.25 })).toEqual({
    offset: "7.5px",
    period: "19.25px",
  });
});

test("a phase is written only when it changed, and removed when the pane has none", () => {
  const { style, writes } = fakeStyle();

  writePhase(style, { offset: 7.5, period: 20 });
  writePhase(style, { offset: 7.5, period: 20 });
  writePhase(style, { offset: 3, period: 20 });
  writePhase(style, null);

  expect(writes).toEqual([
    "--fold-wave-x: 7.5px",
    "--fold-wave-period: 20px",
    "--fold-wave-x: 3px",
    "--fold-wave-x removed",
    "--fold-wave-period removed",
  ]);
});

function measured(left: number, right: number): { getBoundingClientRect: () => Rect } {
  return { getBoundingClientRect: () => ({ left, right }) };
}

type FakeObserver = { observed: unknown[]; disconnected: boolean; resize: () => void };
type FakeQuery = { media: string; listeners: Set<() => void> };
type FakeDom = { observers: FakeObserver[]; queries: FakeQuery[]; styles: FakeStyle[] };

function fakeDom(ratio: number): FakeDom {
  const dom: FakeDom = { observers: [], queries: [], styles: [] };
  vi.stubGlobal("devicePixelRatio", ratio);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly observed: unknown[] = [];
      disconnected = false;
      readonly resize: () => void;
      constructor(callback: () => void) {
        this.resize = callback;
        dom.observers.push(this);
      }
      observe(target: unknown): void {
        this.observed.push(target);
      }
      disconnect(): void {
        this.disconnected = true;
      }
    },
  );
  vi.stubGlobal("matchMedia", (media: string) => {
    const listeners = new Set<() => void>();
    dom.queries.push({ media, listeners });
    return {
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
  });
  vi.stubGlobal(
    "HTMLElement",
    class {
      readonly style: FakeStyle["style"];
      constructor() {
        const faked = fakeStyle();
        dom.styles.push(faked);
        this.style = faked.style;
      }
    },
  );
  vi.stubGlobal("Element", class {});
  return dom;
}

function fakeHosts(local: Rect, remote: Rect): WaveHosts {
  return {
    left: new HTMLElement(),
    center: new HTMLElement(),
    right: new HTMLElement(),
    strips: [
      Object.assign(new Element(), measured(local.left, local.right)),
      Object.assign(new Element(), measured(remote.left, remote.right)),
    ],
  };
}

test("the layout is read from each pane's scroller and the strips in order, local first", () => {
  const views = {
    left: { dom: measured(250, 700), scrollDOM: measured(260, 699) },
    center: { dom: measured(738, 1179), scrollDOM: measured(739, 1178) },
    right: { dom: measured(1217, 1658), scrollDOM: measured(1218, 1657) },
  };

  expect(layoutOf(views, [measured(700, 738), measured(1179, 1217)], 1)).toEqual({
    scrollers: {
      left: { left: 260, right: 699 },
      center: { left: 739, right: 1178 },
      right: { left: 1218, right: 1657 },
    },
    strips: { local: { left: 700, right: 738 }, remote: { left: 1179, right: 1217 } },
  });
});

test("every edge is snapped to the device pixels of the ratio", () => {
  const edge = measured(428.65625, 808.328125);
  const views = {
    left: { scrollDOM: edge },
    center: { scrollDOM: edge },
    right: { scrollDOM: edge },
  };
  const snapped = [1, 1.25, 2].map((ratio) => layoutOf(views, [edge, edge], ratio));

  expect(snapped.map(({ scrollers, strips }) => [scrollers, strips])).toEqual(
    [
      { left: 429, right: 808 },
      { left: 428.8, right: 808 },
      { left: 428.5, right: 808.5 },
    ].map((each) => [
      { left: each, center: each, right: each },
      { local: each, remote: each },
    ]),
  );
});

test("a change of resolution measures again at the new ratio and watches for the next change", () => {
  const dom = fakeDom(1);
  const hosts = fakeHosts(
    { left: 389.65625, right: 427.65625 },
    { left: 809.328125, right: 847.328125 },
  );
  const views = {
    left: { scrollDOM: measured(9, 388.65625) },
    center: { scrollDOM: measured(428.65625, 808.328125) },
    right: { scrollDOM: measured(848.328125, 1228) },
  };
  const phases = new WavePhases(hosts, () => views);
  function centerPhase(): string[] {
    return [
      hosts.center.style.getPropertyValue("--fold-wave-x"),
      hosts.center.style.getPropertyValue("--fold-wave-period"),
    ];
  }
  function expected(ratio: number): string[] {
    const phase = panePhases(layoutOf(views, hosts.strips, ratio)).center;
    return phase === null ? [] : Object.values(phaseStyle(phase));
  }

  dom.observers[0]?.resize();
  const atOne = centerPhase();
  vi.stubGlobal("devicePixelRatio", 2);
  for (const listener of dom.queries[0]?.listeners ?? []) {
    listener();
  }
  const atTwo = centerPhase();
  const watched = dom.queries.map(({ media, listeners }) => [media, listeners.size]);
  phases.destroy();
  const afterDestroy = dom.queries.map(({ listeners }) => listeners.size);
  vi.unstubAllGlobals();

  expect(atOne).toEqual(expected(1));
  expect(atTwo).toEqual(expected(2));
  expect(atTwo).not.toEqual(atOne);
  expect(watched).toEqual([
    ["(resolution: 1dppx)", 0],
    ["(resolution: 2dppx)", 1],
  ]);
  expect(afterDestroy).toEqual([0, 0]);
});

test("destroying the phases stops observing and removes both properties from every pane", () => {
  const dom = fakeDom(1);
  const hosts = fakeHosts({ left: 700, right: 738 }, { left: 1179, right: 1217 });
  const phases = new WavePhases(hosts, () => {
    throw new Error("no resize in this test");
  });
  for (const pane of ["left", "center", "right"] as const) {
    writePhase(hosts[pane].style, { offset: 7.5, period: 20 });
  }

  phases.destroy();
  vi.unstubAllGlobals();

  expect(dom.observers.map(({ observed, disconnected }) => ({ observed, disconnected }))).toEqual([
    { observed: [hosts.left, hosts.center, hosts.right], disconnected: true },
  ]);
  expect(dom.styles.map(({ writes }) => writes.slice(2))).toEqual(
    Array.from({ length: 3 }, () => ["--fold-wave-x removed", "--fold-wave-period removed"]),
  );
});
