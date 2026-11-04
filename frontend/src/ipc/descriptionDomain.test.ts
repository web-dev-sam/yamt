import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { toDescription, toDescriptionReply, type ImageSize } from "./descriptionDomain";

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
    { kind: "image", image: { kind: "refused" }, caption: "c", size: null },
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

test("an_images_size_passes_as_sent", () => {
  const sizes: readonly ImageSize[] = [
    { kind: "width", width: { kind: "pixels", value: 120 } },
    { kind: "height", height: { kind: "percent", value: 50 } },
    {
      kind: "both",
      width: { kind: "percent", value: 40 },
      height: { kind: "pixels", value: 9999 },
    },
  ];
  const images: Inline[] = sizes.map((size) => ({
    kind: "image",
    image: { kind: "web", address: "https://images.example/a.png" },
    caption: "a",
    size,
  }));
  const raw = read([{ kind: "paragraph", inlines: images }]);

  expect(toDescriptionReply(raw)).toEqual(raw);
});

test("a_comment_body_names_its_field_when_a_link_is_not_http", () => {
  const body: Generated.Description = {
    blocks: [{ kind: "quote", blocks: [{ kind: "paragraph", inlines: [linked("ftp://x/")] }] }],
  };

  expect(() => toDescription(body, "thread.comments[2].body")).toThrow(
    'thread.comments[2].body.link.page must be an http or https address, got "ftp://x/"',
  );
  expect(() => toDescriptionReply({ kind: "read", description: body })).toThrow(
    'description.link.page must be an http or https address, got "ftp://x/"',
  );
});
