import { expect, test } from "vitest";

import type { DescriptionReply } from "../ipc";
import {
  CLOSE_DESCRIPTION,
  DESCRIPTION_LOADING,
  descriptionRefusalText,
  IMAGE_STAND_IN,
  NO_DESCRIPTION,
  SHOW_DESCRIPTION,
  TASK_DONE,
  TASK_INAPPLICABLE,
  TASK_OPEN,
} from "./mergeRequestDescriptionText";

type Refused = Exclude<DescriptionReply, { readonly kind: "read" }>;

const REFUSALS: Readonly<Record<Refused["kind"], readonly [Refused, string]>> = {
  glabMissing: [
    { kind: "glabMissing" },
    "glab is not installed (not found on PATH) — install glab, then Retry.",
  ],
  notLoggedIn: [
    { kind: "notLoggedIn", detail: "gitlab.example: not logged in" },
    "glab is not logged in: gitlab.example: not logged in — run glab auth login in a terminal, then Retry.",
  ],
  failed: [
    { kind: "failed", message: "glab timed out" },
    "Could not read the description: glab timed out",
  ],
};

test("the description panel's words", () => {
  expect([
    SHOW_DESCRIPTION,
    CLOSE_DESCRIPTION,
    DESCRIPTION_LOADING,
    NO_DESCRIPTION,
    TASK_DONE,
    TASK_OPEN,
    TASK_INAPPLICABLE,
    IMAGE_STAND_IN,
  ]).toEqual([
    "Show description",
    "Close",
    "Loading…",
    "No description.",
    "Done",
    "Not done",
    "Not applicable",
    "picture",
  ]);
});

test.each(Object.values(REFUSALS))("a refused description says why: %o", (reply, words) => {
  expect(descriptionRefusalText(reply)).toBe(words);
});
