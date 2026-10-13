import { expect, test } from "vitest";

import { DEFAULT_KEYS, parseKey, type Key } from "../../ipc";
import { sideKeyCommands } from "./sideKeys";

const LINUX = "Linux x86_64";

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

test("a focused side applies with Enter and Space, ignores with Backspace (macOS Delete), Delete and x, and moves with the arrows", () => {
  expect(sideKeyCommands(DEFAULT_KEYS, LINUX)).toEqual([
    { key: "Enter", command: { kind: "decide", decision: "apply" } },
    { key: "Space", command: { kind: "decide", decision: "apply" } },
    { key: "Backspace", command: { kind: "decide", decision: "ignore" } },
    { key: "Delete", command: { kind: "decide", decision: "ignore" } },
    { key: "x", command: { kind: "decide", decision: "ignore" } },
    { key: "ArrowDown", command: { kind: "step", direction: "down" } },
    { key: "ArrowUp", command: { kind: "step", direction: "up" } },
    { key: "ArrowLeft", command: { kind: "toward", side: "local" } },
    { key: "ArrowRight", command: { kind: "toward", side: "remote" } },
  ]);
});

test("Apply rebound to a: a applies and Enter is bound to nothing", () => {
  const commands = sideKeyCommands({ ...DEFAULT_KEYS, apply: [key("a")] }, LINUX);

  expect(commands.filter(({ key: name }) => name === "a")).toEqual([
    { key: "a", command: { kind: "decide", decision: "apply" } },
  ]);
  expect(commands.some(({ key: name }) => name === "Enter" || name === "Space")).toBe(false);
});

test("a side action without keys binds nothing, and a macOS-only key is not bound on Linux", () => {
  const commands = sideKeyCommands(
    { ...DEFAULT_KEYS, ignore: [], "next-change": [key("MacCtrl-n")] },
    LINUX,
  );

  expect(commands.map(({ key: name }) => name)).toEqual([
    "Enter",
    "Space",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
  ]);
  expect(
    sideKeyCommands({ ...DEFAULT_KEYS, "next-change": [key("MacCtrl-n")] }, "MacIntel").find(
      ({ key: name }) => name === "Ctrl-n",
    ),
  ).toEqual({ key: "Ctrl-n", command: { kind: "step", direction: "down" } });
});
