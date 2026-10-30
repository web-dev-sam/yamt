import type * as Generated from "./bindings";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import {
  DROPPED_LABEL,
  FIXTURE_ME,
  FIXTURE_REPOSITORY,
  fixtureRows,
  LOGGED_OUT_DETAIL,
  OPEN_REPLIES,
  PAGE_FAILED_MESSAGE,
  REFUSED_MESSAGE,
} from "./fixtureMergeRequestData";
import type { Log } from "./log";
import { toMergeRequestPage, toOpenReply } from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";

export type MergeRequestScript =
  | "list"
  | "slow"
  | "many"
  | "empty"
  | "noGlab"
  | "loggedOut"
  | "timeout"
  | "refused"
  | "pageFails";

type Scripted = {
  readonly pages: readonly (readonly Generated.MergeRequestRow[])[];
  readonly end: Generated.ListEnd;
};

const SCRIPTS: Readonly<Record<MergeRequestScript, true>> = {
  list: true,
  slow: true,
  many: true,
  empty: true,
  noGlab: true,
  loggedOut: true,
  timeout: true,
  refused: true,
  pageFails: true,
};

const LIST_PAGE = 20;
const LIST_PAGES = 2;
const MANY_PAGE = 100;
const MANY_PAGES = 5;
const SLOW_PAGE_MS = 1000;
const OPEN_PAUSE_MS = 1000;
const LOADED: Generated.ListEnd = { kind: "loaded" };

function isScript(name: string): name is MergeRequestScript {
  return Object.hasOwn(SCRIPTS, name);
}

function shownScript(log: Log, search: string): MergeRequestScript | null {
  const asked = new URLSearchParams(search).get("mr");
  if (asked === null || asked === "") {
    return null;
  }
  if (isScript(asked)) {
    return asked;
  }
  log.info("mergeRequests.fixture_miss", { mr: asked, known: Object.keys(SCRIPTS).join(", ") });
  return null;
}

function pages(size: number, count: number): Generated.MergeRequestRow[][] {
  return Array.from({ length: count }, (_, page) => fixtureRows(page * size, size));
}

function withoutDroppedLabel(
  rows: readonly Generated.MergeRequestRow[],
): Generated.MergeRequestRow[] {
  return rows.map((row) => ({
    ...row,
    labels: row.labels.filter((label) => label !== DROPPED_LABEL),
  }));
}

function scripted(script: MergeRequestScript, load: number): Scripted {
  switch (script) {
    case "list": {
      const first = pages(LIST_PAGE, LIST_PAGES);
      return { pages: load === 1 ? first : first.map(withoutDroppedLabel), end: LOADED };
    }
    case "slow":
      return { pages: pages(LIST_PAGE, LIST_PAGES), end: LOADED };
    case "many":
      return {
        pages: pages(MANY_PAGE, MANY_PAGES),
        end: { kind: "cut", limit: MANY_PAGE * MANY_PAGES },
      };
    case "empty":
      return { pages: [[]], end: LOADED };
    case "noGlab":
      return { pages: [], end: { kind: "glabMissing" } };
    case "loggedOut":
      return { pages: [], end: { kind: "notLoggedIn", detail: LOGGED_OUT_DETAIL } };
    case "timeout":
      return { pages: [], end: { kind: "failed", message: TIMED_OUT } };
    case "refused":
      return { pages: [], end: { kind: "failed", message: REFUSED_MESSAGE } };
    case "pageFails":
      return { pages: pages(LIST_PAGE, 1), end: { kind: "failed", message: PAGE_FAILED_MESSAGE } };
    default: {
      const _exhaustive: never = script;
      return _exhaustive;
    }
  }
}

/** `?mr=<script>` scripts GitLab's answers; without it the window has no GitLab project. */
export function createFixtureMergeRequests(log: Log, search: string): MergeRequestSource {
  const script = shownScript(log, search);
  let loads = 0;
  return {
    async findGitLabProject() {
      return {
        ok: true,
        value:
          script === null ? { kind: "none" } : { kind: "found", repository: FIXTURE_REPOSITORY },
      };
    },
    async listMergeRequests(onPage) {
      if (script === null) {
        return { ok: true, value: LOADED };
      }
      loads += 1;
      const { pages: sent, end } = scripted(script, loads);
      for (const rows of sent) {
        if (script === "slow") {
          await pause(SLOW_PAGE_MS);
        }
        onPage(toMergeRequestPage({ me: FIXTURE_ME, rows: [...rows] }));
      }
      return { ok: true, value: end };
    },
    async openMergeRequest(iid) {
      await pause(OPEN_PAUSE_MS);
      return { ok: true, value: toOpenReply(OPEN_REPLIES[iid] ?? { kind: "opened" }) };
    },
    async openJobPage(page) {
      log.info("mergeRequests.fixture_job", { page });
      return { ok: true, value: { kind: "opened" } };
    },
  };
}
