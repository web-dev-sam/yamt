import type * as Generated from "./bindings";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import {
  DROPPED_LABEL,
  FIXTURE_ME,
  FIXTURE_REPOSITORY,
  fixtureRows,
  fixtureUploadedPicture,
  LOCAL_CHECKED,
  LOGGED_OUT_DETAIL,
  OPEN_REPLIES,
  PAGE_FAILED_MESSAGE,
  REFUSED_MESSAGE,
  REFUSING_REVIEWER,
} from "./fixtureMergeRequestData";
import { descriptionScript } from "./fixtureMergeRequestDescriptions";
import { discussionsScript } from "./fixtureMergeRequestDiscussions";
import { linksScript } from "./fixtureMergeRequestLinks";
import { fixtureJobLog } from "./fixtureMergeRequestLogs";
import { peopleScript } from "./fixtureMergeRequestPeople";
import type { Log } from "./log";
import {
  toCheckedRow,
  toMergeRequestPage,
  toOpenReply,
  toRerequestReply,
  type CheckedRow,
  type ContinueMergeReply,
  type LocalMerge,
  type ResolveReply,
} from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";

export type MergeRequestScript =
  | "list"
  | "local"
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
  local: true,
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
const LISTED_ROWS = MANY_PAGE * MANY_PAGES;
const SLOW_PAGE_MS = 1000;
const LOCAL_CHECK_MS = 1000;
const OPEN_PAUSE_MS = 1000;
const RE_REQUEST_PAUSE_MS = 1000;
const LOG_PAUSE_MS = 400;
const REFUSED_REREQUEST = "You are not allowed to re-request a review on this merge request.";
const LOADED: Generated.ListEnd = { kind: "loaded" };
const CLEAN_IID = 632;
const LOCAL_AHEAD_IID = 624;
const WINDOW_FAILS_IID = 616;
const FIXTURE_TARGET = "main";
const WINDOW_FAILED_MESSAGE = "yamt: not found";

function isScript(name: string): name is MergeRequestScript {
  return Object.hasOwn(SCRIPTS, name);
}

function fixtureProject(script: MergeRequestScript | null): Generated.GitLabProject {
  return script === null ? { kind: "none" } : { kind: "found", repository: FIXTURE_REPOSITORY };
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
    labels: row.labels.filter((label) => label.title !== DROPPED_LABEL),
  }));
}

function scripted(script: MergeRequestScript, load: number): Scripted {
  switch (script) {
    case "list":
    case "local": {
      const first = pages(LIST_PAGE, LIST_PAGES);
      return { pages: load === 1 ? first : first.map(withoutDroppedLabel), end: LOADED };
    }
    case "slow":
      return { pages: pages(LIST_PAGE, LIST_PAGES), end: LOADED };
    case "many":
      return {
        pages: pages(MANY_PAGE, MANY_PAGES),
        end: { kind: "cut", limit: LISTED_ROWS },
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

function checkLater(onChecked: (row: CheckedRow) => void): void {
  setTimeout(() => {
    for (const row of LOCAL_CHECKED) {
      onChecked(toCheckedRow(row));
    }
  }, LOCAL_CHECK_MS);
}

function fixtureBranch(iid: number): string {
  return `feature/fixture-${iid}`;
}

function resolveReply(iid: number): ResolveReply {
  const branch = fixtureBranch(iid);
  const started = { branch, target: FIXTURE_TARGET, conflicts: iid !== CLEAN_IID };
  switch (iid) {
    case LOCAL_AHEAD_IID:
      return { kind: "refused", refusal: { kind: "localAhead", branch } };
    case WINDOW_FAILS_IID:
      return { kind: "windowFailed", started, message: WINDOW_FAILED_MESSAGE };
    default:
      return { kind: "started", started };
  }
}

function continueReply(localMerge: LocalMerge, iid: number): ContinueMergeReply {
  if (localMerge.kind !== "merging" || localMerge.iid !== iid) {
    return { kind: "ended" };
  }
  return { kind: "opened", branch: fixtureBranch(iid), target: FIXTURE_TARGET };
}

function rerequestReply(iid: number, username: string): Generated.RerequestReply {
  if (username === REFUSING_REVIEWER) {
    return { kind: "refused", message: REFUSED_REREQUEST };
  }
  const listed = fixtureRows(0, LISTED_ROWS).find((row) => row.iid === iid);
  const reviewers = listed?.reviewers ?? [];
  if (!reviewers.some((reviewer) => reviewer.person.username === username)) {
    return { kind: "notReviewer" };
  }
  return {
    kind: "requested",
    reviewers: reviewers.map((reviewer) =>
      reviewer.person.username === username ? { ...reviewer, state: "requested" } : reviewer,
    ),
  };
}

function localMergeScript(): Pick<
  MergeRequestSource,
  "resolveMergeRequest" | "continueMergeRequest" | "findLocalMerge"
> {
  let localMerge: LocalMerge = { kind: "free" };
  return {
    async resolveMergeRequest(iid) {
      await pause(OPEN_PAUSE_MS);
      const reply = resolveReply(iid);
      if (reply.kind !== "refused") {
        localMerge = { kind: "merging", iid, windowOpen: false };
      }
      return { ok: true, value: reply };
    },
    async continueMergeRequest(iid) {
      await pause(OPEN_PAUSE_MS);
      const reply = continueReply(localMerge, iid);
      if (reply.kind === "opened") {
        localMerge = { kind: "merging", iid, windowOpen: true };
      }
      return { ok: true, value: reply };
    },
    async findLocalMerge() {
      return { ok: true, value: localMerge };
    },
  };
}

function rerequestScript(log: Log): Pick<MergeRequestSource, "rerequestReview"> {
  return {
    async rerequestReview(iid, username) {
      log.info("mergeRequests.fixture_rerequest", { iid, username });
      await pause(RE_REQUEST_PAUSE_MS);
      return {
        ok: true,
        value: toRerequestReply(rerequestReply(iid, username), fixtureUploadedPicture),
      };
    },
  };
}

function pageScript(log: Log): Pick<MergeRequestSource, "openPage" | "readJobLog"> {
  return {
    async openPage(page) {
      log.info("mergeRequests.fixture_page", { page });
      return { ok: true, value: { kind: "opened" } };
    },
    async readJobLog(page) {
      log.info("mergeRequests.fixture_job_log", { page });
      await pause(LOG_PAUSE_MS);
      return { ok: true, value: fixtureJobLog(page, fixtureRows(0, LISTED_ROWS)) };
    },
  };
}

/** `?mr=<script>` scripts GitLab's answers; without it the window has no GitLab project. */
export function createFixtureMergeRequests(log: Log, search: string): MergeRequestSource {
  const script = shownScript(log, search);
  let loads = 0;
  return {
    async findGitLabProject() {
      return { ok: true, value: fixtureProject(script) };
    },
    async listMergeRequests(onPage, onChecked) {
      if (script === null) {
        return { ok: true, value: LOADED };
      }
      loads += 1;
      const { pages: sent, end } = scripted(script, loads);
      for (const rows of sent) {
        if (script === "slow") {
          await pause(SLOW_PAGE_MS);
        }
        onPage(toMergeRequestPage({ me: FIXTURE_ME, rows: [...rows] }, fixtureUploadedPicture));
      }
      if (script === "local") {
        checkLater(onChecked);
      }
      return { ok: true, value: end };
    },
    async openMergeRequest(iid) {
      await pause(OPEN_PAUSE_MS);
      return { ok: true, value: toOpenReply(OPEN_REPLIES[iid] ?? { kind: "opened" }) };
    },
    ...localMergeScript(),
    ...rerequestScript(log),
    ...pageScript(log),
    ...discussionsScript(log, LISTED_ROWS),
    ...peopleScript(log, LISTED_ROWS),
    ...descriptionScript(log, LISTED_ROWS),
    ...linksScript(log),
  };
}
