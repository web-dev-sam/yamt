import { afterEach, expect, test, vi } from "vitest";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type Description,
  type DescriptionReply,
  type MergeRequestIid,
  type MergeRequestSource,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import {
  createDescriptions,
  type DescribedRow,
  type DescriptionLoad,
  type Descriptions,
  type ShownDescription,
} from "./mergeRequestDescriptions";

type Ask = {
  readonly iid: MergeRequestIid;
  readonly answer: (result: SourceResult<DescriptionReply>) => void;
  readonly fail: (error: unknown) => void;
};

type Rig = { readonly descriptions: Descriptions; readonly asks: Ask[] };

const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const LOADING: DescriptionLoad = { kind: "loading" };
const SECRET = "the secret words of the description";
const HELLO: Description = {
  blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: SECRET }] }],
};
const TWO_BLOCKS: Description = { blocks: [...HELLO.blocks, { kind: "rule" }] };
const UPLOAD = "upload~00000000000000000000000000000001";

afterEach(() => {
  vi.restoreAllMocks();
});

function iid(number: number): MergeRequestIid {
  if (!isMergeRequestIid(number)) {
    throw new Error(`${number} is not an iid`);
  }
  return number;
}

const SNOOZE: DescribedRow = { iid: iid(640), title: "Snooze a reminder" };
const BOARD: DescribedRow = { iid: iid(639), title: "Show the board" };

function rig(): Rig {
  const asks: Ask[] = [];
  const source: MergeRequestSource = {
    ...createFixtureCompareSource(log, "", {}),
    readDescription: (asked) =>
      new Promise((resolve, reject) => {
        asks.push({ iid: asked, answer: resolve, fail: reject });
      }),
    uploadedImage: (key) => `yamt-picture://localhost/${key}`,
  };
  return { descriptions: createDescriptions({ source }), asks };
}

function askAt(live: Rig, index: number): Ask {
  const ask = live.asks[index];
  if (ask === undefined) {
    throw new Error(`no ask ${index}; ${live.asks.length} made`);
  }
  return ask;
}

function read(description: Description): SourceResult<DescriptionReply> {
  return { ok: true, value: { kind: "read", description } };
}

function shownOf(live: Rig): ShownDescription | null {
  return live.descriptions.description.value;
}

test("opening_shows_loading_then_the_reply", async () => {
  const live = rig();
  expect(shownOf(live)).toBeNull();
  const opening = live.descriptions.toggleDescription(SNOOZE);
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: LOADING });
  expect(live.asks.map((ask) => ask.iid)).toEqual([SNOOZE.iid]);

  askAt(live, 0).answer(read(HELLO));
  await opening;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: { kind: "shown", description: HELLO } });
});

test("each_open_asks_gitlab_again", async () => {
  const live = rig();
  const first = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 0).answer(read(HELLO));
  await first;
  live.descriptions.closeDescription();
  expect(shownOf(live)).toBeNull();

  const second = live.descriptions.toggleDescription(SNOOZE);
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: LOADING });
  askAt(live, 1).answer(read(TWO_BLOCKS));
  await second;
  expect(live.asks.map((ask) => ask.iid)).toEqual([SNOOZE.iid, SNOOZE.iid]);
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: { kind: "shown", description: TWO_BLOCKS } });
});

test("a_second_toggle_of_the_same_row_closes", async () => {
  const live = rig();
  const opening = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 0).answer(read(HELLO));
  await opening;

  await live.descriptions.toggleDescription(SNOOZE);
  expect(shownOf(live)).toBeNull();
  expect(live.asks).toHaveLength(1);

  void live.descriptions.toggleDescription(SNOOZE);
  await live.descriptions.toggleDescription(SNOOZE);
  expect(shownOf(live)).toBeNull();
  expect(live.asks).toHaveLength(2);
});

test("another_rows_toggle_replaces_the_panel_and_asks_afresh", async () => {
  const live = rig();
  const first = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 0).answer(read(HELLO));
  await first;

  const second = live.descriptions.toggleDescription(BOARD);
  expect(shownOf(live)).toEqual({ row: BOARD, load: LOADING });
  expect(live.asks.map((ask) => ask.iid)).toEqual([SNOOZE.iid, BOARD.iid]);
  askAt(live, 1).answer(read(TWO_BLOCKS));
  await second;
  expect(shownOf(live)).toEqual({ row: BOARD, load: { kind: "shown", description: TWO_BLOCKS } });
});

test("an_answer_for_a_closed_or_replaced_panel_is_dropped", async () => {
  const live = rig();
  const info = vi.spyOn(log, "info");
  const closed = live.descriptions.toggleDescription(SNOOZE);
  live.descriptions.closeDescription();
  askAt(live, 0).answer(read(HELLO));
  await closed;
  expect(shownOf(live)).toBeNull();

  const replaced = live.descriptions.toggleDescription(SNOOZE);
  const replacing = live.descriptions.toggleDescription(BOARD);
  askAt(live, 1).answer(read(HELLO));
  await replaced;
  expect(shownOf(live)).toEqual({ row: BOARD, load: LOADING });

  const reopened = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 2).answer(read(TWO_BLOCKS));
  await replacing;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: LOADING });
  expect(info).not.toHaveBeenCalled();

  askAt(live, 3).answer(read(HELLO));
  await reopened;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: { kind: "shown", description: HELLO } });
});

test("retry_asks_again_and_shows_the_new_answer", async () => {
  const live = rig();
  const failing = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 0).answer({ ok: true, value: { kind: "failed", message: "glab timed out" } });
  await failing;

  const retrying = live.descriptions.retryDescription();
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: LOADING });
  expect(live.asks.map((ask) => ask.iid)).toEqual([SNOOZE.iid, SNOOZE.iid]);

  const newer = live.descriptions.retryDescription();
  askAt(live, 1).answer(read(TWO_BLOCKS));
  await retrying;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: LOADING });
  askAt(live, 2).answer(read(HELLO));
  await newer;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: { kind: "shown", description: HELLO } });
});

test("retry_with_no_panel_asks_nothing", async () => {
  const live = rig();
  await live.descriptions.retryDescription();
  expect(live.asks).toEqual([]);
  expect(shownOf(live)).toBeNull();
});

test.each<Exclude<DescriptionReply, { readonly kind: "read" }>>([
  { kind: "glabMissing" },
  { kind: "notLoggedIn", detail: "gitlab.example" },
  { kind: "failed", message: "no such merge request" },
])("a_refusal_is_refused_and_a_thrown_call_is_failed_with_its_cause: %j", async (reply) => {
  const live = rig();
  const refusing = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 0).answer({ ok: true, value: reply });
  await refusing;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: { kind: "refused", reply } });

  const stopping = live.descriptions.retryDescription();
  askAt(live, 1).answer({ ok: false, failure: STOPPED });
  await stopping;
  expect(shownOf(live)).toEqual({ row: SNOOZE, load: { kind: "failed", cause: STOPPED } });

  const throwing = live.descriptions.retryDescription();
  askAt(live, 2).fail(new Error("ipc gone"));
  await throwing;
  expect(shownOf(live)).toEqual({
    row: SNOOZE,
    load: { kind: "failed", cause: { kind: "Unexpected", message: "ipc gone" } },
  });
});

test("image_address_is_the_scheme_for_an_upload_its_own_for_another_site_and_null_when_refused", () => {
  const { descriptions } = rig();
  expect(descriptions.imageAddress({ kind: "uploaded", key: UPLOAD })).toBe(
    `yamt-picture://localhost/${UPLOAD}`,
  );
  expect(descriptions.imageAddress({ kind: "web", address: "https://other.example/a.png" })).toBe(
    "https://other.example/a.png",
  );
  expect(descriptions.imageAddress({ kind: "refused" })).toBeNull();
});

test("the_log_line_names_the_kind_and_counts_never_text", async () => {
  const live = rig();
  const info = vi.spyOn(log, "info");
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(1000)
    .mockReturnValueOnce(1250.4)
    .mockReturnValueOnce(2000)
    .mockReturnValueOnce(2007.6)
    .mockReturnValueOnce(3000)
    .mockReturnValueOnce(3001);
  const shown = live.descriptions.toggleDescription(SNOOZE);
  askAt(live, 0).answer(read(TWO_BLOCKS));
  await shown;
  const refused = live.descriptions.toggleDescription(BOARD);
  askAt(live, 1).answer({ ok: true, value: { kind: "failed", message: SECRET } });
  await refused;
  const failed = live.descriptions.retryDescription();
  askAt(live, 2).answer({ ok: false, failure: STOPPED });
  await failed;

  expect(info.mock.calls).toEqual([
    ["mergeRequests.description_shown", { iid: 640, kind: "shown", blocks: 2, ms: 250 }],
    ["mergeRequests.description_shown", { iid: 639, kind: "refused", ms: 8 }],
    ["mergeRequests.description_shown", { iid: 639, kind: "failed", ms: 1 }],
  ]);
  expect(JSON.stringify(info.mock.calls)).not.toContain(SECRET);
});
