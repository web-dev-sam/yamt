import "../../style.css";
import type { HighlightStyle } from "@codemirror/language";
import { tags, type Tag } from "@lezer/highlight";
import { afterEach, expect, test } from "vitest";

import { MarkdownView } from "../index";
import { fontHighlight, paletteHighlight } from "./syntax";

const ALLOWED_TAGS: Readonly<Record<string, true>> = {
  P: true,
  H1: true,
  H2: true,
  H3: true,
  H4: true,
  H5: true,
  H6: true,
  PRE: true,
  CODE: true,
  UL: true,
  OL: true,
  LI: true,
  BLOCKQUOTE: true,
  TABLE: true,
  THEAD: true,
  TBODY: true,
  TR: true,
  TH: true,
  TD: true,
  HR: true,
  EM: true,
  STRONG: true,
  DEL: true,
  SPAN: true,
  BR: true,
};

const HOSTILE = [
  "# Answer <script>window.ran = true</script>",
  "",
  'Here <img src=x onerror="window.ran = true"> and [click](javascript:window.ran=true).',
  "",
  '<div onclick="window.ran = true">',
  '<iframe src="https://x.test"></iframe>',
  "</div>",
  "",
  '- item with <b onmouseover="x()">bold</b> and ![pic](https://x.test/p.png)',
  "",
  "| a | <i>b</i> |",
  "| - | - |",
  "| `<svg onload=x()>` | **c** |",
  "",
  '> <a href="https://x.test">quote</a>',
  "",
  "```html",
  "<script>window.ran = true</script>",
  "```",
].join("\n");

const hosts: HTMLElement[] = [];
const views: MarkdownView[] = [];

function mounted(): { readonly host: HTMLElement; readonly view: MarkdownView } {
  const host = document.createElement("div");
  document.body.append(host);
  const view = new MarkdownView(host);
  hosts.push(host);
  views.push(view);
  return { host, view };
}

function classOf(highlighter: HighlightStyle, tag: Tag): string {
  const name = highlighter.style([tag]);
  if (name === null) {
    throw new Error("the highlighter styles no such tag");
  }
  return name;
}

function spanWith(host: HTMLElement, text: string): Element | undefined {
  return [...host.querySelectorAll("pre code span")].find((span) => span.textContent === text);
}

function present<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("missing");
  }
  return value;
}

afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
  for (const host of hosts.splice(0)) {
    host.remove();
  }
});

test("the tree holds only allowed tags and only `class` attributes for an answer with <script>, <img onerror>, an HTML block and a javascript: link", async () => {
  const { host, view } = mounted();
  view.show(HOSTILE);
  await expect
    .poll(() => host.querySelectorAll("pre code span").length, { timeout: 5000 })
    .toBeGreaterThan(0);

  const elements = [...host.querySelectorAll("*")];
  expect(elements.length).toBeGreaterThan(10);
  expect(
    elements.map((element) => element.tagName).filter((tag) => !Object.hasOwn(ALLOWED_TAGS, tag)),
  ).toEqual([]);
  expect(
    elements.flatMap((element) => element.getAttributeNames().filter((name) => name !== "class")),
  ).toEqual([]);
  expect(Reflect.get(window, "ran")).toBeUndefined();
  expect(host.textContent).toContain("<script>window.ran = true</script>");
  expect(host.textContent).toContain("click javascript:window.ran=true");
  expect(host.textContent).toContain("pic (https://x.test/p.png)");
  expect(host.querySelector(".markdown-address")?.textContent).toBe("javascript:window.ran=true");
});

test("a ts code block carries the editor's highlight classes", async () => {
  const { host, view } = mounted();
  view.show("```ts\nconst answer: number = 42;\n```");
  const keyword = classOf(paletteHighlight, tags.definitionKeyword);

  await expect.poll(() => spanWith(host, "const")?.className, { timeout: 5000 }).toContain(keyword);
  const probe = document.createElement("span");
  probe.style.color = "var(--color-syntax-definition-keyword)";
  host.append(probe);
  expect(getComputedStyle(present(spanWith(host, "const"))).color).toBe(
    getComputedStyle(probe).color,
  );
  expect(present(spanWith(host, "42")).className).toContain(classOf(paletteHighlight, tags.number));
  expect(host.querySelector("pre code")?.textContent).toBe("const answer: number = 42;");
  expect(document.head.querySelector("style.markdown-highlight-styles")?.textContent).toContain(
    classOf(fontHighlight, tags.comment),
  );
});

test("show() with a longer text keeps the unchanged first block's node", () => {
  const { host, view } = mounted();
  view.show("# Title\n\nFirst *para");
  const [title, paragraph] = [...host.children];

  view.show("# Title\n\nFirst *paragraph*, done.\n\n- next");

  expect(host.children[0]).toBe(title);
  expect(host.children[1]).not.toBe(paragraph);
  expect(host.children[1]?.textContent).toBe("First paragraph, done.");
  expect(host.children[1]?.querySelector("em")?.textContent).toBe("paragraph");
  expect(host.children).toHaveLength(3);
});
