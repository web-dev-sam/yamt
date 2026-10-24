```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "vision-2 / RV-growth: second rule for one fact",
      "file": "crates/review/src/lines_up.rs",
      "line": 88,
      "problem": "`shown_head`, `shown_base` (lines 78, 84) and `LookedAt::Commit.short_id` (send.rs:269) cut the window's own commits to 7 characters. The range window already names those same commits in its column headers with git's `%h` (`RangeSide.short_id` from `commit_summary`). git's `%h` grows past 7 characters in a repository with more than about 65k objects, so there the hover says \"this window shows 9c1ba3f\" while the header above it shows \"9c1ba3fc60\". That is two sources for one shown fact. The implementer listed this as an open risk.",
      "fix": "Ask the orchestrator for a yamt-range addition: `Compared` gains `left_short_id`/`right_short_id`, the same strings `RangeSide.short_id` holds. Plan #117 limits yamt-review to `entry`/`compared`/`root`, so `range.start()` is not the way. Then use them for `shown_*` and `LookedAt::Commit`, and cut GitLab's head/base to the shown id's length."
    },
    {
      "severity": "should",
      "rule_id": "RS6 / RV-growth",
      "file": "crates/review/src/send.rs",
      "line": 219,
      "problem": "send.rs is at 398 of 400 lines and holds three jobs: the check flow (`lined_up`, `lookup`, `require_logged_in`), the send loop, and reading glab's process output (`HttpAnswer`, `http_answer_from`, `posted`, `answer`, `run`, `first_line`, `last_line`, `exit_words`, `TIMED_OUT`, `NO_HTTP_ANSWER`). The next change cannot add a line without a split under pressure. Examples: the open risk about skipping `100 Continue`, or row 17 needing a different stop reason.",
      "fix": "Move the glab-output reading, about 90 lines with its two unit tests, into its own module (e.g. `crates/review/src/glab_answer.rs`; the orchestrator adds it to Owned). send.rs then keeps `check_gitlab`/`send_queue` and their flow."
    },
    {
      "severity": "should",
      "rule_id": "RV-growth: hidden coupling",
      "file": "crates/review/tests/review.rs",
      "line": 22,
      "problem": "Ten integration tests, the unit tests in lines_up.rs and all twelve `tests/glab/*` folders hard-code the commit ids that `scripts/range-repo.sh` produces. Those ids depend on every byte copied from `scripts/demo/{base,main,feature}`, which `demo-repo.sh` and the README screenshot share. Any edit to the demo project or to the range smoke script fails the review tests as an opaque `OtherBase`/`Moved` mismatch, and every scenario JSON has to be fixed by hand.",
      "fix": "Add a first test (e.g. `range_repo_has_the_scenarios_commit_ids`) that rev-parses the merge base, `main` and `feature` of `range_repo()` and asserts the three constants, with a message naming `tests/glab/*`. Report a header line for `scripts/range-repo.sh` saying `tests/glab` and `crates/review/tests` pin its ids."
    },
    {
      "severity": "should",
      "rule_id": "RV-growth: fixture that cannot state its case",
      "file": "crates/review/tests/review.rs",
      "line": 518,
      "problem": "`several_and_none_name_what_was_looked_at` asserts `Several { references: [\"!12\", \"!12\"] }`, an answer GitLab can never give. It exists only because the fake serves `merge-request.json` for every iid. The `several` folder's `merge-request-14.json` is never served, so an app session on `several` shows the same impossible sentence, and anyone building on this scenario inherits it.",
      "fix": "Report a fake change: serve `merge-request-<iid>.json` before `merge-request.json`. Then assert `LinedUp` !14 on `several`, and add a scenario where neither request lines up (e.g. `several-none`) that asserts `Several [\"!12\", \"!14\"]`."
    },
    {
      "severity": "should",
      "rule_id": "RS5",
      "file": "crates/review/tests/review.rs",
      "line": 148,
      "problem": "This brings the workspace's first `RefCell`, which RS5 excludes. The next test author copies the precedent.",
      "fix": "Collect progress through `std::sync::mpsc::channel()`: `let report = |step| sender.send(step).unwrap();` and then `receiver.try_iter().collect()`. This works with the fixed `&dyn Fn` contract and mirrors row 17's `Channel`."
    },
    {
      "severity": "should",
      "rule_id": "CP1",
      "file": "crates/review/src/gitlab.rs",
      "line": 154,
      "problem": "\"`glab api --paginate`, which prints one array per page\" states an external fact as measured. The implementer's open risks say it was not measured, and tests/glab/README.md does not record it. A later reader may trust it when changing the parser.",
      "fix": "Either measure it with glab 1.124.0 and cite the README section, or reword it to say what the code accepts: \"one JSON array, or one per page\"."
    },
    {
      "severity": "nit",
      "rule_id": "vision-1",
      "file": "crates/review/src/send.rs",
      "line": 25,
      "problem": "`use std::ops::Range as Span` plus three constants (`ACCEPTED`, `CLIENT_ERRORS`, `STOPPING_CLIENT_ERRORS`) and two `contains` calls hide one status rule from a Rust beginner. Nothing gets harder as the app grows.",
      "fix": "Write one `match answer.status { 200..=299 => …, 401 | 403 | 429 => stop, 400..=499 => refused, _ => stop }` and keep the rationale line above the 401/403/429 arm."
    },
    {
      "severity": "nit",
      "rule_id": "RV-growth: dead weight",
      "file": "crates/review/src/thread_store.rs",
      "line": 22,
      "problem": "With the `expect(dead_code)` lines removed, `QueuedMessage.thread` is read only by thread_store's own unit test (line 276). The sender never uses it; only the derived `PartialEq` keeps the lint quiet. Nothing gets harder as the app grows.",
      "fix": "Drop the field and its test tuple slot (row 14's file, so the orchestrator decides)."
    }
  ],
  "checked": [
    "Ownership: every changed file is in Owned, except Cargo.lock (cargo), thread_store.rs (only the three `expect(dead_code)` lines, as permitted) and the notes file; tests/glab/README.md, runner/ and scripts/fake-glab are untouched",
    "PM1 / plan #117: yamt-review's normal deps are yamt-range, yamt-gitio and yamt-merge-core, which scripts/arch-check.sh:59 allows; no tauri; no new external crate (serde_json is a workspace dep)",
    "Contract matches the brief: MergeRequestRef, LookedAt, NotLinedUp (8 variants, same fields), GitLabCheck, SendProgress, SendReply; serde tag \"kind\", camelCase on sums, snake_case fields; `check_gitlab(&Range, Option<&Glab>) -> GitLabCheck`; `send_queue(..) -> Result<SendReply>` uses the crate alias for `Result<SendReply, Error>`",
    "Lock discipline: send.rs `post_queue` uses only temporary `locked(threads)` guards that drop at the end of their statement (snapshot, record, list); none is held across `answer`/`outcome`/`run`",
    "MAX_MERGE_REQUESTS_CHECKED = 5 sits next to its one user `candidates` (lines_up.rs:7); `at_most_five_merge_requests_are_checked` covers it",
    "lines_up is pure over `&Compared` + `Found`; `start_sha` is not compared; one non-lining-up request gives Moved (head first), then OtherBase; null diff_refs gives Preparing; several give Several (design §6, plan #119)",
    "Commit route: `candidates` keeps open MRs whose `sha` is the right commit (plan #120); branch route trusts `state=opened`",
    "right_branch: `refs/heads/x` → x, `refs/remotes/<longest remote>/x` → x, a tag/commit/detached HEAD → None; an empty side reaches it as `HEAD` (RangeSideLabel doc, range/src/lib.rs:29)",
    "position.rs: 1-based lines; removed → old_line only, added → new_line only, unchanged → both; renamed uses `old_path`; deleted/added use `entry.path` for both paths; U+FFFD refusal follows design §1 wording",
    "Post classification matches plan #118: 2xx → Pending with `<web_url>/diffs`; 4xx except 401/403/429 → Refused with GitLab's `message` and the send goes on; timeout/5xx/401/403/429/no HTTP answer/glab gone → Stopped with the rest queued",
    "Draft matching (design §5 step 4): same note, head_sha and LinePlace; each draft is taken once (`swap_remove`); a draft with no position is `placed: None` and matches nothing",
    "Endpoint argv in gitlab.rs matches the design §5 glab-calls table, and integration tests check it exactly (review.rs branch/commit/draft/post argv)",
    "No second HTTP-status parser: gitio/src/glab.rs returns bytes only; `http_answer_from` is the one reader",
    "Deviations accepted: `Glab::at(link)` instead of a temp PATH (the contract takes `Option<&Glab>`); unexpected_json test in gitlab.rs where the reading is; a matching draft counted in `sent`; `UnknownFile` unreachable (the snapshot's ids come from the same range); stop-reason words; refusal/post-2.err is unmeasured but never asserted, since the body's `message` wins",
    "All 18 acceptance test names are present (lines_up.rs 8, gitlab.rs 1, position.rs 2, tests/review.rs 7); mutation has no survivors (.omp/run/mutants/RVGitlab.survivors.txt)",
    "Comments: the STOPPING_CLIENT_ERRORS rationale and the http_answer_from measurement citation are acceptable under CP1; no TODOs, section headers or narration",
    "RS6 on test files not reported: tests/review.rs is 532 lines, but threads.rs (561) and gitio/tests/operations.rs (471) set the existing practice",
    "docs/map/architecture/AGENTS.md and the tests/glab/README.md scenario list are the orchestrator's docs pass, as the task says"
  ]
}
```