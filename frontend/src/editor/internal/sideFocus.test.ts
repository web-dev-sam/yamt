import { expect, test } from "vitest";

import { SIDE_KEYS } from "./sideFocus";

test("a focused side applies with Enter and Space, ignores with Backspace (macOS Delete), Delete and x, and moves with the arrows", () => {
  expect(SIDE_KEYS).toEqual({
    Enter: { kind: "decide", decision: "apply" },
    Space: { kind: "decide", decision: "apply" },
    Backspace: { kind: "decide", decision: "ignore" },
    Delete: { kind: "decide", decision: "ignore" },
    x: { kind: "decide", decision: "ignore" },
    ArrowDown: { kind: "step", direction: "down" },
    ArrowUp: { kind: "step", direction: "up" },
    ArrowLeft: { kind: "toward", side: "local" },
    ArrowRight: { kind: "toward", side: "remote" },
  });
});
