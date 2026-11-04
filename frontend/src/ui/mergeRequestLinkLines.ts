import type {
  DescriptionLinks,
  LinkedCommit,
  LinkedEpic,
  LinkedIssue,
  LinkedParent,
  WebPage,
} from "../ipc";
import { GLAB_MISSING_TEXT, glabNotLoggedInText } from "./glab";
import type { LinksLoad } from "./mergeRequestLinks";
import { problemText } from "./problemText";

export const SHOW_LINKS = "Linked epics, issues and commits";
export const LINKS_LOADING = "Loading…";
export const NO_LINKS = "No linked epics, issues or commits.";
export const NOT_SHOWN = "Not found or no access";
export const CLOSED = "Closed";

export type LinkGroupKind = "epics" | "issues" | "commits";

export const GROUP_HEADINGS: Readonly<Record<LinkGroupKind, string>> = {
  epics: "Epics",
  issues: "Issues",
  commits: "Commits",
};

export type LinkDetail =
  | { readonly kind: "shown"; readonly title: string; readonly closed: boolean }
  | { readonly kind: "notShown" };

export type LinkLine = {
  readonly reference: string;
  readonly detail: LinkDetail;
  readonly page: WebPage;
  /** Only on an issue GitLab shows with a parent. */
  readonly parent: { readonly page: WebPage; readonly tooltip: string } | null;
};

export type LinkGroup = {
  readonly kind: LinkGroupKind;
  readonly heading: string;
  readonly lines: readonly LinkLine[];
};

export type LinkBox =
  | { readonly kind: "status"; readonly text: string; readonly failed: boolean }
  | { readonly kind: "groups"; readonly groups: readonly LinkGroup[] };

const NOT_SHOWN_DETAIL: LinkDetail = { kind: "notShown" };

/** `Open parent: ${reference} ${title}` (rule 4). */
export function parentTooltip(parent: LinkedParent): string {
  return `Open parent: ${parent.reference} ${parent.title}`;
}

function epicLine(epic: LinkedEpic): LinkLine {
  const detail: LinkDetail =
    epic.shown === null ? NOT_SHOWN_DETAIL : { kind: "shown", ...epic.shown };
  return { reference: epic.reference, detail, page: epic.page, parent: null };
}

function issueLine(issue: LinkedIssue): LinkLine {
  const { reference, page, shown } = issue;
  if (shown === null) {
    return { reference, detail: NOT_SHOWN_DETAIL, page, parent: null };
  }
  const detail: LinkDetail = { kind: "shown", title: shown.title, closed: shown.closed };
  const parent =
    shown.parent === null
      ? null
      : { page: shown.parent.page, tooltip: parentTooltip(shown.parent) };
  return { reference, detail, page, parent };
}

function commitLine(commit: LinkedCommit): LinkLine {
  const detail: LinkDetail =
    commit.title === null
      ? NOT_SHOWN_DETAIL
      : { kind: "shown", title: commit.title, closed: false };
  return { reference: commit.reference, detail, page: commit.page, parent: null };
}

function groupsOf(links: DescriptionLinks): readonly LinkGroup[] {
  const lines: Readonly<Record<LinkGroupKind, readonly LinkLine[]>> = {
    epics: links.epics.map(epicLine),
    issues: links.issues.map(issueLine),
    commits: links.commits.map(commitLine),
  };
  const order: readonly LinkGroupKind[] = ["epics", "issues", "commits"];
  return order
    .filter((kind) => lines[kind].length > 0)
    .map((kind) => ({ kind, heading: GROUP_HEADINGS[kind], lines: lines[kind] }));
}

/** glabMissing → `${GLAB_MISSING_TEXT} — install glab, then Retry.`; notLoggedIn → `${glabNotLoggedInText(detail)} —
 *  run glab auth login in a terminal, then Retry.`; failed → `Could not read the links: ${message}`; a thrown call →
 *  problemText({ action: "mergeRequests", step: "links", cause }, platform). */
export function linksFailedText(
  load: Extract<LinksLoad, { kind: "refused" | "failed" }>,
  platform: string,
): string {
  if (load.kind === "failed") {
    return problemText({ action: "mergeRequests", step: "links", cause: load.cause }, platform);
  }
  const { reply } = load;
  switch (reply.kind) {
    case "glabMissing":
      return `${GLAB_MISSING_TEXT} — install glab, then Retry.`;
    case "notLoggedIn":
      return `${glabNotLoggedInText(reply.detail)} — run glab auth login in a terminal, then Retry.`;
    case "failed":
      return `Could not read the links: ${reply.message}`;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
}

/** undefined or loading → LINKS_LOADING; read with no line → NO_LINKS; read → the groups Epics, Issues, Commits that
 *  hold a line; refused or failed → its sentence, failed. */
export function linkBox(load: LinksLoad | undefined, platform: string): LinkBox {
  if (load === undefined) {
    return { kind: "status", text: LINKS_LOADING, failed: false };
  }
  switch (load.kind) {
    case "loading":
      return { kind: "status", text: LINKS_LOADING, failed: false };
    case "read": {
      const groups = groupsOf(load.links);
      return groups.length === 0
        ? { kind: "status", text: NO_LINKS, failed: false }
        : { kind: "groups", groups };
    }
    case "refused":
    case "failed":
      return { kind: "status", text: linksFailedText(load, platform), failed: true };
    default: {
      const _exhaustive: never = load;
      return _exhaustive;
    }
  }
}
