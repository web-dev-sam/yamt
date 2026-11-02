import { expect, test } from "vitest";

import {
  createFixtureCompareSource,
  isMergeRequestIid,
  log,
  type MergeRequestIid,
  type MergeRequestSource,
  type RerequestReply,
  type Reviewer,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { createRerequests, type RerequestAsk, type Rerequests } from "./mergeRequestRerequests";
import type { Problem } from "./problem";

type Ask = {
  readonly iid: MergeRequestIid;
  readonly username: string;
  readonly answer: (result: SourceResult<RerequestReply>) => void;
};

type Rig = {
  readonly slice: Rerequests;
  readonly asks: Ask[];
  readonly problems: Problem[];
  readonly replaced: [MergeRequestIid, readonly Reviewer[]][];
};

const STOPPED: SourceFailure = { kind: "WorkerStopped" };
const REVIEWERS: readonly Reviewer[] = [
  { person: { username: "anna", name: "Anna Berg", picture: null }, state: "requested" },
];
const REFUSED: RerequestReply = { kind: "refused", message: "not allowed" };

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function rig(): Rig {
  const asks: Ask[] = [];
  const problems: Problem[] = [];
  const replaced: [MergeRequestIid, readonly Reviewer[]][] = [];
  const source: MergeRequestSource = {
    ...createFixtureCompareSource(log, "", {}),
    rerequestReview: (asked, username) =>
      new Promise((resolve) => {
        asks.push({ iid: asked, username, answer: resolve });
      }),
  };
  const slice = createRerequests({
    source,
    report: (problem) => problems.push(problem),
    replaced: (asked, reviewers) => replaced.push([asked, reviewers]),
  });
  return { slice, asks, problems, replaced };
}

function askAt(asks: readonly Ask[], index: number): Ask {
  const found = asks[index];
  if (found === undefined) {
    throw new Error(`no ask ${index}; ${asks.length} made`);
  }
  return found;
}

function asksOf(live: Rig, value: number): ReadonlyMap<string, RerequestAsk> | undefined {
  return live.slice.rerequests.value.get(iid(value));
}

test("a second click on the same reviewer while running asks once; another reviewer or row asks beside it", async () => {
  const live = rig();
  const first = live.slice.rerequestReview(iid(52), "anna");
  await live.slice.rerequestReview(iid(52), "anna");
  const other = live.slice.rerequestReview(iid(52), "ben");
  const otherRow = live.slice.rerequestReview(iid(50), "anna");

  expect(live.asks.map((ask) => [ask.iid, ask.username])).toEqual([
    [52, "anna"],
    [52, "ben"],
    [50, "anna"],
  ]);
  expect(asksOf(live, 52)).toEqual(
    new Map([
      ["anna", { kind: "running" }],
      ["ben", { kind: "running" }],
    ]),
  );
  for (const ask of live.asks) {
    ask.answer({ ok: true, value: { kind: "notOpen" } });
  }
  await Promise.all([first, other, otherRow]);
});

test("requested calls replaced with that row's reviewers and clears the ask (catches the row left running)", async () => {
  const live = rig();
  const asking = live.slice.rerequestReview(iid(52), "anna");
  askAt(live.asks, 0).answer({ ok: true, value: { kind: "requested", reviewers: REVIEWERS } });
  await asking;

  expect(live.replaced).toEqual([[52, REVIEWERS]]);
  expect(live.slice.rerequests.value.has(iid(52))).toBe(false);
  expect(live.problems).toEqual([]);
});

test.each<RerequestReply>([
  REFUSED,
  { kind: "notReviewer" },
  { kind: "notOpen" },
  { kind: "glabMissing" },
  { kind: "notLoggedIn", detail: "no token" },
  { kind: "failed", message: "502" },
])("a refusal %j stays until dismissed, and dismissing keeps a running ask", async (reply) => {
  const live = rig();
  const refused = live.slice.rerequestReview(iid(52), "anna");
  askAt(live.asks, 0).answer({ ok: true, value: reply });
  await refused;
  expect(asksOf(live, 52)).toEqual(new Map([["anna", { kind: "refused", reply }]]));
  expect(live.replaced).toEqual([]);

  const running = live.slice.rerequestReview(iid(52), "ben");
  live.slice.dismissRerequestRefusals(iid(52));
  expect(asksOf(live, 52)).toEqual(new Map([["ben", { kind: "running" }]]));

  askAt(live.asks, 1).answer({ ok: true, value: { kind: "notOpen" } });
  await running;
  live.slice.dismissRerequestRefusals(iid(52));
  expect(live.slice.rerequests.value.has(iid(52))).toBe(false);
});

test("dismissing one row's refusals keeps another row's", async () => {
  const live = rig();
  const first = live.slice.rerequestReview(iid(52), "anna");
  const second = live.slice.rerequestReview(iid(50), "anna");
  askAt(live.asks, 0).answer({ ok: true, value: REFUSED });
  askAt(live.asks, 1).answer({ ok: true, value: REFUSED });
  await Promise.all([first, second]);

  live.slice.dismissRerequestRefusals(iid(52));
  expect(live.slice.rerequests.value.has(iid(52))).toBe(false);
  expect(asksOf(live, 50)).toEqual(new Map([["anna", { kind: "refused", reply: REFUSED }]]));
});

test("the next ask for a refused reviewer replaces the refusal with running", async () => {
  const live = rig();
  const refused = live.slice.rerequestReview(iid(52), "anna");
  askAt(live.asks, 0).answer({ ok: true, value: REFUSED });
  await refused;

  const again = live.slice.rerequestReview(iid(52), "anna");
  expect(asksOf(live, 52)).toEqual(new Map([["anna", { kind: "running" }]]));
  expect(live.asks).toHaveLength(2);
  askAt(live.asks, 1).answer({ ok: true, value: { kind: "requested", reviewers: REVIEWERS } });
  await again;
  expect(live.slice.rerequests.value.has(iid(52))).toBe(false);
});

test("a source failure reports rerequestReview and clears the ask, keeping the row's other asks", async () => {
  const live = rig();
  const failing = live.slice.rerequestReview(iid(52), "anna");
  const other = live.slice.rerequestReview(iid(52), "ben");
  askAt(live.asks, 0).answer({ ok: false, failure: STOPPED });
  await failing;

  expect(live.problems).toEqual([
    { action: "mergeRequests", step: "rerequestReview", cause: STOPPED },
  ]);
  expect(asksOf(live, 52)).toEqual(new Map([["ben", { kind: "running" }]]));
  expect(live.replaced).toEqual([]);
  askAt(live.asks, 1).answer({ ok: false, failure: STOPPED });
  await other;
});
