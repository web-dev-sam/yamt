import { afterEach, expect, test, vi } from "vitest";

import type { DescriptionLinks, LinksReply } from "./descriptionDomain";
import { isMergeRequestIid, type SourceResult } from "./domain";
import { linksScript } from "./fixtureMergeRequestLinks";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";
import { branded } from "./validate";

const PAUSE_MS = 400;
const ORIGIN = "https://gitlab.example/taskboard/taskboard";

afterEach(() => {
  vi.useRealTimers();
});

function quietLog(lines: string[]): Log {
  function keep(event: string, fields: Record<string, string | number | boolean> = {}): void {
    lines.push(`${event} ${JSON.stringify(fields)}`);
  }
  return { debug: keep, info: keep, warn: keep, error: keep };
}

function script(lines: string[] = []): Pick<MergeRequestSource, "readLinks"> {
  return linksScript(quietLog(lines));
}

async function asked(
  linked: Pick<MergeRequestSource, "readLinks">,
  iid: number,
): Promise<SourceResult<LinksReply>> {
  const answer = linked.readLinks(branded(iid, isMergeRequestIid, "iid"));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  return answer;
}

async function linksOf(iid: number): Promise<DescriptionLinks> {
  vi.useFakeTimers();
  const result = await asked(script(), iid);
  if (!result.ok || result.value.kind !== "read") {
    throw new Error(`!${iid} did not read`);
  }
  return result.value.links;
}

test("the_rich_row_holds_every_kind_of_line", async () => {
  const { epics, issues, commits } = await linksOf(640);

  expect(epics.map((epic) => [epic.reference, epic.shown])).toEqual([
    ["&3", { title: "Board redesign", closed: false }],
    ["&4", { title: "Old board", closed: true }],
    ["design&2", null],
  ]);
  expect(issues.map((issue) => [issue.reference, issue.shown])).toEqual([
    [
      "#12",
      {
        title: "Snooze a reminder",
        closed: false,
        parent: {
          reference: "&3",
          title: "Board redesign",
          page: "https://gitlab.example/groups/taskboard/-/work_items/3",
        },
      },
    ],
    [
      "#13",
      {
        title: "Write the snooze test",
        closed: false,
        parent: { reference: "#12", title: "Snooze a reminder", page: `${ORIGIN}/-/work_items/12` },
      },
    ],
    ["other/lib#5", { title: "Fix date parsing", closed: true, parent: null }],
    ["secret/vault#9", null],
  ]);
  expect(commits.map((commit) => [commit.reference, commit.title])).toEqual([
    ["fa3335f3", "Backfill due dates"],
    ["a1b2c3d4…e5f6a7b8", "Commits a1b2c3d4 through e5f6a7b8"],
    ["secret/vault@0badc0de", null],
  ]);
  const pages = [...epics, ...issues, ...commits].map((line) => line.page);
  expect(new Set(pages).size).toBe(pages.length);
  expect(pages).toEqual([
    "https://gitlab.example/groups/taskboard/-/epics/3",
    "https://gitlab.example/groups/taskboard/-/epics/4",
    "https://gitlab.example/groups/design/-/epics/2",
    `${ORIGIN}/-/work_items/12`,
    `${ORIGIN}/-/work_items/13`,
    "https://gitlab.example/other/lib/-/issues/5",
    "https://gitlab.example/secret/vault/-/issues/9",
    `${ORIGIN}/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f`,
    `${ORIGIN}/-/compare/a1b2c3d4...e5f6a7b8`,
    "https://gitlab.example/secret/vault/-/commit/0badc0de",
  ]);
});

test.each([639, 637, 600])("row !%i reads three empty groups", async (iid) => {
  expect(await linksOf(iid)).toEqual({ epics: [], issues: [], commits: [] });
});

test("the_logged_out_row_is_refused_every_time", async () => {
  vi.useFakeTimers();
  const linked = script();
  const refused = {
    ok: true,
    value: {
      kind: "notLoggedIn",
      detail:
        "gitlab.example: No token found (checked config file, keyring, and environment variables).",
    },
  };
  expect(await asked(linked, 634)).toEqual(refused);
  expect(await asked(linked, 634)).toEqual(refused);
});

test("the_failing_row_fails_once_then_reads", async () => {
  vi.useFakeTimers();
  const linked = script();

  expect(await asked(linked, 636)).toEqual({
    ok: true,
    value: { kind: "failed", message: "glab timed out" },
  });
  const rich = { ok: true, value: { kind: "read", links: await linksOf(640) } };
  expect(await asked(linked, 636)).toEqual(rich);
  expect(await asked(linked, 636)).toEqual(rich);
  expect(await asked(script(), 636)).toMatchObject({ value: { kind: "failed" } });
});

test("each_ask_is_logged_before_its_answer", async () => {
  vi.useFakeTimers();
  const lines: string[] = [];
  let answer: unknown = null;
  void script(lines)
    .readLinks(branded(637, isMergeRequestIid, "iid"))
    .then((result) => {
      answer = result;
    });

  expect(lines).toEqual(['mergeRequests.fixture_links {"iid":637}']);
  await vi.advanceTimersByTimeAsync(PAUSE_MS - 1);
  expect(answer).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(answer).toEqual({
    ok: true,
    value: { kind: "read", links: { epics: [], issues: [], commits: [] } },
  });
});
