import { beforeAll, expect, test } from "vitest";

import {
  createFixtureCompareSource,
  log,
  type MergeRequestRow,
  type PeopleChange,
  type Person,
} from "../ipc";
import {
  firstAddable,
  groupNotices,
  keptHighlight,
  personState,
  pickList,
  steppedHighlight,
  type GroupPlace,
  type PickInput,
  type PickLine,
} from "./mergeRequestPeopleLines";
import {
  rowPeopleAsks,
  type NotDone,
  type PeopleSearch,
  type RowPeopleAsks,
} from "./mergeRequests";

const PLATFORM = "Linux x86_64";
const SAM: Person = { username: "sam", name: "Sam Reed", picture: null };
const ANNA: Person = { username: "anna", name: "Anna Berg", picture: "yamt-picture://anna" };
const ERIK: Person = { username: "erik", name: "Erik Lund", picture: null };
const CHIARA: Person = { username: "chiara", name: "Chiara Rossi", picture: null };

let BASE: MergeRequestRow;

beforeAll(async () => {
  const rows: MergeRequestRow[] = [];
  await createFixtureCompareSource(log, "?mr=list", {}).listMergeRequests(
    (page) => {
      rows.push(...page.rows);
    },
    () => undefined,
  );
  const first = rows[0];
  if (first === undefined) {
    throw new Error("the fixture lists no row");
  }
  BASE = first;
});

function row(people: Partial<MergeRequestRow>): MergeRequestRow {
  return {
    ...BASE,
    author: ANNA,
    assignees: [SAM],
    reviewers: [{ person: CHIARA, state: "requested" }],
    approvedBy: [],
    ...people,
  };
}

function input(edit: Partial<PickInput>): PickInput {
  const shown = edit.row ?? row({});
  return {
    rows: [shown],
    row: shown,
    group: "assignees",
    me: "sam",
    search: { kind: "empty" },
    asks: rowPeopleAsks(new Map(), shown.iid),
    platform: PLATFORM,
    ...edit,
  };
}

function line(username: string, state: PickLine["state"]): PickLine {
  return { username, picture: SAM, label: username, state };
}

function states(lines: readonly PickLine[]): string[] {
  return lines.map((each) => `${each.label} ${each.username} ${each.state}`);
}

function add(username: string, group: PeopleChange["group"]): PeopleChange {
  return { group, action: "add", username };
}

function remove(username: string, group: PeopleChange["group"]): PeopleChange {
  return { group, action: "remove", username };
}

test("already_in_the_group_is_not_addable_and_working_shows_for_a_queued_add", () => {
  const asks: RowPeopleAsks = {
    queue: [add("chiara", "assignees"), add("anna", "reviewers"), remove("anna", "assignees")],
    notDone: [],
  };
  const assignees = pickList(input({ asks }));
  expect(states(assignees.lines)).toEqual([
    "Me sam already",
    "Anna Berg anna addable",
    "Chiara Rossi chiara working",
  ]);
  expect(assignees.note).toBeNull();
  expect(assignees.lines[0]?.picture).toBe(SAM);

  const reviewers = pickList(input({ group: "reviewers", asks }));
  expect(states(reviewers.lines)).toEqual([
    "Me sam addable",
    "Anna Berg anna working",
    "Chiara Rossi chiara already",
  ]);
});

test("the viewer on no loaded row reads Me with a picture of their username's initials", () => {
  const list = pickList(input({ me: "olga" }));
  expect(list.lines[0]).toEqual({
    username: "olga",
    picture: { username: "olga", name: "", picture: null },
    label: "Me",
    state: "addable",
  });
});

test("arrows_skip_people_already_there_and_wrap", () => {
  const lines = [
    line("sam", "already"),
    line("anna", "addable"),
    line("chiara", "working"),
    line("erik", "addable"),
    line("olga", "addable"),
  ];
  expect(firstAddable(lines)).toBe(1);
  expect(steppedHighlight(lines, 1, 1)).toBe(3);
  expect(steppedHighlight(lines, 3, 1)).toBe(4);
  expect(steppedHighlight(lines, 4, 1)).toBe(1);
  expect(steppedHighlight(lines, 1, -1)).toBe(4);
  expect(steppedHighlight(lines, 4, -1)).toBe(3);
  expect(steppedHighlight(lines, null, 1)).toBe(1);
  expect(steppedHighlight(lines, null, -1)).toBe(4);
  expect(steppedHighlight(lines, 0, -1)).toBe(4);
  const none = [line("sam", "already"), line("chiara", "working")];
  expect(firstAddable(none)).toBeNull();
  expect(steppedHighlight(none, null, 1)).toBeNull();
  expect(steppedHighlight(none, null, -1)).toBeNull();
  expect(steppedHighlight([], null, 1)).toBeNull();
});

test("the_highlight_returns_to_the_first_addable_line_when_the_list_changes", () => {
  const before = [line("sam", "already"), line("anna", "addable"), line("erik", "addable")];
  expect(keptHighlight(before, [...before], 2)).toBe(2);
  expect(
    keptHighlight(
      before,
      [line("sam", "already"), line("anna", "working"), line("erik", "addable")],
      1,
    ),
  ).toBe(2);
  expect(keptHighlight(before, [line("erik", "addable"), line("anna", "addable")], 1)).toBe(0);
  expect(keptHighlight(before, before.slice(0, 2), 1)).toBe(1);
  expect(keptHighlight(before.slice(1), [...before.slice(1), line("olga", "addable")], 1)).toBe(0);
  expect(
    keptHighlight(
      before,
      [line("sam", "already"), line("erik", "addable"), line("anna", "addable")],
      2,
    ),
  ).toBe(1);
  expect(keptHighlight(before, [line("sam", "already")], 1)).toBeNull();
});

function place(notDone: readonly NotDone[], group: PeopleChange["group"]): GroupPlace {
  return { row: row({}), group, asks: { queue: [], notDone }, platform: PLATFORM };
}

test("a_remove_notice_sits_under_its_listed_person_else_under_the_group", () => {
  const notDone: NotDone[] = [
    { change: remove("chiara", "reviewers"), why: { kind: "unchanged" } },
    {
      change: remove("erik", "reviewers"),
      why: { kind: "refused", reply: { kind: "refused", message: "gone" } },
    },
    { change: add("olga", "reviewers"), why: { kind: "unchanged" } },
    { change: add("anna", "reviewers"), why: { kind: "unchanged" } },
    {
      change: add("chiara", "reviewers"),
      why: { kind: "refused", reply: { kind: "refused", message: "twice" } },
    },
    {
      change: remove("sam", "assignees"),
      why: { kind: "failed", cause: { kind: "WorkerStopped" } },
    },
    { change: remove("chiara", "assignees"), why: { kind: "unchanged" } },
  ];
  const reviewers = place(notDone, "reviewers");
  expect(personState(reviewers, "chiara")).toEqual({
    removing: false,
    notices: ["GitLab still lists Chiara Rossi as reviewer."],
  });
  expect(groupNotices(reviewers)).toEqual([
    "gone",
    "GitLab did not add @olga as reviewer (GitLab Free allows one reviewer per merge request).",
    "GitLab did not add Anna Berg as reviewer (GitLab Free allows one reviewer per merge request).",
    "twice",
  ]);
  const assignees = place(notDone, "assignees");
  expect(personState(assignees, "sam").notices).toEqual([
    "Could not change the merge request's people: yamt's worker stopped; try again.",
  ]);
  expect(groupNotices(assignees)).toEqual(["GitLab still lists Chiara Rossi as assignee."]);
});

test("a notice names a person the row does not hold, on a row without an author, by @username", () => {
  const noAuthor: GroupPlace = {
    row: row({ author: null }),
    group: "assignees",
    asks: {
      queue: [],
      notDone: [{ change: add("olga", "assignees"), why: { kind: "unchanged" } }],
    },
    platform: PLATFORM,
  };
  expect(groupNotices(noAuthor)).toEqual([
    "GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request).",
  ]);
});

test("a person's remove queued or running is working; an add of them or another group's remove is not", () => {
  const asks: RowPeopleAsks = {
    queue: [add("sam", "reviewers"), remove("chiara", "reviewers"), add("chiara", "assignees")],
    notDone: [],
  };
  const reviewers: GroupPlace = { row: row({}), group: "reviewers", asks, platform: PLATFORM };
  expect(personState(reviewers, "chiara")).toEqual({ removing: true, notices: [] });
  expect(personState(reviewers, "sam").removing).toBe(false);
  expect(personState({ ...reviewers, group: "assignees" }, "chiara").removing).toBe(false);
});

test("searching_keeps_the_last_people_and_found_nobody_is_no_one_found", () => {
  const searching: PeopleSearch = { kind: "searching", text: "er", people: [ERIK, SAM] };
  const kept = pickList(input({ search: searching }));
  expect(states(kept.lines)).toEqual(["Erik Lund erik addable", "Sam Reed sam already"]);
  expect(kept.lines[0]?.picture).toBe(ERIK);
  expect(kept.note).toEqual({ text: "Searching…", failed: false });

  const found = pickList(input({ search: { kind: "found", text: "er", people: [ERIK] } }));
  expect(states(found.lines)).toEqual(["Erik Lund erik addable"]);
  expect(found.note).toBeNull();

  const nobody = pickList(input({ search: { kind: "found", text: "zz", people: [] } }));
  expect(nobody).toEqual({ lines: [], note: { text: "No one found", failed: false } });

  const refused = pickList(
    input({ search: { kind: "refused", text: "er", reply: { kind: "failed", message: "boom" } } }),
  );
  expect(refused).toEqual({ lines: [], note: { text: "boom", failed: true } });
  const failed = pickList(
    input({ search: { kind: "failed", text: "er", cause: { kind: "WorkerStopped" } } }),
  );
  expect(failed).toEqual({
    lines: [],
    note: { text: "Could not search people: yamt's worker stopped; try again.", failed: true },
  });
});
