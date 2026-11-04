# Slice mr-threads-verify — the gate, the WebKit fixture and the real app for turns, threads, replies and sized images

Design: `docs/slices/briefs/mr-threads-design.md` option A. Request acceptance: `docs/slices/request-mr-threads.md`
"Acceptance". Plan §2 #179–#185; RK33, RK41, RK53, RK54, RK59–RK61, RK66, RK67 (amended), RK71–RK73. Recipes:
`skill://verification`. Windows open only on a private display. Screenshots come only from the session or the
private display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-threads-fixtures`, `-http`, `-images`, `-crate`, `-app` (with `just bindings` applied), `-state-ipc`,
  `-state-ui`, `-panel` and `-box` committed.
- **Smoke pass** (steps B–C, no `just check`): as soon as `-box` is committed, beside the docs keeper.
- **Final pass**: once the docs keeper has named every new file in the project map (`just map-check`, PM6), the five
  commands and source methods in `docs/architecture.md` §4 and `ipc-contract`. Run `just check` once, then B–C.

**Non-goals:** the owner's playground check (below, for the orchestrator to hand on); fixing anything; `just mutants`.

## Contract

**Fixture `?mr=list`**, as `mr-threads-state-ipc` built it: !637 (author Dmitri Volkov) holds thirteen discussions
d01–d13, !636 (author Sam Weller, locked) three, d14–d16 (the cases of `briefs/mr-threads-fixtures.md`); d01 is the
rich thread (four comments: code, table, link, uploaded and sized images, edits by self and by Dmitri Volkov; drafts
in d01 and d05, 2 pending); !640's description has a 120 px, a 40 %, a 4000 px and a 60 px-high image. Texts starting
`refuse` are refused ("403 Forbidden"), starting `fail` fail ("glab timed out"). Log lines:
`mergeRequests.fixture_discussions { iids }`, `fixture_thread { iid, discussion }`, `fixture_write { kind, iid,
discussion }`, `fixture_preview { iid }`, `fixture_page { page }`, and the window's `discussions_read`,
`discussions_reloaded`, `thread_read`, `thread_write`, `preview_read` — never a text or a name.

**Scenario `tests/glab/mr-threads/`**: !90 (author dmitri) d01–d13, !91 (author sam, locked) d14–d16; posts 1–5 in
order comment, draft, resolve, unresolve, submit on d01, each followed by its `after-post-<n>` reads.

**Words:** "Your turn", "Author's turn", "<Name>'s turn", "Waiting for an answer", "Open", "N of M wait for you",
"Reload discussions", "Shift: show the thread", "Resolved", "Open on GitLab", "Submit review", "N pending", "Publish
your N pending comments on this merge request", "Close", "Author", "· Edited … ago", "by …", "Pending", "Write",
"Preview", "Write a reply… (Markdown)", "Nothing to preview.", "Loading…", "Add review", "Add comment", "Resolve
thread", "Unresolve thread", "Comments on this merge request are locked to project members.", "You may not resolve
this thread.", "Could not add the comment: …", "This discussion is no longer on GitLab.", "Retry".

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** `just app-session start-fixture --name mtv --diff --mr list --size 1600x1000`, then the
merge-requests page. Every step in yamt Dark and yamt Light (`--settings '{"theme":"light"}'`) unless noted.

1. **A Sizes.** !640's description panel: the 120 px image is 120 px wide; the 40 % one is 40 % of the text column; the
   4000 px one is exactly the column's width, its height scaled by the same factor; the 60 px-high one is 60 px high
   with its own proportions (`read` rects). d01's thread: the sized images likewise.
2. **B words.** !637: d01 "Your turn", d02 "Author's turn", d03–d05 "Your turn", d06 "Ben Okafor's turn", d07 "Author's
   turn", d08 "Anna Berg's turn", d09 "Open", d10–d13 "Author's turn"; the four "Your turn" rows first; header "4 of
   13 wait for you". !636: "Anna Berg's turn", "Waiting for an answer", "Your turn". Review mode as Ben Okafor: the
   review tooltip "Sorted for Ben Okafor's review: …" (!637 is not Ben's to review in the fixture, #2393; d06's
   "Ben Okafor's turn" is proven by `b5_review_mode_speaks_for_the_reviewer`).
3. **C1 Shift.** Shift over d01 opens its panel directly left of the box, tops aligned where it fits (rects; clamped
   on screen otherwise); d01 marked; Shift over d02 switches; Shift+a in the field types "A" (no new `fixture_thread`);
   a lone Shift tap with focus in the field and the pointer on another row: no new `fixture_thread`, the panel keeps
   its discussion (#2386); a focused row and Shift opens its thread. With !637's panel open, hover !639's count (its box
   fits above !637's) and Shift over its row: !637's box and panel close (#2385, #2405).
4. **C3–C5 Thread.** d01: four comments oldest first, no system note; pictures, names, muted `@username`, the crown
   only on Dmitri Volkov's comment (tooltip "Author"); "3 hours ago" style times with `DD.MM.YYYY, HH:MM` on hover;
   "· Edited … ago by Dmitri Volkov" on Sam Weller's, "· Edited … ago" on Anna Berg's; code in yamt's colours, the
   table, the images, a link that logs `fixture_page` on click; the header's "Open on GitLab" logs one `fixture_page`
   naming d01's first comment's page (#2375); "Loading…" before the answer; each reopen logs a new `fixture_thread`.
5. **C6 Field.** The placeholder; 2 lines → 3 lines high, 8 → 8, 20 → 12 and scrolling; the text kept after closing
   the box and reopening; another discussion's field empty.
6. **C7 Preview.** Type `**Hi** @anna`, press Preview: "Loading…", then bold "Hi" and the mention link; Write: the same
   text and caret; an empty field's Preview: "Nothing to preview." and no `fixture_preview`; `fail` → one sentence,
   the text untouched.
7. **C8 Sends.** "Add comment" (and Ctrl+Enter) with "Thanks": one `fixture_write { kind: comment }`, the field
   clears, the comment shows last, d01's row reads "Author's turn". "Add review" with "Later": one `fixture_write {
   kind: draft }`, the draft shows "Pending" at the end, the header "3 pending". Both disabled while empty and while
   sending. `refuse it`: "Could not add the comment: 403 Forbidden", the text stays. !636's buttons disabled with the
   locked reason, and Ctrl+Enter with text in its field logs no `fixture_write` (#2376); its d14 resolve disabled
   with "You may not resolve this thread.". Escape in the field closes the panel (focus back on its row).
8. **C9 Submit.** "Submit review" (tooltip "Publish your 3 pending comments on this merge request"): one
   `fixture_write { kind: submit }`, the drafts show as comments, no "Submit review" left, the row reloaded (one
   `fixture_discussions { iids: 637 }`).
9. **C10 Resolve.** d02 "Resolve thread" → "Unresolve thread", the row a check, muted, "Resolved", out of the header
   count, !637's count still 13; "Unresolve thread" → open again; resolve again, close the box: the count reads 12,
   reopen: d02 gone.
10. **C2 What stays open.** Pointer far away: both stay; a comment link click: both stay; Escape: panel closes, focus on
    its row; Escape: box closes; the panel's Close: panel closes, box stays; a press on the list: both close; a list
    Refresh (the page's Refresh button, which does not count as a press outside, #2392) with the panel open: both
    stay and the thread is read again; after "Resolve thread", "Add comment" and "Submit review" the focus stays in
    the panel, so Escape closes the panel, not the page (#2383/#2389); the same after Retry of a failed read and with
    focus on the page's Refresh (#2400/#2401); leaving the page with the panel open and coming back: no box, and the
    resolved row gone (the fixture's listed count is fixed, so the count drop shows only in the real app, #2404).
11. **D Refresh.** "Reload discussions": the icon turns, the rows stay, then the new answer; only `iids: 637` in the
    log; with d01's panel open also one `fixture_thread`.
12. **C11 Off.** Discussion details "Off": no box, no panel; "Load lazily": both work.
13. `shot` of the box with d01's panel open, dark and light; the description panel's sized images, dark and light.

**C. Real app.** `scripts/local-conflicts-repo.sh <scratch>/mtv`, `cargo tauri build --debug --no-bundle`, `just
app-session start-app --name mtv --diff --dir <scratch>/mtv --glab mr-threads`, the merge-requests page:

1. !90's box: the B words as in step B2 (d-numbers equal); !91's three.
2. Shift on d01: four comments, the edits, drafts `I'll take the second option.` "Pending", "2 pending".
3. In order: "Add comment" "Thanks"; "Add review" "Later"; "Resolve thread"; "Unresolve thread"; "Submit review". After
   each the thread shows the after-post answer. The fake glab log has exactly, in order: `--method POST
   projects/taskboard%2Ftaskboard/merge_requests/90/discussions/<d01>/notes` with `stdin: {"body":"Thanks"}`; `POST
   …/draft_notes` with `{"note":"Later","in_reply_to_discussion_id":"<d01>"}`; `PUT …/discussions/<d01>` with
   `{"resolved":true}`; the same with `false`; `POST …/draft_notes/bulk_publish` with `{}` — and no other `--method`
   or `stdin:` line; Preview logs `POST markdown` and counts no post (state file 5 at the end).
4. The Rust log (`RUST_LOG=info`): one line per write with kind and outcome, no text; the thread read line with counts.
5. Review mode on the `mr-review-mode` scenario (`--glab mr-review-mode`): the orders for Me and for Anna, compared with
   `docs/slices/briefs/mr-review-mode-design.md:218-219`; report the orders seen (the B5 rule may have changed them).
6. `shot` dark and light.

## Acceptance

Each step: pass or fail, with the observed words, the `read` results, the app-log and fake-glab log lines pasted
verbatim, and the screenshots' paths.

**Owner check** (hand on, not run). The owner's playground (`samubr/glab-yamt-playground`, a private personal project
on gitlab.com), the real app logged in as `samubr`:

1. On GitLab, have a second account (or a collaborator) "Anna" start a discussion on an open merge request of
   `samubr`, and `samubr` (the author) answer it; and give the description an image with `{width=40%}`.
2. In yamt, review mode for a reviewer who never wrote in it: the row reads "Anna's turn" (her name as GitLab shows
   it), not "Your turn". The description panel shows the image at 40 % of its column.
3. Shift over that row: the whole thread, pictures, names, the crown on `samubr`.
4. "Add comment" with a line, "Add review" with another, then "Submit review", then "Resolve thread": on GitLab's page
   the reply, then the published review comment, appear as sent, and the thread is resolved. Close the box in yamt:
   the row is gone and the count dropped.
