# MrFastPreviewRememberedBoundary

Agent output (`agent://MrFastPreviewRememberedBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewRememberedBoundary.md), collected 2026-11-04T22:12:50.203Z.

{
  "verdict": "fail",
  "checked": [
    "One writer: Remembered.project is private; only project.rs held/forget/logged_in_project touch it. detect.rs only builds the default. The shell reaches it only via pub forget_project (merge_requests.rs:240).",
    "One path: all 13 actions call repository.logged_in_project; asked_project's only caller is that method. No auth_status call outside project.rs. The free function is gone. logged_out_after runs at most once per exit.",
    "Accepted deviations: GRAPHQL_UNAUTHORIZED follows M2. batch_failed is checked before the fan-out. headers() split. Recounted tests (list, people, job_log, discussions INFO). ask_gitlab_again doc per #2423.",
    "Shell: ask_gitlab_again follows the sibling blocking_reply/WebviewWindow pattern, registered after find_gitlab_project. PM1: no new yamt-* edge, no tauri in the crate. CP1 const comments cite the measurement.",
    "Left to the docs keeper (DR5): plan §2 #187 and RK75 rows absent from plan.md. state.md row for the remembered project. map-check: ask_gitlab_again in architecture and ipc-contract. RS5 skipped (#2444).",
    "Growth: project.rs owns project lookup, its memory and the lost-words rule, one coherent job. write.rs failure_words is pub(super) for its test only."
  ],
  "findings": [
    {
      "file": "tests/glab/README.md",
      "line": 88,
      "severity": "block",
      "rule_id": "CP1",
      "problem": "The new measured-fact line says an anonymous `glab api --method POST markdown` for a public project answers the preview with exit 0. The slice's own M3 measured `glab: 401 Unauthorized (HTTP 401)`, exit 1. The implementer's open_risks admits it is wrong. Open question 1 and owner #2423 depend on exactly this fact.",
      "fix": "Rewrite lines 88–89 to M3's observed output: body `{\"message\":\"401 Unauthorized\"}`, stderr `glab: 401 Unauthorized (HTTP 401)`, exit 1, with the command and the date. Correct the deviation entry to match."
    },
    {
      "file": "crates/merge-requests/src/project.rs",
      "line": 113,
      "severity": "block",
      "problem": "The Failed-or-NotLoggedIn mapping lives in `refusal` (6 actions), yet five more copy `Some(detail) → NotLoggedIn` inline: list.rs:67, people_search.rs:89, people_change.rs:153, rerequest.rs:123, discussion_thread/read.rs:113. All five reply types have From<NoProject>. Two shapes for one rule.",
      "fix": "Route the five post-hoc `Failed { message }` sites through `repository.refusal(glab, message).into()`. Keep the inline form only in write.rs and job_log.rs, whose None replies differ."
    },
    {
      "file": "scripts/fake-glab/glab",
      "line": 56,
      "severity": "block",
      "problem": "`after_post` adds a second copy of the fake's 'largest k ≤ posts counted with a file' rule. `reply()` (line 129) already loops over `$1.after-post-$posts.json` the same way. The scenarios rely on this rule, and the two loops can now drift apart.",
      "fix": "Make `after_post` take a path prefix: `after_post <path> <suffix> <suffix>`. Have `reply` use `answers=$(after_post \"$1\" .json .json); respond \"${answers:-$1}\" \"$2\"` and drop reply's own loop."
    },
    {
      "file": "crates/merge-requests/src/project.rs",
      "line": 102,
      "severity": "should",
      "problem": "`is_login` repeats `is_lost`'s first two clauses to pick the forget reason. The reason is a free `&str` (`refresh`/`login`/`project`). Both mutation survivors are this copy, so a new lost form must be added in two places and a wrong reason goes unnoticed in the log.",
      "fix": "Replace `is_lost` with `fn lost(words) -> Option<Lost>`, where `enum Lost { Login, Project }`. Derive the reason from the variant and have `forget` take that enum (plus Refresh) instead of `&str`."
    },
    {
      "file": "crates/merge-requests/AGENTS.md",
      "line": 1,
      "severity": "should",
      "problem": "Line 1 still says the crate has 'no `Mutex`' and that 'the one memory across loads is the run's `MergedPairs`'. Line 16 adds that this 'predates' Remembered, so the reader must reconcile two contradicting statements. Every later edit inherits the contradiction.",
      "fix": "In line 1, change 'no `Mutex`; the one memory across loads is the run's `MergedPairs`' to name `project.rs` `Remembered` as the one Mutex and second memory, then delete line 16."
    },
    {
      "file": "src-tauri/AGENTS.md",
      "line": 1,
      "severity": "should",
      "problem": "Line 1 still lists 'the nineteen commands' without `ask_gitlab_again`, while line 3 calls it 'the twentieth command'. A reader counting the shell's commands gets two answers.",
      "fix": "Change line 1 to 'the twenty commands', add `ask_gitlab_again` after `find_gitlab_project` in its list, and drop 'twentieth' from line 3."
    },
    {
      "file": "src-tauri/src/merge_requests.rs",
      "line": 61,
      "severity": "nit",
      "problem": "MergeRequestState's doc says the login and project stay remembered 'until `ask_gitlab_again`', but a lost login or a missing project forgets them too. Nothing gets harder beyond a misleading line.",
      "fix": "Say 'until `ask_gitlab_again` or an action finds the login or project lost'."
    }
  ]
}
