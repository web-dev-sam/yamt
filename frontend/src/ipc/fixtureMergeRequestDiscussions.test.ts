import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { TIMED_OUT } from "./fixtureGitLab";
import { FIXTURE_ME, fixtureRows, LOGGED_OUT_DETAIL } from "./fixtureMergeRequestData";
import {
  DISCUSSIONS_FAILED_IID,
  DISCUSSIONS_LOGGED_OUT_IID,
  fixtureDiscussions,
} from "./fixtureMergeRequestDiscussions";

const LISTED = fixtureRows(0, 500);
const SCRIPTED: ReadonlySet<number> = new Set([DISCUSSIONS_FAILED_IID, DISCUSSIONS_LOGGED_OUT_IID]);
const LONG_LINE = 400;
const MARKUP =
  "Please RENAME this.\n**not bold** <b>not bold</b> &amp; <script>x</script>\nThird line\nA fourth line the box leaves out";

function openOf(iid: number): readonly Generated.OpenDiscussion[] {
  const answer = fixtureDiscussions(iid, LISTED);
  if (answer.kind !== "open") {
    throw new Error(`!${iid} answered ${answer.kind}`);
  }
  return answer.discussions;
}

const UNSCRIPTED = LISTED.filter((row) => !SCRIPTED.has(row.iid));

function everyDiscussion(): readonly Generated.OpenDiscussion[] {
  return UNSCRIPTED.flatMap((row) => openOf(row.iid));
}

function isSams(discussion: Generated.OpenDiscussion | undefined): boolean {
  return discussion?.last.author?.username === FIXTURE_ME;
}

test("every_listed_row_with_open_discussions_has_that_many", () => {
  for (const row of UNSCRIPTED) {
    expect(openOf(row.iid)).toHaveLength(row.openDiscussions);
  }
  expect(LISTED.some((row) => row.openDiscussions === 2)).toBe(true);
});

test("both_turns_occur_for_sam_and_some_rows_wait_only", () => {
  const pairs = UNSCRIPTED.map((row) => openOf(row.iid)).filter((open) => open.length === 2);
  const mixed = pairs.filter(([first, second]) => !isSams(first) && isSams(second));
  const samsOnly = pairs.filter((open) => open.every(isSams));

  expect(mixed.length).toBeGreaterThan(0);
  expect(samsOnly.length).toBeGreaterThan(0);
  for (const [first, second] of mixed) {
    expect(Date.parse(second?.last.createdAt ?? "")).toBeGreaterThan(
      Date.parse(first?.last.createdAt ?? ""),
    );
  }
});

test("the_markup_text_and_a_pageless_discussion_exist", () => {
  const all = everyDiscussion();
  const texts = all.map((discussion) => discussion.last.text);

  expect(texts).toContain(MARKUP);
  expect(texts.filter((text) => text.length === LONG_LINE && !text.includes("\n"))).toHaveLength(1);
  expect(openOf(638)[0]?.last.text).toHaveLength(LONG_LINE);
  expect(all.some((discussion) => discussion.last.page === null)).toBe(true);
  expect(openOf(636)[0]?.last.text).toBe(MARKUP);
  expect(openOf(635).map((discussion) => discussion.last.text)).toEqual([
    "Could you look at this again?",
    "Done, see the new commit.",
  ]);
  expect(openOf(638).map((discussion) => discussion.last.page)).toEqual([
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/638#note_7020",
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/638#note_7021",
  ]);
  expect(openOf(638).map((discussion) => discussion.place)).toEqual([
    { kind: "overview" },
    { kind: "file", path: "src/board/column.ts", line: null },
  ]);
  expect(openOf(639)[0]?.place).toEqual({ kind: "file", path: "src/board/card.ts", line: 11 });
});

test("the_scripted_rows_refuse_as_named", () => {
  for (const iid of SCRIPTED) {
    expect(LISTED.find((row) => row.iid === iid)?.openDiscussions).toBeGreaterThan(0);
  }
  expect(fixtureDiscussions(DISCUSSIONS_FAILED_IID, LISTED)).toEqual({
    kind: "failed",
    message: TIMED_OUT,
  });
  expect(fixtureDiscussions(DISCUSSIONS_LOGGED_OUT_IID, LISTED)).toEqual({
    kind: "notLoggedIn",
    detail: LOGGED_OUT_DETAIL,
  });
});

test("an_unlisted_iid_fails", () => {
  expect(fixtureDiscussions(140, LISTED)).toEqual({
    kind: "failed",
    message: "GitLab sent no merge request !140",
  });
  expect(fixtureDiscussions(141, LISTED).kind).toBe("open");
});
