import { expect, test } from "vitest";

import {
  collapseRows,
  countColours,
  feedFrames,
  frameBytes,
  framesWithMatch,
  parseColour,
} from "./colours";

const DARK = parseColour("26282c");
const LIGHT = parseColour("#E9EAEE");

function pixels(...colours: readonly (readonly [number, number, number])[]): Uint8Array {
  return Uint8Array.from(colours.flat());
}

test("a colour is six hex digits, with or without #, any case", () => {
  expect(DARK).toEqual({ hex: "26282c", rgb: 0x26282c });
  expect(LIGHT).toEqual({ hex: "e9eaee", rgb: 0xe9eaee });
  expect(() => parseColour("e9eae")).toThrow(/not a colour/);
  expect(() => parseColour("e9eaeeff")).toThrow(/not a colour/);
  expect(() => parseColour("g9eaee")).toThrow(/not a colour/);
});

test("only exact pixels count; one step off in any channel does not", () => {
  const frame = pixels(
    [0x26, 0x28, 0x2c],
    [0x27, 0x28, 0x2c],
    [0x26, 0x29, 0x2c],
    [0x26, 0x28, 0x2d],
    [0x26, 0x28, 0x2c],
    [0xe9, 0xea, 0xee],
  );
  expect(countColours(frame, [DARK, LIGHT])).toEqual([2, 1]);
});

test("a colour straddling two pixels is not a match", () => {
  const frame = pixels([0x00, 0x26, 0x28], [0x2c, 0x00, 0x00]);
  expect(countColours(frame, [DARK])).toEqual([0]);
});

test("frames split across chunks, mid-pixel, keep each frame's own counts", () => {
  const frameSize = frameBytes(2, 1);
  const frame0 = pixels([0, 0, 0], [0x26, 0x28, 0x2c]);
  const frame1 = pixels([0x26, 0x28, 0x2c], [0, 0, 0]);
  const frame2 = pixels([0, 0, 0], [0, 0, 0]);
  const stream = Uint8Array.from([...frame0, ...frame1, ...frame2]);
  const chunks = [
    stream.subarray(0, 4),
    stream.subarray(4, 7),
    stream.subarray(7, 13),
    stream.subarray(13),
  ];
  const buffer = new Uint8Array(frameSize);
  const perFrame: number[][] = [];
  let filled = 0;
  for (const chunk of chunks) {
    filled = feedFrames(buffer, filled, chunk, (full) => perFrame.push(countColours(full, [DARK])));
  }
  expect(perFrame).toEqual([[1], [1], [0]]);
  expect(filled).toBe(0);
});

test("feedFrames returns the bytes of an unfinished frame and hands over only whole ones", () => {
  const buffer = new Uint8Array(frameBytes(1, 1));
  const frames: number[][] = [];
  function keep(full: Uint8Array): void {
    frames.push([...full]);
  }
  let filled = feedFrames(buffer, 0, Uint8Array.from([1, 2, 3, 4, 5]), keep);
  expect(frames).toEqual([[1, 2, 3]]);
  expect(filled).toBe(2);
  filled = feedFrames(buffer, filled, Uint8Array.from([6]), keep);
  expect(frames).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
  expect(filled).toBe(0);
});

test("consecutive equal rows collapse into one inclusive frame range; equal rows apart stay apart", () => {
  const rows = collapseRows([
    [0, 0],
    [0, 0],
    [3, 1],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  expect(rows).toEqual([
    { first: 0, last: 1, counts: [0, 0] },
    { first: 2, last: 2, counts: [3, 1] },
    { first: 3, last: 5, counts: [0, 0] },
  ]);
  expect(collapseRows([])).toEqual([]);
});

test("framesWithMatch counts frames with at least one pixel of that colour", () => {
  const perFrame = [
    [0, 5],
    [1, 0],
    [0, 0],
    [2, 2],
  ];
  expect(framesWithMatch(perFrame, 0)).toBe(2);
  expect(framesWithMatch(perFrame, 1)).toBe(2);
});
