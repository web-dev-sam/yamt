import "../style.css";
import type { HighlightStyle } from "@codemirror/language";
import { tags, type Tag } from "@lezer/highlight";
import { afterEach, expect, test } from "vitest";

import { MarkdownView } from "./index";
import { paletteHighlight } from "./internal/syntax";

const HOSTILE = '<img src=x onerror="window.ran = true"><script>window.ran = true</script>';

const ALLOWED_TAGS: Readonly<Record<string, true>> = { PRE: true, CODE: true, SPAN: true };

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

function codeOf(host: HTMLElement): Element {
  const code = host.querySelector(":scope > pre.markdown-block.markdown-code > code");
  if (code === null) {
    throw new Error("no code block");
  }
  return code;
}

afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
  for (const host of hosts.splice(0)) {
    host.remove();
  }
});

test("showCode_colours_a_known_language_with_the_panes_classes", async () => {
  const { host, view } = mounted();
  view.showCode("ruby", "def answer\n  42\nend");

  expect(codeOf(host).textContent).toBe("def answer\n  42\nend");
  await expect
    .poll(() => spanWith(host, "def")?.className, { timeout: 5000 })
    .toContain(classOf(paletteHighlight, tags.keyword));
  const probe = document.createElement("span");
  probe.style.color = "var(--color-syntax-keyword)";
  host.append(probe);
  const keyword = spanWith(host, "def");
  if (keyword === undefined) {
    throw new Error("no keyword span");
  }
  expect(getComputedStyle(keyword).color).toBe(getComputedStyle(probe).color);
  expect(spanWith(host, "42")?.className).toContain(classOf(paletteHighlight, tags.number));
  expect(codeOf(host).textContent).toBe("def answer\n  42\nend");
});

test("showCode_keeps_null_empty_and_unknown_languages_plain", async () => {
  const plain = [null, "", "mermaid"].map((language) => {
    const { host, view } = mounted();
    view.showCode(language, "def graph\n  42\nend");
    return host;
  });
  const painted = mounted();
  painted.view.showCode("ruby", "def graph\n  42\nend");
  await expect.poll(() => spanWith(painted.host, "def"), { timeout: 5000 }).toBeDefined();

  for (const host of plain) {
    expect(host.children).toHaveLength(1);
    const code = codeOf(host);
    expect(code.childNodes).toHaveLength(1);
    expect(code.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(code.textContent).toBe("def graph\n  42\nend");
  }
});

test("showCode_never_reads_its_text_as_markup", async () => {
  const plain = mounted();
  plain.view.showCode(null, HOSTILE);
  const painted = mounted();
  painted.view.showCode("html", HOSTILE);
  await expect
    .poll(() => painted.host.querySelectorAll("pre code span").length, { timeout: 5000 })
    .toBeGreaterThan(0);

  for (const { host } of [plain, painted]) {
    const elements = [...host.querySelectorAll("*")];
    expect(
      elements.map((element) => element.tagName).filter((tag) => !Object.hasOwn(ALLOWED_TAGS, tag)),
    ).toEqual([]);
    expect(
      elements.flatMap((element) => element.getAttributeNames().filter((name) => name !== "class")),
    ).toEqual([]);
    expect(codeOf(host).textContent).toBe(HOSTILE);
    expect(host.querySelector("img, script")).toBeNull();
  }
  expect(Reflect.get(window, "ran")).toBeUndefined();
});

test("showCode_and_show_replace_each_other", () => {
  const { host, view } = mounted();
  view.show("# Title\n\nA paragraph.");

  view.showCode(null, "plain code");
  expect(host.children).toHaveLength(1);
  expect(codeOf(host).textContent).toBe("plain code");

  view.show("# Title\n\nA paragraph.");
  expect([...host.children].map((child) => child.tagName)).toEqual(["H1", "P"]);
  expect(host.textContent).toBe("TitleA paragraph.");

  view.showCode(null, "first");
  view.showCode(null, "second");
  expect(host.children).toHaveLength(1);
  expect(codeOf(host).textContent).toBe("second");
});

test("showCode_after_destroy_does_nothing", () => {
  const { host, view } = mounted();
  view.showCode(null, "before");
  view.destroy();

  view.showCode(null, "after");

  expect(host.childNodes).toHaveLength(0);
});
