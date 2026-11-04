import type * as Generated from "./bindings";
import { toLinksReply } from "./descriptionDomain";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import { LOGGED_OUT_DETAIL, ORIGIN } from "./fixtureMergeRequestData";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";

const RICH_LINKS_IID = 640;
const FAILS_ONCE_IID = 636;
const LOGGED_OUT_IID = 634;
const LINKS_PAUSE_MS = 400;

function onServer(path: string): string {
  return `https://gitlab.example/${path}`;
}

function epics(): Generated.LinkedEpic[] {
  return [
    {
      reference: "&3",
      page: onServer("groups/taskboard/-/epics/3"),
      shown: { title: "Board redesign", closed: false },
    },
    {
      reference: "&4",
      page: onServer("groups/taskboard/-/epics/4"),
      shown: { title: "Old board", closed: true },
    },
    { reference: "design&2", page: onServer("groups/design/-/epics/2"), shown: null },
  ];
}

function issues(): Generated.LinkedIssue[] {
  const board: Generated.LinkedParent = {
    reference: "&3",
    title: "Board redesign",
    page: onServer("groups/taskboard/-/work_items/3"),
  };
  const snooze: Generated.LinkedParent = {
    reference: "#12",
    title: "Snooze a reminder",
    page: `${ORIGIN}/-/work_items/12`,
  };
  return [
    {
      reference: snooze.reference,
      page: snooze.page,
      shown: { title: snooze.title, closed: false, parent: board },
    },
    {
      reference: "#13",
      page: `${ORIGIN}/-/work_items/13`,
      shown: { title: "Write the snooze test", closed: false, parent: snooze },
    },
    {
      reference: "other/lib#5",
      page: onServer("other/lib/-/issues/5"),
      shown: { title: "Fix date parsing", closed: true, parent: null },
    },
    { reference: "secret/vault#9", page: onServer("secret/vault/-/issues/9"), shown: null },
  ];
}

function commits(): Generated.LinkedCommit[] {
  return [
    {
      reference: "fa3335f3",
      page: `${ORIGIN}/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f`,
      title: "Backfill due dates",
    },
    {
      reference: "a1b2c3d4…e5f6a7b8",
      page: `${ORIGIN}/-/compare/a1b2c3d4...e5f6a7b8`,
      title: "Commits a1b2c3d4 through e5f6a7b8",
    },
    {
      reference: "secret/vault@0badc0de",
      page: onServer("secret/vault/-/commit/0badc0de"),
      title: null,
    },
  ];
}

function fixtureLinks(iid: number, firstAsk: boolean): Generated.LinksReply {
  const rich: Generated.LinksReply = {
    kind: "read",
    links: { epics: epics(), issues: issues(), commits: commits() },
  };
  switch (iid) {
    case RICH_LINKS_IID:
      return rich;
    case FAILS_ONCE_IID:
      return firstAsk ? { kind: "failed", message: TIMED_OUT } : rich;
    case LOGGED_OUT_IID:
      return { kind: "notLoggedIn", detail: LOGGED_OUT_DETAIL };
    default:
      return { kind: "read", links: { epics: [], issues: [], commits: [] } };
  }
}

export function linksScript(log: Log): Pick<MergeRequestSource, "readLinks"> {
  const asked = new Set<number>();
  return {
    async readLinks(iid) {
      log.info("mergeRequests.fixture_links", { iid });
      const firstAsk = !asked.has(iid);
      asked.add(iid);
      await pause(LINKS_PAUSE_MS);
      return { ok: true, value: toLinksReply(fixtureLinks(iid, firstAsk)) };
    },
  };
}
