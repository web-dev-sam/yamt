import { beforeAll, expect, test, vi } from "vitest";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type DescriptionLinks,
  type LinkedIssue,
} from "../ipc";
import {
  CLOSED,
  GROUP_HEADINGS,
  linkBox,
  linksFailedText,
  LINKS_LOADING,
  NO_LINKS,
  NOT_SHOWN,
  parentTooltip,
  type LinkBox,
  type LinkDetail,
  type LinkGroup,
  type LinkLine,
} from "./mergeRequestLinkLines";
import type { LinksLoad } from "./mergeRequestLinks";

const PLATFORM = "Linux x86_64";
const FIXTURE_PAUSE_MS = 400;
const RICH_IID = 640;
const SERVER = "https://gitlab.example";
const ORIGIN = `${SERVER}/taskboard/taskboard`;
const NONE: DescriptionLinks = { epics: [], issues: [], commits: [] };

let RICH: DescriptionLinks = NONE;

beforeAll(async () => {
  if (!isMergeRequestIid(RICH_IID)) {
    throw new Error("not an iid");
  }
  vi.useFakeTimers();
  const answer = createFixtureCompareSource(log, "", {}).readLinks(RICH_IID);
  await vi.advanceTimersByTimeAsync(FIXTURE_PAUSE_MS);
  const result = await answer;
  vi.useRealTimers();
  if (!result.ok || result.value.kind !== "read") {
    throw new Error("the fixture's !640 did not read");
  }
  RICH = result.value.links;
});

function read(links: DescriptionLinks): LinksLoad {
  return { kind: "read", links };
}

function groupsOf(box: LinkBox): readonly LinkGroup[] {
  if (box.kind !== "groups") {
    throw new Error(`expected groups, got ${box.text}`);
  }
  return box.groups;
}

function lineOf(box: LinkBox, reference: string): LinkLine {
  const line = groupsOf(box)
    .flatMap((group) => group.lines)
    .find((candidate) => candidate.reference === reference);
  if (line === undefined) {
    throw new Error(`no line ${reference}`);
  }
  return line;
}

function words({ detail }: { readonly detail: LinkDetail }): string {
  switch (detail.kind) {
    case "shown":
      return detail.closed ? `${detail.title} ${CLOSED}` : detail.title;
    case "notShown":
      return NOT_SHOWN;
    default: {
      const _exhaustive: never = detail;
      return _exhaustive;
    }
  }
}

function issuesOnly(issues: readonly LinkedIssue[]): DescriptionLinks {
  return { ...NONE, issues };
}

test("groups_come_epics_issues_commits_and_an_empty_group_is_left_out", () => {
  const rich = groupsOf(linkBox(read(RICH), PLATFORM));
  expect(rich.map((group) => [group.kind, group.heading])).toEqual([
    ["epics", "Epics"],
    ["issues", "Issues"],
    ["commits", "Commits"],
  ]);
  expect(rich.map((group) => group.lines.map((line) => line.reference))).toEqual([
    ["&3", "&4", "design&2"],
    ["#12", "#13", "other/lib#5", "secret/vault#9"],
    ["fa3335f3", "a1b2c3d4…e5f6a7b8", "secret/vault@0badc0de"],
  ]);
  expect(GROUP_HEADINGS).toEqual({ epics: "Epics", issues: "Issues", commits: "Commits" });

  const noIssues = groupsOf(linkBox(read({ ...RICH, issues: [] }), PLATFORM));
  expect(noIssues.map((group) => group.kind)).toEqual(["epics", "commits"]);
  const onlyCommits = groupsOf(linkBox(read({ ...NONE, commits: RICH.commits }), PLATFORM));
  expect(onlyCommits.map((group) => group.kind)).toEqual(["commits"]);
  const onlyEpics = groupsOf(linkBox(read({ ...NONE, epics: RICH.epics }), PLATFORM));
  expect(onlyEpics.map((group) => group.kind)).toEqual(["epics"]);
});

test("a_line_keeps_its_reference_title_and_closed", () => {
  const box = linkBox(read(RICH), PLATFORM);
  expect(lineOf(box, "&3").detail).toEqual({
    kind: "shown",
    title: "Board redesign",
    closed: false,
  });
  expect(lineOf(box, "&4").detail).toEqual({ kind: "shown", title: "Old board", closed: true });
  expect(lineOf(box, "#13").detail).toEqual({
    kind: "shown",
    title: "Write the snooze test",
    closed: false,
  });
  expect(lineOf(box, "other/lib#5").detail).toEqual({
    kind: "shown",
    title: "Fix date parsing",
    closed: true,
  });
  expect(lineOf(box, "fa3335f3").detail).toEqual({
    kind: "shown",
    title: "Backfill due dates",
    closed: false,
  });
  expect(lineOf(box, "#12").page).toBe(`${ORIGIN}/-/work_items/12`);
  expect(lineOf(box, "&3").page).toBe(`${SERVER}/groups/taskboard/-/epics/3`);
  expect(lineOf(box, "fa3335f3").page).toBe(
    `${ORIGIN}/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f`,
  );
  expect(groupsOf(box).flatMap((group) => group.lines.map(words))).toEqual([
    "Board redesign",
    `Old board ${CLOSED}`,
    NOT_SHOWN,
    "Snooze a reminder",
    "Write the snooze test",
    `Fix date parsing ${CLOSED}`,
    NOT_SHOWN,
    "Backfill due dates",
    "Commits a1b2c3d4 through e5f6a7b8",
    NOT_SHOWN,
  ]);
  expect(CLOSED).toBe("Closed");
});

test("a_thing_gitlab_did_not_show_says_not_found_or_no_access_and_keeps_its_page", () => {
  const box = linkBox(read(RICH), PLATFORM);
  expect(NOT_SHOWN).toBe("Not found or no access");
  expect(lineOf(box, "design&2")).toEqual({
    reference: "design&2",
    detail: { kind: "notShown" },
    page: `${SERVER}/groups/design/-/epics/2`,
    parent: null,
  });
  expect(lineOf(box, "secret/vault#9")).toEqual({
    reference: "secret/vault#9",
    detail: { kind: "notShown" },
    page: `${SERVER}/secret/vault/-/issues/9`,
    parent: null,
  });
  expect(lineOf(box, "secret/vault@0badc0de")).toEqual({
    reference: "secret/vault@0badc0de",
    detail: { kind: "notShown" },
    page: `${SERVER}/secret/vault/-/commit/0badc0de`,
    parent: null,
  });
});

test("only_an_issue_with_a_parent_gets_the_parent_button_with_its_tooltip", () => {
  const box = linkBox(read(RICH), PLATFORM);
  expect(lineOf(box, "#12").parent).toEqual({
    page: `${SERVER}/groups/taskboard/-/work_items/3`,
    tooltip: "Open parent: &3 Board redesign",
  });
  expect(lineOf(box, "#13").parent).toEqual({
    page: `${ORIGIN}/-/work_items/12`,
    tooltip: "Open parent: #12 Snooze a reminder",
  });
  const parented = groupsOf(box).flatMap((group) =>
    group.lines.filter((line) => line.parent !== null).map((line) => line.reference),
  );
  expect(parented).toEqual(["#12", "#13"]);
  const [snooze] = RICH.issues;
  if (snooze === undefined || snooze.shown === null) {
    throw new Error("the fixture's #12 is not shown");
  }
  const { parent } = snooze.shown;
  if (parent === null) {
    throw new Error("the fixture's #12 has no parent");
  }
  expect(parentTooltip(parent)).toBe("Open parent: &3 Board redesign");
  const hidden = linkBox(read(issuesOnly([{ ...snooze, shown: null }])), PLATFORM);
  expect(lineOf(hidden, "#12").parent).toBeNull();
});

test("loading_empty_refused_and_failed_have_their_sentence_and_only_failures_retry", () => {
  expect(linkBox(undefined, PLATFORM)).toEqual({
    kind: "status",
    text: LINKS_LOADING,
    failed: false,
  });
  expect(linkBox({ kind: "loading" }, PLATFORM)).toEqual({
    kind: "status",
    text: "Loading…",
    failed: false,
  });
  expect(linkBox(read(NONE), PLATFORM)).toEqual({ kind: "status", text: NO_LINKS, failed: false });
  expect(NO_LINKS).toBe("No linked epics, issues or commits.");

  const refusals: readonly [Extract<LinksLoad, { kind: "refused" }>, string][] = [
    [
      { kind: "refused", reply: { kind: "glabMissing" } },
      "glab is not installed (not found on PATH) — install glab, then Retry.",
    ],
    [
      { kind: "refused", reply: { kind: "notLoggedIn", detail: "gitlab.example: No token" } },
      "glab is not logged in: gitlab.example: No token — run glab auth login in a terminal, then Retry.",
    ],
    [
      { kind: "refused", reply: { kind: "failed", message: "glab timed out" } },
      "Could not read the links: glab timed out",
    ],
  ];
  for (const [load, sentence] of refusals) {
    expect(linksFailedText(load, PLATFORM)).toBe(sentence);
    expect(linkBox(load, PLATFORM)).toEqual({ kind: "status", text: sentence, failed: true });
  }
  const thrown: LinksLoad = { kind: "failed", cause: { kind: "WorkerStopped" } };
  expect(linkBox(thrown, PLATFORM)).toEqual({
    kind: "status",
    text: "Could not read the links: yamt's worker stopped; try again.",
    failed: true,
  });
});
