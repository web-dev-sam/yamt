import type * as Generated from "./bindings";
import { isMergeRequestIid, isWebPage, type MergeRequestIid, type WebPage } from "./domain";
import { branded } from "./validate";

export type GitLabProject = Readonly<Generated.GitLabProject>;
type FailedJob = Readonly<Omit<Generated.FailedJob, "page">> & {
  readonly page: WebPage | null;
};
type Pipeline = {
  readonly status: Generated.CiStatus;
  readonly failedJobs: readonly FailedJob[];
  readonly moreFailedJobs: boolean;
};
export type Person = {
  readonly username: string;
  readonly name: string;
  readonly picture: string | null;
};
export type Reviewer = { readonly person: Person; readonly state: Generated.ReviewState };
export type Label = Readonly<Generated.Label>;
export type MergeRequestRow = Readonly<
  Omit<
    Generated.MergeRequestRow,
    | "iid"
    | "createdAt"
    | "pipeline"
    | "page"
    | "author"
    | "assignees"
    | "reviewers"
    | "labels"
    | "approvedBy"
  >
> & {
  readonly iid: MergeRequestIid;
  /** Milliseconds since 1970, from GitLab's ISO 8601 time. */
  readonly createdAt: number;
  readonly author: Person | null;
  readonly assignees: readonly Person[];
  readonly reviewers: readonly Reviewer[];
  readonly labels: readonly Label[];
  readonly approvedBy: readonly Person[];
  readonly pipeline: Pipeline | null;
  readonly page: WebPage | null;
};
export type MergeRequestPage = {
  readonly me: string | null;
  readonly rows: readonly MergeRequestRow[];
};
export type ListEnd = Readonly<Generated.ListEnd>;
export type OpenReply =
  | Readonly<Exclude<Generated.OpenReply, { kind: "missingCommit" }>>
  | { readonly kind: "missingCommit"; readonly shortId: string };
export type PageOpened = Readonly<Generated.PageOpened>;
export type Readiness = Readonly<Generated.Readiness>;
export type Started = Readonly<Generated.Started>;
export type Refusal = Readonly<Generated.Refusal>;
export type ResolveRefusal = Readonly<Generated.ResolveRefusal>;
export type ResolveReply = Readonly<Generated.ResolveReply>;
export type ContinueMergeReply = Readonly<Generated.ContinueMergeReply>;
export type CheckedRow = { readonly iid: MergeRequestIid; readonly readiness: Readiness };
export type LocalMerge = Readonly<Generated.LocalMerge>;
export type RerequestReply =
  | Readonly<Exclude<Generated.RerequestReply, { kind: "requested" }>>
  | { readonly kind: "requested"; readonly reviewers: readonly Reviewer[] };
export type JobLogReply = Readonly<Generated.JobLogReply>;

type UploadedPicture = (username: string) => string;

function toWebPage(text: string, field: string): WebPage {
  if (!isWebPage(text)) {
    throw new Error(`${field} must be an https address, got "${text}"`);
  }
  return text;
}

function toTime(text: string, field: string): number {
  const time = Date.parse(text);
  if (Number.isNaN(time)) {
    throw new Error(`${field} must be an ISO 8601 time, got "${text}"`);
  }
  return time;
}

function toPipeline(raw: Generated.Pipeline, field: string): Pipeline {
  return {
    status: raw.status,
    failedJobs: raw.failedJobs.map((job, at) => ({
      ...job,
      page: job.page === null ? null : toWebPage(job.page, `${field}.failedJobs[${at}].page`),
    })),
    moreFailedJobs: raw.moreFailedJobs,
  };
}

function toPerson(raw: Generated.Person, uploadedPicture: UploadedPicture): Person {
  const { username, name, picture } = raw;
  switch (picture.kind) {
    case "uploaded":
      return { username, name, picture: uploadedPicture(username) };
    case "gravatar":
      return { username, name, picture: picture.address };
    case "none":
      return { username, name, picture: null };
    default: {
      const _exhaustive: never = picture;
      return _exhaustive;
    }
  }
}

function toReviewers(
  raw: readonly Generated.Reviewer[],
  uploadedPicture: UploadedPicture,
): readonly Reviewer[] {
  return raw.map(({ person, state }) => ({ person: toPerson(person, uploadedPicture), state }));
}

function toRow(
  raw: Generated.MergeRequestRow,
  index: number,
  uploadedPicture: UploadedPicture,
): MergeRequestRow {
  const field = `rows[${index}]`;
  function person(each: Generated.Person): Person {
    return toPerson(each, uploadedPicture);
  }
  return {
    ...raw,
    iid: branded(raw.iid, isMergeRequestIid, `${field}.iid`),
    createdAt: toTime(raw.createdAt, `${field}.createdAt`),
    author: raw.author === null ? null : person(raw.author),
    assignees: raw.assignees.map(person),
    reviewers: toReviewers(raw.reviewers, uploadedPicture),
    approvedBy: raw.approvedBy.map(person),
    pipeline: raw.pipeline === null ? null : toPipeline(raw.pipeline, `${field}.pipeline`),
    page: raw.page === null ? null : toWebPage(raw.page, `${field}.page`),
  };
}

export function toMergeRequestPage(
  raw: Generated.MergeRequestPage,
  uploadedPicture: UploadedPicture,
): MergeRequestPage {
  return { me: raw.me, rows: raw.rows.map((row, index) => toRow(row, index, uploadedPicture)) };
}

export function toRerequestReply(
  raw: Generated.RerequestReply,
  uploadedPicture: UploadedPicture,
): RerequestReply {
  return raw.kind === "requested"
    ? { kind: "requested", reviewers: toReviewers(raw.reviewers, uploadedPicture) }
    : raw;
}

export function toCheckedRow(raw: Generated.CheckedRow): CheckedRow {
  return { iid: branded(raw.iid, isMergeRequestIid, "row.iid"), readiness: raw.readiness };
}

export function toOpenReply(raw: Generated.OpenReply): OpenReply {
  return raw.kind === "missingCommit" ? { kind: "missingCommit", shortId: raw.short_id } : raw;
}
