import { expect, test } from "vitest";

import { wavePhase } from "../../connectors";
import { paneEnds, panePhases, phaseStyle, writePhase, type WaveLayout } from "./wavePhase";

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

function fakeStyle(): { style: Parameters<typeof writePhase>[0]; writes: string[] } {
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
