# Slice mr-links-verify — the gate, the WebKit fixture and the real app for the links box

Design: `docs/slices/briefs/mr-links-design.md` option A. Request acceptance: `docs/slices/request-mr-links.md`
"Acceptance". Proposed plan §2 #175–#177; RK41 (amended), RK68–RK70. Recipes: `skill://verification`. Windows open
only on a private display. Screenshots come only from the session or the private display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-links-rust`, `-app` (with `just bindings` applied), `-state` and `-page` committed, and `mr-description-page`
  (the info column the links column follows).
- **Smoke pass** (steps B–C, no `just check`): as soon as `-page` is committed, beside its reviewers.
- **Final pass**: once the docs keeper has named every new file in the project map (`just map-check`, PM6) and
  `read_links` and `MergeRequestSource.readLinks` in architecture and ipc-contract. Run `just check` once, then B–C.

**Non-goals:**

- The owner's playground check (below, for the orchestrator to hand on).
- Fixing anything.
- `just mutants`.

## Contract

**Fixture `?mr=list`**, as `mr-links-state` built it:

- !638 has no description (no links button).
- `readLinks` logs `mergeRequests.fixture_links { iid }`, answers after 400 ms:
  - !640 rich: Epics `&3` "Board redesign", `&4` "Old board" (closed), `design&2` (not shown); Issues `#12` "Snooze a
    reminder" (parent `&3`), `#13` "Write the snooze test" (parent `#12`), `other/lib#5` "Fix date parsing" (closed),
    `secret/vault#9` (not shown); Commits `fa3335f3` "Backfill due dates", `a1b2c3d4…e5f6a7b8` "Commits a1b2c3d4
    through e5f6a7b8", `secret/vault@0badc0de` (not shown).
  - !636 fails once ("glab: a deadline line"), then reads as !640.
  - !634 `notLoggedIn` every time.
  - Every other row: no linked epics, issues or commits.
- Log lines: `mergeRequests.fixture_links { iid }`, `mergeRequests.fixture_page { page }`, `mergeRequests.links_read
  { iid, kind, epics, issues, commits, hidden, ms }`.

**Scenario `tests/glab/mr-links/`**, as `mr-links-rust` recorded it: project `taskboard/taskboard` on
`https://gitlab.example`, user `sam`; !62 rich (expected reply in `mr-links-rust.md`: Epics 3, Issues 6, Commits 4);
!61 nothing of rule 2; !60 the lookup fails ("glab: a deadline line"); !59 GitLab Free (no parents, `&8` not shown); !58
commits alone; !57 no description.

**Words:** "Linked epics, issues and commits" (the button's label), "Loading…", "No linked epics, issues or commits.",
"Epics", "Issues", "Commits", "Closed", "Not found or no access", "Open parent: <reference> <title>", "Retry", "Could
not read the links: …", "Could not read the links" (problem bar).

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** Run `just app-session start-fixture --name mlv --diff --mr list --size 1600x1000`, then open the
merge-requests page. Run every step in both windows (`--diff`, and `--range-case review --mr list`) and in yamt Dark
and yamt Light (`--settings '{"theme":"light"}'`) unless noted.

1. **Column (rule 1).**
   - The links column is directly after the info column and before the CI box on every row (WebDriver rects).
   - !638 has none, and the CI boxes of !639, !638 and !637 share one x.
   - Before any hover, the session log has no `fixture_links` line (a row never hovered is never asked).
2. **Hover opens at once (rules 1, 5).**
   - Hover !640's button: the box is open within one frame, says "Loading…", then lists the lines.
   - The log has exactly one `fixture_links { iid: 640 }`.
   - Move the pointer into the box: it stays open; out of both: it closes. Hover again: no new `fixture_links`.
   - A click on the button logs no `fixture_page` (the row does not open).
3. **Groups and lines (rules 2, 3, 6).**
   - Headings "Epics", "Issues", "Commits" in that order; each line once, in the fixture's order.
   - The kind icons differ by group; each reference as listed in the Contract.
   - `&4` and `other/lib#5` show "Closed"; `design&2`, `secret/vault#9`, `secret/vault@0badc0de` show "Not found or
     no access".
4. **Lines open (rule 3).** Click `#12`: one `fixture_page` with `https://gitlab.example/taskboard/taskboard/-/work_items/12`;
   the box stays; `location.href` is unchanged. Click `secret/vault#9`: its page is logged too (rule 6).
5. **Parent (rule 4).**
   - `#12`'s parent button: tooltip "Open parent: &3 Board redesign"; a click logs
     `https://gitlab.example/groups/taskboard/-/work_items/3`.
   - `#13`'s parent opens `…/-/work_items/12`.
   - No parent button on any epic, any commit, `other/lib#5` or `secret/vault#9`.
6. **Empty (rule 1).** !639 says "No linked epics, issues or commits."
7. **Failure (rule 5).**
   - !636: "Could not read the links: glab: a deadline line" and Retry; Retry shows !640's lines, a second
     `fixture_links { iid: 636 }`.
   - !634: the not-logged-in sentence and Retry; leave and hover again: a new `fixture_links { iid: 634 }`.
8. **Refresh (rule 5).** Press Refresh and wait for the list; hover !640: "Loading…" first and a new
   `fixture_links { iid: 640 }`.
9. **Keyboard.** Tab reaches !640's links button and the box opens; Tab moves through the lines and parent buttons in
   order; Enter on a line logs its page; Escape closes.
10. `shot` of the open box and of a row, in dark and light.

**C. Real app.** Run `scripts/local-conflicts-repo.sh <scratch>/mlv`, then `cargo tauri build --debug --no-bundle`, then
`just app-session start-app --name mlv --diff --dir <scratch>/mlv --glab mr-links`. Open the merge-requests page.

1. **List.** !62–!58 have the links button; !57 has none. The fake glab log has no `MergeRequestLinks` before a hover.
2. **!62 (rules 2–4, 6).** The box lists, in order:
   - Epics `&3` "Board redesign", `&4` "Old board" Closed, `design&2` "Design system";
   - Issues `#12` (parent `&3`), `#13` (parent `#12`), `other/lib#5` Closed, `web#6` (no parent button: its parent is
     on another host), `secret/vault#9` and `#99` "Not found or no access";
   - Commits `fa3335f3` "Backfill due dates", `6ea97d8c` "Snooze a reminder", `a1b2c3d4…e5f6a7b8`, `secret/vault@0badc0de`
     "Not found or no access".
   - `#12`'s parent button reaches the fake opener with `https://gitlab.example/groups/taskboard/-/work_items/3`;
     `6ea97d8c` with `…/-/merge_requests/62/diffs?commit_id=6ea97d8c…`; `secret/vault#9` with its address.
3. **!59 (rule 6, Free).** `#20` without a parent button, `#21` with parent `#20`, Epics `&8` "Not found or no
   access"; no error.
4. **!61** the empty sentence; **!58** its two commits, and no `MergeRequestLinks` call in the log; **!60** "Could not
   read the links: glab: a deadline line" with Retry.
5. **Log.** The fake glab log for one hover of !62: `auth status`, the project, `MergeRequestDescription`, one
   `MergeRequestLinks` with fields `path0` to `path5`; no `stdin:`, no `-X`. The app log has one `links_read` line per
   ask with counts, never a title or an address. The Rust log (`RUST_LOG=info`) has one "read a merge request's links"
   line for !62 whose epics, issues and commits counts are 3, 6 and 4 (finding #2311: it pins the crate's field
   mapping), with its calls and score.
6. `shot` in dark and light.

## Acceptance

Each step: pass or fail, with the observed words, the `read` results, the app-log and fake-glab log lines pasted
verbatim, and the screenshots' paths.

**Owner check** (hand on, not run). The owner's playground (`samubr/glab-yamt-playground`, a private personal project
on gitlab.com), with the real app logged in as `samubr`:

1. On GitLab, give one open merge request a description holding:
   - `Related to gitlab-org/gitlab#630405` (a public issue whose parent is the epic gitlab-org&22961 "Add skills to the
     AI Catalog", measured 2026-11-04);
   - `https://gitlab.com/groups/gitlab-org/-/epics/22956` (a public epic);
   - `#1` (an issue of the playground, if it has one) and a commit of the merge request (its short id);
   - `` `#1` `` inside backticks and a link to `https://docs.gitlab.com/`.
2. In yamt, hover that merge request's links button: "Loading…" for about a second, then Epics (`gitlab-org&22956`),
   Issues (`gitlab-org/gitlab#630405`, `#1`), Commits (the commit and its first message line). The code and the docs
   link are not listed.
3. Click the parent button on `gitlab-org/gitlab#630405` ("Open parent: gitlab-org&22961 Add skills to the AI
   Catalog"): the browser opens the epic. That is the MR's epic in one hover and one click.
4. Press Refresh, hover again: it asks afresh (Loading…).
