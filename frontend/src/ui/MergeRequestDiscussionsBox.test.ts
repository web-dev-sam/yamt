import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h, shallowRef, type ShallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
  type DiscussionDetails,
  type DiscussionId,
  type MergeRequestIid,
  type MergeRequestRow,
  type MergeRequestSource,
} from "../ipc";
import MergeRequestDiscussions from "./MergeRequestDiscussions.vue";
import { createMergeRequests, type MergeRequests } from "./mergeRequests";
import { registerMergeRequests } from "./mergeRequestsStore";
import type { Screen } from "./screen";

vi.mock("./tooltip", () => ({
  vTooltip: {
    getSSRProps: ({ value }: { value: string | null }) => ({ "data-tooltip": value }),
  },
}));
vi.mock("./useMarkdown", () => ({ useMarkdownCode: () => undefined }));
// vi.mock is hoisted above the file's imports (vitest "vi.mock"), so its factory imports vue itself.
vi.mock("./useHoverBox", async () => {
  const { computed, shallowRef: open } = await import("vue");
  return {
    useHoverBox: () => ({
      open: open(true),
      placement: computed(() => ({ left: "0px", top: "0px" })),
      on: {
        pointerenter: () => undefined,
        pointerleave: () => undefined,
        focusin: () => undefined,
        focusout: () => undefined,
        keydown: () => undefined,
      },
      close: () => undefined,
      keepFocus: () => undefined,
    }),
  };
});

const NOW = Date.parse("2026-11-04T12:00:00Z");
const PAUSE_MS = 400;
const WRITE_MS = 300;
const THREADS = 637;
const SPINS = /aria-label="Reload discussions"[^>]*><svg [^>]*animate-spin/u;
const TURN_LOOK = "font-semibold text-primary";

let slice: MergeRequests;
/** When set, every discussions read after it fails with this message. */
let failReads: string | null;
/** The source's `askGitLabAgain`; a test may hold it. */
let askAgain: MergeRequestSource["askGitLabAgain"];
let mode: ShallowRef<DiscussionDetails>;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  failReads = null;
  mode = shallowRef<DiscussionDetails>("lazy");
  const fixture = createFixtureCompareSource(log, "?mr=list", {});
  askAgain = () => fixture.askGitLabAgain();
  const source: MergeRequestSource = {
    ...fixture,
    askGitLabAgain: () => askAgain(),
    readDiscussions: async (iids) =>
      failReads === null
        ? fixture.readDiscussions(iids)
        : {
            ok: true,
            value: iids.map((each) => ({
              iid: each,
              answer: { kind: "failed", message: failReads ?? "" },
            })),
          },
  };
  slice = createMergeRequests({
    source,
    screen: shallowRef<Screen>({ kind: "mergeRequests" }),
    report: () => undefined,
    discussionDetails: () => mode.value,
  });
  registerMergeRequests(slice);
});

afterEach(() => {
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

function d(serial: number): DiscussionId {
  const id = String(serial).padStart(40, "0");
  if (!isDiscussionId(id)) {
    throw new Error(`${id} is not a discussion id`);
  }
  return id;
}

function rowOf(value: number): MergeRequestRow {
  const found = slice.rows.value.find((row) => row.iid === value);
  if (found === undefined) {
    throw new Error(`no row !${value}`);
  }
  return found;
}

async function discussionsRead(): Promise<void> {
  await slice.refresh();
  slice.askDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
}

async function box(at = THREADS): Promise<string> {
  const props = { row: rowOf(at), now: NOW, asking: false };
  const html = await renderToString(
    createSSRApp({ render: () => h(MergeRequestDiscussions, props) }),
  );
  return html.replaceAll(/<!--[[\]]?-->/gu, "");
}

/** Each row button's discussion id (its last two digits) and its turn words, in the box's order. */
function rows(html: string): string[] {
  return html
    .split("<li")
    .slice(1)
    .map((line) => {
      const id = /data-discussion-id="0+(\d+)"/u.exec(line)?.[1] ?? "?";
      const turn =
        /<span class="[^"]*ml-auto[^"]*"[^>]*>(?:<svg[^]*?<\/svg>)?([^<]+)<\/span>/u.exec(
          line,
        )?.[1];
      return `d${id.padStart(2, "0")} ${turn?.replaceAll("&#39;", "'") ?? "?"}`;
    });
}

/** The header's words, then "error" or "muted" by its colour. */
function headerOf(html: string): string {
  const [, tone = "", text = ""] =
    /<p role="status" class="([^"]*)">([^<]*)<\/p>/u.exec(html) ?? [];
  return `${text} | ${tone.includes("text-problem-error") ? "error" : "muted"}`;
}

/** Whether the discussions opener button carries the look of a "Your turn" line's words. */
function waitsForViewer(html: string): boolean {
  const opener = /<button [^>]*aria-expanded[^>]*>/u.exec(html)?.[0] ?? "";
  return opener.includes(TURN_LOOK);
}

async function resolve(serial: number): Promise<void> {
  await resolveDiscussion(THREADS, d(serial));
}

async function resolveDiscussion(at: number, id: DiscussionId): Promise<void> {
  slice.showThread(iid(at), id);
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const resolving = slice.setResolved(true);
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await resolving;
}

test("rows_are_buttons_keyed_by_id_with_the_shift_tip", async () => {
  await discussionsRead();
  const html = await box();

  expect(rows(html)).toEqual([
    "d01 Your turn",
    "d03 Your turn",
    "d04 Your turn",
    "d05 Your turn",
    "d02 Dmitri Volkov's turn",
    "d06 Ben Okafor's turn",
    "d07 Dmitri Volkov's turn",
    "d08 Anna Berg's turn",
    "d09 Open",
    "d10 Dmitri Volkov's turn",
    "d11 Dmitri Volkov's turn",
    "d12 Dmitri Volkov's turn",
    "d13 Dmitri Volkov's turn",
  ]);
  expect(headerOf(html)).toBe("4 of 13 wait for you | muted");
  const buttons = html.split("<li").slice(1);
  expect(buttons.every((line) => line.includes(`<button type="button" data-discussion-id=`))).toBe(
    true,
  );
  expect(buttons.every((line) => line.includes('aria-keyshortcuts="Shift"'))).toBe(true);
  expect(buttons.every((line) => line.includes('data-tooltip="Shift: show the thread"'))).toBe(
    true,
  );
  expect(html).not.toContain('aria-current="');
  expect(html).not.toContain('role="dialog"');
});

test("a_marked_row_reads_resolved_and_leaves_the_count", async () => {
  await discussionsRead();
  slice.showThread(iid(THREADS), d(2));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const resolving = slice.setResolved(true);
  await vi.advanceTimersByTimeAsync(WRITE_MS + PAUSE_MS);
  await resolving;
  const html = await box();

  expect(rows(html)).toContain("d02 Resolved");
  expect(rows(html)).not.toContain("d02 Dmitri Volkov's turn");
  const marked = html
    .split("<li")
    .find((line) => line.includes('data-discussion-id="0000000000000000000000000000000000000002"'));
  expect(marked).toContain('aria-current="true"');
  expect(marked).toMatch(/^><button [^>]*class="[^"]* text-fg-muted"/u);
  expect(marked).toContain("<svg");
  expect(headerOf(html)).toBe("4 of 12 wait for you | muted");
  expect(html).toContain('aria-label="13 open discussions"');
  expect(html).toContain('role="dialog"');

  slice.boxClosed(iid(THREADS));
  const closed = await box();
  expect(rows(closed)).not.toContain("d02 Resolved");
  expect(closed).toContain('aria-label="12 open discussions"');
});

test("the_refresh_button_has_its_tip_and_spins_at_the_press", async () => {
  await discussionsRead();
  const idle = await box();
  const button = /<button [^>]*aria-label="Reload discussions"[^]*?<\/button>/u.exec(idle)?.[0];
  expect(button).toContain('data-tooltip="Reload discussions"');
  expect(button).not.toContain("animate-spin");

  askAgain = () => new Promise(() => undefined);
  slice.refreshDiscussions(iid(THREADS));
  const running = await box();
  expect(rows(running)).toHaveLength(13);
  expect(running).toMatch(SPINS);
});

test("with_discussions_off_the_shown_threads_reload_spins_at_the_press", async () => {
  await discussionsRead();
  slice.showThread(iid(THREADS), d(2));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  mode.value = "off";
  await vi.advanceTimersByTimeAsync(0);
  expect(slice.discussions.value.size).toBe(0);
  expect(await box()).not.toMatch(SPINS);

  askAgain = () => new Promise(() => undefined);
  slice.refreshDiscussions(iid(THREADS));
  expect(await box()).toMatch(SPINS);
});

test("a_failed_reload_keeps_the_rows", async () => {
  await discussionsRead();
  failReads = "glab timed out";
  slice.refreshDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const html = await box();

  expect(rows(html)).toHaveLength(13);
  expect(rows(html)[0]).toBe("d01 Your turn");
  expect(headerOf(html)).toMatch(/glab timed out.* \| error$/u);
});

test("a_row_with_the_viewers_turn_has_a_marked_button", async () => {
  await slice.refresh();
  expect(waitsForViewer(await box())).toBe(false);
  slice.askDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const read = await box();
  expect(read).toContain(`class="${TURN_LOOK} ml-auto pl-4">Your turn<`);
  expect([headerOf(read), waitsForViewer(read)]).toEqual(["4 of 13 wait for you | muted", true]);

  mode.value = "full";
  await slice.findProject();
  slice.review({ kind: "person", username: "anna" });
  const anna = await box();
  expect([headerOf(anna), waitsForViewer(anna)]).toEqual([
    "2 of 13 wait for Anna Berg | muted",
    true,
  ]);
  slice.review({ kind: "person", username: "zoe" });
  const zoe = await box();
  expect([headerOf(zoe), waitsForViewer(zoe)]).toEqual(["0 of 13 wait for zoe | muted", false]);
  slice.review({ kind: "me" });

  for (const serial of [1, 3, 4]) {
    await resolve(serial);
  }
  const last = await box();
  expect([headerOf(last), waitsForViewer(last)]).toEqual(["1 of 10 waits for you | muted", true]);
  await resolve(5);
  const none = await box();
  expect([headerOf(none), waitsForViewer(none)]).toEqual(["0 of 9 wait for you | muted", false]);
});

test("a_discussion_resolved_in_the_box_moves_its_row_in_review_order_as_it_unmarks_the_button", async () => {
  const ASKS_SAM = 633;
  mode.value = "full";
  await slice.findProject();
  await slice.refresh();
  slice.review({ kind: "me" });
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const entry = slice.discussions.value.get(iid(ASKS_SAM));
  const [only] = entry?.kind === "read" ? entry.discussions : [];
  if (only === undefined || entry?.kind !== "read" || entry.discussions.length !== 1) {
    throw new Error(`!${ASKS_SAM} should have read one open discussion`);
  }
  expect(slice.shownRows.value[0]?.iid).toBe(ASKS_SAM);
  expect(waitsForViewer(await box(ASKS_SAM))).toBe(true);

  await resolveDiscussion(ASKS_SAM, only.id);

  const after = await box(ASKS_SAM);
  expect(after).toContain(`data-discussion-id="${only.id}"`);
  expect(headerOf(after)).toBe("No open discussions | muted");
  expect(waitsForViewer(after)).toBe(false);
  expect(slice.shownRows.value[0]?.iid).not.toBe(ASKS_SAM);
  expect(slice.shownRows.value.map((row) => row.iid)).toContain(ASKS_SAM);
});
