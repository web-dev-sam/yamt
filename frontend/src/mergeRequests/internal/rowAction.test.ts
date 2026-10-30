import { expect, test } from "vitest";

import {
  rowAction,
  type ActionRow,
  type LocalMerge,
  type Readiness,
  type RowAction,
} from "../index";

const FREE: LocalMerge = { kind: "free" };
const CONFLICTS: Readiness = { kind: "conflicts", also: [] };

function row(iid: number, readiness: Readiness = CONFLICTS, fromFork = false): ActionRow {
  return { iid, readiness, fromFork };
}

function merging(iid: number, windowOpen = false): LocalMerge {
  return { kind: "merging", iid, windowOpen };
}

test.each<Readiness>([
  { kind: "ready" },
  { kind: "blocked", reason: { kind: "draft" } },
  { kind: "conflicts", also: [] },
])("the merging row offers Continue whatever GitLab now says (%j)", (readiness) => {
  const continued: RowAction = {
    kind: "continue",
    label: "Continue merging !12",
    state: { kind: "enabled" },
  };
  expect(rowAction(row(12, readiness), merging(12), false)).toEqual(continued);
});

test("the merging row's Continue is disabled while its window is open, running or not", () => {
  const open: RowAction = {
    kind: "continue",
    label: "Continue merging !12",
    state: { kind: "disabled", hover: "Its merge window is already open" },
  };
  expect(rowAction(row(12), merging(12, true), false)).toEqual(open);
  expect(rowAction(row(12), merging(12, true), true)).toEqual(open);
});

test("a running Continue shows as running", () => {
  expect(rowAction(row(12), merging(12), true)).toEqual({
    kind: "continue",
    label: "Continue merging !12",
    state: { kind: "running" },
  });
});

test.each<Readiness>([
  { kind: "ready" },
  { kind: "needsRebase" },
  { kind: "checking" },
  { kind: "blocked", reason: { kind: "discussions" } },
])("a row without conflicts has no button (%j)", (readiness) => {
  expect(rowAction(row(12, readiness), FREE, false)).toEqual({ kind: "none" });
  expect(rowAction(row(12, readiness), merging(21), false)).toEqual({ kind: "none" });
});

test("a fork's row is refused before another merge is named", () => {
  const fork: RowAction = {
    kind: "resolve",
    label: "Resolve conflicts of !12",
    state: { kind: "disabled", hover: "Resolving a fork's merge request is not supported" },
  };
  expect(rowAction(row(12, CONFLICTS, true), merging(21), false)).toEqual(fork);
  expect(rowAction(row(12, CONFLICTS, true), FREE, false)).toEqual(fork);
});

test("another unfinished merge disables Resolve and names its iid, even while running", () => {
  const blocked: RowAction = {
    kind: "resolve",
    label: "Resolve conflicts of !12",
    state: { kind: "disabled", hover: "The merge of !21 is not finished in this repository" },
  };
  expect(rowAction(row(12), merging(21), false)).toEqual(blocked);
  expect(rowAction(row(12), merging(21, true), true)).toEqual(blocked);
});

test("a running Resolve shows as running", () => {
  expect(rowAction(row(12), FREE, true)).toEqual({
    kind: "resolve",
    label: "Resolve conflicts of !12",
    state: { kind: "running" },
  });
});

test("a conflicting row with nothing in the way offers Resolve enabled", () => {
  expect(rowAction(row(12, { kind: "conflicts", also: [{ kind: "draft" }] }), FREE, false)).toEqual(
    { kind: "resolve", label: "Resolve conflicts of !12", state: { kind: "enabled" } },
  );
});
