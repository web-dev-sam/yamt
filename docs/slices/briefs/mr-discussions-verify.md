# Slice mr-discussions-verify — the gate, the WebKit fixture and the real app for open discussions

Design: `docs/slices/briefs/mr-discussions-design.md` option A. Request acceptance:
`docs/slices/request-mr-discussions.md` "Acceptance" (`:62-72`). Proposed plan §2 #162–#164 and RK60–RK61. Recipes:
`skill://verification`. Windows open only on a private display, and screenshots come only from the session or the
private display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-discussions-rust` (with `just bindings` applied), `-core`, `-state` and `-page` committed.
- **Smoke pass** (steps B–C, no `just check`): as soon as `-page` is committed, beside its reviewers.
- **Final pass**: once the docs keeper has named every new file in the project map (`just map-check`, PM6) and
  `read_discussions`, `set_discussion_details` and `MergeRequestSource.readDiscussions` in architecture and
  ipc-contract. Run `just check` once, then B–C.

**Non-goals:** the owner's playground check (below, for the orchestrator to hand on); fixing anything; `just
mutants`.

## Contract

**Fixture `?mr=list`**, as `mr-discussions-state` built it:

- A row with `openDiscussions` k has k discussions.
- Discussion 0's last author cycles through `PEOPLE` from index + 2. Its place is Overview on even indexes and
  `src/board/card.ts:<10+index>` on odd ones.
- Discussion 1 is sam's, newer, on `src/board/column.ts`.
- Every 4th discussion holds the markup text (`Please RENAME this.`, `**not bold** <b>not bold</b> &amp;
  <script>x</script>`, two more lines).
- One discussion per 6 rows has no page.
- `DISCUSSIONS_FAILED_IID` answers "glab timed out", `DISCUSSIONS_LOGGED_OUT_IID` answers not logged in.
- Answers come 10 iids per call after 400 ms.
- The fixture logs `mergeRequests.fixture_discussions { iids }` and `mergeRequests.fixture_page`.

**Scenario `tests/glab/mr-discussions/`**, as `mr-discussions-rust` recorded it:

| row | open | what the box should show                                                                                            |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| !82 | 3    | (a) last sam, `src/…:<line>`; (b) last ben, with a system note after his comment; (c) anna on the Overview, no link |
| !81 | 1    | ben on the Overview, markup in the body                                                                             |
| !80 | 0    | —                                                                                                                   |
| !79 | 1    | its open one on a second discussions page                                                                           |
| !78 | 1    | GitLab names no such merge request                                                                                  |

The user is `sam`.

**Words:**

- Core: "Your turn", "Waiting for an answer", "N of M wait(s) for you", "No open discussions", "Overview",
  `path:line`, "… ago", "Someone".
- Page: "Loading discussions…", "Discussion details" with "Load fully", "Load lazily", "Off".
- Problems: "Could not read the discussions", and "This comment's page was not listed by GitLab, so yamt did not
  open it."

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** `just app-session start-fixture --name md --diff --mr list --size 1600x1000`, then open the
merge requests page. Run every step in both windows (`--diff` and `--range-case review --mr list`) unless noted.

1. **Load fully.**
   - Hover !638's count. The box opens without a loading wait; its header sums the turns, viewer's-turn lines come
     first, and newest first within each.
   - Each line: picture, name, "… ago", turn words, place, at most three lines ending in "…" where cut.
   - The session log has `fixture_discussions` calls, one at a time, each asking the not yet answered rows (the
     fixture answers 10 per call; the queue sends the rest again, state brief rule 1); together the answers cover
     each row with a count > 0 exactly once, and no count-0 row is asked.
2. **Text and links.**
   - A markup discussion: `read` finds no `b`/`script` element in the box; `innerText` holds `<b>not bold</b>`,
     `**not bold**` and `RENAME` in capitals.
   - Click a line with a page: `fixture_page` names `…/-/merge_requests/<iid>#note_<n>`, and the row's own page is
     not opened.
   - A pageless line is no button.
3. **Keyboard.** Tab to a count opener: the box opens (focus inside). Escape: the box closes and focus is back on
   the opener.
4. **Load lazily.** Settings → Discussion details → Load lazily → Back → Refresh.
   - No `fixture_discussions` line after the refresh until a hover.
   - Hover a count: "Loading discussions…", then the box, with one line naming that iid alone.
   - Hover away and back: no new line.
   - In `--range-case review`, the review-mode button does not exist (it does not exist yet in any mode; record its
     absence for the next feature).
5. **Off.** Settings → Off → Back → Refresh: no `fixture_discussions` line. A hover over a count shows the plain
   tooltip "N open discussions"; there is no `aria-expanded` opener.
6. **Switching applies at once.** From Off: Settings → Load fully → Back, without Refresh. `fixture_discussions`
   lines follow, and a hover shows the box.
7. **Failure.** The `DISCUSSIONS_FAILED_IID` row's box says "glab timed out" in the list's words, its count still
   shows, and the page's problem bar stays empty.
8. `shot` with a box open in yamt Dark and yamt Light.

**C. Real app.** `scripts/local-conflicts-repo.sh <scratch>/md`, then `cargo tauri build --debug --no-bundle`, then
`just app-session start-app --name md --diff --dir <scratch>/md --glab mr-discussions`. Open the merge requests page.

1. **Full.**
   - The fake glab log has one `argv:` line with `MergeRequestDiscussions` and `iids=["82","81","79","78"]`, then
     one with `iids=["79"]` and `discussionsAfter=d-2`, and no other discussions line.
   - !82's box: three lines, ben's (b) and anna's (c) "Your turn" first, sam's (a) "Waiting for an answer"; header
     "2 of 3 wait for you".
   - !81: the markup shows as text.
   - !79: its one discussion.
   - !78: the box says GitLab sent no such merge request; the count shows 1.
   - !80: the plain tooltip.
2. **Links.** Click (a): `<scratch>/md/glab/opened.log` names `https://gitlab.example/taskboard/taskboard/-/merge_requests/82#note_…`.
   (c) is no button.
3. **Lazy.** Settings → Load lazily → Back → Refresh: no discussions `argv:` line until a hover. Hover !81: exactly
   one line with `iids=["81"]`. Hover again: none.
4. **Off.** Settings → Off → Back → Refresh: no discussions `argv:` line through hovers on every count.
5. **The file.** The settings file in use holds `"discussionDetails": "off"`. After Load fully it holds no
   `discussionDetails` key.
6. The app log has one `mergeRequests.discussions_read` line per call and never a body, name or address. `shot` in
   dark and light.

## Acceptance

Each step: pass or fail with the observed words, the `read` results, and the app-log and fake-glab log lines pasted
verbatim, plus the screenshots' paths.

**Owner check** (hand on, not run): the playground's !1 "Due dates on cards" (4 open discussions, all by `samubr`).

1. The owner, as `samubr` in the real app, sees each discussion "Waiting for an answer" and the header "0 of 4 wait
   for you".
2. Then he answers one of them **by hand as a second GitLab user**: the author's side. No script can do it; `glab` is
   `samubr`.
3. After Refresh that discussion reads "Your turn", sits first, and the header reads "1 of 4 waits for you". Its line
   opens that comment on GitLab.
