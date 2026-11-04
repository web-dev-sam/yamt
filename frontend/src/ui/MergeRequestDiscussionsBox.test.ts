import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
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

let slice: MergeRequests;
/** When set, every discussions read after it fails with this message. */
let failReads: string | null;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  failReads = null;
  const fixture = createFixtureCompareSource(log, "?mr=list", {});
  const source: MergeRequestSource = {
    ...fixture,
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
    discussionDetails: () => "lazy",
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

async function box(): Promise<string> {
  const props = { row: rowOf(THREADS), now: NOW };
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

test("rows_are_buttons_keyed_by_id_with_the_shift_tip", async () => {
  await discussionsRead();
  const html = await box();

  expect(rows(html)).toEqual([
    "d01 Your turn",
    "d03 Your turn",
    "d04 Your turn",
    "d05 Your turn",
    "d02 Author's turn",
    "d06 Ben Okafor's turn",
    "d07 Author's turn",
    "d08 Anna Berg's turn",
    "d09 Open",
    "d10 Author's turn",
    "d11 Author's turn",
    "d12 Author's turn",
    "d13 Author's turn",
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
  expect(rows(html)).not.toContain("d02 Author's turn");
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

test("the_refresh_button_has_its_tip", async () => {
  await discussionsRead();
  const idle = await box();
  const button = /<button [^>]*aria-label="Reload discussions"[^]*?<\/button>/u.exec(idle)?.[0];
  expect(button).toContain('data-tooltip="Reload discussions"');
  expect(button).not.toContain("animate-spin");

  slice.reloadDiscussions(iid(THREADS));
  const running = await box();
  expect(rows(running)).toHaveLength(13);
  expect(running).toMatch(/aria-label="Reload discussions"[^>]*><svg [^>]*animate-spin/u);
});

test("a_failed_reload_keeps_the_rows", async () => {
  await discussionsRead();
  failReads = "glab timed out";
  slice.reloadDiscussions(iid(THREADS));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const html = await box();

  expect(rows(html)).toHaveLength(13);
  expect(rows(html)[0]).toBe("d01 Your turn");
  expect(headerOf(html)).toMatch(/glab timed out.* \| error$/u);
});
