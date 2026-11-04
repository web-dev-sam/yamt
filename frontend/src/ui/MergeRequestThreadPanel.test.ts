import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
  type DiscussionDetails,
  type DiscussionId,
  type MergeRequestIid,
  type MergeRequestSource,
} from "../ipc";
import { dateTimeText } from "../mergeRequests";
import type { MergeRequests } from "./mergeRequests";
import { windowMergeRequests } from "./mergeRequestsStore";
import MergeRequestThread from "./MergeRequestThread.vue";
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

const NOW = Date.parse("2026-11-04T12:00:00Z");
const THREAD_MS = 400;
const WRITE_MS = 300;
const DAY_MS = 86_400_000;
const THREADS = 637;
const LOCKED = 636;
const RETRY = ">Retry</button>";

let slice: MergeRequests;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  slice = windowOver(createFixtureCompareSource(log, "?mr=list", {}));
});

afterEach(() => {
  shownCode.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function windowOver(source: MergeRequestSource): MergeRequests {
  return windowMergeRequests(source, {
    screen: shallowRef<Screen>({ kind: "mergeRequests" }),
    problem: shallowRef<Problem | null>(null),
    settings: shallowRef<{ readonly discussionDetails: DiscussionDetails }>({
      discussionDetails: "full",
    }),
  });
}

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function d(serial: number): DiscussionId {
  const id = String(serial).padStart(40, "0");
  if (!isDiscussionId(id)) {
    throw new Error(`${id} is not a discussion id`);
  }
  return id;
}

async function shown(number: number, serial: number): Promise<void> {
  slice.showThread(iid(number), d(serial));
  await vi.advanceTimersByTimeAsync(THREAD_MS);
}

async function panel(number = THREADS): Promise<string> {
  const props = {
    iid: iid(number),
    author: "dmitri",
    place: "Overview",
    turn: "Your turn",
    anchor: { left: 800, top: 40 },
    now: NOW,
  };
  const html = await renderToString(createSSRApp({ render: () => h(MergeRequestThread, props) }));
  return html.replaceAll(/<!--[[\]]?-->/gu, "");
}

function tagOf(html: string, text: string): string {
  const at = html.indexOf(`>${text}<`);
  return html.slice(html.lastIndexOf("<", at), at + 1);
}

function articles(html: string): string[] {
  return html.split("<article").slice(1);
}

function buttons(html: string): string[] {
  return [...html.matchAll(/<button [^>]*>([^<]*)</gu)].map(
    ([tag, words]) => `${words?.trim() ?? ""}${/\sdisabled[\s>]/u.test(tag) ? " (disabled)" : ""}`,
  );
}

test("the_comment_header_shows_picture_name_username_crown_and_ago", async () => {
  await shown(THREADS, 1);
  const [anna, sam, dmitri, last] = articles(await panel());

  expect(anna).toContain('<span class="font-semibold">Anna Berg</span>');
  expect(anna).toContain('<span class="text-fg-muted">@anna</span>');
  expect(anna).toContain(
    `<span class="text-fg-muted" data-tooltip="${dateTimeText(NOW - 2 * DAY_MS)}">2 days ago</span>`,
  );
  expect(anna).toContain('<span class="relative inline-flex shrink-0 overflow-hidden rounded-full');
  expect(anna).not.toContain("Edited");
  expect(sam).toMatch(/>· Edited .+ ago by Dmitri Volkov<\/span>/u);
  expect(dmitri).toContain('role="img" aria-label="Author" class="flex" data-tooltip="Author"');
  expect(dmitri).toContain(">@dmitri<");
  expect(last).toMatch(/>· Edited .+ ago<\/span>/u);
  expect(last).not.toContain(" by ");
  expect(
    [anna, sam, dmitri, last].map((comment) => comment?.includes('aria-label="Author"')),
  ).toEqual([false, false, true, false]);
});

test("a_comment_renders_gitlabs_blocks", async () => {
  await shown(THREADS, 1);
  const html = await panel();

  expect(html).toContain('<table class="markdown-table">');
  expect(shownCode.length).toBeGreaterThan(0);
  expect(html).toContain('<a role="link" tabindex="0" class="cursor-pointer text-syntax-link');
  expect(html).toContain(
    'alt="both options" referrerpolicy="no-referrer" loading="lazy" draggable="false" class="inline" style="width:160px;aspect-ratio:160 / 80;height:auto;max-width:100%;"',
  );
  expect(html).toContain('alt="the sketch"');
  expect(html).toContain('style="width:50%;height:auto;max-width:100%;"');
  expect(html).not.toContain("<script");
  expect(html).not.toContain(" href=");
  expect(html).not.toMatch(/ on[a-z]+=/u);
});

test("the_drafts_show_pending_at_the_end", async () => {
  await shown(THREADS, 1);
  const all = articles(await panel());
  const draft = all.at(-1) ?? "";

  expect(all).toHaveLength(5);
  expect(draft).toContain(">Pending</span>");
  expect(draft).toContain('<p class="[overflow-wrap:anywhere] whitespace-pre-wrap">');
  expect(draft).toContain("I&#39;ll take the second option.</p>");
  expect(draft).not.toContain("rounded-full");
});

test("submit_review_shows_the_pending_count_and_its_tip", async () => {
  await shown(THREADS, 1);
  const html = await panel();

  expect(html).toContain('data-tooltip="Publish your 2 pending comments on this merge request"');
  expect(html).toContain('Submit review<span class="text-fg-muted">2 pending</span>');

  await shown(LOCKED, 15);
  expect(await panel(LOCKED)).not.toContain("Submit review");
});

test("the_field_has_its_placeholder_and_no_toolbar", async () => {
  await shown(THREADS, 1);
  slice.setReplyText(d(1), "Kept text");
  const html = await panel();

  expect(html).toContain('placeholder="Write a reply… (Markdown)"');
  expect(html).toContain(">Kept text</textarea>");
  expect(buttons(html)).toEqual([
    "",
    "Submit review",
    "",
    "Write",
    "Preview",
    "Add review",
    "Add comment",
    "Resolve thread",
  ]);
  expect(html).toContain('<button type="button" aria-pressed="true"');
  expect(html).not.toContain('role="toolbar"');
  expect(html).toContain('role="dialog" aria-label="Thread: Overview" tabindex="-1"');
});

test("preview_shows_loading_then_blocks_and_nothing_for_empty", async () => {
  await shown(THREADS, 1);
  slice.setReplyText(d(1), "**Preview** of @anna");
  slice.showPreview();
  const loading = await panel();
  expect(loading).toContain('<p class="text-fg-muted">Loading…</p>');
  expect(loading).toContain('style="display:none;"');

  await vi.advanceTimersByTimeAsync(WRITE_MS);
  const read = await panel();
  expect(read).toContain("<strong>Preview</strong>");
  expect(read).toContain(">@anna</a>");

  slice.showWrite();
  const back = await panel();
  expect(back).toContain(">**Preview** of @anna</textarea>");
  expect(back).not.toContain("display:none");
  expect(back).not.toContain("<strong>Preview</strong>");

  slice.setReplyText(d(1), "   ");
  slice.showPreview();
  expect(await panel()).toContain('<p class="text-fg-muted">Nothing to preview.</p>');

  slice.setReplyText(d(1), "fail here");
  slice.showPreview();
  await vi.advanceTimersByTimeAsync(WRITE_MS);
  expect(await panel()).toContain(
    '<p role="alert" class="text-problem-error">Could not preview: glab timed out</p>',
  );
});

test("the_buttons_row_has_add_review_add_comment_and_resolve_at_the_right", async () => {
  await shown(THREADS, 1);
  expect(buttons(await panel()).slice(-3)).toEqual([
    "Add review (disabled)",
    "Add comment (disabled)",
    "Resolve thread",
  ]);
  slice.setReplyText(d(1), "Agreed.");
  const typed = await panel();
  expect(buttons(typed).slice(-3)).toEqual(["Add review", "Add comment", "Resolve thread"]);
  expect(typed).toContain('<span class="ml-auto flex"><button');

  void slice.sendReply("comment");
  expect(buttons(await panel()).slice(-3)).toEqual([
    "Add review (disabled)",
    "Add comment (disabled)",
    "Resolve thread (disabled)",
  ]);
  await vi.advanceTimersByTimeAsync(WRITE_MS + THREAD_MS);

  await shown(LOCKED, 14);
  slice.setReplyText(d(14), "Why?");
  const locked = await panel(LOCKED);
  expect(buttons(locked).slice(-3)).toEqual([
    "Add review (disabled)",
    "Add comment (disabled)",
    "Resolve thread (disabled)",
  ]);
  const reason = "Comments on this merge request are locked to project members.";
  expect(locked.split(`<span class="flex" data-tooltip="${reason}">`)).toHaveLength(3);
  expect(locked).toContain(
    '<span class="ml-auto flex" data-tooltip="You may not resolve this thread.">',
  );
});

test("a_failed_send_says_why_under_the_row", async () => {
  await shown(THREADS, 2);
  slice.setReplyText(d(2), "refuse this");
  const drafting = slice.sendReply("draft");
  await vi.advanceTimersByTimeAsync(WRITE_MS);
  await drafting;
  const refused = await panel();
  expect(refused).toContain(
    '<p role="alert" class="text-problem-error">Could not add the review comment: 403 Forbidden</p>',
  );
  expect(refused).toContain(">refuse this</textarea>");

  slice.setReplyText(d(2), "fail now");
  const failing = slice.sendReply("comment");
  await vi.advanceTimersByTimeAsync(WRITE_MS);
  await failing;
  expect(await panel()).toContain("Could not add the comment: glab timed out</p>");

  await vi.advanceTimersByTimeAsync(THREAD_MS);
  await shown(LOCKED, 15);
  const resolving = slice.setResolved(true);
  await vi.advanceTimersByTimeAsync(WRITE_MS);
  await resolving;
  expect(await panel(LOCKED)).toContain("Could not resolve the thread: 403 Forbidden</p>");
});

test("resolved_reads_resolved_and_unresolve", async () => {
  await shown(THREADS, 1);
  const open = await panel();
  expect(open).toContain('<span class="shrink-0 text-fg-muted">Your turn</span>');
  expect(open).not.toContain(">Resolved");

  const resolving = slice.setResolved(true);
  await vi.advanceTimersByTimeAsync(WRITE_MS + THREAD_MS);
  await resolving;
  const resolved = await panel();
  expect(resolved).toMatch(
    /<span class="flex shrink-0 items-center gap-1 text-fg-muted"><svg[^>]*>.*<\/svg>Resolved<\/span>/u,
  );
  expect(resolved).not.toContain("Your turn");
  expect(buttons(resolved).at(-1)).toBe("Unresolve thread");
});

test("loading_failure_and_not_found_read_one_sentence_with_retry", async () => {
  slice.showThread(iid(THREADS), d(1));
  const loading = await panel();
  expect(tagOf(loading, "Loading…")).toBe('<p class="text-fg-muted">');
  expect(loading).not.toContain(RETRY);
  await vi.advanceTimersByTimeAsync(THREAD_MS);

  await shown(THREADS, 99);
  const gone = await panel();
  expect(gone).toContain(
    '<span class="text-problem-error">This discussion is no longer on GitLab.</span>',
  );
  expect(gone).toContain(RETRY);

  const fixture = createFixtureCompareSource(log, "?mr=list", {});
  const answers = [
    { ok: true, value: { kind: "glabMissing" } },
    { ok: true, value: { kind: "failed", message: "glab timed out" } },
    { ok: false, failure: { kind: "WorkerStopped" } },
  ] as const;
  for (const [index, answer] of answers.entries()) {
    slice = windowOver({ ...fixture, readDiscussionThread: () => Promise.resolve(answer) });
    await shown(THREADS, index + 1);
    const html = await panel();
    expect(html).toContain(RETRY);
    expect(html).toContain(
      [
        "glab is not installed (not found on PATH) — install glab, then Retry.</span>",
        "Could not read the thread: glab timed out</span>",
        "Could not read the thread: yamt&#39;s worker stopped; try again.</span>",
      ][index],
    );
  }
});

test("a_refreshing_thread_keeps_its_comments_and_another_requests_thread_renders_nothing", async () => {
  await shown(THREADS, 1);
  slice.setReplyText(d(1), "Agreed.");
  const sending = slice.sendReply("comment");
  await vi.advanceTimersByTimeAsync(WRITE_MS);
  await sending;
  const refreshing = await panel();
  expect(refreshing).toContain('aria-busy="true"');
  expect(articles(refreshing)).toHaveLength(5);
  expect(buttons(refreshing).at(-1)).toBe("Resolve thread (disabled)");

  expect(await panel(LOCKED)).toBe("");
});
