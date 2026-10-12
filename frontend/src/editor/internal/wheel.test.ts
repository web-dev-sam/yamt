import { expect, test } from "vitest";

import type { Direction } from "./navigation";
import { WHEEL_IDLE_MS, WHEEL_STEP_PX, wheelStep, type WheelSum } from "./wheel";

const PIXEL = 0;
const LINE = 1;
const PAGE = 2;

type Tick = { deltaY: number; at: number; deltaMode?: number; deltaX?: number };

function steps(ticks: readonly Tick[]): (Direction | null)[] {
  let sum: WheelSum = null;
  return ticks.map(({ deltaY, at, deltaMode = PIXEL, deltaX = 0 }) => {
    const result = wheelStep(sum, { deltaMode, deltaX, deltaY, timeStamp: at });
    sum = result.sum;
    return result.step;
  });
}

test("line and page wheels step once per event", () => {
  expect(
    steps([
      { deltaY: 3, at: 0, deltaMode: LINE },
      { deltaY: 3, at: 10, deltaMode: LINE },
      { deltaY: -1, at: 20, deltaMode: PAGE },
    ]),
  ).toEqual(["down", "down", "up"]);
});

test("in pixels the first event of a burst steps, the next one only after WHEEL_STEP_PX more", () => {
  expect(
    steps([
      { deltaY: 4, at: 0 },
      { deltaY: WHEEL_STEP_PX - 10, at: 16 },
      { deltaY: 9, at: 32 },
      { deltaY: 1, at: 48 },
      { deltaY: 50, at: 64 },
    ]),
  ).toEqual(["down", null, null, "down", null]);
});

test("a direction flip and an idle gap both start a new burst that steps at once", () => {
  expect(
    steps([
      { deltaY: 10, at: 0 },
      { deltaY: -10, at: 16 },
      { deltaY: -10, at: 32 },
      { deltaY: -10, at: 32 + WHEEL_IDLE_MS + 1 },
      { deltaY: -10, at: 48 + WHEEL_IDLE_MS },
    ]),
  ).toEqual(["down", "up", null, "up", null]);
});

test("one 500 px event gives one step, not five", () => {
  expect(steps([{ deltaY: 500, at: 0 }])).toEqual(["down"]);
  expect(
    steps([
      { deltaY: 10, at: 0 },
      { deltaY: 500, at: 16 },
      { deltaY: 10, at: 32 },
    ]),
  ).toEqual(["down", "down", null]);
});

test("WebKitGTK's X11 mouse notches of 96 px step once each, also inside one fast burst", () => {
  const X11_NOTCH_PX = 96;

  expect(
    steps([
      { deltaY: X11_NOTCH_PX, at: 0 },
      { deltaY: X11_NOTCH_PX, at: 16 },
      { deltaY: X11_NOTCH_PX, at: 32 },
    ]),
  ).toEqual(["down", "down", "down"]);
});

test("events that scroll more sideways than up or down never step", () => {
  expect(
    steps([
      { deltaY: 10, deltaX: 40, at: 0 },
      { deltaY: 0, deltaX: 0, at: 16, deltaMode: LINE },
      { deltaY: -3, deltaX: -4, at: 32, deltaMode: LINE },
    ]),
  ).toEqual([null, null, null]);
});
