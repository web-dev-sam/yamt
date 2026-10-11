import { expect, test } from "vitest";

import type { RemoteName } from "../ipc";
import { sideHeader } from "./sideHeaders";

const COMMIT: RemoteName = {
  kind: "Commit",
  short_id: "1a2b3c4",
  subject: "Fix parser crash",
  message: "Fix parser crash\n\nThe lexer read past the end of the input.",
};

test("the left header is the same whatever is merged in", () => {
  const local = { text: "Local (yours)", tooltip: "Local (yours)" };

  expect(sideHeader("local", null)).toEqual(local);
  expect(sideHeader("local", COMMIT)).toEqual(local);
});

test("a branch names the right header, the same text on hover", () => {
  expect(sideHeader("remote", { kind: "Branch", name: "minor" })).toEqual({
    text: "Remote (theirs): minor",
    tooltip: "Remote (theirs): minor",
  });
});

test("a commit shows its short id and subject; hovering shows the full message", () => {
  expect(sideHeader("remote", COMMIT)).toEqual({
    text: "Remote (theirs): 1a2b3c4 Fix parser crash",
    tooltip: "Fix parser crash\n\nThe lexer read past the end of the input.",
  });
});

test("no name leaves the plain right header", () => {
  expect(sideHeader("remote", null)).toEqual({
    text: "Remote (theirs)",
    tooltip: "Remote (theirs)",
  });
});
