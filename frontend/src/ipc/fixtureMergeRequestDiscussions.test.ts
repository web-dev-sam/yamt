import { expect, test, vi } from "vitest";

import {
  byDueDate,
  calendarDayFrom,
  filtered,
  reviewing,
  reviewOrdered,
  withDraft,
  type CalendarDay,
  type Filters,
  type ReviewDetails,
} from "../mergeRequests";
import type * as Generated from "./bindings";
import { toRowDiscussions } from "./discussionDomain";
import { TIMED_OUT } from "./fixtureGitLab";
import {
  FIXTURE_ME,
  fixtureRows,
  fixtureUploadedPicture,
  LOGGED_OUT_DETAIL,
} from "./fixtureMergeRequestData";
import {
  createDiscussionStore,
  DISCUSSIONS_FAILED_IID,
  DISCUSSIONS_LOGGED_OUT_IID,
  fixtureDiscussions,
  type DiscussionStore,
} from "./fixtureMergeRequestDiscussions";
import { toMergeRequestPage } from "./mergeRequestDomain";

const LISTED = fixtureRows(0, 500);
const TURN_CASES: ReadonlySet<number> = new Set([637, 636]);
const SCRIPTED: ReadonlySet<number> = new Set([DISCUSSIONS_FAILED_IID, DISCUSSIONS_LOGGED_OUT_IID]);
const HOUR_MS = 3_600_000;
const LONG_LINE = 400;
const MARKUP =
  "Please RENAME this.\n**not bold** <b>not bold</b> &amp; <script>x</script>\nThird line\nA fourth line the box leaves out";

function openOf(
  iid: number,
  store: DiscussionStore = createDiscussionStore(500),
): readonly Generated.OpenDiscussion[] {
  const answer = fixtureDiscussions(iid, store);
  if (answer.kind !== "open") {
    throw new Error(`!${iid} answered ${answer.kind}`);
  }
  return answer.discussions;
}

const UNSCRIPTED = LISTED.filter((row) => !SCRIPTED.has(row.iid));
const GENERATED = UNSCRIPTED.filter((row) => !TURN_CASES.has(row.iid));

function everyDiscussion(): readonly Generated.OpenDiscussion[] {
  return GENERATED.flatMap((row) => openOf(row.iid));
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

test("every_discussion_id_is_40_hex_and_unique_and_other_rows_have_no_earlier_or_mentions", () => {
  const ids = UNSCRIPTED.flatMap((row) => openOf(row.iid).map((discussion) => discussion.id));
  expect(ids.every((id) => /^[0-9a-f]{40}$/u.test(id))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  for (const discussion of everyDiscussion()) {
    expect([discussion.earlier, discussion.last.mentions]).toEqual([[], []]);
  }
});

test("every_listed_row_with_open_discussions_has_that_many", () => {
  for (const row of UNSCRIPTED) {
    expect(openOf(row.iid)).toHaveLength(row.openDiscussions);
  }
  expect(LISTED.some((row) => row.openDiscussions === 2)).toBe(true);
});

test("both_turns_occur_for_sam_and_some_rows_wait_only", () => {
  const pairs = GENERATED.filter((row) => row.openDiscussions === 2);
  const opens = GENERATED.map((row) => openOf(row.iid)).filter((open) => open.length > 0);

  expect(pairs.length).toBeGreaterThan(0);
  for (const row of pairs) {
    const [first, second] = openOf(row.iid);
    expect(row.reviewers[0]).toBeDefined();
    expect(second?.last.author).toEqual(row.reviewers[0]?.person);
    expect(Date.parse(second?.last.createdAt ?? "")).toBeGreaterThan(
      Date.parse(first?.last.createdAt ?? ""),
    );
  }
  expect(opens.some((open) => open.every(isSams))).toBe(true);
  expect(opens.some((open) => !open.some(isSams))).toBe(true);
  expect(opens.some((open) => open.some(isSams) && !open.every(isSams))).toBe(true);
});

test("the_markup_text_and_a_pageless_discussion_exist", () => {
  const all = everyDiscussion();
  const texts = all.map((discussion) => discussion.last.text);

  expect(texts).toContain(MARKUP);
  expect(texts.filter((text) => text.length === LONG_LINE && !text.includes("\n"))).toHaveLength(1);
  expect(openOf(638)[0]?.last.text).toHaveLength(LONG_LINE);
  expect(all.some((discussion) => discussion.last.page === null)).toBe(true);
  expect(openOf(632)[0]?.last.text).toBe(MARKUP);
  expect(openOf(635).map((discussion) => discussion.last.text)).toEqual([
    "Could you look at this again?",
    "Done, see the new commit.",
  ]);
  expect(openOf(638).map((discussion) => discussion.last.page)).toEqual([
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/638#note_7020",
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/638#note_7021",
  ]);
  expect(openOf(638).map((discussion) => discussion.id)).toEqual(
    ["63800", "63801"].map((serial) => serial.padStart(40, "0")),
  );
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
  expect(fixtureDiscussions(DISCUSSIONS_FAILED_IID, createDiscussionStore(500))).toEqual({
    kind: "failed",
    message: TIMED_OUT,
  });
  expect(fixtureDiscussions(DISCUSSIONS_LOGGED_OUT_IID, createDiscussionStore(500))).toEqual({
    kind: "notLoggedIn",
    detail: LOGGED_OUT_DETAIL,
  });
});

test("an_unlisted_iid_fails", () => {
  expect(fixtureDiscussions(140, createDiscussionStore(500))).toEqual({
    kind: "failed",
    message: "GitLab sent no merge request !140",
  });
  expect(fixtureDiscussions(141, createDiscussionStore(500)).kind).toBe("open");
});

function said(discussion: Generated.OpenDiscussion): string {
  const authors = [...discussion.earlier, discussion.last].map(
    (comment) => comment.author?.username ?? "deleted",
  );
  const mentions = discussion.last.mentions.map((mention) => `@${mention.username}`);
  return [authors.join(" "), ...mentions].join(" | ");
}

test("the_b_cases_answer_on_637_and_636", () => {
  const store = createDiscussionStore(500);
  const cases = openOf(637, store);

  expect(cases.map(said)).toEqual([
    "anna sam dmitri anna",
    "anna sam",
    "sam anna",
    "ben chiara",
    "anna sam anna",
    "chiara anna | @ben",
    "anna anna",
    "anna dmitri",
    "dmitri",
    "deleted deleted",
    "chiara ben | @dmitri",
    "ben chiara",
    "chiara | @chiara",
  ]);
  expect(cases.map((discussion) => discussion.id)).toEqual(
    Array.from({ length: 13 }, (_, at) => String(at + 1).padStart(40, "0")),
  );
  expect(cases[9]?.id).toBe("0000000000000000000000000000000000000010");
  expect(cases[0]?.earlier[0]?.mentions).toEqual([{ username: "ben", name: "Ben Okafor" }]);
  expect(cases[3]?.earlier[0]?.mentions).toEqual([{ username: "sam", name: "Sam Weller" }]);
  expect(cases[4]?.earlier[0]?.mentions).toEqual([{ username: "sam", name: "Sam Weller" }]);
  expect(cases[0]?.place).toEqual({ kind: "file", path: "src/board.ts", line: 12 });
  expect(cases[3]?.place).toEqual({ kind: "file", path: "src/due.ts", line: 4 });
  expect(cases[1]?.place).toEqual({ kind: "overview" });
  expect(openOf(636, store).map(said)).toEqual(["anna sam", "sam sam", "anna anna"]);
  expect(openOf(636, store).map((discussion) => discussion.id)).toEqual([
    "0000000000000000000000000000000000000014",
    "0000000000000000000000000000000000000015",
    "0000000000000000000000000000000000000016",
  ]);
});

test("the_b_cases_are_two_days_old_and_their_last_comments_one_to_thirteen_hours", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const cases = openOf(637, createDiscussionStore(500));
  vi.useRealTimers();

  expect(
    cases.map((discussion) => (now - Date.parse(discussion.last.createdAt)) / HOUR_MS),
  ).toEqual(Array.from({ length: 13 }, (_, at) => at + 1));
});

const SMOKE_ROWS = 40;
const SMOKE_DUE_DATES: Readonly<Record<number, string>> = {
  618: "2026-11-04",
  633: "2026-11-05",
  623: "2026-11-05",
  622: "2026-11-01",
  602: "2026-11-06",
};

function smokeDue(iid: number): CalendarDay | null {
  const text = SMOKE_DUE_DATES[iid];
  return text === undefined ? null : calendarDayFrom(text);
}

function smokeDetails(store: DiscussionStore) {
  return (iid: number): ReviewDetails<string> => {
    const { answer } = toRowDiscussions(
      { iid, answer: fixtureDiscussions(iid, store) },
      0,
      fixtureUploadedPicture,
    );
    return answer.kind === "open"
      ? { kind: "read", discussions: answer.discussions }
      : { kind: "failed", failure: answer.kind };
  };
}

test("the_review_orders_the_smoke_expects", () => {
  const listed = fixtureRows(0, SMOKE_ROWS);
  const { rows } = toMergeRequestPage({ me: FIXTURE_ME, rows: listed }, fixtureUploadedPicture);
  const detailsOf = smokeDetails(createDiscussionStore(SMOKE_ROWS));
  function orders(filters: Filters, reviewer: string) {
    const passing = filtered(rows, filters, FIXTURE_ME);
    const order = reviewOrdered(passing, reviewer, smokeDue, detailsOf);
    return {
      normal: byDueDate(passing, smokeDue)
        .map((row) => `!${row.iid}`)
        .join(" "),
      review: order.rows.map((row) => `!${row.iid}`).join(" "),
      failed: order.kind === "failed" ? order.row.iid : null,
    };
  }
  const anna = reviewing({ kind: "person", username: "anna" });

  expect(orders(reviewing({ kind: "me" }), FIXTURE_ME)).toEqual({
    normal: "!622 !618 !633 !623 !638 !608 !603",
    review: "!618 !633 !623 !622 !638 !603 !608",
    failed: null,
  });
  expect(orders(anna, "anna")).toEqual({
    normal: "!622 !602 !632 !630 !617 !612",
    review: "!602 !622 !630 !612 !632 !617",
    failed: null,
  });
  expect(orders(withDraft(anna, "all"), "anna").review).toBe(
    "!602 !622 !630 !627 !612 !632 !617 !606",
  );
  expect(orders(reviewing({ kind: "person", username: "chiara" }), "chiara")).toEqual({
    normal: "!638 !635 !630 !615 !614 !605",
    review: "!638 !635 !630 !615 !614 !605",
    failed: 615,
  });
});
