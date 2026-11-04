import type * as Generated from "./bindings";
import type { WebPage } from "./domain";

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

function isLinkedPage(text: string): text is WebPage {
  return text.startsWith("https://") || text.startsWith("http://");
}

function toLink(raw: Generated.DescriptionLink): DescriptionLink {
  if (raw.kind === "refused") {
    return raw;
  }
  if (!isLinkedPage(raw.page)) {
    throw new Error(`link.page must be an http or https address, got "${raw.page}"`);
  }
  return { kind: "page", page: raw.page };
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
