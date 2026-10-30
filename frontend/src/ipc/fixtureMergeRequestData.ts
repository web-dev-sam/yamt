import type * as Generated from "./bindings";

export const FIXTURE_REPOSITORY = "/home/sam/taskboard/.git";
export const FIXTURE_ME = "sam";
export const DROPPED_LABEL = "backend";
export const LOGGED_OUT_DETAIL =
  "gitlab.example: No token found (checked config file, keyring, and environment variables).";
export const REFUSED_MESSAGE = "Field 'approvedBy' doesn't exist on type 'MergeRequest'";
export const PAGE_FAILED_MESSAGE = "glab api graphql: 502 Bad Gateway";

const ORIGIN = "https://gitlab.example/taskboard/taskboard";
const NEWEST_IID = 640;
export const ALREADY_OPEN_IID = 639;
export const FETCH_FAILS_IID = 638;
export const PREPARING_IID = 637;
const NEWEST_CREATED = Date.parse("2026-10-30T09:00:00Z");
const CREATED_STEP_MS = 21_600_000;
const DRAFT_EVERY = 7;
const NO_ASSIGNEE_EVERY = 4;
const NO_LABEL_EVERY = 5;
const BUG_EVERY = 3;
const FIRST_JOB = 9000;
const JOBS_PER_ROW = 10;
const MORE_JOBS_AT = 8;
const FORK_AT = 1;
const NO_SIZE_EVERY = 5;
const ADDED_PER_ROW = 12;
const REMOVED_STEP = 5;
const REMOVED_CYCLE = 4;
const FILES_CYCLE = 6;

const TITLES = [
  "Snooze a reminder",
  "Show overdue cards in red",
  "Keep the board's scroll position on reload",
  "Move the card menu into the header",
  "Fix the week view on Sundays",
  "Add keyboard shortcuts for moving cards",
  "Speed up the board query",
  "Document the import format",
  "Drop the old export endpoint",
  "Let a card belong to two lists",
];

const PEOPLE: readonly Generated.Person[] = [
  { username: FIXTURE_ME, name: "Sam Weller" },
  { username: "anna", name: "Anna Berg" },
  { username: "ben", name: "Ben Okafor" },
  { username: "chiara", name: "Chiara Rossi" },
  { username: "dmitri", name: "Dmitri Volkov" },
];

const LABELS = [DROPPED_LABEL, "frontend", "ui", "docs"];

const PIPELINES: readonly (Generated.CiStatus | null)[] = [
  "failed",
  "passed",
  "running",
  null,
  "manual",
  "pending",
  "canceled",
  "skipped",
];

/** Per iid; every other merge request opens. */
export const OPEN_REPLIES: Readonly<Record<number, Generated.OpenReply>> = {
  [ALREADY_OPEN_IID]: { kind: "alreadyOpen" },
  [FETCH_FAILS_IID]: {
    kind: "fetchFailed",
    message:
      "fatal: unable to access 'https://gitlab.example/taskboard/taskboard.git/': Could not resolve host: gitlab.example",
  },
  [PREPARING_IID]: { kind: "preparing" },
};

const READINESS: readonly Generated.Readiness[] = [
  { kind: "conflicts", also: [] },
  { kind: "conflicts", also: [] },
  { kind: "ready" },
  { kind: "needsRebase" },
  { kind: "conflicts", also: [{ kind: "discussions" }] },
  { kind: "checking" },
  { kind: "blocked", reason: { kind: "pipelineMustPass" } },
  { kind: "blocked", reason: { kind: "other", status: "MERGE_TRAIN_STUCK" } },
];

function cycled<T>(values: readonly T[], index: number): T {
  const value = values[index % values.length];
  if (value === undefined) {
    throw new Error("cycled() needs at least one value");
  }
  return value;
}

function failedJobs(index: number): Generated.FailedJob[] {
  const first = FIRST_JOB + index * JOBS_PER_ROW;
  return [
    { name: "lint:docs", stage: "lint", allowFailure: true, page: `${ORIGIN}/-/jobs/${first}` },
    {
      name: "test:unit",
      stage: "test",
      allowFailure: false,
      page: `${ORIGIN}/-/jobs/${first + 1}`,
    },
    { name: "test:e2e", stage: "test", allowFailure: false, page: null },
  ];
}

function pipeline(index: number): Generated.Pipeline | null {
  const status = cycled(PIPELINES, index);
  if (status === null) {
    return null;
  }
  const failed = status === "failed";
  return {
    status,
    failedJobs: failed ? failedJobs(index) : [],
    moreFailedJobs: failed && index === MORE_JOBS_AT,
  };
}

function labels(index: number): string[] {
  if (index % NO_LABEL_EVERY === NO_LABEL_EVERY - 1) {
    return [];
  }
  const label = cycled(LABELS, index);
  return index % BUG_EVERY === 0 ? [label, "bug"] : [label];
}

function readiness(index: number, draft: boolean): Generated.Readiness {
  const cycle = cycled(READINESS, index);
  if (!draft) {
    return cycle;
  }
  if (cycle.kind === "conflicts") {
    return { kind: "conflicts", also: [...cycle.also, { kind: "draft" }] };
  }
  return { kind: "blocked", reason: { kind: "draft" } };
}

function size(index: number): Generated.ChangeSize | null {
  if (index % NO_SIZE_EVERY === NO_SIZE_EVERY - 1) {
    return null;
  }
  return {
    additions: ADDED_PER_ROW * (index + 1),
    deletions: REMOVED_STEP * (index % REMOVED_CYCLE),
    files: (index % FILES_CYCLE) + 1,
  };
}

function row(index: number): Generated.MergeRequestRow {
  const title = cycled(TITLES, index);
  const draft = index % DRAFT_EVERY === DRAFT_EVERY - 1;
  const iid = NEWEST_IID - index;
  return {
    iid,
    title: draft ? `Draft: ${title}` : title,
    createdAt: new Date(NEWEST_CREATED - index * index * CREATED_STEP_MS).toISOString(),
    draft,
    assignees: index % NO_ASSIGNEE_EVERY === NO_ASSIGNEE_EVERY - 1 ? [] : [cycled(PEOPLE, index)],
    reviewers: index % BUG_EVERY === 0 ? [] : [cycled(PEOPLE, index + BUG_EVERY)],
    labels: labels(index),
    openDiscussions: index % BUG_EVERY,
    approvals: index % NO_ASSIGNEE_EVERY,
    pipeline: pipeline(index),
    page: `${ORIGIN}/-/merge_requests/${iid}`,
    size: size(index),
    readiness: readiness(index, draft),
    fromFork: index % READINESS.length === FORK_AT,
  };
}

/** `count` merge requests, newest first, starting at the `from`th newest. */
export function fixtureRows(from: number, count: number): Generated.MergeRequestRow[] {
  return Array.from({ length: count }, (_, at) => row(from + at));
}
