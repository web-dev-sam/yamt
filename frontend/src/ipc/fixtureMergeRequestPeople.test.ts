import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { isMergeRequestIid, type MergeRequestIid, type SourceResult } from "./domain";
import { fixtureUploadedPicture } from "./fixtureMergeRequestData";
import { peopleScript } from "./fixtureMergeRequestPeople";
import type { Log } from "./log";
import type { PeopleChange, PeopleChangeReply } from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";
import { branded } from "./validate";

type Script = Pick<MergeRequestSource, "searchPeople" | "changePeople">;
type Lists = { readonly assignees: readonly string[]; readonly reviewers: readonly string[] };

const LISTED_ROWS = 40;
const CHANGE_MS = 1000;

let lines: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  lines = [];
});

afterEach(() => {
  vi.useRealTimers();
});

function quietLog(): Log {
  function keep(event: string, fields: Record<string, string | number | boolean> = {}): void {
    lines.push(`${event} ${JSON.stringify(fields)}`);
  }
  return { debug: keep, info: keep, warn: keep, error: keep };
}

function iid(value: number): MergeRequestIid {
  return branded(value, isMergeRequestIid, "iid");
}

function script(): Script {
  return peopleScript(quietLog(), LISTED_ROWS);
}

async function answered<T>(asked: Promise<SourceResult<T>>, ms: number): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  const result = await asked;
  if (!result.ok) {
    throw new Error("the fixture failed");
  }
  return result.value;
}

function change(
  group: PeopleChange["group"],
  action: PeopleChange["action"],
  username: string,
): PeopleChange {
  return { group, action, username };
}

async function changed(
  people: Script,
  number: number,
  asked: PeopleChange,
): Promise<PeopleChangeReply> {
  return answered(people.changePeople(iid(number), asked), CHANGE_MS);
}

function lists(reply: PeopleChangeReply): Lists & { readonly kind: string } {
  if (reply.kind !== "changed" && reply.kind !== "unchanged") {
    throw new Error(`no lists in ${reply.kind}`);
  }
  return {
    kind: reply.kind,
    assignees: reply.people.assignees.map((person) => person.username),
    reviewers: reply.people.reviewers.map(({ person, state }) => `${person.username}:${state}`),
  };
}

test("a_search_matches_username_or_name_after_300_ms_and_logs_its_text", async () => {
  const people = script();
  let reply: unknown = null;
  void people.searchPeople("ER").then((result) => {
    reply = result;
  });
  expect(lines).toEqual([`mergeRequests.fixture_people_search {"text":"ER"}`]);
  await vi.advanceTimersByTimeAsync(299);
  expect(reply).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  expect(reply).toEqual({
    ok: true,
    value: {
      kind: "found",
      people: [
        { username: "sam", name: "Sam Weller", picture: fixtureUploadedPicture("sam") },
        {
          username: "anna",
          name: "Anna Berg",
          picture: expect.stringMatching(/^data:image\/png/u),
        },
        {
          username: "erik",
          name: "Erik Lund",
          picture: expect.stringMatching(/^data:image\/png/u),
        },
      ],
    },
  });

  const moreau = await answered(people.searchPeople("moreau"), CHANGE_MS);
  expect(moreau).toEqual({
    kind: "found",
    people: [{ username: "rita", name: "Rita Moreau", picture: null }],
  });
  expect(await answered(people.searchPeople("zzz"), CHANGE_MS)).toEqual({
    kind: "found",
    people: [],
  });
  const everyone = await answered(people.searchPeople(""), CHANGE_MS);
  expect(everyone.kind === "found" && everyone.people.map((person) => person.username)).toEqual([
    "sam",
    "anna",
    "ben",
    "chiara",
    "dmitri",
    "erik",
    "olga",
    "rita",
  ]);
});

test("adding_then_removing_follows_the_scripts_own_lists", async () => {
  const people = script();
  expect(lists(await changed(people, 640, change("reviewers", "add", "ben")))).toEqual({
    kind: "changed",
    assignees: ["sam"],
    reviewers: ["ben:requested"],
  });
  expect(lists(await changed(people, 640, change("assignees", "add", "erik")))).toEqual({
    kind: "changed",
    assignees: ["sam", "erik"],
    reviewers: ["ben:requested"],
  });
  expect(lists(await changed(people, 640, change("assignees", "add", "erik")))).toEqual({
    kind: "changed",
    assignees: ["sam", "erik"],
    reviewers: ["ben:requested"],
  });
  expect(lists(await changed(people, 640, change("assignees", "remove", "sam")))).toEqual({
    kind: "changed",
    assignees: ["erik"],
    reviewers: ["ben:requested"],
  });
  expect(lists(await changed(people, 640, change("reviewers", "remove", "ben")))).toEqual({
    kind: "changed",
    assignees: ["erik"],
    reviewers: [],
  });
  expect(lists(await changed(people, 639, change("assignees", "remove", "nobody")))).toEqual({
    kind: "unchanged",
    assignees: ["anna"],
    reviewers: ["dmitri:reviewed"],
  });
  expect(await changed(people, 1, change("assignees", "add", "ben"))).toEqual({
    kind: "failed",
    message: "GitLab sent no merge request !1",
  });
  expect(lists(await changed(script(), 640, change("assignees", "add", "ben")))).toEqual({
    kind: "changed",
    assignees: ["sam", "ben"],
    reviewers: [],
  });
});

test("olga_is_unchanged_and_rita_refused", async () => {
  const people = script();
  await changed(people, 640, change("assignees", "add", "ben"));
  expect(lists(await changed(people, 640, change("assignees", "add", "olga")))).toEqual({
    kind: "unchanged",
    assignees: ["sam", "ben"],
    reviewers: [],
  });
  expect(lists(await changed(people, 640, change("reviewers", "add", "olga")))).toEqual({
    kind: "unchanged",
    assignees: ["sam", "ben"],
    reviewers: [],
  });
  expect(await changed(people, 640, change("reviewers", "add", "rita"))).toEqual({
    kind: "refused",
    message: "Cannot assign @rita to !640",
  });
  expect(await changed(people, 639, change("assignees", "remove", "rita"))).toEqual({
    kind: "refused",
    message: "Cannot assign @rita to !639",
  });
  expect(lists(await changed(people, 640, change("assignees", "remove", "olga")))).toEqual({
    kind: "changed",
    assignees: ["sam", "ben"],
    reviewers: [],
  });
  expect(lists(await changed(people, 640, change("assignees", "add", "olga")))).toEqual({
    kind: "unchanged",
    assignees: ["sam", "ben"],
    reviewers: [],
  });
});

test("a_new_reviewer_is_requested", async () => {
  const reply = await changed(script(), 639, change("reviewers", "add", "erik"));
  expect(lists(reply)).toEqual({
    kind: "changed",
    assignees: ["anna"],
    reviewers: ["dmitri:reviewed", "erik:requested"],
  });
  expect(reply.kind === "changed" && reply.people.reviewers[1]?.person).toEqual({
    username: "erik",
    name: "Erik Lund",
    picture: expect.stringMatching(/^data:image\/png/u),
  });
});

test("each_call_is_logged", async () => {
  const people = script();
  void people.changePeople(iid(638), change("reviewers", "remove", "anna"));
  void people.searchPeople("an");
  expect(lines).toEqual([
    `mergeRequests.fixture_people_change {"iid":638,"group":"reviewers","action":"remove","username":"anna"}`,
    `mergeRequests.fixture_people_search {"text":"an"}`,
  ]);
  await vi.advanceTimersByTimeAsync(CHANGE_MS);
});
