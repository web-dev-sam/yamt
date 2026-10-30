import type * as Generated from "./bindings";
import { isJobPage, isMergeRequestIid, type JobPage, type MergeRequestIid } from "./domain";
import { branded } from "./validate";

export type GitLabProject = Readonly<Generated.GitLabProject>;
type FailedJob = Readonly<Omit<Generated.FailedJob, "page">> & {
  readonly page: JobPage | null;
};
type Pipeline = {
  readonly status: Generated.CiStatus;
  readonly failedJobs: readonly FailedJob[];
  readonly moreFailedJobs: boolean;
};
export type MergeRequestRow = Readonly<
  Omit<Generated.MergeRequestRow, "iid" | "createdAt" | "pipeline">
> & {
  readonly iid: MergeRequestIid;
  /** Milliseconds since 1970, from GitLab's ISO 8601 time. */
  readonly createdAt: number;
  readonly pipeline: Pipeline | null;
};
export type MergeRequestPage = {
  readonly me: string | null;
  readonly rows: readonly MergeRequestRow[];
};
export type ListEnd = Readonly<Generated.ListEnd>;
export type OpenReply =
  | Readonly<Exclude<Generated.OpenReply, { kind: "missingCommit" }>>
  | { readonly kind: "missingCommit"; readonly shortId: string };
export type JobOpened = Readonly<Generated.JobOpened>;

function toJobPage(text: string, field: string): JobPage {
  if (!isJobPage(text)) {
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
      page: job.page === null ? null : toJobPage(job.page, `${field}.failedJobs[${at}].page`),
    })),
    moreFailedJobs: raw.moreFailedJobs,
  };
}

function toRow(raw: Generated.MergeRequestRow, index: number): MergeRequestRow {
  const field = `rows[${index}]`;
  return {
    ...raw,
    iid: branded(raw.iid, isMergeRequestIid, `${field}.iid`),
    createdAt: toTime(raw.createdAt, `${field}.createdAt`),
    pipeline: raw.pipeline === null ? null : toPipeline(raw.pipeline, `${field}.pipeline`),
  };
}

export function toMergeRequestPage(raw: Generated.MergeRequestPage): MergeRequestPage {
  return { me: raw.me, rows: raw.rows.map(toRow) };
}

export function toOpenReply(raw: Generated.OpenReply): OpenReply {
  return raw.kind === "missingCommit" ? { kind: "missingCommit", shortId: raw.short_id } : raw;
}
