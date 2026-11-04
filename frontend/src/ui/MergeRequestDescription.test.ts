import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type Description,
  type DescriptionBlock,
  type DiscussionDetails,
  type MergeRequestIid,
  type MergeRequestSource,
} from "../ipc";
import MergeRequestDescription from "./MergeRequestDescription.vue";
import type { DescriptionLoad } from "./mergeRequestDescriptions";
import { windowMergeRequests } from "./mergeRequestsStore";
import type { Problem } from "./problem";
import type { Screen } from "./screen";

const shownCode = vi.hoisted(() => new Array<{ language: string | null; text: string }>());

vi.mock("./tooltip", () => ({
  vTooltip: {
    getSSRProps: ({ value }: { value: string | null }) => ({ "data-tooltip": value }),
  },
}));
vi.mock("./useMarkdown", () => ({
  useMarkdownCode: (_: unknown, code: () => { language: string | null; text: string }) => {
    shownCode.push(code());
  },
}));

const DESCRIPTION_PAUSE_MS = 400;
const RICH = 640;
const PLANTED = 635;
const LOADING_UPLOAD = "upload~00000000000000000000000000000001";
const BROKEN_UPLOAD = "upload~00000000000000000000000000000002";

let source: MergeRequestSource;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.useFakeTimers();
  source = createFixtureCompareSource(log, "?mr=list", {});
  windowMergeRequests(source, {
    screen: shallowRef<Screen>({ kind: "mergeRequests" }),
    problem: shallowRef<Problem | null>(null),
    settings: shallowRef<{ readonly discussionDetails: DiscussionDetails }>({
      discussionDetails: "full",
    }),
  });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  shownCode.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

async function fixtureDescription(asked: number): Promise<Description> {
  const answer = source.readDescription(iid(asked));
  await vi.advanceTimersByTimeAsync(DESCRIPTION_PAUSE_MS);
  const result = await answer;
  if (!result.ok || result.value.kind !== "read") {
    throw new Error(`the fixture did not read !${asked}`);
  }
  return result.value.description;
}

async function panel(load: DescriptionLoad): Promise<string> {
  const shown = { row: { iid: iid(RICH), title: "Snooze a reminder" }, load };
  const html = await renderToString(
    createSSRApp({ render: () => h(MergeRequestDescription, { shown, asking: false }) }),
  );
  return html.replaceAll(/<!--[[\]]?-->/gu, "");
}

async function rendered(asked: number): Promise<string> {
  return panel({ kind: "shown", description: await fixtureDescription(asked) });
}

function blocks(...shown: DescriptionBlock[]): Promise<string> {
  return panel({ kind: "shown", description: { blocks: shown } });
}

function tagOf(html: string, text: string): string {
  const at = html.indexOf(`>${text}<`);
  return html.slice(html.lastIndexOf("<", at), at + 1);
}

test("every_block_and_inline_renders_its_element", async () => {
  const html = await rendered(RICH);

  for (const tag of [
    '<h1 class="markdown-block markdown-heading"',
    '<h2 class="markdown-block markdown-heading"',
    '<h3 class="markdown-block markdown-heading"',
    '<p class="markdown-block markdown-paragraph"',
    "<em>",
    "<strong>",
    "<del>",
    '<code class="markdown-inline-code">snooze(card)</code>',
    "<br>",
    '<ul class="markdown-block markdown-list"',
    '<ol start="3" class="markdown-block markdown-list markdown-ordered"',
    '<span class="markdown-number">3.</span>',
    '<span class="markdown-number">4.</span>',
    '<blockquote class="markdown-block markdown-quote"',
    '<hr class="markdown-block markdown-rule"',
    '<div class="markdown-block overflow-x-auto"><table class="markdown-table"><thead>',
    "<tbody>",
    "<th",
    "<td",
    '<details class="markdown-block"',
    '<summary class="cursor-pointer">',
    '<a role="link" tabindex="0"',
    "<img",
  ]) {
    expect(html).toContain(tag);
  }
  expect(html).not.toContain("<details open");
  expect(shownCode).toEqual([
    { language: "ruby", text: "def snooze(card)\n  card.update!(due: 1.day.from_now)\nend" },
    { language: null, text: "plain text\n  indented" },
    { language: "mermaid", text: "graph TD\n  A --> B" },
  ]);
});

test("a details block that starts open renders open; a heading level picks its tag", async () => {
  const html = await blocks(
    { kind: "details", open: true, summary: [{ kind: "text", text: "S" }], blocks: [] },
    { kind: "heading", level: "h6", inlines: [{ kind: "text", text: "Six" }] },
  );

  expect(html).toContain("<details open");
  expect(tagOf(html, "Six")).toBe('<h6 class="markdown-block markdown-heading">');
});

test("text_that_looks_like_markup_renders_as_text", async () => {
  const html = await rendered(PLANTED);

  expect(html).toContain("&lt;script&gt;window.yamtPlanted = true&lt;/script&gt;");
  expect(html).toContain("&lt;img src=x onerror=&quot;window.yamtPlanted = true&quot;&gt;");
  expect(html).toContain("&lt;iframe src=&quot;https://evil.example/&quot;&gt;");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<iframe");
});

test("no_description_element_has_an_href_or_an_on_attribute", async () => {
  const html = await rendered(RICH);

  expect(html).not.toContain(" href=");
  expect(html).not.toMatch(/ on[a-z]+=/u);
  for (const tag of ["<input", "<iframe", "<form", "<style", "<object"]) {
    expect(html).not.toContain(tag);
  }
});

test("an_upload_and_another_sites_image_load_their_address_and_a_refused_one_shows_its_caption", async () => {
  const html = await rendered(RICH);
  const images = [...html.matchAll(/<img [^>]*>/gu)].map((found) => found[0]);

  expect(images).toHaveLength(3);
  expect(images[0]).toContain(`src="${source.uploadedImage(LOADING_UPLOAD)}"`);
  expect(images[0]).toContain('alt="screenshot"');
  expect(images[1]).toContain(`src="${source.uploadedImage(BROKEN_UPLOAD)}"`);
  expect(images[2]).toContain('alt="outside picture"');
  for (const image of images) {
    expect(image).toContain('referrerpolicy="no-referrer" loading="lazy" draggable="false"');
  }
  expect(tagOf(html, "refused picture")).toBe('<span class="text-fg-muted">');
});

test("an image without a caption stands in with its address, or with 'picture'", async () => {
  const html = await blocks({
    kind: "paragraph",
    inlines: [
      { kind: "image", image: { kind: "refused" }, caption: "" },
      {
        kind: "image",
        image: { kind: "web", address: "https://images.example/a.png" },
        caption: "",
      },
    ],
  });

  expect(tagOf(html, "picture")).toBe('<span class="text-fg-muted">');
  expect(html).toContain('<img src="https://images.example/a.png" alt referrerpolicy');
});

test("a_refused_link_carries_its_address_for_the_tooltip_and_no_page", async () => {
  const html = await rendered(RICH);

  expect(tagOf(html, "mail Anna")).toBe(
    '<a role="link" tabindex="0" class="cursor-default text-fg-muted" data-tooltip="mailto:anna@example.com">',
  );
  expect(tagOf(html, "planted")).toBe(
    '<a role="link" tabindex="0" class="cursor-default text-fg-muted" data-tooltip="javascript:window.yamtPlanted=true">',
  );
  expect(tagOf(html, "the docs")).toBe(
    '<a role="link" tabindex="0" class="cursor-pointer text-syntax-link hover:underline" data-tooltip="https://docs.example/x">',
  );
});

test("task_boxes_are_icons_with_their_word_never_inputs", async () => {
  const html = await rendered(RICH);
  const boxes = [...html.matchAll(/<svg [^>]*role="img"[^>]*>/gu)].map((found) => found[0]);

  expect(boxes.map((box) => /aria-label="([^"]*)"/u.exec(box)?.[1])).toEqual([
    "Done",
    "Not done",
    "Not applicable",
  ]);
  expect(html).toContain('<li class="list-none markdown-item">');
  expect(html).not.toContain("<input");
});

test("table_cells_carry_their_alignment", async () => {
  const html = await rendered(RICH);

  expect(tagOf(html, "Card")).toBe('<th class="">');
  expect(tagOf(html, "State")).toBe('<th class="markdown-align-center">');
  expect(tagOf(html, "Days")).toBe('<th class="markdown-align-right">');
  expect(tagOf(html, "Login")).toBe('<td class="">');
  expect(tagOf(html, "open")).toBe('<td class="markdown-align-center">');
  expect(tagOf(html, "3")).toBe('<td class="markdown-align-right">');
});

test("loading_empty_refused_and_failed_show_their_sentence_and_retry", async () => {
  const retry = ">Retry</button>";
  const loading = await panel({ kind: "loading" });
  const empty = await panel({ kind: "shown", description: { blocks: [] } });
  const refused = await panel({ kind: "refused", reply: { kind: "glabMissing" } });
  const failed = await panel({ kind: "failed", cause: { kind: "WorkerStopped" } });

  expect(tagOf(loading, "Loading…")).toBe('<p class="text-fg-muted">');
  expect(tagOf(empty, "No description.")).toBe('<p class="text-fg-muted">');
  expect(refused).toContain(
    "glab is not installed (not found on PATH) — install glab, then Retry.</span>",
  );
  expect(failed).toContain(
    "Could not read the description: yamt&#39;s worker stopped; try again.</span>",
  );
  expect([loading, empty, refused, failed].map((html) => html.includes(retry))).toEqual([
    false,
    false,
    true,
    true,
  ]);
  expect(loading).toContain('<span class="shrink-0 text-fg-muted">!640</span>');
  expect(loading).toContain('<span class="truncate">Snooze a reminder</span>');
});
