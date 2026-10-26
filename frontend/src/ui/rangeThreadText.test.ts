import { expect, test } from "vitest";

import {
  changedThreadLine,
  unchangedThreadLine,
  type NotLinedUp,
  type Posting,
  type RangeStart,
} from "../ipc";
import {
  notLinedUpText,
  postingLabel,
  postTitle,
  sendLabel,
  sendResultText,
  sendTitle,
  threadPlaceText,
} from "./rangeThreadText";

const MERGE_REQUEST = { reference: "!12", title: "Reminders", webUrl: "https://gl/x/-/mr/12" };
const THREE_DOTS: RangeStart = {
  range: "main...dev",
  left: {
    label: { kind: "mergeBase", left: "main", right: "dev" },
    shortId: "5d6e7f8",
    subject: "s",
  },
  right: { label: { kind: "named", name: "dev" }, shortId: "abc4567", subject: "s" },
  files: [],
};
const TWO_DOTS: RangeStart = {
  ...THREE_DOTS,
  range: "main..dev",
  left: { label: { kind: "named", name: "main" }, shortId: "5d6e7f8", subject: "s" },
};

test.each<[NotLinedUp, string]>([
  [{ kind: "glabMissing" }, "glab is not installed (not found on PATH)"],
  [
    { kind: "notLoggedIn", detail: "gitlab.example.com: No token found" },
    "glab is not logged in: gitlab.example.com: No token found",
  ],
  [
    { kind: "noMergeRequest", lookedAt: { kind: "branch", name: "dev" } },
    "no open merge request from dev",
  ],
  [
    { kind: "noMergeRequest", lookedAt: { kind: "commit", shortId: "2b3b4b5" } },
    "no open merge request ends at 2b3b4b5 (the range names no branch)",
  ],
  [
    {
      kind: "several",
      lookedAt: { kind: "branch", name: "dev" },
      references: ["!12", "!14"],
    },
    "several open merge requests from dev (!12, !14); none compares 5d6e7f8 with abc4567",
  ],
  [
    {
      kind: "several",
      lookedAt: { kind: "commit", shortId: "abc4567" },
      references: ["!12", "!14"],
    },
    "several open merge requests ending at abc4567 (!12, !14); none compares 5d6e7f8 with abc4567",
  ],
  [
    { kind: "moved", mergeRequest: MERGE_REQUEST, gitlabHead: "def1234", shownHead: "abc4567" },
    "the merge request !12 is at def1234, this window shows abc4567",
  ],
  [
    { kind: "otherBase", mergeRequest: MERGE_REQUEST, gitlabBase: "1a2b3c4", shownBase: "5d6e7f8" },
    "the merge request !12 starts from 1a2b3c4, this window from 5d6e7f8",
  ],
  [
    { kind: "preparing", mergeRequest: MERGE_REQUEST },
    "GitLab is still preparing the changes of !12",
  ],
  [{ kind: "failed", message: "502 Bad Gateway" }, "glab failed: 502 Bad Gateway"],
])("not lined up %o reads its sentence", (why, sentence) => {
  expect(notLinedUpText(why, THREE_DOTS)).toBe(sentence);
});

test("another base with two dots adds the three-dots hint; with three dots it does not", () => {
  const why: NotLinedUp = {
    kind: "otherBase",
    mergeRequest: MERGE_REQUEST,
    gitlabBase: "1a2b3c4",
    shownBase: "5d6e7f8",
  };

  expect(notLinedUpText(why, TWO_DOTS)).toBe(
    "the merge request !12 starts from 1a2b3c4, this window from 5d6e7f8 — main...dev compares from where dev branched off",
  );
  expect(notLinedUpText(why, THREE_DOTS)).not.toContain("—");
});

test.each<[Posting, string | null]>([
  [{ kind: "notQueued" }, null],
  [{ kind: "queued", text: "Why?" }, "Queued for GitLab"],
  [
    { kind: "refused", text: "Why?", reason: "400 Bad request" },
    "Refused by GitLab: 400 Bad request",
  ],
  [
    { kind: "pending", text: "Why?", draftNote: 3, mergeRequest: "!12", link: "https://gl/diffs" },
    "Pending on GitLab",
  ],
])("the posting %o is labelled %s", (posting, label) => {
  expect(postingLabel(posting)).toBe(label);
});

test("the Send label counts the queue, then the message being sent", () => {
  expect(sendLabel(null, 7)).toBe("Send to GitLab (7)");
  expect(sendLabel({ done: 0, of: 7 }, 7)).toBe("Sending 1 of 7…");
  expect(sendLabel({ done: 2, of: 7 }, 7)).toBe("Sending 3 of 7…");
  expect(sendLabel({ done: 7, of: 7 }, 7)).toBe("Sending 7 of 7…");
});

test("the Send and Post hovers name the merge request", () => {
  expect(sendTitle(MERGE_REQUEST, 3)).toBe(
    "Send the 3 queued comments to your pending review on !12",
  );
  expect(sendTitle(MERGE_REQUEST, 1)).toBe(
    "Send the 1 queued comment to your pending review on !12",
  );
  expect(postTitle(MERGE_REQUEST)).toBe("Queue this message as its own comment on !12");
});

test("the result notice counts sent and refused, and a stop says why", () => {
  const list = { threads: [] };
  expect(sendResultText({ kind: "sent", list, sent: 5, refused: 1 })).toBe("5 sent, 1 refused");
  expect(
    sendResultText({ kind: "stopped", list, sent: 1, refused: 0, reason: "glab timed out" }),
  ).toBe("1 sent, 0 refused; stopped: glab timed out. The rest stay queued.");
});

test.each([
  [changedThreadLine("left", 11), "src/old.ts:12"],
  [changedThreadLine("right", 11), "src/board.ts:12"],
  [unchangedThreadLine("left", { left: 4, right: 11 }), "src/board.ts:12"],
  [unchangedThreadLine("right", { left: 4, right: 11 }), "src/board.ts:12"],
])("the place of %o in a renamed file", (line, place) => {
  const entry = {
    path: "src/board.ts",
    change: { kind: "renamed", oldPath: "src/old.ts" },
  } as const;
  expect(threadPlaceText(entry, line)).toBe(place);
});

test("a removed line of a file that was not renamed names its own path", () => {
  const entry = { path: "src/board.ts", change: { kind: "deleted" } } as const;
  expect(threadPlaceText(entry, changedThreadLine("left", 0))).toBe("src/board.ts:1");
});
