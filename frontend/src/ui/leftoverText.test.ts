import { expect, test } from "vitest";

import type { Leftover } from "../ipc";
import { leftoverText } from "./leftoverText";

const DEVELOP = { kind: "branch", name: "develop" } as const;
const COMMIT = { kind: "commit", id: "9b0d4e1" } as const;

test.each<[Leftover, string]>([
  [
    { kind: "notReturned", to: DEVELOP },
    "HEAD moved after the merge started, so yamt did not check out develop again.",
  ],
  [
    { kind: "notReturned", to: COMMIT },
    "HEAD moved after the merge started, so yamt did not check out commit 9b0d4e1 again.",
  ],
  [
    {
      kind: "returnRefused",
      to: DEVELOP,
      message: "error: your local changes would be overwritten",
    },
    "git did not check out develop again: error: your local changes would be overwritten",
  ],
  [
    { kind: "returnRefused", to: COMMIT, message: "fatal: reference is not a tree" },
    "git did not check out commit 9b0d4e1 again: fatal: reference is not a tree",
  ],
  [
    { kind: "branchKept", branch: "feature/due-dates" },
    "feature/due-dates changed after the merge started, so yamt left it as it is.",
  ],
  [
    { kind: "branchCheckedOut", branch: "feature/due-dates" },
    "feature/due-dates is still checked out, so yamt did not delete it.",
  ],
  [
    { kind: "branchRefused", branch: "feature/due-dates", message: "error: cannot lock ref" },
    "git did not put feature/due-dates back: error: cannot lock ref",
  ],
])("%j reads as the one sentence for it", (leftover, sentence) => {
  expect(leftoverText(leftover)).toBe(sentence);
});
