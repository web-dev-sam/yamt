# MrPersonDiscussionsRust

Agent output (`agent://MrPersonDiscussionsRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsRust.md), collected 2026-11-05T13:39:57.863Z.

{
  "summary": "Each `OpenDiscussion` now has `first: FirstComment { created_at, body: Description }`. It is built in `open_discussion` from the first person note (`earlier[0]`, else `last`), and the body goes through `described_on`. A new `discussions/offers.rs` `Offers` collects pages and uploads once each, in order. Both the discussions read and the thread read use it, which removes the two dedupe loops in `comments_of`. `ReadDiscussions` gains `pages` and `uploads`, and the log line counts both. The shell offers the pages with the pictures, then the uploads, before it returns the rows.",
  "files_changed": [
    "crates/merge-requests/src/discussions.rs",
    "crates/merge-requests/src/discussions/offers.rs",
    "crates/merge-requests/src/discussions/turn.rs",
    "crates/merge-requests/src/discussions/sample.rs",
    "crates/merge-requests/src/discussions/tests.rs",
    "crates/merge-requests/src/discussion_thread/read.rs",
    "crates/merge-requests/src/discussion_thread/tests.rs",
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/tests/discussions.rs",
    "src-tauri/src/merge_requests/discussions.rs",
    "src-tauri/src/merge_requests/tests/discussions.rs",
    "tests/glab/README.md",
    "tests/glab/mr-discussions/project.json",
    "tests/glab/mr-discussions/graphql-discussions-82-81-79-78.json",
    "tests/glab/mr-discussions/graphql-discussions-81.json",
    "tests/glab/mr-discussions/graphql-discussions-79-after-d-2.json",
    "tests/glab/mr-discussions/uploads/7/uploads/8201a1b2c3d4e5f60718293a4b5c6d7e/sort.png"
  ],
  "tests_added": [
    {
      "name": "yamt-app merge_requests::tests::discussions::each_discussion_carries_its_first_comment_in_one_read",
      "proves": "In the fake batch, each discussion's first.createdAt and first.body (anna's link and upload; ben's escaped markup; the plain paragraphs) are those of its first person note. No glab call beyond the batch and !79's later page."
    },
    {
      "name": "yamt-app merge_requests::tests::discussions::a_first_comments_link_and_upload_are_offered_before_the_reply",
      "proves": "RK41/RK53: before the read, issue #12 answers notOffered and /upload~8201… is 404. After it, the upload answers 200 with sort.png's bytes and the fake opener opens the issue page."
    },
    {
      "name": "discussions::tests::a_single_note_discussion_starts_with_its_last_note",
      "proves": "With `earlier` empty, `first` holds last's time and the reduction of its bodyHtml; with earlier notes it holds earlier[0]'s, not last's."
    },
    {
      "name": "discussions::tests::the_first_comment_goes_through_the_description_reducer",
      "proves": "RK60/RK66: a planted script, onerror or onclick in a first note's bodyHtml does not appear anywhere in first.body."
    },
    {
      "name": "discussions::offers::tests::offers_keep_each_page_and_upload_once_in_order",
      "proves": "`Offers.page` and `Offers.described` keep each page and each upload key once, in first-named order, and return the description."
    },
    {
      "name": "discussions::tests::the_read_offers_each_last_page_then_its_first_comments_pages_and_uploads_once",
      "proves": "`answered` gives `pages` = each discussion's last-note page, then its first comment's links, deduplicated, and gives `uploads` once each."
    },
    {
      "name": "discussion_thread::tests::the_thread_read_carries_first_and_offers_each_page_once (renamed from a_threads_pages_and_uploads_are_named_once_each_in_order)",
      "proves": "thread.discussion.first equals comments[0]'s body and time, not comments[1]'s. The thread's pages, uploads and pictures assertions are the same as before."
    },
    {
      "name": "yamt-app …::a_read_logs_its_counts_and_score_but_no_name_or_body (expected line updated)",
      "proves": "The info line is now `asked=4 answered=3 failed=1 pages=5 uploads=1 queries=2 score=58 limit=250`, still without a name, body or address."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --all --check",
      "observed": "no output, exit 0"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile … (no warnings)"
    },
    {
      "command": "hermetic prefix + cargo nextest run -p yamt-merge-requests -p yamt-app",
      "observed": "Summary [7.562s] 564 tests run: 564 passed, 48 skipped"
    },
    {
      "command": "hermetic + cargo nextest run -p yamt-app -E 'test(/merge_requests::tests::discussions::/)'",
      "observed": "PASS each_discussion_carries_its_first_comment_in_one_read; PASS a_first_comments_link_and_upload_are_offered_before_the_reply; PASS a_read_logs_its_counts…; 7 tests run: 7 passed"
    },
    {
      "command": "just bindings-check (fresh export into target/, bindings.ts not touched)",
      "observed": "+export type FirstComment = { createdAt: string, body: Description }; OpenDiscussion gains `first: FirstComment` between place and earlier. The recipe exits 1 as expected, since the orchestrator runs `just bindings`."
    },
    {
      "command": "Step 8: serde_json::to_vec(&read.rows).len() for [82,81,79,78] via a throwaway test in tests/discussions.rs (since removed)",
      "observed": "before (base code, base fixture): REPLY BYTES 2419; after (this change, new fixture with anna's link and upload): REPLY BYTES 3735"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 18 mutants in 3m: 7 caught, 10 unviable, 1 missed",
    "survivors": [
      "crates/merge-requests/src/discussions.rs:386 log_read → () — gate-covered: mutants runs crate tests only. Applied by hand, yamt-app a_read_logs_its_counts_and_score_but_no_name_or_body FAILED; reverted."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "mr-discussions now uses a gitlab.com project (project.json web_url; every note url moved to gitlab.com). Reason: address.rs `upload_of` offers an upload only on https://gitlab.com, so the upload acceptance could not pass on gitlab.example. Test expectations updated to match; 77.err keeps glab's gitlab.example words.",
    "README: the mr-review-mode paragraph (line ~229, 'mr-discussions/'s project') is no longer true, since mr-review-mode/project.json still uses gitlab.example. That paragraph is outside my glob; the docs keeper should reword it.",
    "Acceptance asks for 'exactly one argv: api graphql line for the batch'. The batch [82,81,79,78] always makes 2 calls (the batch, then !79's later page d-2). The test asserts exactly those 2 (by iids and cursor), which shows that reading the first comments adds no call.",
    "the_thread_read_carries_first_and_offers_each_page_once is the existing pages/uploads thread test, renamed and extended with the `first` assertions. This keeps 'pages/uploads unchanged from before' pinned by the same expected values.",
    "`on_gitlab_com()` moved from discussion_thread/tests.rs into discussions/sample.rs, where offers.rs and discussions tests share it, so there is one copy instead of three.",
    "I added helpers to stay within clippy too_many_lines (40): `turn::place_of` (the place match) and `discussions::open_answer` (one row's Open/Failed answer).",
    "Docs to update (outside Owned, docs keeper): crates/merge-requests/AGENTS.md (FirstComment, OpenDiscussion.first, ReadDiscussions pages/uploads, offers.rs, the log fields); src-tauri/AGENTS.md (discussions_reply offers pages and uploads); architecture §3.9 and §4; ipc-contract.",
    "The brief's TS note says `createdAt: number`; Rust sends an ISO string, per the Contract. The ipc slice converts it."
  ],
  "open_risks": [
    {
      "location": "tests/glab/mr-discussions/project.json:1",
      "risk": "Any verifier recipe or real-app smoke that expects mr-discussions note pages on gitlab.example (older docs and recipes) will now see gitlab.com addresses."
    },
    {
      "location": "crates/merge-requests/src/discussion_thread/read.rs:129-138",
      "risk": "The thread runs `described_on` twice on the starter note (comments_of, then open_discussion). Offers deduplicates the pages and uploads, but the HTML is parsed twice per thread read, which the brief accepts."
    }
  ]
}
