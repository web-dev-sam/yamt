# CiJobLogStateBoundary

Agent output (`agent://CiJobLogStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogStateBoundary.md), collected 2026-11-03T10:56:04.575Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 15 changed files are within the brief's Owned list; fixtureMergeRequestData.ts changes only `export const ORIGIN`; bindings.ts, mergeRequests/**, .vue, docs untouched (PM4).",
    "Edges: ui/mergeRequestJobLogs.ts imports vue, ../ipc (log as aiClose.ts), ../mergeRequests index, ./problem, ./windowStorage only (PM2/PM5/PM10); ipc test → ../mergeRequests has precedent fixtureMergeRequestData.test.ts:3.",
    "Contract: readJobLog signature/doc, `JobLogReply = Readonly<Generated.JobLogReply>`, index export, tauri pass-through `toResult(await commands.readJobLog(page))` match the brief; bindings.ts:85 has readJobLog(page: WebPage).",
    "State: jobLog written only by showJobLog/closeJobLog; jobSearches via storedRecord, written only by setJobSearch, no repo key, key/event named as dueDates/filters. state.md/tree.md rows are the docs keeper's (deviations).",
    "Deviations accepted: `plan §2 row 158` (palette HEX_COLOUR matches #158); createJobLogs(deps) as createRowActions(deps) (mergeRequests.ts:225); dropped replies not parsed/logged; openPage moved into pageScript (max-lines).",
    "Rules: TS15 unitLog is a build-once string cache of constant input; TS17 REFUSALS a Readonly Record; TS10 arrows only in object literals; no narrating comments (CP2 one-liners only); ipc/AGENTS.md line matches the code."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestLogs.ts",
      "line": 13,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "The job numbering (FIRST_JOB 9000, JOBS_PER_ROW 10, lint at +0, unit at +1) is copied from fixtureMergeRequestData.ts:23-24,135-142, and refusals scan a second magic bound (SCRIPTED_ROWS_SCANNED 20). So the data file's numbering now lives in two places, and fixtureJobLog's doc comment ('a job page of the fixture's list') is false: jobs/99990 or a non-failed row's number gets a log.",
      "fix": "Find the page once among the listed rows' failedJobs (as scriptedRefusal/rerequestReply do) and choose the refusal by iid and the log by job.name. Then delete FIRST_JOB, JOBS_PER_ROW, LINT_JOB, UNIT_JOB, JOB_PREFIX, JOB_NUMBER, jobNumber and SCRIPTED_ROWS_SCANNED."
    },
    {
      "file": "frontend/src/ui/mergeRequestJobLogs.ts",
      "line": 28,
      "severity": "should",
      "problem": "The private `type Shown` and the variable `shown` reuse a name the slice already uses: mergeRequestsShown.ts exports `Shown` (the shown rows, imported into mergeRequests.ts) and State has `shown` (the load on the page). The load kind is also called 'shown', so `shown.value = { job, load }` with `load.kind === \"shown\"` is ambiguous. Every later reader of the slice has to tell three 'shown's apart.",
      "fix": "Rename the alias and the local to `LogBox`/`box` (or `OpenLog`/`open`), so 'shown' keeps only its row and load-kind meanings."
    }
  ]
}
