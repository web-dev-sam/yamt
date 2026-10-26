import { expect, test } from "vitest";

import {
  fromAgentCommand,
  toAgentStartReply,
  toCheckoutChanges,
  toCheckoutReady,
} from "./agentDomain";
import type * as Generated from "./bindings";

test("the command goes out in the app's shape", () => {
  expect(fromAgentCommand({ program: "omp", args: ["acp"], homeFolders: [".bun/bin"] })).toEqual({
    program: "omp",
    args: ["acp"],
    home_folders: [".bun/bin"],
  });
});

test("a start brands its run; the other replies come back as they are", () => {
  expect(toAgentStartReply({ kind: "Started", run: 0 })).toEqual({ kind: "Started", run: 0 });
  expect(toAgentStartReply({ kind: "NoCheckout" })).toEqual({ kind: "NoCheckout" });
  expect(() => toAgentStartReply({ kind: "Started", run: 1.5 })).toThrow(
    "run must be a non-negative safe integer, got 1.5",
  );
});

test("a ready checkout brands its folder", () => {
  expect(toCheckoutReady({ kind: "Ready", folder: "/c" })).toEqual({ kind: "Ready", folder: "/c" });
  expect(toCheckoutReady({ kind: "Failed", message: "no git" })).toEqual({
    kind: "Failed",
    message: "no git",
  });
});

test("a changed checkout comes out camelCased, its short ref names split into branches and the stash", () => {
  expect(
    toCheckoutChanges({
      kind: "Changed",
      folder: "/c",
      files: [],
      refs: ["fix", "stash", "heads/stash"],
      head_moved: false,
    }),
  ).toEqual({
    kind: "Changed",
    folder: "/c",
    files: [],
    refs: { branches: ["fix", "heads/stash"], stash: true },
    headMoved: false,
  });
});

test("without a stash name the refs are only branches", () => {
  const look = toCheckoutChanges({
    kind: "Changed",
    folder: "/c",
    files: ["a"],
    refs: ["ai"],
    head_moved: true,
  });

  expect(look.kind === "Changed" && look.refs).toEqual({ branches: ["ai"], stash: false });
});

test.each<Generated.CheckoutLook>([
  { kind: "Changed", folder: "c", files: ["a"], refs: [], head_moved: false },
  { kind: "Unreadable", folder: "c", message: "m" },
])("a $kind look with a relative folder is refused", (look) => {
  expect(() => toCheckoutChanges(look)).toThrow("folder must be an absolute path, got c");
});
