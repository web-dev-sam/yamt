import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { toDescriptionReply, toLinksReply } from "./descriptionDomain";

type Inline = Generated.DescriptionInline;
type Block = Generated.DescriptionBlock;

function linked(page: string): Inline {
  return { kind: "link", link: { kind: "page", page }, inlines: [{ kind: "text", text: page }] };
}

function everyKind(page: string): Block[] {
  const deep: Inline[] = [
    { kind: "emphasis", inlines: [linked(page)] },
    { kind: "strong", inlines: [{ kind: "strike", inlines: [linked(page)] }] },
    { kind: "code", text: "x" },
    { kind: "image", image: { kind: "refused" }, caption: "c" },
    { kind: "lineBreak" },
    { kind: "link", link: { kind: "refused", address: "mailto:a@b" }, inlines: [] },
  ];
  return [
    { kind: "paragraph", inlines: deep },
    { kind: "heading", level: "h2", inlines: [linked(page)] },
    { kind: "code", language: "ruby", text: "end" },
    { kind: "rule" },
    {
      kind: "list",
      numbering: { kind: "numbers", start: 3 },
      items: [{ task: "done", blocks: [{ kind: "paragraph", inlines: [linked(page)] }] }],
    },
    { kind: "quote", blocks: [{ kind: "paragraph", inlines: [linked(page)] }] },
    {
      kind: "table",
      head: [{ cells: [{ header: true, align: "center", inlines: [linked(page)] }] }],
      body: [{ cells: [{ header: false, align: "end", inlines: [linked(page)] }] }],
    },
    {
      kind: "details",
      open: true,
      summary: [linked(page)],
      blocks: [{ kind: "paragraph", inlines: [linked(page)] }],
    },
  ];
}

function read(blocks: Block[]): Generated.DescriptionReply {
  return { kind: "read", description: { blocks } };
}

test.each(["https://gitlab.example/g/p/-/issues/12", "http://docs.example/x"])(
  "every block and inline keeps its shape and its %s link",
  (page) => {
    const raw = read(everyKind(page));
    expect(toDescriptionReply(raw)).toEqual(raw);
  },
);

const LINKED_BLOCKS = everyKind("ftp://x.example/").filter(
  (block) => block.kind !== "code" && block.kind !== "rule",
);

test.each(LINKED_BLOCKS.map((block) => [block.kind, block] as const))(
  "a %s holding a link to a page that is not http or https throws",
  (_, block) => {
    expect(() => toDescriptionReply(read([block]))).toThrow(
      'link.page must be an http or https address, got "ftp://x.example/"',
    );
  },
);

test.each(["httpx://docs.example/x", " https://docs.example/x", "mailto:a@b", "javascript:x", ""])(
  "a linked page must start with http:// or https://, so %j throws",
  (page) => {
    expect(() =>
      toDescriptionReply(read([{ kind: "paragraph", inlines: [linked(page)] }])),
    ).toThrow(`link.page must be an http or https address, got "${page}"`);
  },
);

test("a refusal passes unchanged", () => {
  const replies: Generated.DescriptionReply[] = [
    { kind: "glabMissing" },
    { kind: "notLoggedIn", detail: "d" },
    { kind: "failed", message: "m" },
  ];
  for (const reply of replies) {
    expect(toDescriptionReply(reply)).toBe(reply);
  }
});

function linksAt(page: (field: string) => string): Generated.LinksReply {
  const parent = {
    reference: "&3",
    title: "Board",
    page: page("links.issues[1].shown.parent.page"),
  };
  return {
    kind: "read",
    links: {
      epics: [{ reference: "&3", page: page("links.epics[0].page"), shown: null }],
      issues: [
        { reference: "#9", page: page("links.issues[0].page"), shown: null },
        {
          reference: "#12",
          page: page("links.issues[1].page"),
          shown: { title: "Snooze", closed: true, parent },
        },
        {
          reference: "#13",
          page: page("links.issues[2].page"),
          shown: { title: "Test", closed: false, parent: null },
        },
      ],
      commits: [{ reference: "fa3335f3", page: page("links.commits[0].page"), title: "Backfill" }],
    },
  };
}

const LINKS_FIELDS = [
  "links.epics[0].page",
  "links.issues[0].page",
  "links.issues[1].page",
  "links.issues[1].shown.parent.page",
  "links.issues[2].page",
  "links.commits[0].page",
];

test("every_links_page_is_branded_and_a_non_http_one_fails", () => {
  const raw = linksAt((field) => `https://gitlab.example/${field}`);
  expect(toLinksReply(raw)).toEqual(raw);
  const plain = linksAt((field) => `http://gitlab.example/${field}`);
  expect(toLinksReply(plain)).toEqual(plain);
  for (const bad of LINKS_FIELDS) {
    const reply = linksAt((field) => (field === bad ? "ftp://x" : "https://gitlab.example/"));
    expect(() => toLinksReply(reply)).toThrow(
      `${bad} must be an http or https address, got "ftp://x"`,
    );
  }
});

test("a_links_refusal_passes_unchanged", () => {
  const replies: Generated.LinksReply[] = [
    { kind: "glabMissing" },
    { kind: "notLoggedIn", detail: "d" },
    { kind: "failed", message: "m" },
  ];
  for (const reply of replies) {
    expect(toLinksReply(reply)).toBe(reply);
  }
});
