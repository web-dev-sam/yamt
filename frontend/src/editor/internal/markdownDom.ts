import type { Block, CodeBlock, ListItem, Numbering } from "./markdownBlocks";
import { parseInline } from "./markdownInline";
import type { Align } from "./markdownTable";
import type { Inline } from "./markdownTree";

export type CodePainter = (element: HTMLElement, block: CodeBlock) => void;

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

type TextElement = { readonly tag: Tag; readonly className: string; readonly text: string };

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

function textElement(document: Document, { tag, className, text }: TextElement): HTMLElement {
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
        return [
          textElement(document, {
            tag: "code",
            className: "markdown-inline-code",
            text: inline.text,
          }),
        ];
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
  const addressNode = textElement(document, {
    tag: "span",
    className: "markdown-address",
    text: address,
  });
  return [...shown, document.createTextNode(" "), addressNode];
}

function withInlines(document: Document, { tag, className, text }: TextElement): HTMLElement {
  const created = element(document, tag, className);
  created.append(...inlineNodes(document, parseInline(text)));
  return created;
}

function codeNode(document: Document, block: CodeBlock, paint: CodePainter): HTMLElement {
  const pre = element(document, "pre", "markdown-code");
  const inner = textElement(document, { tag: "code", className: "", text: block.code });
  pre.append(inner);
  paint(inner, block);
  return pre;
}

function listNode(
  document: Document,
  numbering: Numbering,
  items: readonly ListItem[],
  paint: CodePainter,
): HTMLElement {
  const list =
    numbering.kind === "ordered"
      ? element(document, "ol", "markdown-list markdown-ordered")
      : element(document, "ul", "markdown-list");
  items.forEach((item, index) => {
    const entry = element(document, "li", "markdown-item");
    if (numbering.kind === "ordered") {
      const number = `${numbering.start + index}.`;
      entry.append(
        textElement(document, { tag: "span", className: "markdown-number", text: number }),
      );
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
    const className = ALIGN_CLASS[align[column] ?? "none"];
    tableRow.append(withInlines(document, { tag, className, text: cell }));
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
      return withInlines(document, { tag: "p", className: "markdown-paragraph", text: block.text });
    case "heading":
      return withInlines(document, {
        tag: block.tag,
        className: "markdown-heading",
        text: block.text,
      });
    case "code":
      return codeNode(document, block, paint);
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
