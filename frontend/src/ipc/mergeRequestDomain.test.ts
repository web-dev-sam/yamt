import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { isMergeRequestIid, isWebPage } from "./domain";
import { toMergeRequestPage, toOpenReply } from "./mergeRequestDomain";

const ROW: Generated.MergeRequestRow = {
  iid: 13,
  title: "Snooze a reminder",
  createdAt: "2026-10-28T09:30:00Z",
  draft: false,
  assignees: [{ username: "anna", name: "Anna Berg" }],
  reviewers: [],
  labels: ["frontend"],
  openDiscussions: 1,
  approvals: 2,
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
};

function page(row: Partial<Generated.MergeRequestRow>): Generated.MergeRequestPage {
  return { me: "sam", rows: [{ ...ROW, ...row }] };
}

test("a page keeps me and every field, with createdAt in ms since 1970 (catches a time left as text)", () => {
  expect(toMergeRequestPage(page({}))).toEqual({
    me: "sam",
    rows: [{ ...ROW, createdAt: Date.UTC(2026, 9, 28, 9, 30) }],
  });
  expect(toMergeRequestPage({ me: null, rows: [] })).toEqual({ me: null, rows: [] });
});

test("a time with an offset is the same instant (catches a time read as local)", () => {
  const [row] = toMergeRequestPage(page({ createdAt: "2026-10-28T11:30:00+02:00" })).rows;
  expect(row?.createdAt).toBe(Date.UTC(2026, 9, 28, 9, 30));
});

test.each(["", "yesterday", "2026-13-45T99:00:00Z"])(
  "an unreadable time %j is refused with its field (catches NaN reaching the order)",
  (createdAt) => {
    expect(() => toMergeRequestPage(page({ createdAt }))).toThrow(
      `rows[0].createdAt must be an ISO 8601 time, got "${createdAt}"`,
    );
  },
);

test.each([-1, 1.5, Number.NaN])("an iid %d is refused (catches an unchecked brand)", (iid) => {
  expect(() => toMergeRequestPage(page({ iid }))).toThrow("rows[0].iid must be");
  expect(isMergeRequestIid(iid)).toBe(false);
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
    expect(() => toMergeRequestPage(page({ pipeline }))).toThrow(
      `rows[0].pipeline.failedJobs[0].page must be an https address, got "${address}"`,
    );
  },
);

test.each(["http://gitlab.example/x/-/merge_requests/1", "//evil/x", "/x/-/merge_requests/1", ""])(
  "a merge request page %j that is not https is refused like a job's",
  (address) => {
    expect(() => toMergeRequestPage(page({ page: address }))).toThrow(
      `rows[0].page must be an https address, got "${address}"`,
    );
  },
);

test("no pipeline and no page stay null", () => {
  const [row] = toMergeRequestPage(page({ pipeline: null, page: null })).rows;
  expect(row?.pipeline).toBeNull();
  expect(row?.page).toBeNull();
});

test("missingCommit names its short id in camelCase; other replies pass unchanged", () => {
  expect(toOpenReply({ kind: "missingCommit", short_id: "531ea52" })).toEqual({
    kind: "missingCommit",
    shortId: "531ea52",
  });
  const fetchFailed: Generated.OpenReply = { kind: "fetchFailed", message: "no route" };
  expect(toOpenReply(fetchFailed)).toBe(fetchFailed);
});
