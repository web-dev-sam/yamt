# PlanScoutRangeThreads

Agent output (`agent://PlanScoutRangeThreads`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T10-54-21-203Z_01a19198-a013-7540-8908-9ce26c57441c/PlanScoutRangeThreads.md), collected 2026-10-31T10:59:20.513Z.

I've mapped the single-line thread anchor at HEAD, end to end. Today a thread is started by a press on a line number, and nothing anywhere carries a line range: not the stored file, the GitLab position, the AI prompt or the header text.

## 1. How a new thread starts in the frontend
- **Trigger:** a left-button `mousedown` on a line number. `threadNumbers()` passes a `domEventHandlers.mousedown` to CodeMirror's `lineNumbers()` (`frontend/src/editor/internal/threadNumbers.ts:103-128`). It returns `false` (lets the press through) for a non-left button, a press outside `.cm-gutterElement`, or a press on a collapse wave cell (`foldRunAt`, :117). It also ignores the empty line after a last newline and the line of an empty column (`pressedLine`, :35-40).
- **What the press means:** `numberPress` (:42-54) returns `toggle` when the press lands on the count badge `.cm-thread-count` (open or collapse that line's threads). Otherwise it returns `start` with `anchorAt(...)`.
- **The hover "+":** it is CSS only. A `::before` mask from `--thread-icon` (lucide `message-square-plus`, :7, :93-101) shows on a hovered number with no count and no wave (`frontend/src/editor/theme.css:503-521`). Same file: `cursor: pointer` (:506), badge style (:523+).
- **Same extension registers the badge:** `lineNumberMarkers.compute([threadField], countMarkers)` and the class `cm-thread-lines` (:130-131).
- **Controller:** `RangeController` adds `threadField`, `threadNumbers` and the fold extension to each column (`frontend/src/editor/range.ts:74-80`). `#pressed` picks the column from the view, then calls `events.startThread(line)` or `events.toggleThreads(keys)` (:108-117). `RangeEvents` is defined at :43-47.
- **Into Vue:** `rangeThreadParts` turns `startThread` into `threads.startThread(file.id, line)` (`frontend/src/ui/useRangeController.ts:198-212`).
- **Where the new-thread draft lives:** `rangeDrafts.ts`.
  - `Draft { kind: "thread", file, line: ThreadLine, text, focus }` (`frontend/src/ui/rangeDrafts.ts:14-26`), kept in a `shallowRef<Map>` with keys `draft-N` (:45-48, :125-136).
  - Pressing a line that already has a draft bumps that draft's `focus` instead of making a second one. "Same line" means the same shown column and line (`sameLine`, :120-123).
- **Drafts as rows:** `rangeThreads.ts` `shownFor` adds each draft as `{ key, line, shown: "draft" }` (`frontend/src/ui/rangeThreads.ts:96-103`). `addThread` sends `source.addThread(draft.file, draft.line, text)` (:124-142).
- **Box:** `RangeThreadBox.vue` refocuses its field when `draft.focus` changes (:70-75).
- Risk: `sameLine` dedup and `focus` assume one line per draft; overlapping ranges need a new identity rule.

## 2. `ThreadLine` and `anchorAt`
- **Rust:** `ThreadLine` is defined at `crates/review/src/thread_types.rs:14-42`, serde `tag="kind"`, camelCase.
  - Variants: `Removed { left }`, `Added { right }`, `UnchangedOnLeft { left, right }`, `UnchangedOnRight { left, right }`.
  - `LeftLine`/`RightLine` are 0-based `u32` newtypes (`crates/merge-core/src/line.rs:19-28`).
- **Generated TS:** `frontend/src/ipc/bindings.ts:1098-1121`. The command is `addThread(file, line, text)` (:48).
- **Hand-written TS domain:** `frontend/src/ipc/threadLine.ts`.
  - `ThreadLine` (:6-10) and `ShownThread` (:12-16).
  - `shownLine` (:18-31): removed and unchangedOnLeft show in the left column, the others in the right.
  - `changedThreadLine` / `unchangedThreadLine` (:37-52), `toThreadLine` / `fromThreadLine` (:54-77).
  - `ReviewSource.addThread` signature: `frontend/src/ipc/ReviewSource.ts:7`.
- **How a pressed line becomes a `ThreadLine`:** `frontend/src/editor/internal/threadAnchor.ts`.
  - `linePlace` (:13-31) walks the differences. It returns `inside` if the line falls in a difference, or `between` with the partner line in the other text.
  - `anchorAt` (:33-45): inside a difference gives `removed`/`added`; between gives `unchanged*` with both lines.
- **Where the box sits:** `frontend/src/editor/internal/threadRows.ts`.
  - `placeOf` (:50-69): the shown column's place is `line+1`, so the row sits under the anchored line.
  - In the other column, `gapAfter` (:33-48) uses the partner line + 1 for unchanged lines, or the end of the difference for changed ones. A one-sided difference gets kind `leftEmpty`/`rightEmpty`.
  - `threadRows` (:71-89) groups threads by `left:right` place; collapsed threads get no row.
- **Widget placement:** `rowDecorations` (`frontend/src/editor/internal/threadField.ts:23-38`) puts a block widget after `doc.line(place).to`. When `sitsBeforePlace` holds, it goes before line `place+1` instead.
- **Row sizing and scroll:** `ThreadRowWidget` is in `threadWidget.ts`. `ThreadHosts` (`threadHosts.ts`) keeps one host per key, and a `ResizeObserver` sets the row height to the larger column's sum. Only `unchanged` rows become scroll anchors (`threadField.ts:67-77`).
- **Per-line badge count** keys by `shownLine(thread.line).line`, and drafts are skipped (`threadNumbers.ts:23-33`).
- Risk: every one of these assumes one place. A range needs a rule for which line the box sits under (GitLab puts it under the end line) and what the other column's gap is when the range spans a difference.

## 3. Storage
- **File and format:** `threads.json`, `const FORMAT: u32 = 1` (`crates/review/src/thread_file.rs:10-11`).
- **`ThreadFile`** (camelCase): `{ format, nextThread, nextMessage, threads }` (:16-24).
- **`StoredThread`** (no rename): `{ id, path, line: ThreadLine, session, messages }`. The line is serialized here (:26-34).
- **Version check:** `parsed` (:205-224) reads `FormatOnly` first.
  - A format above 1 gives `Error::NewerFormat`; any other mismatch gives `Broken`.
  - Then a full parse plus `problem()` checks (:121-160).
  - Error texts: `crates/review/src/lib.rs:176-188`. The shell maps both to `IpcError::Git` (`src-tauri/src/ipc_error.rs:191-195`).
- **Write:** temp file + rename (:232-250).
- **Not validated:** `add_thread` does not check the line against the file. It only checks the text and that the file is known (`crates/review/src/thread_store.rs:64-88`).
- **Migration precedent:** none. Every format constant is 1 (`crates/compare/src/index.rs:11`, `crates/local-merge/src/record.rs:13`). Plan #121 changed format 1 in place "before any release" (`docs/plan.md:153`).
- **Pinned on-disk JSON with every line kind:** `crates/review/tests/stored_threads/mod.rs:107-126`.
- Risk: there is no `deny_unknown_fields`, so an extra optional field would be silently dropped by an older yamt when it rewrites the file. A new shape needs `FORMAT` 2, which older builds refuse via `NewerFormat`.

## 4. GitLab posting
- **Line mapping:** `line_place(entry, line)` (`crates/review/src/position.rs:19-41`).
  - `Removed` gives `old_line` only, `Added` gives `new_line` only, unchanged gives both. All are +1 (`one_based`, :43-45).
  - `old_path` is the renamed entry's old path, otherwise the entry's path; `new_path` is the entry's path. A `\u{FFFD}` in either path gives `Err(NOT_UTF8)`.
- **`LinePlace`:** `{ old_path, new_path, old_line: Option, new_line: Option }` (`crates/review/src/gitlab.rs:39-46`).
- **Request body:** `PostBody::json` (`position.rs:47-77`) builds `{ note, position: { position_type: "text", base_sha, start_sha, head_sha, old_path, new_path, old_line?, new_line? } }`.
- **Send path:** `send.rs:142-163`. `line_place` then `PostBody`; a matching draft is taken instead of posting again (`same_draft`, `position.rs:80-87`, which compares `LinePlace` and `head_sha`). Otherwise `glab api` to the draft-notes route.
- **Reading GitLab's drafts back:** `placed_draft_from` (`gitlab.rs:177-188`) reads `position.old_line/new_line` only.
- **`line_range`:** nothing builds or reads one. The only occurrence is `"line_range":null` in the fixture `tests/glab/drafted/draft-notes.json:1`.
- **`lines_up`:** `crates/review/src/lines_up.rs:37-63` (`diff_refs.base_sha == left && head_sha == right`). `check_gitlab` is at `crates/review/src/send.rs:25`.
- Risk: `same_draft` compares only the end-line `LinePlace`, so a range draft and a single-line draft on the same end line would wrongly count as the same draft.

## 5. AI prompt context
- **Prompt rule:** `promptText` (`frontend/src/ui/rangeAiRules.ts:59-77`). The notes since the last answer are joined. Only a session's first turn goes through `firstMessage(template, values)`.
- **Values:** `askContext` (`frontend/src/ui/rangeStore.ts:112-131`) sets `RELATIVE_FILE_PATH_WITH_LINE: threadPlaceText(entry, thread.line)`, plus `RANGE`, `OLD_COMMIT`, `NEW_COMMIT`.
- **Default template:** `frontend/src/agent/internal/firstMessage.ts:11-19`, with the line "My comment on {{ RELATIVE_FILE_PATH_WITH_LINE }}:". It also says a removed line is named by its place in OLD_COMMIT.
- **What the AI gets:** file path and a 1-based line number only. The text of the line is never quoted.
- Risk: the placeholder name is stored in users' `agent.firstMessage` settings (plan #113, `docs/plan.md:145`). Renaming it breaks saved templates; the value would have to become `path:a-b` under the same name.

## 6. Collapse rule #126 (a thread line is never hidden)
- **Where:** `unchangedLine` (`frontend/src/editor/internal/columnFolds.ts:58-71`). An `unchangedOnLeft`/`unchangedOnRight` thread (any shown kind, drafts included) becomes a `ColumnChange` `{ left: { start, len: 1 }, right: { start, len: 1 } }`.
- **What it keeps visible:** exactly that one line in both columns, as a run edge, so collapsed runs end around it. Removed/added threads give `null`, since they are already inside a difference.
- **Merge and dedup:** `columnChanges` (:89-102), sorted by left then right; `rangeRuns` (:104-110).
- **When computed:** at file open and on each collapse toggle, never on an add (`range.ts:101-104`, :124-127; `docs/plan.md:158`).
- **Related:** a selection in the left column reveals hidden lines (`ownerSteps` update, `columnFolds.ts:50`).
- Risk: `len: 1` is hard-coded; a range would need `len = n`, and a range that crosses a difference would have to be split.

## 7. Header and place text
- **Text:** `threadPlaceText(entry, line)` (`frontend/src/ui/rangeThreadText.ts:164-173`).
  - Any non-removed line gives `path:right+1`; this includes `unchangedOnLeft`, which still shows the right-side line.
  - A removed line gives `oldPath` (when renamed) `:left+1`.
- **Used by:** the `RangeThreadBox.vue` header (:42-45, :161) and its `aria-label` (:157), and the AI value (Q5).
- **Other displays of the anchor:** the per-line count badge (`CountMarker`, `threadNumbers.ts:56-90`). The per-file count in `rangeThreads.ts` `counts` is not per line.

## 8. Selection today and drag precedents
- **The columns are selectable:** `readOnlyCenter` = `centerExtensions` + `EditorState.readOnly.of(true)` only, with no `EditorView.editable.of(false)` (`frontend/src/editor/internal/pane.ts:209-210`). The side panes, by contrast, set editable false (:201-202). So the columns allow caret and native drag selection.
- **Painting:** `drawSelection()` (:232), `highlightActiveLine` / `highlightActiveLineGutter` (:192-193). The columns are built at `compareViews.ts:86-103`.
- **Mouse handlers in the range editor today:**
  - the gutter `mousedown` above (`threadNumbers.ts:108-127`);
  - the fold wave `mousedown` with `preventDefault` (`folding.ts:28-31`);
  - a capture-phase document `pointerdown`/`focusin` in `threadHosts.ts:48-49` (for focus only);
  - strip `mousedown` → `keepEditorFocus` (`compareStrip.ts:29`).
  - Thread widgets ignore all events (WidgetType default).
- **Existing gutter drag:** none in the range or compare windows.
- **Drag precedent:** the merge window's `IconDrag` (`frontend/src/editor/internal/drag.ts:52-116`, used at `merge.ts:161-170`). It uses pointer capture on the strip SVGs: `pointermove`/`pointerup`/`pointercancel`/`lostpointercapture`. `coveredChunks` builds a vertical span from the press top to the pointer top, and the painting runs through the frame (`frame.ts:88-91`).
- **Another pointer-capture drag:** `minimapPointer.ts:56-64`.
- Risk: the gutter handler fires on `mousedown`, so it starts a thread before any drag; a drag gesture needs the start moved to release.

## 9. Tests that pin single-line behaviour (file names)
- **Rust:**
  - `crates/review/src/position.rs` (tests module)
  - `crates/review/src/thread_file.rs` (tests)
  - `crates/review/src/thread_store/waiting.rs` (tests)
  - `crates/review/tests/review.rs` (`the_post_body_names_the_three_commits_and_the_position`, :310-338)
  - `crates/review/tests/threads.rs`
  - `crates/review/tests/note_edits.rs`
  - `crates/review/tests/stored_threads/mod.rs`
  - `src-tauri/src/ipc_error/tests.rs`
- **Frontend unit:**
  - `editor/internal/threadAnchor.test.ts`, `threadRows.test.ts`, `threadField.test.ts`, `threadNumbers.test.ts`, `columnFolds.test.ts`
  - `ipc/reviewDomain.test.ts`, `fixtureReview.test.ts`, `fixtureRange.test.ts`, `tauriReview.test.ts`
  - `ui/rangeThreads.test.ts`, `rangeThreadText.test.ts`, `rangeStore.test.ts`, `rangeAi.test.ts`, `rangeAiRules.test.ts`, `rangeGitLab.test.ts`, `rangeOpen.test.ts`, `useRangeController.test.ts`
  - `agent/internal/firstMessage.test.ts`
- **WebKit browser tests:**
  - `frontend/src/editor/rangeThreads.browser.test.ts`. Includes "a press on a line number starts a thread there…" (:297) and "an added file's empty left column … start no thread" (:368).
  - `frontend/src/editor/range.browser.test.ts`.
- **Session args:** `frontend/scripts/app-session/args.test.ts`.

## 10. Fixtures
- **Sample threads:** `frontend/src/ipc/fixtureThreads.ts`. `?threads=seeded` puts 4 threads on `src/board/board.ts` (:11), one per kind:
  - removed 19
  - added 20
  - unchangedOnLeft 5/5
  - unchangedOnRight 100/101 (:21-48)
  
  `startThreads` is at :63-68.
- **Fixture store:** in memory in `frontend/src/ipc/fixtureReview.ts` (`addThread` :63-80, `createFixtureReview` :256). The fixture GitLab builds no position.
- **Range case:** `DEFAULT_CASE = "review"` (`frontend/src/ipc/fixtureRange.ts:28`).
- **`scripts/range-repo.sh`:** builds the smoke repo (main/feature, every file shape, fake GitLab `!12`/`!13`, fixed commit ids pinned by `tests/glab` and `crates/review/tests`). It creates no threads (:1-16, :125-126).
- **Fake GitLab answers:** `tests/glab/<case>/` (`lined-up`, `drafted`, `refusal`, …).
- Risk: the seeded threads and `draft-notes.json` hold only single-line shapes, so ranges need new fixture cases.
