import type * as Generated from "./bindings";
import type { WebPage } from "./domain";
import { toWebPage } from "./mergeRequestDomain";

export type LinkedParent = {
  readonly reference: string;
  readonly title: string;
  readonly page: WebPage;
};
export type LinkedEpic = {
  readonly reference: string;
  readonly page: WebPage;
  readonly shown: { readonly title: string; readonly closed: boolean } | null;
};
export type LinkedIssue = {
  readonly reference: string;
  readonly page: WebPage;
  readonly shown: {
    readonly title: string;
    readonly closed: boolean;
    readonly parent: LinkedParent | null;
  } | null;
};
export type LinkedCommit = {
  readonly reference: string;
  readonly page: WebPage;
  readonly title: string | null;
};
export type DescriptionLinks = {
  readonly epics: readonly LinkedEpic[];
  readonly issues: readonly LinkedIssue[];
  readonly commits: readonly LinkedCommit[];
};
export type LinksReply =
  | { readonly kind: "read"; readonly links: DescriptionLinks }
  | Readonly<Exclude<Generated.LinksReply, { kind: "read" }>>;

function toIssue(raw: Generated.LinkedIssue, field: string): LinkedIssue {
  const page = toWebPage(raw.page, `${field}.page`);
  if (raw.shown === null) {
    return { ...raw, page, shown: null };
  }
  const { parent } = raw.shown;
  const parentPage = `${field}.shown.parent.page`;
  return {
    ...raw,
    page,
    shown: {
      ...raw.shown,
      parent: parent === null ? null : { ...parent, page: toWebPage(parent.page, parentPage) },
    },
  };
}

/** Brands every line's and parent's page as an https WebPage, the only kind Rust's links lookup sends; any other
 *  throws. */
export function toLinksReply(raw: Generated.LinksReply): LinksReply {
  if (raw.kind !== "read") {
    return raw;
  }
  const { epics, issues, commits } = raw.links;
  return {
    kind: "read",
    links: {
      epics: epics.map((epic, at) => ({
        ...epic,
        page: toWebPage(epic.page, `links.epics[${at}].page`),
      })),
      issues: issues.map((issue, at) => toIssue(issue, `links.issues[${at}]`)),
      commits: commits.map((commit, at) => ({
        ...commit,
        page: toWebPage(commit.page, `links.commits[${at}].page`),
      })),
    },
  };
}
