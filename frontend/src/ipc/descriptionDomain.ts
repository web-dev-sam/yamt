import type * as Generated from "./bindings";
import { isLinkedPage, type WebPage } from "./domain";

type Inlines = readonly DescriptionInline[];
type Blocks = readonly DescriptionBlock[];

export type DescriptionImage = Readonly<Generated.DescriptionImage>;
export type ImageSize = Readonly<Generated.ImageSize>;
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

function toLinkedPage(text: string, field: string): WebPage {
  if (!isLinkedPage(text)) {
    throw new Error(`${field} must be an http or https address, got "${text}"`);
  }
  return text;
}

function toLink(raw: Generated.DescriptionLink, field: string): DescriptionLink {
  return raw.kind === "refused"
    ? raw
    : { kind: "page", page: toLinkedPage(raw.page, `${field}.link.page`) };
}

function toInline(raw: Generated.DescriptionInline, field: string): DescriptionInline {
  switch (raw.kind) {
    case "text":
    case "code":
    case "image":
    case "lineBreak":
      return raw;
    case "emphasis":
    case "strong":
    case "strike":
      return { kind: raw.kind, inlines: raw.inlines.map((each) => toInline(each, field)) };
    case "link":
      return {
        kind: "link",
        link: toLink(raw.link, field),
        inlines: raw.inlines.map((each) => toInline(each, field)),
      };
  }
}

function toRow(raw: Generated.DescriptionRow, field: string): DescriptionRow {
  return {
    cells: raw.cells.map((cell) => ({
      ...cell,
      inlines: cell.inlines.map((each) => toInline(each, field)),
    })),
  };
}

function toBlock(raw: Generated.DescriptionBlock, field: string): DescriptionBlock {
  switch (raw.kind) {
    case "code":
    case "rule":
      return raw;
    case "paragraph":
    case "heading":
      return { ...raw, inlines: raw.inlines.map((each) => toInline(each, field)) };
    case "list":
      return {
        ...raw,
        items: raw.items.map((item) => ({
          ...item,
          blocks: item.blocks.map((each) => toBlock(each, field)),
        })),
      };
    case "quote":
      return { kind: "quote", blocks: raw.blocks.map((each) => toBlock(each, field)) };
    case "table":
      return {
        kind: "table",
        head: raw.head.map((each) => toRow(each, field)),
        body: raw.body.map((each) => toRow(each, field)),
      };
    case "details":
      return {
        ...raw,
        summary: raw.summary.map((each) => toInline(each, field)),
        blocks: raw.blocks.map((each) => toBlock(each, field)),
      };
  }
}

/** Brands every link's page as a WebPage on http or https, as Rust's `WebPage::linked` makes it; any other throws,
 *  naming `field`. An image's size passes as sent. */
export function toDescription(raw: Generated.Description, field: string): Description {
  return { blocks: raw.blocks.map((block) => toBlock(block, field)) };
}

export function toDescriptionReply(raw: Generated.DescriptionReply): DescriptionReply {
  return raw.kind === "read"
    ? { kind: "read", description: toDescription(raw.description, "description") }
    : raw;
}
