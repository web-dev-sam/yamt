import { expect, test } from "vitest";

import { basicColour, type AnsiColour } from "../index";

test("the_first_sixteen_are_themselves", () => {
  expect(Array.from({ length: 16 }, (_, index) => basicColour(index))).toEqual([
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "brightBlack",
    "brightRed",
    "brightGreen",
    "brightYellow",
    "brightBlue",
    "brightMagenta",
    "brightCyan",
    "brightWhite",
  ]);
});

test.each<[number, AnsiColour]>([
  [16, "black"],
  [21, "blue"],
  [28, "green"],
  [46, "brightGreen"],
  [124, "red"],
  [196, "brightRed"],
  [208, "yellow"],
  [226, "brightYellow"],
  [231, "brightWhite"],
  [232, "black"],
  [244, "brightBlack"],
  [250, "white"],
  [255, "white"],
  [39, "cyan"],
  [94, "red"],
  [135, "brightBlue"],
  [201, "brightMagenta"],
  [51, "brightCyan"],
  [37, "cyan"],
  [90, "magenta"],
])("a_256_colour_is_its_nearest_basic_one (%i is %s)", (index, colour) => {
  expect(basicColour(index)).toBe(colour);
});

test("a_tie_goes_to_the_lower_index (249, gray 178, is as near white 229 as bright black 127)", () => {
  expect(basicColour(249)).toBe("white");
});

test.each([-1, 256, 1.5, Number.NaN])("anything_else_is_no_colour (%s)", (index) => {
  expect(basicColour(index)).toBeNull();
});
