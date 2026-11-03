# Slice mr-review-mode-verify — the gate, the WebKit fixture and the real app for review mode

Design: `docs/slices/briefs/mr-review-mode-design.md` option A. Request acceptance:
`docs/slices/request-mr-review-mode.md` "Acceptance" (`:53-58`). Proposed plan §2 #165–#166 and RK62–RK63. Recipes:
`skill://verification`. Windows open only on a private display, and screenshots come only from the session or the
private display (VF8, VF9).

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-review-mode-core` and `mr-review-mode-page` committed.
- **Smoke pass** (steps B–C, no `just check`): as soon as `-page` is committed, beside its reviewers.
- **Final pass:** once the docs keeper has named `mergeRequests/internal/reviewOrder.ts`, `ui/MergeRequestReviewMode.vue`
  and `ui/MergeRequestReviewSort.vue` in the project map (`just map-check`, PM6). Run `just check` once, then B–C.

**Non-goals:** fixing anything (VF1); `just mutants`.

## Contract

**Fixture `?mr=list`**, as `mr-review-mode-page` left it:

- 40 rows, the user sam. Discussion 0's last author is the next row's author.
- Discussion 1 (on rows with two) is the row's first reviewer's, and newer.
- !615 (`DISCUSSIONS_FAILED_IID`) answers "glab timed out"; !629 answers not logged in.
- Answers come 10 iids per call after 400 ms.
- With the due dates 618 → 04.11.2026, 633 → 05.11.2026, 623 → 05.11.2026, 622 → 01.11.2026, 602 → 06.11.2026, the
  orders are (pinned by `fixtureMergeRequestDiscussions.test.ts` `the_review_orders_the_smoke_expects`):

  | review mode         | rows (top to bottom)                     |
  | ------------------- | ---------------------------------------- |
  | Me, Ready           | !618 !633 !623 !622 !638 !603 !608       |
  | Anna Berg, Ready    | !602 !622 !630 !612 !632 !617            |
  | Anna Berg, All      | !602 !622 !630 !627 !612 !632 !617 !606  |
  | Chiara Rossi, Ready | !638 !635 !630 !615 !614 !605 (unsorted) |

**Scenario `tests/glab/mr-review-mode/`** (user sam):

| row | draft | reviewers | open | last comments               |
| --- | ----- | --------- | ---- | --------------------------- |
| !97 | no    | anna      | 1    | anna                        |
| !96 | no    | sam, anna | 2    | ben; sam                    |
| !95 | yes   | sam       | 1    | anna                        |
| !94 | no    | sam       | 1    | anna                        |
| !93 | no    | sam       | 2    | sam; sam                    |
| !92 | no    | anna      | 1    | anna                        |
| !91 | no    | sam, ben  | 0    | —                           |
| !90 | no    | ben       | 1    | absent from GitLab's answer |

**Words:**

- Button: "Review mode".
- Icon:
  - "Sorted for your review: due with your turn first, then fewest waiting on the author"
  - "Sorted for <name>'s review: due with their turn first, then fewest waiting on the author"
  - The loading suffix: "(the discussions of N merge requests are still loading; they move when they arrive)"
  - "Not sorted for <name>'s review: the discussions of !<iid> could not be read. <reason>"
- Box: "<name>'s turn" and "N of M wait(s) for <name>" in review mode for another person; "Your turn" and "… for
  you" otherwise.

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.**

- Start with `just app-session start-fixture --name rmv --diff --mr list --size 1600x1000`. Run every step in both
  windows (`--diff` and `--range-case review --mr list`) unless noted.
- Store the five due dates and reload before opening the page:
  ```
  read "localStorage.setItem('yamt.mergeRequests.dueDates', JSON.stringify({'/home/sam/taskboard/.git': {'618': '2026-11-04', '633': '2026-11-05', '623': '2026-11-05', '622': '2026-11-01', '602': '2026-11-06'}})); setTimeout(() => location.reload(), 0)"
  ```
- Read row orders as the `!iid`s of the list's rows.

1. **Button and picker.**
   - The `user-round-search` button sits after the Label filter, with the tooltip "Review mode".
   - Hover opens its menu: "Me" first, then exactly the Reviewer filter's people in that filter's order, no "None".
   - Arrow keys step through the items. Hovering a filter list closes the picker (one menu open).
2. **Pick Me.**
   - The menu closes and focus is on the button.
   - The filters read "Reviewer: Me" and Draft "Ready", Assignee and Label cleared. A search text typed before the
     pick stays.
   - Rows per the table, and the icon with Me's tooltip.
3. **Pick Anna Berg.**
   - Rows per the table, and the tooltip names Anna Berg.
   - !632's box reads "1 of 2 waits for Anna Berg", with "Anna Berg's turn" and "Waiting for an answer".
4. **Change a filter.** Draft → All: rows per the table ("Anna Berg, All"), and the icon stays.
5. **Reload and reopen.**
   - Reviewer anna, Draft All, the order and the icon are back.
   - `localStorage` `yamt.mergeRequests.filters` holds `"review":"user:anna"` beside `assignee`, `reviewer`, `label`
     and `draft`.
6. **Clear filters.**
   - The normal order (dated first, then newest), and no icon.
   - !632's box reads "1 of 2 waits for you" and "Your turn".
   - The stored entry is gone.
7. **Failure.** Pick Chiara Rossi.
   - Rows per the table, in the normal order.
   - The icon is in the error colour, and its tooltip says "Not sorted for Chiara Rossi's review: the discussions of
     !615 could not be read." with the timeout words.
8. **Load lazily.** With Anna picked: Settings → Discussion details → Load lazily → Back.
   - No button and no icon; Reviewer and Ready kept; normal order; the stored entry has no `review`.
   - Off → Back: the same.
   - Load fully → Back: the button is back, and the order stays off.
9. **Loading** (`--diff` only). Pick Me, Refresh, and read the icon's `aria-label` within the first second: it
   carries the loading suffix while answers are pending, and rows settle to the table's order once they stop.
10. `shot` of the picker open and of the icon's tooltip, in yamt Dark and yamt Light.

**C. Real app.**

- Run `scripts/local-conflicts-repo.sh <scratch>/rm`, then `cargo tauri build --debug --no-bundle`, then `just
  app-session start-app --name rm --diff --dir <scratch>/rm --glab mr-review-mode`. Open the merge requests page.

1. The fake glab log has exactly one discussions `argv:` line, with `iids=["97","96","95","94","93","92","90"]`.
2. The picker lists Me, Anna Berg, Ben Okafor.
3. **Me:**
   - Rows `!94 !91 !96 !93`, normal `!96 !94 !93 !91`.
   - Set !93's due date to 04.11.2026: still `!94 !91 !96 !93`.
   - Draft → All: `!95 !94 !91 !96 !93`.
4. **Anna Berg:** `!96 !97 !92`. !96's box reads "2 of 2 wait for Anna Berg".
5. **Ben Okafor:** `!91 !90`, with the icon in the error colour and its tooltip naming !90.
6. **Reload** (`read "setTimeout(() => location.reload(), 0)"`), reopen the page: the mode and the order are back.
   Clear filters: all 8 rows, `!93` first.
7. **The setting:** as B8.
8. The app log has one `mergeRequests.discussions_read` line per call. `shot` in dark and light. Stop the session.

## Acceptance

Each step: pass or fail with the observed words, the read orders, the `localStorage` values, and the fake-glab log
lines pasted verbatim, plus the screenshots' paths. Report the environment (VF5).
