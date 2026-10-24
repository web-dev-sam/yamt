import type { Align, Block, ListItem, Numbering } from "./markdownBlocks";
import { parseInline, type Inline } from "./markdownInline";

export type CodePainter = (element: HTMLElement, info: string, code: string) => void;

type Tag = keyof Pick<
  HTMLElementTagNameMap,
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "pre"
  | "code"
  | "ul"
  | "ol"
  | "li"
  | "blockquote"
  | "table"
  | "thead"
  | "tbody"
  | "tr"
  | "th"
  | "td"
  | "hr"
  | "em"
  | "strong"
  | "del"
  | "span"
  | "br"
>;

const STYLED_TAG = { emphasis: "em", strong: "strong", strike: "del" } as const satisfies Readonly<
  Record<string, Tag>
>;

const ALIGN_CLASS: Readonly<Record<Align, string>> = {
  none: "",
  left: "markdown-align-left",
  center: "markdown-align-center",
  right: "markdown-align-right",
};

function element<K extends Tag>(
  document: Document,
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  if (className !== "") {
    created.className = className;
  }
  return created;
}

function textElement(document: Document, tag: Tag, className: string, text: string): HTMLElement {
  const created = element(document, tag, className);
  created.textContent = text;
  return created;
}

function inlineNodes(document: Document, inlines: readonly Inline[]): Node[] {
  return inlines.flatMap((inline): Node[] => {
    switch (inline.kind) {
      case "text":
        return [document.createTextNode(inline.text)];
      case "code":
        return [textElement(document, "code", "markdown-inline-code", inline.text)];
      case "break":
        return [element(document, "br", "")];
      case "emphasis":
      case "strong":
      case "strike": {
        const styled = element(document, STYLED_TAG[inline.kind], "");
        styled.append(...inlineNodes(document, inline.children));
        return [styled];
      }
      case "link":
        return linkNodes(document, inline.children, inline.address);
      default: {
        const _exhaustive: never = inline;
        return _exhaustive;
      }
    }
  });
}

function linkNodes(document: Document, children: readonly Inline[], address: string): Node[] {
  const shown = inlineNodes(document, children);
  const sameText =
    children.length === 1 && children[0]?.kind === "text" && children[0].text === address;
  if (address === "" || sameText) {
    return shown;
  }
  const addressNode = textElement(document, "span", "markdown-address", address);
  return [...shown, document.createTextNode(" "), addressNode];
}

function withInlines(document: Document, tag: Tag, className: string, text: string): HTMLElement {
  const created = element(document, tag, className);
  created.append(...inlineNodes(document, parseInline(text)));
  return created;
}

function codeNode(document: Document, info: string, code: string, paint: CodePainter): HTMLElement {
  const pre = element(document, "pre", "markdown-code");
  const inner = textElement(document, "code", "", code);
  pre.append(inner);
  paint(inner, info, code);
  return pre;
}

function listNode(
  document: Document,
  numbering: Numbering,
  items: readonly ListItem[],
  paint: CodePainter,
): HTMLElement {
  const ordered = numbering.kind === "ordered";
  const list = ordered
    ? element(document, "ol", "markdown-list markdown-ordered")
    : element(document, "ul", "markdown-list");
  items.forEach((item, index) => {
    const entry = element(document, "li", "markdown-item");
    if (numbering.kind === "ordered") {
      entry.append(textElement(document, "span", "markdown-number", `${numbering.start + index}.`));
    }
    entry.append(...item.blocks.map((block) => blockNode(document, block, paint)));
    list.append(entry);
  });
  return list;
}

function rowNode(
  document: Document,
  tag: "th" | "td",
  row: readonly string[],
  align: readonly Align[],
): HTMLElement {
  const tableRow = element(document, "tr", "");
  row.forEach((cell, column) => {
    tableRow.append(withInlines(document, tag, ALIGN_CLASS[align[column] ?? "none"], cell));
  });
  return tableRow;
}

function tableNode(
  document: Document,
  { align, header, rows }: Extract<Block, { kind: "table" }>,
): HTMLElement {
  const table = element(document, "table", "markdown-table");
  const head = element(document, "thead", "");
  head.append(rowNode(document, "th", header, align));
  const body = element(document, "tbody", "");
  body.append(...rows.map((row) => rowNode(document, "td", row, align)));
  table.append(head, ...(rows.length > 0 ? [body] : []));
  return table;
}

function kindNode(document: Document, block: Block, paint: CodePainter): HTMLElement {
  switch (block.kind) {
    case "paragraph":
      return withInlines(document, "p", "markdown-paragraph", block.text);
    case "heading":
      return withInlines(document, block.tag, "markdown-heading", block.text);
    case "code":
      return codeNode(document, block.info, block.code, paint);
    case "list":
      return listNode(document, block.numbering, block.items, paint);
    case "quote": {
      const quote = element(document, "blockquote", "markdown-quote");
      quote.append(...block.blocks.map((inner) => blockNode(document, inner, paint)));
      return quote;
    }
    case "table":
      return tableNode(document, block);
    case "rule":
      return element(document, "hr", "markdown-rule");
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function blockNode(document: Document, block: Block, paint: CodePainter): HTMLElement {
  const node = kindNode(document, block, paint);
  node.className = `markdown-block ${node.className}`;
  return node;
}
