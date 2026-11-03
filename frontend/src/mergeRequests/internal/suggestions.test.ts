import { expect, test } from "vitest";

import {
  SUGGESTED_PEOPLE,
  peopleSuggestions,
  searchedText,
  type KnownPeople,
  type Person,
  type Suggestion,
} from "../index";

type Face = Person & { readonly picture: string };

function face(username: string, name: string): Face {
  return { username, name, picture: `${username}.png` };
}

const SAM = face("sam", "Sam Lee");
const ANNA = face("anna", "Anna Berg");
const BEN = face("ben", "Ben Ode");
const CARL = face("carl", "Carl Ray");
const DORA = face("dora", "Dora Fox");
const ZED = face("zed", "Zed Ash");
const ABE = face("abe", "Abe Moss");

type Fields = {
  readonly author?: Face;
  readonly assignees?: readonly Face[];
  readonly reviewers?: readonly Face[];
  readonly approvedBy?: readonly Face[];
};

function row(fields: Fields = {}): KnownPeople<Face> {
  return {
    author: fields.author ?? null,
    assignees: fields.assignees ?? [],
    reviewers: (fields.reviewers ?? []).map((person) => ({ person })),
    approvedBy: fields.approvedBy ?? [],
  };
}

function lines(suggestions: readonly Suggestion<Face>[]): readonly string[] {
  return suggestions.map((line) =>
    line.kind === "me"
      ? `Me @${line.username} ${line.person?.picture ?? "initials"}`
      : line.person.username,
  );
}

test("me_comes_first_with_their_picture_from_any_loaded_row", () => {
  const open = row({ author: ANNA });
  const elsewhere = row({ approvedBy: [SAM] });
  expect(lines(peopleSuggestions([open, elsewhere], open, "assignees", "sam"))).toEqual([
    "Me @sam sam.png",
    "anna",
  ]);

  const onlyHere = row({ reviewers: [SAM], author: ANNA });
  expect(lines(peopleSuggestions([], onlyHere, "reviewers", "sam"))).toEqual([
    "Me @sam sam.png",
    "anna",
  ]);
});

test("me_unknown_on_every_row_has_no_person", () => {
  const open = row({ author: ANNA, assignees: [BEN] });
  const suggestions = peopleSuggestions(
    [open, row({ reviewers: [CARL] })],
    open,
    "assignees",
    "sam",
  );
  expect(suggestions[0]).toEqual({ kind: "me", username: "sam", person: null });
  expect(lines(suggestions)).toEqual(["Me @sam initials", "anna", "ben", "carl"]);
  expect(suggestions[1]).toEqual({ kind: "known", person: ANNA });
});

test("no_me_entry_without_a_viewer", () => {
  const open = row({ author: SAM, assignees: [ANNA] });
  expect(lines(peopleSuggestions([open], open, "assignees", null))).toEqual(["sam", "anna"]);
  expect(peopleSuggestions([], row(), "reviewers", null)).toEqual([]);
});

test("the_rows_own_people_follow_me_author_assignees_reviewers_approvers", () => {
  const open = row({ author: ZED, assignees: [DORA], reviewers: [CARL], approvedBy: [ABE] });
  const busy = row({ assignees: [ANNA, BEN], reviewers: [ANNA, BEN] });
  const rows = [open, busy, busy, busy];
  expect(lines(peopleSuggestions(rows, open, "assignees", "sam"))).toEqual([
    "Me @sam initials",
    "zed",
    "dora",
    "carl",
    "abe",
    "anna",
    "ben",
  ]);
});

test("others_are_ordered_by_rows_holding_them_in_the_group_then_by_name", () => {
  const nameless = face("zack", "");
  const open = row({ author: SAM });
  const rows = [
    open,
    row({ assignees: [DORA], reviewers: [BEN] }),
    row({ assignees: [DORA, CARL], reviewers: [BEN] }),
    row({ assignees: [ANNA], reviewers: [CARL, ANNA] }),
    row({ author: nameless, approvedBy: [ZED] }),
    row({ author: ABE }),
  ];
  expect(lines(peopleSuggestions(rows, open, "assignees", null))).toEqual([
    "sam",
    "dora",
    "anna",
    "carl",
    "abe",
    "ben",
    "zack",
    "zed",
  ]);
  expect(lines(peopleSuggestions(rows, open, "reviewers", null))).toEqual([
    "sam",
    "ben",
    "anna",
    "carl",
    "abe",
    "dora",
    "zack",
    "zed",
  ]);
});

test("each_username_appears_once", () => {
  const open = row({
    author: ANNA,
    assignees: [SAM, BEN],
    reviewers: [BEN, SAM],
    approvedBy: [ANNA],
  });
  const rows = [open, row({ assignees: [BEN], reviewers: [SAM, CARL] }), row({ author: CARL })];
  expect(lines(peopleSuggestions(rows, open, "reviewers", "sam"))).toEqual([
    "Me @sam sam.png",
    "anna",
    "ben",
    "carl",
  ]);
});

test("at_most_twenty_lines_me_included", () => {
  const many = Array.from({ length: SUGGESTED_PEOPLE + 5 }, (_, index) =>
    face(`user${String(index).padStart(2, "0")}`, `User ${String(index).padStart(2, "0")}`),
  );
  const open = row({ author: SAM });
  const suggestions = peopleSuggestions([open, row({ assignees: many })], open, "assignees", "sam");
  expect(SUGGESTED_PEOPLE).toBe(20);
  expect(suggestions).toHaveLength(SUGGESTED_PEOPLE);
  expect(lines(suggestions).slice(0, 2)).toEqual(["Me @sam sam.png", "user00"]);
  expect(lines(suggestions).at(-1)).toBe("user18");
});

test("people_already_in_the_group_stay_listed", () => {
  const open = row({ assignees: [ANNA], reviewers: [BEN] });
  const rows = [open, row({ assignees: [CARL], reviewers: [DORA] })];
  expect(lines(peopleSuggestions(rows, open, "assignees", null))).toEqual([
    "anna",
    "ben",
    "carl",
    "dora",
  ]);
  expect(lines(peopleSuggestions(rows, open, "reviewers", null))).toEqual([
    "anna",
    "ben",
    "dora",
    "carl",
  ]);
});

test("searched_text_trims_and_drops_one_leading_at", () => {
  expect(searchedText("  @ben ")).toBe("ben");
  expect(searchedText("@")).toBe("");
  expect(searchedText("@@x")).toBe("@x");
  expect(searchedText("a b")).toBe("a b");
  expect(searchedText(" @ ben")).toBe("ben");
  expect(searchedText("b@n")).toBe("b@n");
  expect(searchedText("   ")).toBe("");
});
