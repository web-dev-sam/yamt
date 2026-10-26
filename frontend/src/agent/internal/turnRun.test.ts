import { expect, test } from "vitest";

import { stopEnding } from "./turnRun";

test.each([
  ["end_turn", { kind: "finished" }],
  ["cancelled", { kind: "stopped" }],
  ["max_tokens", { kind: "failed", failure: { kind: "ended", reason: "max_tokens" } }],
  [
    "max_turn_requests",
    { kind: "failed", failure: { kind: "ended", reason: "max_turn_requests" } },
  ],
  ["refusal", { kind: "failed", failure: { kind: "ended", reason: "refusal" } }],
  ["something new", { kind: "failed", failure: { kind: "ended", reason: "something new" } }],
])("stopReason %s ends the turn as %j", (stopReason, ending) => {
  expect(stopEnding(stopReason)).toEqual(ending);
});
