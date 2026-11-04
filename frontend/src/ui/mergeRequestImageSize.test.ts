import { expect, test } from "vitest";

import { imageStyle } from "./mergeRequestImageSize";

const PICTURE = { width: 48, height: 24 };
const UNMEASURED = { width: 0, height: 0 };

function pixels(value: number): { readonly kind: "pixels"; readonly value: number } {
  return { kind: "pixels", value };
}

function percent(value: number): { readonly kind: "percent"; readonly value: number } {
  return { kind: "percent", value };
}

test("an image without a size keeps its own size under the cap", () => {
  expect(imageStyle(null, null)).toEqual({ height: "auto", maxWidth: "100%" });
  expect(imageStyle(null, PICTURE)).toEqual({ height: "auto", maxWidth: "100%" });
});

test("a_width_keeps_the_pictures_proportions_and_the_cap", () => {
  const style = { width: "120px", height: "auto", maxWidth: "100%" };
  expect(imageStyle({ kind: "width", width: pixels(120) }, null)).toEqual(style);
  expect(imageStyle({ kind: "width", width: pixels(120) }, PICTURE)).toEqual(style);
});

test("a_percent_width_is_of_the_column_and_never_over_100", () => {
  expect(imageStyle({ kind: "width", width: percent(40) }, null)).toEqual({
    width: "40%",
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle({ kind: "width", width: percent(100) }, null)).toMatchObject({
    width: "100%",
  });
  expect(imageStyle({ kind: "width", width: percent(250) }, null)).toMatchObject({
    width: "100%",
  });
});

test("a_height_alone_scales_the_width_once_loaded", () => {
  const size = { kind: "height", height: pixels(60) } as const;
  expect(imageStyle(size, null)).toEqual({ height: "60px" });
  expect(imageStyle(size, PICTURE)).toEqual({ width: "120px", height: "auto", maxWidth: "100%" });
  expect(imageStyle(size, { width: 30, height: 40 })).toEqual({
    width: "45px",
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle(size, UNMEASURED)).toEqual({ height: "60px" });
});

test("both_keep_their_ratio", () => {
  const style = { width: "160px", aspectRatio: "160 / 80", height: "auto", maxWidth: "100%" };
  const size = { kind: "both", width: pixels(160), height: pixels(80) } as const;
  expect(imageStyle(size, null)).toEqual(style);
  expect(imageStyle(size, PICTURE)).toEqual(style);

  const wide = { kind: "both", width: percent(150), height: pixels(80) } as const;
  expect(imageStyle(wide, null)).toEqual({ width: "100%", height: "auto", maxWidth: "100%" });
  expect(imageStyle(wide, PICTURE)).toEqual({
    width: "100%",
    aspectRatio: "48 / 24",
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle({ ...wide, width: percent(30) }, UNMEASURED)).toEqual({
    width: "30%",
    height: "auto",
    maxWidth: "100%",
  });
});

test("a_percent_height_is_ignored", () => {
  expect(imageStyle({ kind: "height", height: percent(50) }, PICTURE)).toEqual({
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle({ kind: "both", width: pixels(90), height: percent(50) }, PICTURE)).toEqual({
    width: "90px",
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle({ kind: "both", width: percent(20), height: percent(50) }, null)).toEqual({
    width: "20%",
    height: "auto",
    maxWidth: "100%",
  });
});

test("a_size_wider_than_the_column_shrinks_with_its_proportions", () => {
  expect(imageStyle({ kind: "width", width: pixels(4000) }, PICTURE)).toEqual({
    width: "4000px",
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle({ kind: "both", width: pixels(4000), height: pixels(2000) }, null)).toEqual({
    width: "4000px",
    aspectRatio: "4000 / 2000",
    height: "auto",
    maxWidth: "100%",
  });
  expect(imageStyle({ kind: "height", height: pixels(3000) }, PICTURE)).toEqual({
    width: "6000px",
    height: "auto",
    maxWidth: "100%",
  });
});
