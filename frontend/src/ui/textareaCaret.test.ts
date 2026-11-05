import { expect, test } from "vitest";

import { mirrorStyle } from "./textareaCaret";

const COPIED = {
  direction: "rtl",
  "padding-top": "4px",
  "padding-right": "8px",
  "padding-bottom": "4px",
  "padding-left": "6px",
  "font-family": "Inter",
  "font-size": "13px",
  "font-style": "italic",
  "font-weight": "600",
  "font-variant-ligatures": "none",
  "font-feature-settings": '"tnum"',
  "font-kerning": "none",
  "line-height": "20px",
  "letter-spacing": "0.5px",
  "word-spacing": "2px",
  "tab-size": "4",
  "text-indent": "3px",
  "text-transform": "uppercase",
  "text-align": "right",
};
const IGNORED = {
  color: "red",
  "box-sizing": "border-box",
  "white-space": "nowrap",
  width: "300px",
  "border-left-width": "1px",
  "overflow-y": "auto",
};

test("the_mirror_copies_what_moves_a_glyph_and_wraps_like_the_field", () => {
  expect(mirrorStyle({ ...COPIED, ...IGNORED }, 314)).toEqual({
    ...COPIED,
    "box-sizing": "content-box",
    "white-space": "pre-wrap",
    "overflow-wrap": "break-word",
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    width: "300px",
  });
  expect(mirrorStyle({ "padding-left": "0.5px" }, 100)).toMatchObject({ width: "99.5px" });
});
