import type { StorageLike } from "@vueuse/core";
import { shallowRef, type ShallowRef } from "vue";

import { log, type JobLogReply, type MergeRequestSource, type WebPage } from "../ipc";
import { jobLogView, type JobLogView } from "../mergeRequests";
import { attempt, type Outcome, type ProblemCause } from "./problem";
import { storedRecord, type StoredRecord } from "./windowStorage";

export type LoggedJob = { readonly name: string; readonly page: WebPage };
export type JobLogLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "shown"; readonly view: JobLogView; readonly cut: boolean }
  | { readonly kind: "refused"; readonly reply: Exclude<JobLogReply, { readonly kind: "log" }> }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type ShownJobLog = { readonly job: LoggedJob; readonly load: JobLogLoad };
export type JobLogs = {
  /** The window's one log box: null when none is open. */
  readonly jobLog: Readonly<ShallowRef<ShownJobLog | null>>;
  /** Shows `job`'s log: the same page while loading or shown changes nothing; else loading, then the reply. */
  showJobLog(job: LoggedJob): Promise<void>;
  closeJobLog(): void;
  /** The search text remembered for a job of this name ("" when none). */
  jobSearch(name: string): string;
  /** Remembers `text` for every job of this name, in every repository; "" forgets it. */
  setJobSearch(name: string, text: string): void;
};

type Shown = ShallowRef<ShownJobLog | null>;

const SEARCHES_KEY = "yamt.mergeRequests.jobSearches";
const SEARCHES_WARN_EVENT = "mergeRequests.job_searches_storage_failed";

function settledLoad(outcome: Outcome<JobLogReply>): JobLogLoad {
  if (!outcome.ok) {
    return { kind: "failed", cause: outcome.cause };
  }
  const reply = outcome.value;
  return reply.kind === "log"
    ? { kind: "shown", view: jobLogView(reply.log.text), cut: reply.log.cut }
    : { kind: "refused", reply };
}

function loggedFields(
  page: WebPage,
  load: JobLogLoad,
  ms: number,
): Record<string, string | number | boolean> {
  return load.kind === "shown"
    ? { page, kind: load.kind, lines: load.view.lines.length, cut: load.cut, ms }
    : { page, kind: load.kind, ms };
}

async function showJobLog(shown: Shown, source: MergeRequestSource, job: LoggedJob): Promise<void> {
  const current = shown.value;
  if (
    current?.job.page === job.page &&
    (current.load.kind === "loading" || current.load.kind === "shown")
  ) {
    return;
  }
  const entry: ShownJobLog = { job, load: { kind: "loading" } };
  shown.value = entry;
  const asked = performance.now();
  const outcome = await attempt(() => source.readJobLog(job.page));
  if (shown.value !== entry) {
    return;
  }
  const load = settledLoad(outcome);
  shown.value = { job, load };
  log.info(
    "mergeRequests.job_log_shown",
    loggedFields(job.page, load, Math.round(performance.now() - asked)),
  );
}

function jobSearch(searches: StoredRecord, name: string): string {
  const text = searches.entryAt(name);
  return typeof text === "string" ? text : "";
}

function setJobSearch(searches: StoredRecord, name: string, text: string): void {
  if (text === "") {
    searches.remove(name);
  } else {
    searches.set(name, text);
  }
}

export function createJobLogs(deps: {
  readonly source: MergeRequestSource;
  readonly storage?: StorageLike;
}): JobLogs {
  const shown: Shown = shallowRef<ShownJobLog | null>(null);
  const searches = storedRecord(SEARCHES_KEY, SEARCHES_WARN_EVENT, deps.storage);
  return {
    jobLog: shown,
    showJobLog: (job) => showJobLog(shown, deps.source, job),
    closeJobLog: () => {
      shown.value = null;
    },
    jobSearch: (name) => jobSearch(searches, name),
    setJobSearch: (name, text) => {
      setJobSearch(searches, name, text);
    },
  };
}
