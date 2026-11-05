# Slice mr-person-discussions-verify — the gate, the WebKit fixture in both windows and the real app for the person view

Design: `docs/slices/briefs/mr-person-discussions-design.md` option A. Request acceptance:
`docs/slices/request-mr-person-discussions.md` "Acceptance". Plan §2 #193–#194 (proposed), #164, #183, #185, #189, #191.
Risks: RK41, RK53, RK59, RK60, RK61 (amended), RK66, RK72, RK73, RK77 and RK78 (proposed). Recipes: `skill://verification`.

Windows open only on a private display. Screenshots come only from the session or the private display.

## Target

**Owned:** none. Read-only commands; your scratch folder only.

**Read-only:** the whole tree.

**Needs:**

- **Smoke pass** (steps B–D, no `just check`): as soon as `mr-person-discussions-view` is committed (it wires the window;
  `rust`, `core`, `threads`, `ipc` and `state` are committed before it).
- **Final pass**: once the docs keeper has written `tree.md` (the new files, `just map-check`, PM6), `state.md` (the
  thread rows, the person view), architecture §3.9/§4/§5.4, `ui/AGENTS.md`, `CHANGELOG.md` and the plan and risk rows,
  run `just check` once, then B–D.

**Non-goals:** the owner's playground check (below, for the orchestrator to hand on); fixing anything; `just mutants`.

## Contract

**Fixture `?mr=list`** (after `mr-person-discussions-ipc`): 40 rows !640–!601, sam is Me ("Sam Weller"), anna "Anna Berg",
ben "Ben Okafor", chiara "Chiara Rossi", dmitri "Dmitri Volkov". The person cases p1–p7 on the rows `ipc` reported
(defaults !626 p1–p3, !620 p4–p5, !621 p6 with fourteen comments, !611 p7); p1's first comment is formatted (bold,
inline code, a link, a 160 px image, six lines); !637 holds d01–d13, !636 d14–d16; !615 times out, !629 is logged out.
Me's and Anna's expected orders are the two literal lists of `mergeRequestPersonView.test.ts`
`over_the_list_fixture_mes_order_is_pinned` / `…_annas_order_is_pinned` (read them before the run). Answers come 10 rows
per 400 ms call. Log lines: `mergeRequests.fixture_discussions { iids }`, `fixture_thread { iid, discussion }`,
`fixture_write { kind, iid, discussion }`, `fixture_preview { iid }`, `fixture_people_search { text }`, and the window's
`mergeRequests.discussions_read`, `mergeRequests.thread_read`, `mergeRequests.thread_write`.

**Range fixture:** `--range-case review --threads seeded --gitlab listed --mr list --open-mr`.

**Fake glab `tests/glab/mr-threads/`:** !90 (d01–d13) and !91 (d14–d16), user sam; every call logged as an `argv:` line;
the discussions query for one merge request is one `argv: api graphql …` line, the drafts one `argv: api --paginate
…/draft_notes` line; writes are `argv: api --include --method POST …/discussions/<id>/notes`, `…/draft_notes`, `--method
PUT …/discussions/<id>`, `…/draft_notes/bulk_publish` (`docs/architecture.md:1053-1062`).

**Words:** "Discussions" (tooltip "Every open discussion, for one person"), "Back to list", "Whose discussions",
"Loading discussions — n of N merge requests", "Reload discussions", "Show the whole thread" / "Hide the thread", "Your
turn", "<Name>'s turn", "Open", "Resolved", "N of M wait(s) for you" / "… for Anna Berg".

## Change (the steps)

### A. Gate (final pass only)

`just check` → pass, or the failing recipe and its first 30 lines.

### B. WebKit fixture, the compare window

Start: `just app-session start-fixture --name mpd --diff --mr list --open-mr --size 1600x1000`. Every step runs in yamt
Dark and in yamt Light (set `<html data-theme="light">` live, #2495) unless noted.

1. **Settings "Load lazily".** Settings → Discussion details → Load lazily → Back. Type `board` in the search, set a
   Reviewer filter; `read` the shown iids. Then (search and filter cleared, window 1600x500 so the list scrolls) scroll the
   list half-way and `read` its `scrollTop` for step 3's second Back (#2525).
2. **A1 the button.** "Discussions" (tooltip) → the view in the list's place, filter row kept; the header reads "Loading
   discussions — n of N merge requests" and counts up; `fixture_discussions` calls run one at a time, each carrying every
   row not read yet (the fixture answers the first 10, plan #179; #2524); entries appear as rows arrive.
3. **Back.** "Back to list" → the same iids, the same search, filter and `scrollTop` (± 1 px); no `fixture_discussions`
   after Back for iids not yet sent. Clear the search and filter, then Discussions again (Load fully for the rest).
4. **C2 Me.** Every row answered: the entries' order equals Me's pinned list; the header reads "N of M wait for you";
   the "Your turn" entries first. !615 and !629 each have a failure line with GitLab's words and Retry; Retry on !615 →
   one `fixture_discussions { iids: "615" }`.
5. **D1–D4 an entry (p1, on !624).** Anna Berg's picture and name, "… ago" (hover: `DD.MM.YYYY, HH:MM`), "!624 <title>"
   muted, the place; the first comment formatted (bold, code, link, image) and cut at four lines (`read` its box height:
   80 px); the pictures Ben, Chiara, Dmitri left to right, each tooltip naming its writer; the turn word "Ben Okafor's turn".
   A one-comment discussion: no pictures. p6: "+N" at the left, its tooltip naming the folded writers, the newest writers
   visible; narrow the window to 900 px: N grows, the newest stay.
6. **B2 the person menu.** "Whose discussions" → Me first, then everyone by name with pictures (no narrowing field:
   it shows from 8 people, design §2.8 #6; the fixture has 5, #2522); pick Anna → the order equals Anna's pinned list,
   words "Your turn" become "Anna Berg's turn"-style and the header "… wait for Anna Berg". Escape in the menu closes the
   menu only; Escape again: the page stays.
7. **E1–E2 expanding.** Pointer over p2's entry, Shift → expanded: "Loading…", then the whole thread, one
   `fixture_thread`; Shift again → nothing (no new `fixture_thread`, still expanded). The chevron → collapsed; Enter on
   the chevron → expanded again, one new `fixture_thread` (fresh, E4). Focus an entry (Tab) and Shift → it expands.
   Shift+a in a reply field types "A" and expands nothing.
8. **E4 two at once.** Expand p1 and p3 → both show their threads; type "one" in p1's field and "three" in p3's.
   Collapse p1, expand it → "one" is still there.
9. **E3 writes, as the panel.** In p3: Preview → the preview, Write → the text; `@an` → the mention list with Anna, Enter
   → `@anna `; Add comment → exactly one `fixture_write { kind: comment }`, the thread re-reads, the text clears; while it
   sends, p1's buttons are disabled too (one write at a time); Add review with text → one `{ kind: draft }`, "Pending"
   shows and "Submit review" shows the count; Submit review → one `{ kind: submit }`; Resolve thread → one
   `{ kind: resolve }`, the entry reads "Resolved" and keeps its place. Escape in p3's field → focus on p3's chevron, still
   expanded, the page stays.
10. **C3 held.** After step 9 p3 kept its index although its last comment changed; collapse p3 → it still keeps its
    index (held since expanded). "Reload discussions" → one `fixture_discussions` for the listed rows, the expanded p1's
    thread read again (one `fixture_thread`), p1 keeps its index (an expanded entry stays held through a Reload; collapsed
    ones re-sort, #2523), and p3 is gone (GitLab no longer lists it as open).
11. **Back.** Back → the list; !624's count is one fewer; Discussions again → nothing expanded, no p3, p1's text "one"
    still in its field after expanding.
12. **Panel text shared.** On the list, open !637's box, Shift over d01 → the panel; type "from the box"; Escape (panel
    closes); Discussions → expand d01's entry → its field reads "from the box".
13. `shot` of steps 5, 6, 8 and 9, dark and light.

### C. WebKit fixture, the range window (A2)

Start: `just app-session start-fixture --name mpdr --range-case review --threads seeded --gitlab listed --mr list
--open-mr --size 1600x1000`: Discussions → the view, Me's pinned order; expand p2, Add comment → one `fixture_write`;
Back → the list. `shot` dark.

### D. Real app on the fake glab

1. `scripts/local-conflicts-repo.sh <scratch>/mpd` and `cargo tauri build --debug --no-bundle`.
2. `just app-session start-app --name mpda --diff --dir <scratch>/mpd --glab mr-threads --mr`, the merge-requests page,
   Discussions. Count the session's fake glab `argv:` lines after each step:
   1. The view shows !90's and !91's discussions with each first comment formatted (d01's first comment as on the panel);
      no new discussions query when "Load fully" already read them.
   2. Expand d01 → exactly one discussions query for `[90]` and one `draft_notes` read (one thread read per expansion);
      collapse and expand → one more of each.
   3. Add comment "verify" → exactly one `POST …/discussions/<d01>/notes`; Resolve thread on d02 (expanded) → exactly one
      `PUT …/discussions/<d02>`; Add review then Submit review → one `POST …/draft_notes` and one `…/bulk_publish`.
   4. A link in a first comment opens (the system opener's log line); an uploaded picture shows (RK41, RK53).
3. `shot`, dark and light. `just app-session stop --name mpda`.

## Acceptance

For each step: pass or fail, with the observed words, the `read` results, the log and `argv:` lines pasted verbatim, and
the screenshots' paths.

**Owner check** (hand on, not run). On the owner's playground (`samubr/glab-yamt-playground` on gitlab.com), with the
real app logged in as `samubr` and a few open merge requests with discussions by several people:

1. Merge-request page → "Discussions". The entries waiting on you come first ("Your turn"), then those you started, those
   you wrote in, those on merge requests you review, then the rest; each shows its first comment as GitLab renders it and
   the later writers' pictures, newest on the right.
2. "Whose discussions" → a colleague → the discussions waiting on that colleague come first, with "<Name>'s turn".
3. Shift over an entry → its whole thread; reply with "Add comment" → the comment on GitLab is yours, once; expand a
   second entry while the first stays open.
4. Back to list → the list as you left it (filters, search, scroll).
