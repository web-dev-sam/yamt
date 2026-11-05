import { expect, test, vi } from "vitest";

import {
  byDueDate,
  calendarDayFrom,
  filtered,
  reviewing,
  personGroupOf,
  reviewOrdered,
  withDraft,
  type CalendarDay,
  type Filters,
  type ReviewDetails,
} from "../mergeRequests";
import type * as Generated from "./bindings";
import { toRowDiscussions, type OpenDiscussion } from "./discussionDomain";
import { TIMED_OUT } from "./fixtureGitLab";
import {
  ANNA_CASES_IID,
  FIXTURE_ME,
  fixtureRows,
  fixtureUploadedPicture,
  FOLD_CASE_IID,
  LOGGED_OUT_DETAIL,
  OTHERS_CASE_IID,
  SAM_CASES_IID,
} from "./fixtureMergeRequestData";
import {
  createDiscussionStore,
  DISCUSSIONS_FAILED_IID,
  DISCUSSIONS_LOGGED_OUT_IID,
  fixtureDiscussions,
  openDiscussion,
  storedDiscussions,
  type DiscussionStore,
} from "./fixtureMergeRequestDiscussions";
import type { FixtureDiscussion } from "./fixtureMergeRequestTurnCases";
import { toMergeRequestPage } from "./mergeRequestDomain";

const LISTED = fixtureRows(0, 500);
const PERSON_CASE_ROWS = [ANNA_CASES_IID, SAM_CASES_IID, FOLD_CASE_IID, OTHERS_CASE_IID];
const TURN_CASES: ReadonlySet<number> = new Set([637, 636, ...PERSON_CASE_ROWS]);
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

function everyDiscussion(store: DiscussionStore): readonly Generated.OpenDiscussion[] {
  return GENERATED.flatMap((row) => openOf(row.iid, store));
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

test("every_discussion_id_is_40_hex_and_unique_and_only_the_due_rows_ask_their_reviewer", () => {
  const store = createDiscussionStore(500);
  const ids = UNSCRIPTED.flatMap((row) =>
    openOf(row.iid, store).map((discussion) => discussion.id),
  );
  expect(ids.every((id) => /^[0-9a-f]{40}$/u.test(id))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  expect(everyDiscussion(store).every((discussion) => discussion.earlier.length === 0)).toBe(true);
  const asking = GENERATED.flatMap((row) =>
    openOf(row.iid, store)
      .filter((discussion) => discussion.last.mentions.length > 0)
      .map(
        ({ last }) =>
          `!${row.iid} ${last.mentions.map((mention) => mention.username).join()}: ${last.text}`,
      ),
  );
  expect(asking).toEqual([
    "!633 sam: @sam Could you look at this again?",
    "!623 sam: @sam Could you look at this again?",
    "!618 sam: @sam Could you look at this again?",
    "!602 anna: @anna Could you look at this again?",
  ]);
});

test("every_listed_row_with_open_discussions_has_that_many", () => {
  for (const row of UNSCRIPTED) {
    expect(openOf(row.iid)).toHaveLength(row.openDiscussions);
  }
  expect(LISTED.some((row) => row.openDiscussions === 2)).toBe(true);
});

test("both_turns_occur_for_sam_and_some_rows_wait_only", () => {
  const store = createDiscussionStore(500);
  const pairs = GENERATED.filter((row) => row.openDiscussions === 2);
  const opens = GENERATED.map((row) => openOf(row.iid, store)).filter((open) => open.length > 0);

  expect(pairs.length).toBeGreaterThan(0);
  for (const row of pairs) {
    const [first, second] = openOf(row.iid, store);
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
  const all = everyDiscussion(createDiscussionStore(500));
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
    review: "!622 !618 !633 !623 !638 !603 !608",
    failed: null,
  });
  expect(orders(anna, "anna")).toEqual({
    normal: "!622 !602 !632 !630 !617 !612",
    review: "!622 !602 !630 !612 !632 !617",
    failed: null,
  });
  expect(orders(withDraft(anna, "all"), "anna").review).toBe(
    "!622 !602 !630 !627 !612 !632 !617 !606",
  );
  expect(orders(reviewing({ kind: "person", username: "chiara" }), "chiara")).toEqual({
    normal: "!638 !635 !630 !615 !614 !605",
    review: "!638 !635 !630 !615 !614 !605",
    failed: 615,
  });
});

test("every_discussion_starts_with_its_first_comment", () => {
  const store = createDiscussionStore(500);
  for (const row of UNSCRIPTED) {
    const comments = (storedDiscussions(store, row.iid) ?? []).map(({ comments: [first] }) => ({
      createdAt: first?.createdAt,
      body: first?.body,
    }));
    expect(openOf(row.iid, store).map((discussion) => discussion.first)).toEqual(comments);
  }
  const [p1] = openOf(ANNA_CASES_IID, store);
  expect(p1?.first.createdAt).not.toBe(p1?.last.createdAt);
});

test("the_person_cases_have_their_writers_in_order", () => {
  const store = createDiscussionStore(500);

  expect(PERSON_CASE_ROWS.map((iid) => openOf(iid, store).map(said))).toEqual([
    ["anna ben chiara dmitri", "sam anna", "anna ben anna"],
    ["sam chiara sam", "ben chiara sam"],
    ["ben chiara dmitri anna deleted ben dmitri chiara anna ben deleted dmitri ben chiara"],
    ["dmitri chiara"],
  ]);
  expect(openOf(FOLD_CASE_IID, store)[0]?.earlier).toHaveLength(13);
  expect(PERSON_CASE_ROWS.flatMap((iid) => openOf(iid, store).map(({ id }) => id))).toEqual(
    Array.from({ length: 7 }, (_, at) => String(at + 17).padStart(40, "0")),
  );
});

test("the_person_cases_last_comments_are_at_distinct_hours_seventeen_to_twenty_three", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const store = createDiscussionStore(500);
  const cases = PERSON_CASE_ROWS.flatMap((iid) => openOf(iid, store));
  vi.useRealTimers();

  expect(cases.map(({ last }) => (now - Date.parse(last.createdAt)) / HOUR_MS)).toEqual([
    17, 18, 19, 20, 21, 22, 23,
  ]);
  expect(cases.map(({ first }) => (now - Date.parse(first.createdAt)) / HOUR_MS)).toEqual([
    48, 48, 48, 48, 48, 48, 48,
  ]);
});

function plainText(inline: Generated.DescriptionInline): string {
  switch (inline.kind) {
    case "text":
    case "code":
      return inline.text;
    case "image":
      return inline.caption;
    case "lineBreak":
      return "\n";
    case "emphasis":
    case "strong":
    case "strike":
    case "link":
      return inline.inlines.map(plainText).join("");
    default: {
      const _exhaustive: never = inline;
      return _exhaustive;
    }
  }
}

test("p1_starts_with_a_formatted_six_line_comment_and_p2_with_a_plain_one", () => {
  const [p1, p2] = openOf(ANNA_CASES_IID);
  const lines = (p1?.first.body.blocks ?? []).map((block) =>
    block.kind === "paragraph" ? block.inlines : [],
  );
  const inlines = lines.flat();

  expect(lines.map((line) => line.map(plainText).join(""))).toEqual([
    "The reminder list needs a second look.",
    "The snoozeUntil field is never cleared.",
    "See the import notes first.",
    "the reminder list",
    "Five lines in, the box cuts here.",
    "And this sixth line is hidden too.",
  ]);
  expect(inlines.map((inline) => inline.kind)).toEqual([
    "text",
    "strong",
    "text",
    "text",
    "code",
    "text",
    "text",
    "link",
    "text",
    "image",
    "text",
    "text",
  ]);
  expect(inlines.find((inline) => inline.kind === "link")).toMatchObject({
    link: { kind: "page", page: "https://gitlab.example/taskboard/taskboard/-/wikis/import" },
  });
  expect(inlines.find((inline) => inline.kind === "image")).toMatchObject({
    size: { kind: "width", width: { kind: "pixels", value: 160 } },
  });
  expect(p1?.last.text).toBe("I'll add a test for archiving.");
  expect(p2?.first.body).toEqual({
    blocks: [
      {
        kind: "paragraph",
        inlines: [{ kind: "text", text: "Should the snooze menu remember the last choice?" }],
      },
    ],
  });
});

test("a_discussion_without_comments_throws_naming_it", () => {
  const empty: FixtureDiscussion = {
    id: "d99",
    place: { kind: "overview" },
    mayResolve: true,
    resolved: false,
    comments: [],
    drafts: [],
  };
  expect(() => openDiscussion(empty)).toThrow("discussion d99 has no comment");
});

function converted(iid: number, store: DiscussionStore): readonly OpenDiscussion[] {
  const { answer } = toRowDiscussions(
    { iid, answer: fixtureDiscussions(iid, store) },
    0,
    fixtureUploadedPicture,
  );
  return answer.kind === "open" ? answer.discussions : [];
}

test("the_person_cases_fall_in_the_groups_the_design_names_for_sam_and_anna", () => {
  const store = createDiscussionStore(500);
  const groups = PERSON_CASE_ROWS.flatMap((iid) => {
    const row = LISTED.find((listed) => listed.iid === iid);
    if (row === undefined) {
      throw new Error(`!${iid} is not listed`);
    }
    return converted(iid, store).map((discussion) => [
      personGroupOf(discussion, FIXTURE_ME, row),
      personGroupOf(discussion, "anna", row),
    ]);
  });

  expect(groups).toEqual([
    ["other", "turn"],
    ["turn", "wrote"],
    ["other", "started"],
    ["started", "other"],
    ["wrote", "other"],
    ["other", "turn"],
    ["other", "other"],
  ]);
});

test("the_listed_rows_give_sam_and_anna_each_a_reviewer_group_discussion", () => {
  const store = createDiscussionStore(SMOKE_ROWS);
  function reviewerGroup(viewer: string): string[] {
    return fixtureRows(0, SMOKE_ROWS)
      .filter((row) =>
        converted(row.iid, store).some(
          (discussion) => personGroupOf(discussion, viewer, row) === "reviewer",
        ),
      )
      .map(({ iid }) => `!${iid}`);
  }

  expect(reviewerGroup(FIXTURE_ME)).toContain("!638");
  expect(reviewerGroup("anna")).toContain("!632");
});
