import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { DiscussionThread, DiscussionWriteReply, OpenDiscussion } from "./discussionDomain";
import {
  isDiscussionId,
  isMergeRequestIid,
  type DiscussionId,
  type MergeRequestIid,
} from "./domain";
import {
  createDiscussionStore,
  discussionsScript,
  type DiscussionStore,
} from "./fixtureMergeRequestDiscussions";
import { renderedText, textComment } from "./fixtureMergeRequestRendering";
import { threadsScript } from "./fixtureMergeRequestThreads";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";
import { branded } from "./validate";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const THREAD_MS = 400;
const WRITE_MS = 300;
const HOUR_MS = 3_600_000;
const SAM = "sam";

type Rig = {
  readonly source: Pick<
    MergeRequestSource,
    | "readDiscussions"
    | "readDiscussionThread"
    | "replyToDiscussion"
    | "resolveDiscussion"
    | "submitReview"
    | "previewMarkdown"
  >;
  readonly lines: string[];
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function rig(store: DiscussionStore = createDiscussionStore(500)): Rig {
  const lines: string[] = [];
  function keep(event: string, fields: Record<string, string | number | boolean> = {}): void {
    lines.push(`${event} ${JSON.stringify(fields)}`);
  }
  const log: Log = { debug: keep, info: keep, warn: keep, error: keep };
  return { source: { ...discussionsScript(log, store), ...threadsScript(log, store) }, lines };
}

function iid(value: number): MergeRequestIid {
  return branded(value, isMergeRequestIid, "iid");
}

function d(serial: number): DiscussionId {
  const id = String(serial).padStart(40, "0");
  if (!isDiscussionId(id)) {
    throw new Error(`not an id: ${id}`);
  }
  return id;
}

async function answered<T>(asked: Promise<T>, ms: number): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return asked;
}

async function threadOf(live: Rig, number: number, serial: number): Promise<DiscussionThread> {
  const result = await answered(
    live.source.readDiscussionThread(iid(number), d(serial)),
    THREAD_MS,
  );
  if (!result.ok || result.value.kind !== "read") {
    throw new Error(`no thread: ${JSON.stringify(result)}`);
  }
  return result.value.thread;
}

async function openOf(live: Rig, number: number): Promise<readonly OpenDiscussion[]> {
  const result = await answered(live.source.readDiscussions([iid(number)]), THREAD_MS);
  const answer = result.ok ? result.value[0]?.answer : undefined;
  if (answer?.kind !== "open") {
    throw new Error(`not open: ${JSON.stringify(result)}`);
  }
  return answer.discussions;
}

async function wrote(asked: Promise<unknown>): Promise<unknown> {
  return answered(asked, WRITE_MS);
}

const SENT = { ok: true, value: { kind: "sent" } };

test("d01_is_the_rich_thread_with_edits_sizes_and_a_draft", async () => {
  const thread = await threadOf(rig(), 637, 1);
  const [first, second, third, fourth] = thread.comments;

  expect(thread.comments.map((comment) => comment.author?.username)).toEqual([
    "anna",
    "sam",
    "dmitri",
    "anna",
  ]);
  expect(first?.body.blocks.length).toBe(19);
  expect(first?.body.blocks.some((block) => block.kind === "table")).toBe(true);
  expect(JSON.stringify(first?.body)).toContain('"kind":"both"');
  expect(first?.edited).toBeNull();
  expect(second?.edited?.by.username).toBe("dmitri");
  expect(JSON.stringify(third?.body)).toContain('{"kind":"percent","value":50}');
  expect(fourth?.edited?.by.username).toBe("anna");
  expect(fourth?.edited?.at).toBeGreaterThan(fourth?.createdAt ?? Infinity);
  expect(first?.createdAt).toBe(NOW - 48 * HOUR_MS);
  expect(fourth?.createdAt).toBe(NOW - HOUR_MS);
  expect(thread.drafts).toEqual([{ text: "I'll take the second option." }]);
  expect([thread.pending, thread.commenting, thread.mayResolve, thread.resolved]).toEqual([
    2,
    "allowed",
    true,
    false,
  ]);
  expect(thread.discussion.id).toBe(d(1));
  const web = { kind: "web", address: expect.stringMatching(/^data:image\/png;base64,/u) };
  expect(first?.body.blocks.slice(-2)).toEqual([
    {
      kind: "paragraph",
      inlines: [
        {
          kind: "image",
          image: web,
          caption: "both options",
          size: {
            kind: "both",
            width: { kind: "pixels", value: 160 },
            height: { kind: "pixels", value: 80 },
          },
        },
      ],
    },
    {
      kind: "paragraph",
      inlines: [
        { kind: "text", text: "Two options for the snooze menu, see below. What do you think, " },
        {
          kind: "link",
          link: { kind: "page", page: "https://gitlab.com/ben" },
          inlines: [{ kind: "text", text: "@ben" }],
        },
        { kind: "text", text: "?" },
      ],
    },
  ]);
  expect(third?.body.blocks).toEqual([
    {
      kind: "paragraph",
      inlines: [
        { kind: "text", text: "Like this, as " },
        { kind: "code", text: "@sam" },
        { kind: "text", text: " drew it: " },
        {
          kind: "image",
          image: web,
          caption: "the sketch",
          size: { kind: "width", width: { kind: "percent", value: 50 } },
        },
      ],
    },
  ]);
  expect(thread.discussion.last.mentions).toEqual([]);
  expect(thread.discussion.earlier.map((comment) => comment.mentions)).toEqual([
    [{ username: "ben", name: "Ben Okafor" }],
    [],
    [],
  ]);
});

test("comments_are_an_hour_apart_and_every_note_page_is_new", async () => {
  const live = rig();
  const thread = await threadOf(live, 637, 5);
  expect(thread.comments.map((comment) => (NOW - comment.createdAt) / HOUR_MS)).toEqual([
    48, 47, 5,
  ]);
  expect(
    (await threadOf(live, 637, 1)).comments.map((comment) => (NOW - comment.createdAt) / HOUR_MS),
  ).toEqual([48, 47, 46, 1]);

  await wrote(live.source.replyToDiscussion(iid(637), d(2), "comment", "Thanks."));
  const notes = await Promise.all(
    Array.from({ length: 13 }, (_, at) => threadOf(live, 637, at + 1)),
  );
  const numbers = notes.flatMap((each) =>
    each.comments.map((comment) => Number(comment.page?.split("#note_")[1])),
  );
  expect(new Set(numbers).size).toBe(numbers.length);
  const written = notes[1]?.comments.at(-1)?.page?.split("#note_")[1];
  expect(Number(written)).toBeGreaterThan(
    Math.max(...numbers.filter((n) => String(n) !== written)),
  );
});

function noteOf(comment: { readonly page: string | null } | undefined): number {
  return Number(comment?.page?.split("#note_")[1]);
}

test("a_written_note_takes_the_next_number_above_every_listed_rows_notes", async () => {
  const live = rig(createDiscussionStore(500));
  const first = await threadOf(live, 637, 1);
  expect(noteOf(first.comments[0])).toBe(7000 + 10 * 500);

  await wrote(live.source.replyToDiscussion(iid(637), d(2), "comment", "Thanks."));
  expect(noteOf((await threadOf(live, 637, 2)).comments.at(-1))).toBe(12_027);
  await wrote(live.source.submitReview(iid(637)));
  const submitted = await Promise.all([1, 5].map((serial) => threadOf(live, 637, serial)));
  expect(submitted.map((thread) => noteOf(thread.comments.at(-1)))).toEqual([12_028, 12_029]);
});

test("another_listed_discussion_reads_as_one_paragraph_comments", async () => {
  const live = rig();
  const thread = await threadOf(live, 637, 5);
  expect(thread.comments.map((comment) => comment.body.blocks.length)).toEqual([1, 1, 1]);
  expect(thread.drafts).toEqual([{ text: "Agreed, I'll fix the copy." }]);
  const [listed] = await openOf(live, 639);
  const other = await threadOf(live, 639, 639 * 100);
  expect(other.discussion).toEqual(listed);
  expect(other.comments).toEqual([
    {
      author: listed?.last.author,
      createdAt: listed?.last.createdAt,
      edited: null,
      body: {
        blocks: [
          { kind: "paragraph", inlines: [{ kind: "text", text: "Could you look at this again?" }] },
        ],
      },
      page: null,
    },
  ]);
  expect([other.drafts, other.pending, other.mayResolve, other.resolved]).toEqual([
    [],
    0,
    true,
    false,
  ]);
});

test("636_is_locked_and_its_first_discussion_may_not_be_resolved", async () => {
  const live = rig();
  const first = await threadOf(live, 636, 14);
  const second = await threadOf(live, 636, 15);
  expect([first.commenting, first.mayResolve, second.mayResolve]).toEqual(["locked", false, true]);
  expect(await wrote(live.source.resolveDiscussion(iid(636), d(15), true))).toEqual({
    ok: true,
    value: { kind: "refused", reason: "403 Forbidden" },
  });
  for (const kind of ["comment", "draft"] as const) {
    expect(await wrote(live.source.replyToDiscussion(iid(636), d(15), kind, "Fine."))).toEqual({
      ok: true,
      value: { kind: "refused", reason: "403 Forbidden" },
    });
  }
  const unchanged = await threadOf(live, 636, 15);
  expect([unchanged.comments.length, unchanged.drafts.length]).toEqual([2, 0]);
  expect((await openOf(live, 636)).map((discussion) => discussion.id)).toEqual([
    d(14),
    d(15),
    d(16),
  ]);
});

test("an_unknown_iid_or_discussion_is_not_found", async () => {
  const live = rig();
  for (const [number, serial] of [
    [637, 99],
    [140, 1],
    [636, 1],
  ] as const) {
    expect(
      await answered(live.source.readDiscussionThread(iid(number), d(serial)), THREAD_MS),
    ).toEqual({
      ok: true,
      value: { kind: "notFound" },
    });
  }
  const notFound = { ok: true, value: { kind: "refused", reason: "404 Not Found" } };
  expect(await wrote(live.source.replyToDiscussion(iid(637), d(99), "comment", "x"))).toEqual(
    notFound,
  );
  expect(await wrote(live.source.resolveDiscussion(iid(140), d(1), true))).toEqual(notFound);
  expect(await wrote(live.source.submitReview(iid(140)))).toEqual(notFound);
});

test("a_comment_shows_in_the_next_read_and_the_rows_discussions", async () => {
  const live = rig();
  expect(
    await wrote(live.source.replyToDiscussion(iid(637), d(2), "comment", "Thanks, **done**.")),
  ).toEqual(SENT);

  const thread = await threadOf(live, 637, 2);
  const last = thread.comments.at(-1);
  expect(last?.author?.username).toBe(SAM);
  expect(last?.createdAt).toBe(NOW + WRITE_MS);
  expect(last?.body.blocks).toEqual([
    {
      kind: "paragraph",
      inlines: [
        { kind: "text", text: "Thanks, " },
        { kind: "strong", inlines: [{ kind: "text", text: "done" }] },
        { kind: "text", text: "." },
      ],
    },
  ]);
  const listed = (await openOf(live, 637)).find((discussion) => discussion.id === d(2));
  expect(listed?.last).toMatchObject({ text: "Thanks, **done**.", author: { username: SAM } });
  expect(listed?.earlier.map((comment) => comment.author?.username)).toEqual(["anna", "sam"]);
  expect(thread.discussion).toEqual(listed);
});

test("a_draft_counts_pending_and_submit_publishes_every_draft", async () => {
  const live = rig();
  expect(await wrote(live.source.replyToDiscussion(iid(637), d(3), "draft", "Later."))).toEqual(
    SENT,
  );

  const drafted = await threadOf(live, 637, 3);
  expect([drafted.drafts, drafted.pending, drafted.comments.length]).toEqual([
    [{ text: "Later." }],
    3,
    2,
  ]);

  expect(await wrote(live.source.submitReview(iid(637)))).toEqual(SENT);
  const published = await Promise.all([1, 3, 5].map((serial) => threadOf(live, 637, serial)));
  expect(published.map((thread) => thread.comments.at(-1)?.author?.username)).toEqual([
    SAM,
    SAM,
    SAM,
  ]);
  expect(published.map((thread) => [thread.drafts.length, thread.pending])).toEqual([
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  expect(published[0]?.comments.at(-1)?.body.blocks).toEqual([
    { kind: "paragraph", inlines: [{ kind: "text", text: "I'll take the second option." }] },
  ]);
});

test("a_resolved_discussion_leaves_the_next_discussions_read", async () => {
  const live = rig();
  expect(await wrote(live.source.resolveDiscussion(iid(637), d(1), true))).toEqual(SENT);

  expect((await openOf(live, 637)).map((discussion) => discussion.id)).not.toContain(d(1));
  expect(await openOf(live, 637)).toHaveLength(12);
  expect((await threadOf(live, 637, 1)).resolved).toBe(true);

  expect(await wrote(live.source.resolveDiscussion(iid(637), d(1), false))).toEqual(SENT);
  expect((await openOf(live, 637))[0]?.id).toBe(d(1));
});

test("refuse_and_fail_texts_answer_as_scripted", async () => {
  const live = rig();
  const cases: [string, DiscussionWriteReply][] = [
    ["", { kind: "refused", reason: "There is nothing to send." }],
    ["  \n ", { kind: "refused", reason: "There is nothing to send." }],
    ["refuse this", { kind: "refused", reason: "403 Forbidden" }],
    ["fail now", { kind: "failed", message: "glab timed out" }],
  ];
  for (const [text, reply] of cases) {
    for (const kind of ["comment", "draft"] as const) {
      expect(await wrote(live.source.replyToDiscussion(iid(637), d(2), kind, text))).toEqual({
        ok: true,
        value: reply,
      });
    }
  }
  const thread = await threadOf(live, 637, 2);
  expect([thread.comments.length, thread.drafts.length]).toEqual([2, 0]);
  expect(await answered(live.source.previewMarkdown(iid(637), "fail here"), WRITE_MS)).toEqual({
    ok: true,
    value: { kind: "failed", message: "glab timed out" },
  });
});

test("a_blank_preview_has_no_blocks", async () => {
  const live = rig();
  for (const text of ["", "   ", "\n\n"]) {
    expect(await answered(live.source.previewMarkdown(iid(637), text), WRITE_MS)).toEqual({
      ok: true,
      value: { kind: "read", preview: { blocks: [] } },
    });
  }
});

test("a_preview_is_a_paragraph_per_line_with_strong_text_and_people_links", async () => {
  const live = rig();
  expect(
    await answered(
      live.source.previewMarkdown(iid(637), "**Preview** of @anna\n\nnext, 2**"),
      WRITE_MS,
    ),
  ).toEqual({
    ok: true,
    value: {
      kind: "read",
      preview: {
        blocks: [
          {
            kind: "paragraph",
            inlines: [
              { kind: "strong", inlines: [{ kind: "text", text: "Preview" }] },
              { kind: "text", text: " of " },
              {
                kind: "link",
                link: { kind: "page", page: "https://gitlab.com/anna" },
                inlines: [{ kind: "text", text: "@anna" }],
              },
            ],
          },
          { kind: "paragraph", inlines: [{ kind: "text", text: "next, 2**" }] },
        ],
      },
    },
  });
});

test("reads_answer_after_400_ms_and_writes_and_previews_after_300", async () => {
  const live = rig();
  let thread: unknown = null;
  let write: unknown = null;
  let preview: unknown = null;
  void live.source.readDiscussionThread(iid(637), d(1)).then((result) => {
    thread = result;
  });
  void live.source.submitReview(iid(637)).then((result) => {
    write = result;
  });
  void live.source.previewMarkdown(iid(637), "x").then((result) => {
    preview = result;
  });
  await vi.advanceTimersByTimeAsync(WRITE_MS - 1);
  expect([thread, write, preview]).toEqual([null, null, null]);
  await vi.advanceTimersByTimeAsync(1);
  expect([thread, write === null, preview === null]).toEqual([null, false, false]);
  await vi.advanceTimersByTimeAsync(THREAD_MS - WRITE_MS - 1);
  expect(thread).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(thread).not.toBeNull();
});

test("the_fixture_logs_no_text", async () => {
  const live = rig();
  const secret = "my secret words";
  await answered(live.source.readDiscussionThread(iid(637), d(1)), THREAD_MS);
  await wrote(live.source.replyToDiscussion(iid(637), d(1), "comment", secret));
  await wrote(live.source.replyToDiscussion(iid(637), d(2), "draft", secret));
  await wrote(live.source.resolveDiscussion(iid(637), d(3), true));
  await wrote(live.source.resolveDiscussion(iid(637), d(3), false));
  await wrote(live.source.submitReview(iid(637)));
  await answered(live.source.previewMarkdown(iid(637), secret), WRITE_MS);

  expect(live.lines).toEqual([
    `mergeRequests.fixture_thread {"iid":637,"discussion":"${d(1)}"}`,
    `mergeRequests.fixture_write {"kind":"comment","iid":637,"discussion":"${d(1)}"}`,
    `mergeRequests.fixture_write {"kind":"draft","iid":637,"discussion":"${d(2)}"}`,
    `mergeRequests.fixture_write {"kind":"resolve","iid":637,"discussion":"${d(3)}"}`,
    `mergeRequests.fixture_write {"kind":"unresolve","iid":637,"discussion":"${d(3)}"}`,
    'mergeRequests.fixture_write {"kind":"submit","iid":637,"discussion":""}',
    'mergeRequests.fixture_preview {"iid":637}',
  ]);
});

test("each_source_has_its_own_store", async () => {
  const first = rig();
  await wrote(first.source.resolveDiscussion(iid(637), d(1), true));
  expect(await openOf(first, 637)).toHaveLength(12);
  expect(await openOf(rig(), 637)).toHaveLength(13);
});

test("a_rendered_mention_is_a_page_link_to_the_person_and_strong_text_is_strong", () => {
  expect(renderedText("**Look** @anna\n\n  \nthen 2**")).toEqual({
    blocks: [
      {
        kind: "paragraph",
        inlines: [
          { kind: "strong", inlines: [{ kind: "text", text: "Look" }] },
          { kind: "text", text: " " },
          {
            kind: "link",
            link: { kind: "page", page: "https://gitlab.com/anna" },
            inlines: [{ kind: "text", text: "@anna" }],
          },
        ],
      },
      { kind: "paragraph", inlines: [{ kind: "text", text: "then 2**" }] },
    ],
  });
});

test("a_text_comment_mentions_listed_people_outside_code_on_its_note_page", () => {
  const said = "@sam see `@anna`, @all and @nobody, @chiara";
  const comment = textComment({ iid: 637, said: ["ben", said], time: NOW, note: 12_027 });
  expect(comment.author?.username).toBe("ben");
  expect([comment.createdAt, comment.edited, comment.text]).toEqual([
    "2026-11-04T12:00:00.000Z",
    null,
    said,
  ]);
  expect(comment.page).toBe(
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/637#note_12027",
  );
  expect(comment.mentions).toEqual([
    { username: "sam", name: "Sam Weller" },
    { username: "chiara", name: "Chiara Rossi" },
  ]);
});
