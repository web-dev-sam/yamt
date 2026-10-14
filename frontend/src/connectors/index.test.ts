import { expect, test } from "vitest";

import {
  bandPath,
  waveCenterY,
  waveJoinPath,
  wavePhase,
  waveTile,
  MASK_PERIODS,
  WAVE_DOWN_X,
  WAVE_TILE_HEIGHT_PX,
  WAVE_TILE_WIDTH_PX,
  WAVE_UP_X,
  type WavePhase,
} from ".";

type Point = readonly [x: number, y: number];
type Segment = { readonly command: string; readonly from: Point; readonly points: Point[] };

function segments(path: string): Segment[] {
  const [move = "", ...rest] = path.split(/ (?=[QC])/);
  const [startX = NaN, startY = NaN] = move.slice(1).split(" ").map(Number);
  let from: Point = [startX, startY];
  return rest.map((piece) => {
    const numbers = piece.slice(1).split(" ").map(Number);
    const points = Array.from({ length: numbers.length / 2 }, (_, i): Point => [
      numbers[2 * i] ?? NaN,
      numbers[2 * i + 1] ?? NaN,
    ]);
    const segment = { command: piece.charAt(0), from, points };
    from = points.at(-1) ?? from;
    return segment;
  });
}

function crossings(path: string, centre: number): [x: number, heading: "down" | "up"][] {
  return segments(path).flatMap(({ command, from, points }) => {
    expect(command).toBe("Q");
    const [[cx, cy], [x2, y2]] = [points[0] ?? from, points[1] ?? from];
    const [x0, y0] = from;
    const a = y0 - 2 * cy + y2;
    const b = 2 * (cy - y0);
    const c = y0 - centre;
    const roots =
      a === 0
        ? [-c / b]
        : [-1, 1].map((sign) => (-b + sign * Math.sqrt(b * b - 4 * a * c)) / (2 * a));
    return [...new Set(roots)]
      .filter((t) => t > 0 && t <= 1)
      .map((t): [number, "down" | "up"] => [
        (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x2,
        2 * a * t + b > 0 ? "down" : "up",
      ]);
  });
}

function tileX(x: number, phase: WavePhase): number {
  const into = x - phase.offset;
  return (
    ((into - phase.period * Math.floor(into / phase.period)) * WAVE_TILE_WIDTH_PX) / phase.period
  );
}

function driftPx(x: number, phase: WavePhase, wantedTileX: number): number {
  return (Math.abs(tileX(x, phase) - wantedTileX) * phase.period) / WAVE_TILE_WIDTH_PX;
}

function sweep(step: number, to: number): number[] {
  return Array.from({ length: Math.floor(to / step) + 1 }, (_, i) => i * step);
}

const WAVE_LEFTS = [0, 0.4, 237.33];
const DISTANCES = sweep(0.37, 2000);

test("an aligned band is a rectangle drawn with flat curves", () => {
  const band = { left: { top: 0, bottom: 20 }, right: { top: 0, bottom: 20 } };

  expect(bandPath(band, 40)).toBe("M0 0 C20 0 20 0 40 0 L40 20 C20 20 20 20 0 20 Z");
});

test("a band whose right side is lower curves down with control points at half the width", () => {
  const band = { left: { top: 10, bottom: 30 }, right: { top: 50, bottom: 90 } };

  expect(bandPath(band, 40)).toBe("M0 10 C20 10 20 50 40 50 L40 90 C20 90 20 30 0 30 Z");
});

test("an insertion on the left tapers the band to a point on the left edge", () => {
  const band = { left: { top: 40, bottom: 40 }, right: { top: 40, bottom: 100 } };

  expect(bandPath(band, 40)).toBe("M0 40 C20 40 20 40 40 40 L40 100 C20 100 20 40 0 40 Z");
});

test("an insertion on the right tapers to the right edge, at fractional line heights", () => {
  const lineHeight = 18.2;
  const band = {
    left: { top: lineHeight, bottom: lineHeight * 3 },
    right: { top: lineHeight * 2, bottom: lineHeight * 2 },
  };

  expect(bandPath(band, 39)).toBe(
    "M0 18.2 C19.5 18.2 19.5 36.4 39 36.4 L39 36.4 C19.5 36.4 19.5 54.6 0 54.6 Z",
  );
});

test("the wave tile is four quarter curves of 5 px with a 3 px half-height, 1 px from the tile edge", () => {
  expect(waveTile(1)).toBe("M0 1 Q2.5 1 5 4 Q7.5 7 10 7 Q12.5 7 15 4 Q17.5 1 20 1");
  expect([WAVE_TILE_WIDTH_PX, WAVE_TILE_HEIGHT_PX]).toEqual([20, 8]);
});

test("a tile of several waves repeats the four curves every 20 px in one stroke", () => {
  expect(waveTile(2)).toBe(
    "M0 1 Q2.5 1 5 4 Q7.5 7 10 7 Q12.5 7 15 4 Q17.5 1 20 1 Q22.5 1 25 4 Q27.5 7 30 7 Q32.5 7 35 4 Q37.5 1 40 1",
  );
});

test("the wave sits in the middle of a 20 px line", () => {
  expect(waveCenterY(20)).toBe(10);
  expect(waveCenterY(30)).toBe(15);
});

test("a level join wider than five steps is six half-waves through the middle", () => {
  expect(waveJoinPath({ left: 10, right: 12 }, 38)).toBe(
    "M0 10 Q2.5 13 5 13 Q7.5 13 10 11 Q12.5 8 19 8 Q25.5 8 28 11 Q30.5 15 33 15 Q35.5 15 38 12",
  );
  expect(waveJoinPath({ left: 10, right: 10 }, 26)).toBe(
    "M0 10 Q2.5 13 5 13 Q7.5 13 10 10 Q12.5 7 13 7 Q13.5 7 16 10 Q18.5 13 21 13 Q23.5 13 26 10",
  );
});

test("a level join of five steps or fewer is one sagging curve", () => {
  expect(waveJoinPath({ left: 10, right: 12 }, 20)).toBe("M0 10 Q10 17 20 12");
  expect(waveJoinPath({ left: 10, right: 10 }, 25)).toBe("M0 10 Q12.5 16 25 10");
});

test("a join falling to the right starts flat on the left and dips before the right end", () => {
  expect(waveJoinPath({ left: 50, right: 10 }, 38)).toBe(
    "M0 50 C0.63 50.38 0.63 51.5 2.5 51.5 C28 51.5 28 22 38 10",
  );
});

test("a join rising to the right dips after the left end and ends flat on the right", () => {
  expect(waveJoinPath({ left: 10, right: 50 }, 38)).toBe(
    "M0 10 C10 22 10 51.5 35.5 51.5 C37.38 51.5 37.38 50.38 38 50",
  );
});

test("a slope of exactly one in five is no longer level", () => {
  expect(waveJoinPath({ left: 0, right: 8 }, 40)).toBe(
    "M0 0 C10 12 10 9.5 37.5 9.5 C39.38 9.5 39.38 8.38 40 8",
  );
});

test("the tile crosses its centre line heading down at WAVE_DOWN_X and heading up at WAVE_UP_X", () => {
  const centre = WAVE_TILE_HEIGHT_PX / 2;

  expect(crossings(waveTile(3), centre)).toEqual([
    [WAVE_DOWN_X, "down"],
    [WAVE_UP_X, "up"],
    [WAVE_TILE_WIDTH_PX + WAVE_DOWN_X, "down"],
    [WAVE_TILE_WIDTH_PX + WAVE_UP_X, "up"],
    [2 * WAVE_TILE_WIDTH_PX + WAVE_DOWN_X, "down"],
    [2 * WAVE_TILE_WIDTH_PX + WAVE_UP_X, "up"],
  ]);
  expect([WAVE_DOWN_X, WAVE_UP_X]).toEqual([5, 15]);
});

test("every join leaves the left edge heading down and arrives at the right edge from below", () => {
  const joins = [
    { left: 10, right: 10 },
    { left: 10, right: 12 },
    { left: 50, right: 10 },
    { left: 10, right: 50 },
  ];
  const paths = [20, 38, 60].flatMap((width) => joins.map((join) => waveJoinPath(join, width)));
  const ends = paths.map((path) => {
    const parts = segments(path);
    const [, firstY] = parts[0]?.points[0] ?? [NaN, NaN];
    const [, lastControlY] = parts.at(-1)?.points.at(-2) ?? [NaN, NaN];
    const [, endY] = parts.at(-1)?.points.at(-1) ?? [NaN, NaN];
    const [, startY] = parts[0]?.from ?? [NaN, NaN];
    return { path, down: firstY > startY, fromBelow: lastControlY > endY };
  });

  expect(ends.filter(({ down, fromBelow }) => !down || !fromBelow)).toEqual([]);
  expect(new Set(paths.map((path) => segments(path).length))).toEqual(new Set([1, 2, 6]));
});

test("a wave leaving into a strip is on its centre heading down at the strip's edge", () => {
  expect(wavePhase(0, { kind: "leaves", at: 100 })).toEqual({ offset: 15, period: 20 });
  expect(wavePhase(110, { kind: "leaves", at: 100 })).toEqual({ offset: 5, period: 20 });
  const misses = WAVE_LEFTS.flatMap((waveLeft) =>
    DISTANCES.flatMap((distance) => {
      const at = waveLeft + distance;
      const phase = wavePhase(waveLeft, { kind: "leaves", at });
      const x = tileX(at - waveLeft, phase);
      const ok =
        Math.abs(x - WAVE_DOWN_X) < 1e-9 &&
        phase.period === 20 &&
        phase.offset >= 0 &&
        phase.offset < phase.period;
      return ok ? [] : [{ waveLeft, distance, phase }];
    }),
  );

  expect(misses).toEqual([]);
});

test("a wave entering from a strip is on its centre heading up at the strip's edge", () => {
  expect(wavePhase(0, { kind: "enters", at: 100 })).toEqual({ offset: 5, period: 20 });
  expect(wavePhase(110, { kind: "enters", at: 100 })).toEqual({ offset: 15, period: 20 });
  const misses = WAVE_LEFTS.flatMap((waveLeft) =>
    DISTANCES.flatMap((distance) => {
      const at = waveLeft + distance;
      const phase = wavePhase(waveLeft, { kind: "enters", at });
      const x = tileX(at - waveLeft, phase);
      const ok =
        Math.abs(x - WAVE_UP_X) < 1e-9 &&
        phase.period === 20 &&
        phase.offset >= 0 &&
        phase.offset < phase.period;
      return ok ? [] : [{ waveLeft, distance, phase }];
    }),
  );

  expect(misses).toEqual([]);
});

test("420 px between two strips hold 21.5 waves of 1250/64 px, pinned at the middle", () => {
  expect(wavePhase(0, { kind: "through", enters: 100, leaves: 520 })).toEqual({
    offset: 7.265625,
    period: 1250 / MASK_PERIODS,
  });
});

test("a wave between two strips holds the nearest whole number of waves plus a half, in a period the mask draws", () => {
  const misses = WAVE_LEFTS.flatMap((waveLeft) =>
    DISTANCES.filter((span) => span > 0).flatMap((span) => {
      const enters = waveLeft + 3.7;
      const phase = wavePhase(waveLeft, { kind: "through", enters, leaves: enters + span });
      const waves = Math.round(span / phase.period - 0.5) + 0.5;
      const ok =
        driftPx(enters - waveLeft, phase, WAVE_UP_X) <= waves / 256 + 1e-9 &&
        driftPx(enters + span - waveLeft, phase, WAVE_DOWN_X) <= waves / 256 + 1e-9 &&
        Number.isInteger(phase.period * MASK_PERIODS) &&
        Math.abs(waves - span / 20) <= 0.5 + 1e-9 &&
        Math.abs(phase.period - 20) / 20 <= 1 / (2 * waves) + 1 / (2 * MASK_PERIODS * 20) &&
        phase.offset >= 0 &&
        phase.offset < phase.period;
      return ok ? [] : [{ waveLeft, span, phase }];
    }),
  );

  expect(misses).toEqual([]);
});

test("a wave between strips a hair apart is drawn one mask pixel per 64 waves", () => {
  const phase = wavePhase(0, { kind: "through", enters: 100, leaves: 100.001 });

  expect(phase.period).toBe(1 / MASK_PERIODS);
  expect(phase.offset).toBeGreaterThanOrEqual(0);
  expect(phase.offset).toBeLessThan(phase.period);
});

test("a wave between two strips that do not leave room falls back to entering", () => {
  for (const leaves of [100, 70]) {
    expect(wavePhase(3, { kind: "through", enters: 100, leaves })).toEqual(
      wavePhase(3, { kind: "enters", at: 100 }),
    );
  }
});
