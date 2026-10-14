import { expect, test } from "vitest";

import {
  bandPath,
  waveCenterY,
  waveJoinPath,
  waveTile,
  WAVE_TILE_HEIGHT_PX,
  WAVE_TILE_WIDTH_PX,
} from ".";

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
  expect(waveTile()).toBe("M0 1 Q2.5 1 5 4 Q7.5 7 10 7 Q12.5 7 15 4 Q17.5 1 20 1");
  expect([WAVE_TILE_WIDTH_PX, WAVE_TILE_HEIGHT_PX]).toEqual([20, 8]);
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
