import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { isMergeRequestIid, isWebPage } from "./domain";
import {
  toCheckedRow,
  toMergeRequestPage,
  toOpenReply,
  toPeopleChangeReply,
  toPeopleSearchReply,
  toRerequestReply,
  type MergeRequestRow,
} from "./mergeRequestDomain";

const ANNA: Generated.Person = { username: "anna", name: "Anna Berg", picture: { kind: "none" } };
const GRAVATAR =
  "https://secure.gravatar.com/avatar/f660ab912ec121d1b1e928a0bb4bc61b?s=80&d=identicon";

function uploadedPicture(username: string): string {
  return `yamt-picture://localhost/${username}`;
}

const ROW: Generated.MergeRequestRow = {
  iid: 13,
  title: "Snooze a reminder",
  hasDescription: true,
  createdAt: "2026-10-28T09:30:00Z",
  draft: false,
  author: null,
  assignees: [ANNA],
  reviewers: [],
  labels: [{ title: "frontend", colors: { background: "steelblue", text: "white" } }],
  openDiscussions: 1,
  approvedBy: [],
  mayRerequest: true,
  pipeline: {
    status: "failed",
    failedJobs: [
      {
        name: "test:unit",
        stage: "test",
        allowFailure: false,
        page: "https://gitlab.example/taskboard/taskboard/-/jobs/42",
      },
      { name: "test:e2e", stage: "test", allowFailure: true, page: null },
    ],
    moreFailedJobs: true,
  },
  page: "https://gitlab.example/taskboard/taskboard/-/merge_requests/13",
  size: { additions: 120, deletions: 40, files: 6 },
  readiness: { kind: "conflicts", also: [{ kind: "pipelineMustPass" }, { kind: "draft" }] },
  fromFork: true,
};

function page(row: Partial<Generated.MergeRequestRow>): Generated.MergeRequestPage {
  return { me: "sam", rows: [{ ...ROW, ...row }] };
}

function firstRow(row: Partial<Generated.MergeRequestRow>): MergeRequestRow {
  const [converted] = toMergeRequestPage(page(row), uploadedPicture).rows;
  if (converted === undefined) {
    throw new Error("the page lost its row");
  }
  return converted;
}

test("a page keeps me and every field, with createdAt in ms since 1970 (catches a time left as text)", () => {
  expect(toMergeRequestPage(page({}), uploadedPicture)).toEqual({
    me: "sam",
    rows: [
      { ...ROW, createdAt: Date.UTC(2026, 9, 28, 9, 30), assignees: [{ ...ANNA, picture: null }] },
    ],
  });
  expect(toMergeRequestPage({ me: null, rows: [] }, uploadedPicture)).toEqual({
    me: null,
    rows: [],
  });
});

test("an_uploaded_picture_is_the_scheme_address_of_the_username, for the author, assignees, reviewers and approvers", () => {
  const sam: Generated.Person = {
    username: "sam",
    name: "Sam Weller",
    picture: { kind: "uploaded" },
  };
  const ben: Generated.Person = {
    username: "ben",
    name: "Ben Okafor",
    picture: { kind: "uploaded" },
  };
  const row = firstRow({
    author: sam,
    assignees: [ben],
    reviewers: [{ person: sam, state: "approved" }],
    approvedBy: [ben],
  });
  expect(row.author?.picture).toBe("yamt-picture://localhost/sam");
  expect(row.assignees.map((person) => person.picture)).toEqual(["yamt-picture://localhost/ben"]);
  expect(row.reviewers).toEqual([
    {
      person: { username: "sam", name: "Sam Weller", picture: "yamt-picture://localhost/sam" },
      state: "approved",
    },
  ]);
  expect(row.approvedBy.map((person) => person.picture)).toEqual(["yamt-picture://localhost/ben"]);
});

test("a_gravatar_picture_is_rusts_address_unchanged (catches an address rebuilt in the window)", () => {
  const gravatar: Generated.Person = { ...ANNA, picture: { kind: "gravatar", address: GRAVATAR } };
  const row = firstRow({ author: gravatar, assignees: [gravatar] });
  expect(row.author).toEqual({ username: "anna", name: "Anna Berg", picture: GRAVATAR });
  expect(row.assignees[0]?.picture).toBe(GRAVATAR);
});

test("no_picture_is_null, and no author stays null", () => {
  const row = firstRow({ author: ANNA, reviewers: [{ person: ANNA, state: "requested" }] });
  expect(row.author?.picture).toBeNull();
  expect(row.reviewers[0]?.person.picture).toBeNull();
  expect(firstRow({ author: null }).author).toBeNull();
});

test("approvedBy keeps GitLab's order; label colours, a colourless label and mayRerequest pass through", () => {
  const people = ["chiara", "anna", "ben"].map((username) => ({ ...ANNA, username }));
  const labels: Generated.Label[] = [
    { title: "bug", colors: { background: "crimson", text: "white" } },
    { title: "docs", colors: null },
  ];
  const row = firstRow({ approvedBy: people, labels, mayRerequest: false });
  expect(row.approvedBy.map((person) => person.username)).toEqual(["chiara", "anna", "ben"]);
  expect(row.labels).toEqual(labels);
  expect(row.mayRerequest).toBe(false);
  expect(firstRow({ mayRerequest: true }).mayRerequest).toBe(true);
});

test("a requested reply's reviewers get their pictures like a row's; other replies pass unchanged", () => {
  const sam: Generated.Person = {
    username: "sam",
    name: "Sam Weller",
    picture: { kind: "uploaded" },
  };
  expect(
    toRerequestReply(
      {
        kind: "requested",
        reviewers: [
          { person: sam, state: "requested" },
          {
            person: { ...ANNA, picture: { kind: "gravatar", address: GRAVATAR } },
            state: "reviewed",
          },
        ],
      },
      uploadedPicture,
    ),
  ).toEqual({
    kind: "requested",
    reviewers: [
      {
        person: { username: "sam", name: "Sam Weller", picture: "yamt-picture://localhost/sam" },
        state: "requested",
      },
      { person: { username: "anna", name: "Anna Berg", picture: GRAVATAR }, state: "reviewed" },
    ],
  });
  const refused: Generated.RerequestReply = { kind: "refused", message: "not allowed" };
  expect(toRerequestReply(refused, uploadedPicture)).toBe(refused);
});

test("found_and_changed_replies_get_pictures_like_a_rows_and_others_pass_unchanged", () => {
  const sam: Generated.Person = {
    username: "sam",
    name: "Sam Weller",
    picture: { kind: "uploaded" },
  };
  const gravatar: Generated.Person = { ...ANNA, picture: { kind: "gravatar", address: GRAVATAR } };
  const samConverted = {
    username: "sam",
    name: "Sam Weller",
    picture: "yamt-picture://localhost/sam",
  };
  const annaConverted = { username: "anna", name: "Anna Berg", picture: GRAVATAR };
  expect(
    toPeopleSearchReply({ kind: "found", people: [sam, gravatar, ANNA] }, uploadedPicture),
  ).toEqual({
    kind: "found",
    people: [samConverted, annaConverted, { username: "anna", name: "Anna Berg", picture: null }],
  });
  const people: Generated.MergeRequestPeople = {
    assignees: [sam],
    reviewers: [{ person: gravatar, state: "approved" }],
  };
  const converted = {
    assignees: [samConverted],
    reviewers: [{ person: annaConverted, state: "approved" }],
  };
  expect(toPeopleChangeReply({ kind: "changed", people }, uploadedPicture)).toEqual({
    kind: "changed",
    people: converted,
  });
  expect(toPeopleChangeReply({ kind: "unchanged", people }, uploadedPicture)).toEqual({
    kind: "unchanged",
    people: converted,
  });
  const failed: Generated.PeopleSearchReply = { kind: "failed", message: "no autocompleteUsers" };
  expect(toPeopleSearchReply(failed, uploadedPicture)).toBe(failed);
  const refused: Generated.PeopleChangeReply = { kind: "refused", message: "Cannot assign" };
  expect(toPeopleChangeReply(refused, uploadedPicture)).toBe(refused);
});

test("a time with an offset is the same instant (catches a time read as local)", () => {
  expect(firstRow({ createdAt: "2026-10-28T11:30:00+02:00" }).createdAt).toBe(
    Date.UTC(2026, 9, 28, 9, 30),
  );
});

test.each(["", "yesterday", "2026-13-45T99:00:00Z"])(
  "an unreadable time %j is refused with its field (catches NaN reaching the order)",
  (createdAt) => {
    expect(() => firstRow({ createdAt })).toThrow(
      `rows[0].createdAt must be an ISO 8601 time, got "${createdAt}"`,
    );
  },
);

test.each([-1, 1.5, Number.NaN])("an iid %d is refused (catches an unchecked brand)", (iid) => {
  expect(() => firstRow({ iid })).toThrow("rows[0].iid must be");
  expect(isMergeRequestIid(iid)).toBe(false);
});

test("a checked row keeps its iid and readiness as they came", () => {
  expect(toCheckedRow({ iid: 41, readiness: { kind: "mergesCleanly" } })).toEqual({
    iid: 41,
    readiness: { kind: "mergesCleanly" },
  });
});

test("a checked row's iid is branded like a page's (catches an unchecked brand)", () => {
  expect(() => toCheckedRow({ iid: -1, readiness: { kind: "ready" } })).toThrow("row.iid must be");
});

test("an iid and a web page are branded as they came", () => {
  expect(isMergeRequestIid(0)).toBe(true);
  expect(isWebPage("https://gitlab.example/x/-/jobs/1")).toBe(true);
});

test.each(["http://gitlab.example/x/-/jobs/1", "//evil/x", "/x/-/jobs/1", ""])(
  "a job page %j that is not https is refused (catches any text reaching the opener)",
  (address) => {
    const job = { name: "lint", stage: "lint", allowFailure: false, page: address };
    const pipeline: Generated.Pipeline = {
      status: "failed",
      failedJobs: [job],
      moreFailedJobs: false,
    };
    expect(() => firstRow({ pipeline })).toThrow(
      `rows[0].pipeline.failedJobs[0].page must be an https address, got "${address}"`,
    );
  },
);

test.each(["http://gitlab.example/x/-/merge_requests/1", "//evil/x", "/x/-/merge_requests/1", ""])(
  "a merge request page %j that is not https is refused like a job's",
  (address) => {
    expect(() => firstRow({ page: address })).toThrow(
      `rows[0].page must be an https address, got "${address}"`,
    );
  },
);

test("no pipeline and no page stay null", () => {
  const row = firstRow({ pipeline: null, page: null });
  expect(row.pipeline).toBeNull();
  expect(row.page).toBeNull();
});

test("missingCommit names its short id in camelCase; other replies pass unchanged", () => {
  expect(toOpenReply({ kind: "missingCommit", short_id: "531ea52" })).toEqual({
    kind: "missingCommit",
    shortId: "531ea52",
  });
  const fetchFailed: Generated.OpenReply = { kind: "fetchFailed", message: "no route" };
  expect(toOpenReply(fetchFailed)).toBe(fetchFailed);
});
