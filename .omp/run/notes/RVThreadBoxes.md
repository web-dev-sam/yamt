All 13 WebKit steps and all 6 real-app steps passed. The six frontend checks pass on the whole tree. `just map-check` already failed before this slice: the project map is missing a long list of files, and my seven new files add to it.

## summary
- The range window now shows thread boxes inside the columns. `RangeThreadLayer` teleports one `RangeThreadBox` into each host the editor keeps. A box is either a draft (Comment/Cancel) or an open thread (its place, a collapse button, its messages, a reply field).
- `RangeMessage` shows a note's text or the one `aiAnswer` line, the Post/Unqueue button, the posting label, and for a pending message the link as selectable text with Copy. Post opens `RangePostEditor` (Queue/Cancel) in the message's place.
- `RangeSendButton` sits in each `RangeView` header. `RangeFileRow` shows a muted speech-bubble thread count. `RangeApp` shows the send result as a closable notice.
- `ui/rangeKeys.ts`:
  - `isTypingTarget` is pure, as the contract asks.
  - `typesIntoField` makes `RangeApp`'s window keydown skip plain typing in a field, so Ctrl/Cmd+B still toggles the list from a box.
  - `boxKeydown` handles the box keys: Ctrl/Cmd+Enter submits, Escape cancels, and both call `preventDefault` and `stopPropagation`.
- `app-session start-app --glab <scenario>` puts `scripts/fake-glab` first on PATH and sets the `YAMT_FAKE_GLAB*` variables. `start-fixture --threads/--gitlab` add `&threads=…&gitlab=…` to a `--range-case` URL.

## files_changed
- `frontend/src/ui/{RangeThreadLayer,RangeThreadBox,RangeMessage,RangePostEditor,RangeSendButton}.vue` (new)
- `frontend/src/ui/{rangeKeys,rangeKeys.test}.ts` (new)
- `frontend/src/ui/{RangeView,RangeFileRow,RangeApp}.vue`
- `frontend/src/ui/AGENTS.md`
- `frontend/scripts/app-session/{args,args.test,startArgs,start}.ts`

## tests_added
- `rangeKeys.test.ts`, 8 tests:
  - which elements count as typing targets: a text area and text-like inputs do; buttons, checkboxes, other elements and `null` don't, nor does an input whose `type` is not a string;
  - Ctrl/Cmd+B still reaches the window from a field (`typesIntoField`);
  - Ctrl+Enter submits on Linux and Cmd+Enter on macOS (not the other way round), and both call `preventDefault`/`stopPropagation`;
  - plain Enter, Shift or Alt with Ctrl+Enter, and other Ctrl keys stay ordinary typing;
  - Escape alone cancels; with a modifier it does nothing;
  - nothing fires while an input method is composing.
  - Stryker on `src/ui/rangeKeys.ts`: **100 %, 73 killed, 0 survived**.
- `args.test.ts`:
  - `start-app --glab names a tests/glab scenario, only with --range` (also refuses paths, upper case and a missing value);
  - `start-fixture --threads and --gitlab pick the review scripts of a range fixture, and only of one`;
  - the two `toEqual` defaults tests now include `glab: null`.

## smoke_evidence
**Frontend commands** (whole tree, after the last edit):
- `typecheck`, `lint`, `test`, `fmt:check`, `sfc-order`, `unused`: all exit 0.
- `test`: "Test Files 184 passed (184) / Tests 2478 passed (2478)".
- `fmt:check`: "All matched files use the correct format."

**WebKit steps** (`just app-session start-fixture --name rv --range-case review [--threads seeded --gitlab <script>]`, MiniBrowser through `just webdriver`; screenshots in `/tmp/rv/`):
1. Hovering a number shows the comment icon (`s2.png`). A press on left line 8 opens the box: focus = TEXTAREA "Write a comment…", rows 154,154, and line 9 moves from 246.5,246.5 to 400.5,400.5 in both columns (`s3.png`).
2. Typing then Ctrl+Enter gives `box=src/board/board.ts:8 Why 200 here? Post | marks=1 | row=M src/board/board.ts 1 +44 −21 | rowTitle=1 thread` (`s4.png`).
3. ArrowDown, ArrowUp, Ctrl+A and Ctrl+C leave focus in the TEXTAREA with no editor selection. With text, Ctrl+A gives `sel=0-3`. Escape on an empty draft gives `BODY | boxes=0 | line9=246.5,246.5`. Ctrl+F in a box gives `search panels=0 focus=TEXTAREA`.
4. A 15-line message on an unchanged right line gives rows `681:434` (left) and `701:434` (right): both columns grow by 434 px, and the band is intact (`s5.png`).
5. Collapse from the header: boxes 1, mark stays 1, line 9 back to 246.5. The mark opens it again (400.5), collapses it, and opens it again.
6. Seeded threads: LEFT `:6` pending with link and Copy, LEFT `:20` removed and queued, RIGHT `:21` added and refused with its reason (`s6.png`).
7. Post, edit, Queue gives "Unqueue Queued for GitLab" and `Send to GitLab (1)`, enabled, title "Send the 1 queued comment to your pending review on !12". Unqueue gives "Post" and `Send to GitLab (0)`, title "Nothing queued".
8. Send reads "Sending 1 of 1… disabled=true", then "Pending on GitLab https://gitlab.example.com/…/12/diffs Copy", Post disabled with title "Pending on GitLab", notice "1 sent, 0 refused" (`s8.png`).
9. `refusal` with 3 queued gives `Send to GitLab (1)` and notice "2 sent, 1 refused"; "This needs a test." stays Unqueue with "Refused by GitLab: 400 Bad request…".
10. Every not-lined-up script disables Post and Send, each with its own sentence on both buttons:
    - `noGlab`: "glab is not installed (not found on PATH)";
    - `loggedOut`: "glab is not logged in: gitlab.example.com: No token found…";
    - `noMergeRequest`: "no open merge request from feature";
    - `noBranch`: "no open merge request ends at 9c1ba3f (the range names no branch)";
    - `moved`: "the merge request !12 is at 7d6c5b4, this window shows 9c1ba3f";
    - `otherBase`: "…starts from 3e2f1a0, this window from 531ea52";
    - `several`: "several open merge requests from feature (!12, !14); none compares 531ea52 with 9c1ba3f";
    - `preparing`: "GitLab is still preparing the changes of !12";
    - `failed`: "glab failed: glab api projects/:fullpath/merge_requests: 502 Bad Gateway".
    - Under `moved`, Unqueue stays enabled (`disabled=false`).
11. `checking` gives `Send to GitLab (2) disabled=true title=Checking GitLab…`; once the check answers, it is enabled with "Send the 2 queued comments…".
12. The AI answer shows "An AI answer — start yamt with --ai to see it" with Post disabled and that sentence as its hover (`s12.png`).
13. A click in the code, Ctrl+F, "BoardError", Enter gives `matches=5 selected=1` (`s13.png`). Ctrl+B toggles the list from the find input and from a box textarea (list=false, then list=true).

**Real-app steps** (`scripts/range-repo.sh /tmp/rr-rv`, `cargo tauri build --debug --no-bundle`, `just app-session start-app --name ra --range main...feature --repo /tmp/rr-rv --glab lined-up --home /tmp/rv-home`; the scenario is switched with `ln -sfn tests/glab/<s> <folder>/glab/scenario`):
1. Threads on an added, a removed and an unchanged line. `threads.json` has `"format": 1` with the kinds `added`/`removed`/`unchangedOnLeft` and one `queued` posting. After close and reopen: `boxes=0`, 3 marks, the row reads 3, `Send to GitLab (1)`, and opening the removed one shows "Unqueue Queued for GitLab".
2. A newer file gives exit 2 with "yamt: the review threads …/threads.json were written by a newer yamt (format 2)", same sha256 before and after. A broken file gives exit 2 with "…cannot be read: expected value at line 3 column 16; nothing was changed", hash unchanged.
3. `lined-up` Send: the log shows `argv: api --include --method POST projects/7/merge_requests/12/draft_notes --input -` and `stdin: {"note":"Removed line note","position":{"base_sha":"531ea52…","head_sha":"9c1ba3f…","new_path":"src/board/board.ts","old_line":20,"old_path":"src/board/board.ts","position_type":"text","start_sha":"4378055…"}}`. Notice "1 sent, 0 refused", and the message shows Pending with the link.
4. Refusal, timeout, then drafted:
   - `refusal`: "1 sent, 1 refused", with the refused one kept queued with its reason.
   - `timeout`: "Sending 1 of 1…", then "0 sent, 0 refused; stopped: glab timed out. The rest stay queued.", `Send to GitLab (1)`.
   - `drafted`: re-send of two messages gives "2 sent, 0 refused"; the POST count went from 5 to 6, so the message already among GitLab's drafts was recorded without a second post.
5. No glab on PATH: `send disabled=true title=glab is not installed (not found on PATH)`.
6. Switched to `moved`, focus away, 31 s, focus back: the 7th `auth status` call ran. Send is disabled with "the merge request !12 is at d1e2f3a, this window shows 9c1ba3f"; a new note's Post has the same sentence.

**What only a real GitLab can prove** (the owner's check, design §8): that each pending comment sits on the same line in GitLab's Changes view (removed, added, far unchanged, renamed file); the `diff_refs` semantics; the `:fullpath` lookup; glab's real output on an HTTP error; and the disabled state after pushing one more commit. The fake only imitates these.

## deviations_from_brief
- **Words outside `rangeThreadText.ts`.** That file is read-only here, so these sit as constants in the components: "Comment", "Cancel", "Queue", "Copy", "Collapse the thread", "Write a comment…", "Reply…", "Text to post", "Copy the link to the merge request's changes", "1 thread"/"n threads" in `RangeFileRow`, and the notice's close label. They should move to `rangeThreadText.ts`.
- **The `aiAnswer` switch is in `RangeMessage.vue`**, not `RangeThreadBox.vue` as the design says. C replaces it there.
- **No `RangeView` `shownKeydown` was added.** The range window has no window-level change-arrow keys. The typing guard applies to `RangeApp`'s one window keydown instead (`typesIntoField`: a typing target without Ctrl/Cmd).
- **Additions to `rangeKeys.ts`** beyond `isTypingTarget`: `typesIntoField` and `boxKeydown` (one key rule for the draft, the reply and the Post editor).
- **Unasked additions:** `RangeApp` shows `gitlab.result` through `NoticeBar` (the result had no view). `start-fixture` gained `--threads`/`--gitlab`, because `--range-case` encodes `&`.
- **`--glab` details:** it is accepted only with `--range` and a plain folder name. It also sets `YAMT_FAKE_GLAB_STATE` and `YAMT_FAKE_GLAB_LOG` (posts need the state file), and `YAMT_FAKE_GLAB` points at a link `<folder>/glab/scenario`, so real-app step 6 can switch scenario mid-run. The start reply reports these paths. Tests went into `args.test.ts`; `startArgs.test.ts` was not created.
- **Run-time things outside the code:** `pnpm install --frozen-lockfile --offline` (the worktree had no `node_modules`, no lockfile change); a debug build in this worktree's `target/`; Stryker run by hand on `rangeKeys.ts`. `scripts/app-session/*` is outside the `just mutants` glob, so `startArgs.ts` was not mutated.
- **Map entries needed elsewhere (PM6):** the project map (`.omp/skills/project-map/SKILL.md`, ui row) needs `RangeThreadLayer`, `RangeThreadBox`, `RangeMessage`, `RangePostEditor`, `RangeSendButton` and `rangeKeys.ts` (`isTypingTarget`, `typesIntoField`, `boxKeydown`); `docs/architecture.md` likewise.

## open_risks
- Each keystroke in a draft or reply rewrites the drafts map, which re-runs `showThreads` on both columns (`frontend/src/ui/useRangeController.ts:122`, from row 20's state). It stayed smooth in these runs; it was not measured on a large file.
- A webdriver click that scrolls an element into view left the two columns 19 px apart once (`/tmp/rv/s7.png`). That is the editor's scroll sync, not this slice.
- `/tmp/rv-home`'s `threads.json` is left broken from real-app step 2; the good copy is at `/tmp/rv/threads.good.json`.