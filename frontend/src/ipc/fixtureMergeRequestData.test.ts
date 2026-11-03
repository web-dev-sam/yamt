import { expect, test } from "vitest";

import { filtered, type Filters } from "../mergeRequests";
import type * as Generated from "./bindings";
import { fixtureRows, fixtureUploadedPicture, LOCAL_CHECKED } from "./fixtureMergeRequestData";
import { toMergeRequestPage } from "./mergeRequestDomain";

const LISTED = 40;

function rowOf(rows: readonly Generated.MergeRequestRow[], iid: number): Generated.MergeRequestRow {
  const found = rows.find((row) => row.iid === iid);
  if (found === undefined) {
    throw new Error(`no fixture row !${iid}`);
  }
  return found;
}

test("the readiness cycle holds each of its eight positions, a fork's conflict second and a draft's blocker last (catches a page script finding no row in a state)", () => {
  const rows = fixtureRows(0, LISTED);
  expect(rowOf(rows, 640).readiness).toEqual({ kind: "conflicts", also: [] });
  expect(rowOf(rows, 639).readiness).toEqual({ kind: "conflicts", also: [] });
  expect(rowOf(rows, 638).readiness).toEqual({ kind: "ready" });
  expect(rowOf(rows, 637).readiness).toEqual({ kind: "needsRebase" });
  expect(rowOf(rows, 636).readiness).toEqual({
    kind: "conflicts",
    also: [{ kind: "discussions" }],
  });
  expect(rowOf(rows, 635).readiness).toEqual({ kind: "checking" });
  expect(rowOf(rows, 626).readiness).toEqual({
    kind: "blocked",
    reason: { kind: "pipelineMustPass" },
  });
  expect(rowOf(rows, 634).readiness).toEqual({ kind: "blocked", reason: { kind: "draft" } });
  expect(rowOf(rows, 620).readiness).toEqual({
    kind: "conflicts",
    also: [{ kind: "discussions" }, { kind: "draft" }],
  });
  expect(rowOf(rows, 633).readiness).toEqual({
    kind: "blocked",
    reason: { kind: "other", status: "MERGE_TRAIN_STUCK" },
  });
  expect(rows.filter((row) => row.fromFork).map((row) => row.iid)).toEqual([
    639, 631, 623, 615, 607,
  ]);
});

test("every fifth row has no size and the others grow with the row (catches a size cycle off by one)", () => {
  const rows = fixtureRows(0, LISTED);
  expect(rowOf(rows, 636).size).toBeNull();
  expect(rowOf(rows, 640).size).toEqual({ additions: 12, deletions: 0, files: 1 });
  expect(rowOf(rows, 633).size).toEqual({ additions: 96, deletions: 15, files: 2 });
  expect(rows.filter((row) => row.size === null).map((row) => row.iid)).toEqual([
    636, 631, 626, 621, 616, 611, 606, 601,
  ]);
});

test("each locally checked row is a listed row whose readiness the check changes (catches a fixture result Rust would never send)", () => {
  const rows = fixtureRows(0, LISTED);
  for (const checked of LOCAL_CHECKED) {
    expect(rowOf(rows, checked.iid).readiness).not.toEqual(checked.readiness);
  }
  expect(LOCAL_CHECKED.map((checked) => checked.iid)).toEqual([640, 638, 635]);
});

test("the_owners_example_keeps_six_rows: Assignee not Me and Label frontend over ?mr=list's 40 rows", () => {
  const { rows } = toMergeRequestPage(
    { me: "sam", rows: fixtureRows(0, LISTED) },
    fixtureUploadedPicture,
  );
  const filters: Filters = {
    assignee: [{ value: { kind: "me" }, mode: "excluded" }],
    reviewer: [],
    label: [{ value: { kind: "label", title: "frontend" }, mode: "included" }],
    draft: "all",
    review: null,
  };
  expect(filtered(rows, filters, "sam").map((row) => row.iid)).toEqual([
    639, 627, 623, 619, 607, 603,
  ]);
});

test("!635, the row ?mr=local finds merging cleanly, changes nothing: its size is zero", () => {
  expect(rowOf(fixtureRows(0, LISTED), 635).size).toEqual({ additions: 0, deletions: 0, files: 0 });
});

test("every 8th row from index 2 stacks its assignee and three reviewers in three states, and dmitri is a done reviewer on a re-requestable one (catches a fixture without a +1)", () => {
  const rows = fixtureRows(0, LISTED);
  const stacked = rows.filter((row) => row.reviewers.length === 3);
  expect(stacked.map((row) => row.iid)).toEqual([638, 630, 622, 614, 606]);
  for (const row of stacked) {
    const reviewers = row.reviewers.map((reviewer) => reviewer.person.username);
    const assignees = row.assignees.map((person) => person.username);
    expect(assignees).toHaveLength(1);
    expect(reviewers.filter((username) => assignees.includes(username))).toEqual([]);
    expect(new Set(row.reviewers.map((reviewer) => reviewer.state)).size).toBe(3);
  }
  expect(
    stacked.some(
      (row) =>
        row.mayRerequest &&
        row.reviewers.some(
          (reviewer) => reviewer.person.username === "dmitri" && reviewer.state !== "requested",
        ),
    ),
  ).toBe(true);
});

test("authors, review states, approvers and the re-request permission follow their cycles", () => {
  const rows = fixtureRows(0, LISTED);
  expect(rows.slice(0, 5).map((row) => row.author?.username)).toEqual([
    "anna",
    "ben",
    "chiara",
    "dmitri",
    "sam",
  ]);
  expect(rows.slice(0, 2).map((row) => row.reviewers.map((reviewer) => reviewer.state))).toEqual([
    [],
    ["reviewed"],
  ]);
  expect(rowOf(rows, 636).reviewers.map((reviewer) => reviewer.state)).toEqual(["requested"]);
  expect(rowOf(rows, 637).approvedBy.map((person) => person.username)).toEqual([
    "sam",
    "anna",
    "ben",
  ]);
  expect(rows.filter((row) => !row.mayRerequest).map((row) => row.iid)).toEqual([
    632, 623, 614, 605,
  ]);
});

test("label colours are CSS colour names, and docs has none", () => {
  const labels = fixtureRows(0, LISTED).flatMap((row) => row.labels);
  const colours = new Map(labels.map((label) => [label.title, label.colors]));
  expect(Object.fromEntries(colours)).toEqual({
    backend: { background: "teal", text: "white" },
    frontend: { background: "steelblue", text: "white" },
    ui: { background: "gold", text: "black" },
    docs: null,
    bug: { background: "crimson", text: "white" },
  });
});

test("no picture address outside data: (catches the fixture loading a remote picture)", () => {
  const { rows } = toMergeRequestPage(
    { me: "sam", rows: fixtureRows(0, LISTED) },
    fixtureUploadedPicture,
  );
  const people = rows.flatMap((row) => [
    ...(row.author === null ? [] : [row.author]),
    ...row.assignees,
    ...row.reviewers.map((reviewer) => reviewer.person),
    ...row.approvedBy,
  ]);
  const pictures = new Map(people.map((person) => [person.username, person.picture]));
  expect(people.every(({ picture }) => picture === null || picture.startsWith("data:"))).toBe(true);
  expect(pictures.get("sam")).toMatch(/^data:image\/png;base64,iVBOR/u);
  expect(pictures.get("anna")).toBe(pictures.get("sam"));
  expect(pictures.get("ben")).toBe("data:image/png;base64,AAAA");
  expect([pictures.get("chiara"), pictures.get("dmitri")]).toEqual([null, null]);
});
