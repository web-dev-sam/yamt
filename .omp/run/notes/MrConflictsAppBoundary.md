# MrConflictsAppBoundary

Agent output (`agent://MrConflictsAppBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsAppBoundary.md), collected 2026-10-30T22:25:40.260Z.

{
  "verdict": "fail",
  "checked": [
    "Contract met: 5 commands registered (commands.rs:27-28,79-81); abort closes only when ended and leftovers empty; push closes after Pushed; close_ended_merge; Committed is not ended and closes with 'merge finished'.",
    "Accepted: claim as a lib.rs local across window::run; Committed{root,offer}; startup opens the session first (find_live gets session.root()); second_window.rs: one private spawn plus range/merge argv.",
    "PM1: arch-check.sh:87 allows yamt-local-merge for yamt-app, no gitio/merge-core edge; no range_window in src-tauri code; AGENTS.md updated; find_live gives Ok(None) for an unreadable record (plan #142).",
    "Accepted: aliases in mergeRequestDomain.ts (domain.ts max-lines and import cycle); index.ts exports all 15; unused exports and red typecheck are the known transient; the leftovers-test change goes to correctness.",
    "Docs keeper (named in notes): tree.md:80,85 (Committed, range_window) and state.md WindowClaim row. PM6 does not cover src-tauri, so map-check is unaffected."
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge.rs",
      "line": 283,
      "severity": "block",
      "rule_id": "growth: copied rule",
      "problem": "push_merged_branch repeats blocking_reply's rule (ipc_error.rs:75-84): spawn_blocking, log the panic with tracing::error!, answer WorkerStopped. Every other worker command shares that one helper, so a change to the panic policy now has to be made in two places.",
      "fix": "Run the push as `blocking_reply(move || Ok(yamt_local_merge::push(&root, &offer))).await`, then set `Finished` on `Ok(Pushed)`, else `Committed { root, offer }`, and return the result. This drops the hand-written Err arm."
    },
    {
      "file": "src-tauri/src/merge.rs",
      "line": 186,
      "severity": "should",
      "rule_id": "RS9",
      "problem": "recorded_merge maps yamt_local_merge::Error to IpcError::Git inline with map_err. Every other crate's error maps in ipc_error.rs through an exhaustive From with tests. Here LockFailed folds silently into Git, and the next find_live caller writes another mapping.",
      "fix": "Add `impl From<yamt_local_merge::Error> for IpcError` (exhaustive match) to ipc_error.rs with a test in ipc_error/tests.rs. recorded_merge then becomes `Ok(find_live(root)?)`. This needs ipc_error.rs added to Owned."
    },
    {
      "file": "frontend/src/ipc/domain.ts",
      "line": 104,
      "severity": "should",
      "rule_id": "TS11",
      "problem": "Listing.mergeRequest is a second spelling, `Readonly<Generated.MergeView>`, of mergeRequestDomain's MergeView, and the merge-window replies (AbortReply, PushReply) now sit in the page's domain file. If MergeView later gains a conversion, Listing misses it, and ChunkSource will import from the page's file.",
      "fix": "Put the local-merge aliases (MergeView, ReturnTo, BranchBefore, Leftover, Started, Refusal, LocalMerge, PushReply, AbortReply) in a new ipc/localMergeDomain.ts that imports only bindings. domain.ts then imports `type MergeView` from it with no cycle."
    },
    {
      "file": "src-tauri/src/merge/merge_request_tests.rs",
      "line": 264,
      "severity": "should",
      "rule_id": "RS11",
      "problem": "outcome::startup's three tests are in merge's test file. merge.rs's split uses a sibling `mod merge_request_tests`, while merge_requests uses a nested `tests/resolve.rs`, so this one patch sets two conventions for splitting tests, and a reader looks for startup tests in outcome.rs.",
      "fix": "Move this file to merge/tests/merge_request.rs (`mod merge_request;` in merge/tests.rs), as merge_requests/tests/resolve.rs does, and move the startup tests into outcome.rs's tests (see the RS6 finding)."
    },
    {
      "file": "src-tauri/src/outcome.rs",
      "line": 164,
      "severity": "should",
      "rule_id": "RS6",
      "problem": "The patch takes outcome.rs from about 378 to 415 lines and commands.rs from 420 to 447, both over RS6's 400. The next command or start-up rule will grow them further.",
      "fix": "Move outcome.rs's inline `mod tests` to outcome/tests.rs and commands.rs's (line 239) to commands/tests.rs, as ai/, review/ and ipc_error/ do. Add both paths to Owned."
    },
    {
      "file": "src-tauri/src/merge.rs",
      "line": 19,
      "severity": "nit",
      "problem": "Running's doc says 'the session is with the worker', but during a push no session exists; the worker holds the committed offer. Nothing grows harder.",
      "fix": "Change it to 'git runs on a worker: an abort or continue holds the session, a push the committed offer'."
    },
    {
      "file": "src-tauri/src/merge_requests.rs",
      "line": 253,
      "severity": "nit",
      "problem": "The private local_merge has one caller, the find_local_merge closure, and shares its name with yamt_local_merge::local_merge, which it calls. Nothing grows harder.",
      "fix": "Inline it into find_local_merge's blocking_reply closure."
    }
  ]
}
