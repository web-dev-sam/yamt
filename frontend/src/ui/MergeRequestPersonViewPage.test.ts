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
} from "../ipc";
import { dateTimeText } from "../mergeRequests";
import MergeRequestPersonView from "./MergeRequestPersonView.vue";
import { createMergeRequests, type MergeRequests } from "./mergeRequests";
import { registerMergeRequests } from "./mergeRequestsStore";
import type { Screen } from "./screen";

vi.mock("./tooltip", () => ({
  vTooltip: {
    getSSRProps: ({ value }: { value: string | null }) => ({ "data-tooltip": value }),
  },
}));
vi.mock("./useMarkdown", () => ({ useMarkdownCode: () => undefined }));

const NOW = Date.parse("2026-11-04T12:00:00Z");
const PAUSE_MS = 400;
const CALLS = 3;
const ANSWERED_PER_CALL = 10;
const ANNA_CASES = 624;
const SAM_CASES = 628;
const FOLD_CASE = 609;
const FAILING = 615;
const LOGGED_OUT = 629;
const P1 = 17;
const P2 = 18;
const P3 = 19;
const P4 = 20;
const P6 = 22;
const P1_COMMENTS = 4;
const P2_COMMENTS = 2;
const TURN_MARK = "font-semibold text-primary";
const CLAMP = "max-h-20 min-w-0 overflow-hidden leading-5";
const WRITERS_ROW = "flex min-w-0 flex-1 items-center gap-1 overflow-hidden";

let slice: MergeRequests;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.stubGlobal("navigator", { platform: "Linux x86_64" });
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  slice = createMergeRequests({
    source: createFixtureCompareSource(log, "?mr=list", {}),
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

async function everyRowRead(): Promise<void> {
  await slice.refresh();
  slice.openPersonView();
  await vi.advanceTimersByTimeAsync(PAUSE_MS * CALLS);
}

async function expanded(row: number, serial: number): Promise<void> {
  slice.expandEntry(iid(row), d(serial));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
}

async function view(): Promise<string> {
  const props = { now: NOW, asking: false };
  const html = await renderToString(
    createSSRApp({ render: () => h(MergeRequestPersonView, props) }),
  );
  return html.replaceAll(/<!--[[\]]?-->/gu, "");
}

/** Each entry's `<li>` by its discussion's serial. */
function entries(html: string): ReadonlyMap<number, string> {
  return new Map(
    html
      .split('<li aria-keyshortcuts="Shift"')
      .slice(1)
      .flatMap((entry): [number, string][] => {
        const serial = /^[^>]*data-discussion-id="0*(\d+)"/u.exec(entry)?.[1];
        return serial === undefined ? [] : [[Number(serial), entry]];
      }),
  );
}

function entryOf(html: string, serial: number): string {
  const found = entries(html).get(serial);
  if (found === undefined) {
    throw new Error(`no entry d${serial}`);
  }
  return found;
}

/** The writers row's names, oldest first (each picture is an `img` named by its writer). */
function writers(entry: string): string[] {
  return [...entry.matchAll(/role="img" aria-label="([^"]*)"/gu)].map(
    ([, name]) => name?.replaceAll("&#39;", "'") ?? "",
  );
}

/** The turn word and whether it carries the viewer's-turn look. */
function turnOf(entry: string): string {
  const [, look = "", word = ""] =
    [...entry.matchAll(/<span class="(?:([^"]*) )?ml-auto shrink-0">([^<]*)<\/span>/gu)].at(-1) ??
    [];
  return `${word.replaceAll("&#39;", "'")}${look === TURN_MARK ? " (marked)" : ""}`;
}

function statusOf(html: string): string {
  return /<p role="status"[^>]*>([^<]*)<\/p>/u.exec(html)?.[1] ?? "";
}

function rowTitle(at: number): string {
  const found = slice.rows.value.find((row) => row.iid === at);
  if (found === undefined) {
    throw new Error(`no row !${at}`);
  }
  return found.title;
}

test("an_entry_shows_its_starter_time_merge_request_place_and_first_comment", async () => {
  await everyRowRead();
  const html = await view();
  const p1 = entryOf(html, P1);
  const first = slice.personView.value?.entries.find((entry) => entry.discussion.id === d(P1));

  expect(p1).toContain('<span class="shrink-0 font-semibold">Anna Berg</span>');
  expect(first).toBeDefined();
  const at = first?.discussion.first.createdAt ?? 0;
  expect(p1).toMatch(
    new RegExp(`data-tooltip="${dateTimeText(at)}">\\d+ (hours|days) ago</span>`, "u"),
  );
  expect(p1).toContain(`>!${ANNA_CASES} ${rowTitle(ANNA_CASES)}</span>`);
  expect(p1).toContain('<span class="shrink-0 text-fg-muted">Overview</span>');
  expect(p1).toContain('aria-expanded="false" aria-label="Show the whole thread"');
  expect(p1).toContain('data-tooltip="Shift: show the thread"');
  expect(html).toContain(`<li aria-keyshortcuts="Shift" data-discussion-id="${d(P1)}"`);
  const clamp = p1.slice(p1.indexOf(CLAMP));
  expect(clamp).toMatch(/<strong>\s*reminder\s*<\/strong>/u);
  expect(clamp).toContain('<code class="markdown-inline-code">snoozeUntil</code>');
  expect(clamp).toMatch(/<a [^>]*role="link"[^>]*>\s*the import notes\s*<\/a>/u);
  expect(clamp).toContain("<img");
  expect(clamp).toContain("And this sixth line is hidden too.");
});

test("the_writers_row_lists_the_later_writers_oldest_first_and_none_for_a_single_comment", async () => {
  await everyRowRead();
  const html = await view();
  const single = slice.personView.value?.entries.find(
    (entry) => entry.discussion.earlier.length === 0,
  );

  expect(writers(entryOf(html, P1))).toEqual(["Ben Okafor", "Chiara Rossi", "Dmitri Volkov"]);
  expect(writers(entryOf(html, P3))).toEqual(["Ben Okafor", "Anna Berg"]);
  expect(writers(entryOf(html, P6))).toEqual([
    "Chiara Rossi",
    "Dmitri Volkov",
    "Anna Berg",
    "Someone",
    "Ben Okafor",
    "Dmitri Volkov",
    "Chiara Rossi",
    "Anna Berg",
    "Ben Okafor",
    "Someone",
    "Dmitri Volkov",
    "Ben Okafor",
    "Chiara Rossi",
  ]);
  expect(single).toBeDefined();
  const lone = entryOf(html, Number(single?.discussion.id));
  expect(writers(lone)).toEqual([]);
  expect(lone).not.toContain(WRITERS_ROW);
});

test("the_turn_word_reads_from_the_persons_side", async () => {
  await everyRowRead();
  const mine = await view();

  expect(statusOf(mine)).toMatch(/^\d+ of \d+ wait for you$/u);
  expect(turnOf(entryOf(mine, P2))).toBe("Your turn (marked)");
  expect(turnOf(entryOf(mine, P4))).toBe("Chiara Rossi's turn");
  expect(turnOf(entryOf(mine, P1))).toBe("Ben Okafor's turn");

  slice.pickPerson({ kind: "person", username: "anna", name: "Anna Berg" });
  const annas = await view();
  expect(statusOf(annas)).toMatch(/^\d+ of \d+ wait for Anna Berg$/u);
  expect(turnOf(entryOf(annas, P1))).toBe("Anna Berg's turn (marked)");
  expect(turnOf(entryOf(annas, P6))).toBe("Anna Berg's turn (marked)");
  expect(turnOf(entryOf(annas, P2))).toBe("Ben Okafor's turn");
  expect([...entries(annas).keys()].indexOf(P1)).toBeLessThan(
    [...entries(annas).keys()].indexOf(P2),
  );
});

test("an_expanded_entry_shows_the_inline_thread_and_hides_the_clamp", async () => {
  await everyRowRead();
  await expanded(ANNA_CASES, P1);
  const html = await view();
  const p1 = entryOf(html, P1);

  expect(p1).toContain('aria-expanded="true" aria-label="Hide the thread"');
  expect(p1).not.toContain(CLAMP);
  expect(p1).not.toContain('data-tooltip="Shift: show the thread"');
  expect(p1.split("<article").length - 1).toBe(1 + P1_COMMENTS);
  expect(p1).toContain("I&#39;ll add a test for archiving.");
  expect(p1).toContain('aria-label="Open on GitLab"');
  expect(p1).toContain("<textarea");
  expect(turnOf(p1)).toBe("Ben Okafor's turn");
  expect(p1).not.toContain(WRITERS_ROW);
  const p3 = entryOf(html, P3);
  expect(p3).toContain(CLAMP);
  expect(p3).not.toContain("<textarea");
});

test("two_expanded_entries_each_show_their_thread", async () => {
  await everyRowRead();
  await expanded(ANNA_CASES, P1);
  await expanded(ANNA_CASES, P2);
  const html = await view();
  const [p1, p2] = [entryOf(html, P1), entryOf(html, P2)];

  expect(p1.split("<article").length - 1).toBe(1 + P1_COMMENTS);
  expect(p2.split("<article").length - 1).toBe(1 + P2_COMMENTS);
  expect(p2).toContain("Yes, per board.");
  expect(p2).not.toContain("archiving");
  expect([p1, p2].map((entry) => entry.includes("<textarea"))).toEqual([true, true]);
  expect([...entries(html).values()].filter((entry) => entry.includes("<textarea"))).toHaveLength(
    2,
  );
});

test("failed_rows_show_one_line_each_with_retry", async () => {
  await everyRowRead();
  const html = await view();
  const alerts = [...html.matchAll(/<p role="alert"[^>]*>([^]*?)<\/p>/gu)].map(([, inner]) =>
    (inner ?? "").replaceAll(/<[^>]*>/gu, "|").replaceAll(/\|+/gu, "|"),
  );

  expect(alerts).toHaveLength(2);
  expect(alerts[0]).toMatch(
    new RegExp(`^\\|!${LOGGED_OUT} [^|]+ — glab is not logged in: .+\\|\\s*Retry\\s*\\|$`, "u"),
  );
  expect(alerts[1]).toMatch(new RegExp(`^\\|!${FAILING} [^|]+ — .+\\|\\s*Retry\\s*\\|$`, "u"));
  expect(alerts[1]).toContain(`!${FAILING} ${rowTitle(FAILING)} — `);
  expect(entries(html).size).toBeGreaterThan(0);
});

test("the_loading_line_counts_the_merge_requests", async () => {
  await slice.refresh();
  const asked = slice.shownRows.value.filter((row) => row.openDiscussions > 0).length;
  slice.openPersonView();

  expect(statusOf(await view())).toBe(`Loading discussions — 0 of ${asked} merge requests`);
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  const partly = await view();
  expect(statusOf(partly)).toBe(
    `Loading discussions — ${ANSWERED_PER_CALL} of ${asked} merge requests`,
  );
  expect(entries(partly).size).toBeGreaterThan(0);
  await vi.advanceTimersByTimeAsync(PAUSE_MS * (CALLS - 1));
  expect(statusOf(await view())).toMatch(/wait for you$/u);
  expect(entries(await view()).has(P4)).toBe(true);
  expect(entries(await view()).has(SAM_CASES)).toBe(false);
  expect(entries(await view()).has(FOLD_CASE)).toBe(false);
});
