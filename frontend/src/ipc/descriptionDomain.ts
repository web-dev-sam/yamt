import type * as Generated from "./bindings";
import { isLinkedPage, type WebPage } from "./domain";

type Inlines = readonly DescriptionInline[];
type Blocks = readonly DescriptionBlock[];

export type DescriptionImage = Readonly<Generated.DescriptionImage>;
type HeadingLevel = Generated.HeadingLevel;
type ListNumbering = Readonly<Generated.ListNumbering>;
type TaskBox = Generated.TaskBox;
type CellAlign = Generated.CellAlign;
export type UploadKey = Generated.UploadKey;
export type DescriptionLink =
  | { readonly kind: "page"; readonly page: WebPage }
  | Readonly<Extract<Generated.DescriptionLink, { kind: "refused" }>>;
export type DescriptionInline =
  | Readonly<
      Extract<Generated.DescriptionInline, { kind: "text" | "code" | "image" | "lineBreak" }>
    >
  | { readonly kind: "emphasis"; readonly inlines: Inlines }
  | { readonly kind: "strong"; readonly inlines: Inlines }
  | { readonly kind: "strike"; readonly inlines: Inlines }
  | { readonly kind: "link"; readonly link: DescriptionLink; readonly inlines: Inlines };
export type DescriptionItem = { readonly task: TaskBox; readonly blocks: Blocks };
export type DescriptionCell = {
  readonly header: boolean;
  readonly align: CellAlign;
  readonly inlines: Inlines;
};
export type DescriptionRow = { readonly cells: readonly DescriptionCell[] };
export type DescriptionBlock =
  | Readonly<Extract<Generated.DescriptionBlock, { kind: "code" | "rule" }>>
  | { readonly kind: "paragraph"; readonly inlines: Inlines }
  | { readonly kind: "heading"; readonly level: HeadingLevel; readonly inlines: Inlines }
  | {
      readonly kind: "list";
      readonly numbering: ListNumbering;
      readonly items: readonly DescriptionItem[];
    }
  | { readonly kind: "quote"; readonly blocks: Blocks }
  | {
      readonly kind: "table";
      readonly head: readonly DescriptionRow[];
      readonly body: readonly DescriptionRow[];
    }
  | {
      readonly kind: "details";
      readonly open: boolean;
      readonly summary: Inlines;
      readonly blocks: Blocks;
    };
export type Description = { readonly blocks: Blocks };
export type DescriptionReply =
  | { readonly kind: "read"; readonly description: Description }
  | Readonly<Exclude<Generated.DescriptionReply, { kind: "read" }>>;
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

function toLinkedPage(text: string, field: string): WebPage {
  if (!isLinkedPage(text)) {
    throw new Error(`${field} must be an http or https address, got "${text}"`);
  }
  return text;
}

function toLink(raw: Generated.DescriptionLink): DescriptionLink {
  return raw.kind === "refused" ? raw : { kind: "page", page: toLinkedPage(raw.page, "link.page") };
}

function toInline(raw: Generated.DescriptionInline): DescriptionInline {
  switch (raw.kind) {
    case "text":
    case "code":
    case "image":
    case "lineBreak":
      return raw;
    case "emphasis":
    case "strong":
    case "strike":
      return { kind: raw.kind, inlines: raw.inlines.map(toInline) };
    case "link":
      return { kind: "link", link: toLink(raw.link), inlines: raw.inlines.map(toInline) };
  }
}

function toRow(raw: Generated.DescriptionRow): DescriptionRow {
  return { cells: raw.cells.map((cell) => ({ ...cell, inlines: cell.inlines.map(toInline) })) };
}

function toBlock(raw: Generated.DescriptionBlock): DescriptionBlock {
  switch (raw.kind) {
    case "code":
    case "rule":
      return raw;
    case "paragraph":
    case "heading":
      return { ...raw, inlines: raw.inlines.map(toInline) };
    case "list":
      return {
        ...raw,
        items: raw.items.map((item) => ({ ...item, blocks: item.blocks.map(toBlock) })),
      };
    case "quote":
      return { kind: "quote", blocks: raw.blocks.map(toBlock) };
    case "table":
      return { kind: "table", head: raw.head.map(toRow), body: raw.body.map(toRow) };
    case "details":
      return { ...raw, summary: raw.summary.map(toInline), blocks: raw.blocks.map(toBlock) };
  }
}

/** Brands every link's page as a WebPage on http or https, as Rust's `WebPage::linked` makes it; any other throws. */
export function toDescriptionReply(raw: Generated.DescriptionReply): DescriptionReply {
  return raw.kind === "read"
    ? { kind: "read", description: { blocks: raw.description.blocks.map(toBlock) } }
    : raw;
}

function toIssue(raw: Generated.LinkedIssue, field: string): LinkedIssue {
  const page = toLinkedPage(raw.page, `${field}.page`);
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
      parent: parent === null ? null : { ...parent, page: toLinkedPage(parent.page, parentPage) },
    },
  };
}

/** Brands every line's and parent's page as a WebPage on http or https, as Rust's `WebPage::linked` makes it; any
 *  other throws. */
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
        page: toLinkedPage(epic.page, `links.epics[${at}].page`),
      })),
      issues: issues.map((issue, at) => toIssue(issue, `links.issues[${at}]`)),
      commits: commits.map((commit, at) => ({
        ...commit,
        page: toLinkedPage(commit.page, `links.commits[${at}].page`),
      })),
    },
  };
}
