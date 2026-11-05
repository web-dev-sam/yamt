# Design — `@` completion in comment fields

Request: `docs/slices/request-mr-mentions.md` (rules 1–7, acceptance, non-goals). Facts:
`.omp/run/notes/PlanScoutMentionFacts.md` (cited below as "facts §n"). Base `180d6c6c`. The owner asked to see the plan
before any implementation. This document is the plan. The briefs are `mr-mentions-{core,search,list,post,verify}.md`.

## 0. Facts this design rests on

| fact                                                                                                                                                                                                                                                                  | source                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Two fields send text to GitLab. The reply field is `<textarea v-show v-model="text" @keydown="keyPressed">`, written through `setReplyText`. The range window's Post box is `<textarea :value @input="typed" @keydown>`, written through `writePost`.                 | `ui/MergeRequestReplyField.vue:45-50, 183-191`; `ui/RangeMessageEditor.vue:41-50, 65-73`                       |
| Both fields send their keys to `boxKeydown` (Mod-Enter submits, Escape cancels). It calls `preventDefault` and `stopPropagation` and skips `isComposing`.                                                                                                             | `ui/boxKeys.ts:16-38`                                                                                          |
| The thread panel closes on any Escape that is not `defaultPrevented`. Two listeners do this: the panel element's own and a window listener.                                                                                                                           | `ui/MergeRequestThread.vue:53, 107-119, 141`                                                                   |
| The panel is `fixed z-10 … overflow-hidden`, placed by `useBesidePlacement`. The reply field sits at its bottom.                                                                                                                                                      | `MergeRequestThread.vue:139`, `ui/useMenuPlacement.ts:26-31`, plan §2 #183                                     |
| The range window's boxes are teleported into CodeMirror widget hosts. CodeMirror's `.cm-scroller` is `position: relative; z-index: 0; overflow-x: auto`, so it clips an absolute child.                                                                               | `ui/RangeThreadLayer.vue:13-15`, `node_modules/@codemirror/view/dist/index.js:6856-6866`                       |
| The window has one people search, `searchOf`, per slice. It waits 250 ms, keeps only the newest answer, and never sends an empty text. It is exposed as `peopleSearch`/`searchPeople`/`endPeopleSearch`.                                                              | `ui/mergeRequestPeople.ts:16-17, 96-130, 209-217`; `ui/AGENTS.md:75` ("the window's one search"); plan §2 #169 |
| `searchedText` trims the text and drops one leading `@`.                                                                                                                                                                                                              | `mergeRequests/internal/suggestions.ts:74-78`                                                                  |
| `autocompleteUsers` searches `project.authorized_users` (invited groups included), active users only, sorted by name, at most 20. A one-letter search works. It exists from GitLab 16.3.                                                                              | `docs/slices/briefs/mr-people-design.md:29-45`                                                                 |
| GitLab's own `@` list shows 10 lines and waits 250 ms. Its backend searches `project.authorized_users` too, with the noteable's author and participants first. Its frontend puts starts-with matches before contains matches over `"<NameWithoutSpaces> <username>"`. | facts §4 (`gfm_auto_complete.js:154-156, 607-643, 1740-1747`; `participants_service.rb`)                       |
| A row carries `author`, `assignees`, `reviewers[].person` and `approvedBy`. A loaded thread carries `comments[].author`. Both are already in the slice.                                                                                                               | `ipc/mergeRequestDomain.ts:21-45`, `ipc/discussionDomain.ts:42-60`, `ui/mergeRequestThread.ts:19-27, 36-41`    |
| The core's `peopleOnRow(row)` gives author, assignees, reviewers and approvers in that order. It is not exported today.                                                                                                                                               | `mergeRequests/internal/suggestions.ts:21-28`                                                                  |
| The range window knows its merge request only as `GitLabCheck.linedUp { mergeRequest: { reference, title, webUrl } }`, after `checkGitLab`. There is no iid on IPC. Rust builds `webUrl` from the REST `web_url`.                                                     | `ipc/reviewDomain.ts:42-46, 73-75`; `ui/rangeGitLab.ts:119-132`; `crates/review/src/gitlab.rs:130-137`         |
| A row's `page` is the merge request's GitLab page. It goes through `toWebPage`.                                                                                                                                                                                       | `ipc/mergeRequestDomain.ts:44, 150`; fixture `fixtureMergeRequestData.ts:246`                                  |
| The range window has the merge-request slice, and its source answers `searchPeople`. In the app, the window's `MergeRequestState` has `gitlab` from its folder at start.                                                                                              | `ui/rangeStore.ts:181`, `ipc/RangeSource.ts:7`, `src-tauri/src/merge_requests.rs:82-83, 324-332`               |
| In fixture mode both windows answer `searchPeople` whatever the `?mr=` script. Each search logs `mergeRequests.fixture_people_search {"text":…}` and answers after 300 ms.                                                                                            | `ipc/fixtureRange.ts:169`, `ipc/fixtureMergeRequests.ts:290`, `ipc/fixtureMergeRequestPeople.ts:15, 105-113`   |
| The range fixture's lined-up merge request is `!12` on `gitlab.example.com/team/taskboard`. The `?mr=list` rows are !601–!640 on `gitlab.example/taskboard/taskboard`, so no row matches it.                                                                          | `ipc/fixtureGitLab.ts:24-28`; `fixtureMergeRequestData.ts:11-12, 246`                                          |
| yamt already writes into a field with `document.execCommand("insertText", false, text)`. The paste brief states that this keeps native undo and fires `input`. That was never measured for undo.                                                                      | `ui/linuxPaste.ts:81`; `docs/slices/briefs/3.F-paste.md:23-24`                                                 |
| `ui/` has no caret measure (facts §6). Only `editor/**` browser tests run in WebKit, and `just check` runs only `--project node`.                                                                                                                                     | `vite.config.ts:13-19`; `package.json:13-14`                                                                   |
| The PM10 fence covers `ui/MergeRequest*`, `ui/mergeRequest*` and `ui/CiStatus*`: no window root, no `lsp/`.                                                                                                                                                           | `frontend/scripts/windowFence.ts:23, 70-84`                                                                    |
| The picker pattern already exists: the combobox and listbox in the people box, `ARROW_STEPS`, the wrap rule `stepMenuItem`, `MergeRequestPicture.vue`, and `peopleSearchText`.                                                                                        | `ui/MergeRequestPeopleSearch.vue:92-143`; `ui/menuKeys.ts:3, 10-22`; `ui/mergeRequestsText.ts:180-183`         |
| `@codemirror/autocomplete` is not a direct dependency. Plan §2 rejects the bundle that would bring it in: "no completion popups in a merge window".                                                                                                                   | facts §6; `docs/plan.md:407-409`                                                                               |

## 1. Options

The options differ in structure on two axes:

1. Where the field and the list live: textareas with yamt's own list, or CodeMirror fields.
2. Where the Post box's people come from: the window's loaded rows, or Rust.

### Option A — one list for the textareas, a second search instance, the Post box's people from the loaded row (recommended)

**Data structures:**

- Core (`mergeRequests/internal/mentions.ts`, self-contained, PM3):
  - `MentionWord { start, end, typed }`: `text[start]` is the `@`, `typed` is what lies between the `@` and the caret, `end` is where the word ends (at or after the caret).
  - `MentionEdit { from, to, insert }`.
  - `MENTION_LINES = 10`.
  - Functions: `mentionWordAt(text, caret): MentionWord | null`, `knownMentions(row, writers)`, `mentionLines(known, found, typed)`, `mentionEdit(word, username)`.
- Search (`ui/mergeRequestPeople.ts`):
  - `PeopleSearcher { state: ShallowRef<PeopleSearch>; search(typed); end() }`, made by `createPeopleSearch(source)`. It is today's `searchOf` with no change in behaviour.
  - The slice holds two instances: `peopleSearch` (the people box) and `mentionSearch` (the mention list). One factory with two users (vision 5). Neither instance can reach the other's state, which is rule 6 by construction (vision 4).
- View (`ui/mergeRequestMentionLines.ts`, pure):
  - `MentionLine { username, picture, label }` and `MentionList { lines, note }`.
  - `MentionKey = step | pick | close`.
  - `MentionAnchor { caret, field, room }` and `MentionPlace { left, top, maxHeight }`.
  - Functions: `mentionList`, `mentionRead`, `mentionKey`, `highlightAfter`, `mentionPlace`.
- DOM (`ui/textareaCaret.ts`): `Rect`, `CaretBox { left, top, bottom }` relative to the field's border box, `mirrorStyle` (pure), `caretBox(field, index)`, `visibleRoom(element)`.
- Composable and component:
  - `ui/mergeRequestMentions.ts` `useMentions(field, known): MentionField`, one per field.
  - `ui/MergeRequestMentionList.vue`, one component, drawn as an absolute child of a `relative` wrapper around the textarea.

**Files:**

- Core: `mergeRequests/internal/{mentions,suggestions}.ts`, `index.ts`.
- `ui/mergeRequestPeople.ts`, `ui/mergeRequests.ts`, `MergeRequestPeople.vue`, `MergeRequestPeopleSearch.vue`.
- New: `ui/mergeRequestMentionLines.ts`, `ui/mergeRequestMentions.ts`, `ui/MergeRequestMentionList.vue`, `ui/textareaCaret.ts`.
- `ui/menuKeys.ts`, `ui/mergeRequestsText.ts`, `MergeRequestReplyField.vue`, `RangeMessageEditor.vue`, `ui/rangeGitLab.ts`.
- `ipc/fixtureGitLab.ts`, `ipc/fixtureReview.ts`, `ipc/fixtureThreads.ts`, `tests/glab/mr-threads/graphql-people-an.json`.
- Tests and docs beside each.

No Rust, no IPC, no binding, no dependency.

**Risks:**

- **Caret measure.** A mirror div must copy every style that moves a glyph. If it misses one, the list sits off the caret. It is proven only in WebKit (the smoke) and is not in the gate.
- **Undo.** `insertText`'s undo step is unmeasured in WebKitGTK (§2.7, measured step plus fallback).
- **Post box people need loaded rows.** They are known only when the merge-request page has loaded rows in that range window, and only if `row.page` equals the REST `web_url` `[INFERENCE: both are GitLab's `merge_request_url`]`. Otherwise the box shows search results only, which the request allows ("none known → search results only").
- **Key order.** The list must take the key before `boxKeydown` and the panel's two Escape listeners (RK73).

**Tests:**

- Core: `mentions.test.ts`. Each word rule, each order rule, the edit.
- `mergeRequestPeople.test.ts`: the two instances never touch each other; the same text twice asks GitLab once.
- `mergeRequests.test.ts`: the slice's two searches.
- `mergeRequestMentionLines.test.ts`: the list, the note, the keys, the highlight, the placement.
- `textareaCaret.test.ts`: `mirrorStyle`.
- `menuKeys.test.ts`: `wrappedIndex`.
- `rangeGitLab.test.ts`: `linedUpRow`.
- `fixtureGitLab.test.ts`: the `listed` script.
- The SSR panel test: the field's ARIA.
- WebKit fixture smoke in both windows; real app on the fake glab.

**Visions:**

- 1: plain textareas and one small list. No new library.
- 2: one search factory, one word rule, one order rule, one list, one composable.
- 3: rule 6 by construction. PM10 covers every mention file.
- 4: `MentionWord`/`MentionKey`/`PeopleSearch` sum types and exhaustive switches.
- 5: no dependency. Two users for the factory, the list and the composable.

### Option B — Option A, plus the lined-up merge request's people over IPC

**Data structures:**

- As A, except `MergeRequestRef` (Rust `yamt-review`, generated) gains `people: { author, assignees, reviewers }` from the REST merge request `merge_request_from` already reads.
- Approvers would cost one more `…/approvals` call per check.
- The pictures must be offered to the window's `MergeRequestState.pictures` before the reply (RK53). `yamt-review` today has no picture path.

**Files:**

- Everything in A.
- `crates/review/src/{gitlab.rs,lines_up.rs}` and tests, `src-tauri/src/review.rs` (the check command and the picture offer), the `ipc/bindings.ts` regeneration, `ipc/reviewDomain.ts` (`toPerson`), `fixtureGitLab.ts`, and the review's fake-glab scenarios.
- This adds a Rust slice and an IPC slice: about 12 files beyond A.

**Risks:**

- A second picture-offer path (RK53) in a crate that never handled pictures.
- One more GitLab call per check, which runs on window focus.
- The check's reply grows for a field that already searches.

**Tests:** A's tests, plus Rust tests for the REST people and the offer, `reviewDomain` conversion, and fake-glab scenarios.

**Visions:**

- 2: one source of truth for the Post box's people, independent of the page.
- Against 5: a new path for a nice-to-have, since the search finds the same people one keystroke later.

### Option C — CodeMirror comment fields with `@codemirror/autocomplete`

**Data structures:**

- The two textareas become small `EditorView`s, created through a new `editor/` controller (PM2: `ui` may not import `@codemirror/*`).
- Mentions become a `CompletionSource` over the same search. The library places the list, handles keys and makes the edit one undo step.

**Files:**

- `package.json` (a direct dependency, DR3).
- A new `editor/` comment-field controller and its `MergeController`-style seam.
- Both fields rewritten, each one's text moved out of `v-model` into transactions.
- The 3-to-12-line `fit` reimplemented, Preview, `keepFocus`, RK35 and RK73 re-proved.

**Risks:**

- It reopens the threads request's "Markdown editor" non-goal and plan §2's bundle rejection (`plan.md:407-409`) for a feature the owner scoped to "people only".
- The library's keymap must be ordered against `boxKeydown`, the panel's Escape and Mod-Enter anyway.
- Its list draws in its own tooltip layer. Inside the panel's `overflow-hidden` and the range scroller that is the same clipping problem.

**Tests:** the controller's browser tests, plus every focus and Escape recipe again.

**Visions:** none gained over A. It breaks 5 (a dependency the stack covers) and 1 (a second editor kind for a text box).

## 2. Option A in detail (what the briefs implement)

### 2.1 The word (rule 1) — core `mentionWordAt(text, caret)`

The function returns null unless all of these hold:

- Walk back from `caret` over word characters. The character reached is `@`, at index `start`.
- The character before `start` is absent (the text's start), whitespace (`/\s/u`: space, tab, line break) or one of `( [ {`.
- Word characters are, by code point, `\p{L}`, `\p{N}`, `_`, `.` and `-`.
  - These are GitLab's username characters (letters, digits, `_ . -`) widened to every letter, so a typed name with an accent (`@zoë`) keeps the list open. Rule 2 matches names too.
  - Decided here (vision 1: what the user sees). Plan row #192.

When it holds:

- `typed = text.slice(start + 1, caret)`.
- `end` = `caret` plus the run of word characters after it. A caret in the middle of `@an|na` gives `typed "an"` and `end` after `na`.

Behaviour that follows from these rules:

- `a@b.c` → null (a letter before the `@`).
- `@@a` → null (an `@` before the `@`).
- `x @` → `{ start: 2, end: 3, typed: "" }`.
- A space typed after the word closes the list, since the caret is no longer in a word.

The ui's `mentionRead({ text, selectionStart, selectionEnd, composing }, dismissed)` adds three closing cases, each returning null:

1. A composition is running (rule 3, IME).
2. The selection is not collapsed.
3. The word's `start` equals `dismissed`. Escape dismissed this word, and it stays closed until the caret leaves it or a new `@` starts. This is a #192 default, and it is also what makes the second Escape reach the field.

### 2.2 The order (rule 2) — core `mentionLines(known, found, typed)`

**Matching.**

- `q = typed.toLowerCase()`.
- A person's key is `name` with all whitespace removed, lower-cased, plus a space, plus `username` lower-cased (GitLab's `"<NameWithoutSpaces> <username>"`).
- **Starts:** either term starts with `q`. **Contains:** the key includes `q`. Otherwise no match.

**Result.**

1. `known` matches: starts before contains. The order inside each group is kept.
2. Then `found` matches, ranked the same way.
3. Each `username` appears once (the first wins), and the list is cut at `MENTION_LINES` (10).

A blank `typed` keeps every known person and no found one, so a bare `@` lists the merge request's people.

`choices.ts` `narrowed` is not reused. It matches a label by containment only, which is a different rule.

**Search results are matched again.** GitLab's own list does the same (`Members.sort` filters by includes, facts §4). A person found only by public email is therefore dropped. Plan row #192 records this.

**Who is known** — core `knownMentions(row, writers)`:

- `peopleOnRow(row)` (exported from `suggestions.ts`, shared, never copied), then the non-null `writers`.
- Each username once, in that order. A null `row` gives the writers only.
- The viewer is listed like anyone else (rule 2 names no exception; #192).

The fields feed it as follows:

- **Reply field.** The row is `rows.find(row => row.iid === thread.shown.iid) ?? null` (approvers here are `approvedBy`, who approved). The writers are `comments.map(c => c.author)` of the loaded thread, or `[]` while it loads.
- **Post box.** The row is `rangeGitLab.ts` `linedUpRow(check, rows)`: when `check` is `linedUp`, the first row whose `page === check.mergeRequest.webUrl`, else null. The writers are `[]`, since range threads are local notes.

### 2.3 The search (rule 2 second half, rule 6) — question 1

`createPeopleSearch(source): PeopleSearcher` is `searchOf` lifted out of `createPeopleChanges` (`mergeRequestPeople.ts:96-130`):

- the 250 ms pause;
- `searchedText`;
- an empty text is `empty` at once, with no call;
- a stale answer is dropped by its own `calls` counter.

It gains one rule: `search(typed)` whose `searchedText` equals the current state's `text` while the state is `searching` or `found` does nothing. A caret moved inside the same word, or the people box's same text, never restarts the pause or asks again. A `refused` or `failed` text asks again.

The slice carries `peopleSearch: PeopleSearcher`, with `searchPeople`/`endPeopleSearch` removed and their three callers migrated (clean cutover), and a new `mentionSearch: PeopleSearcher` created beside it in `mergeRequests.ts`.

**Why two instances, not one keyed search:**

- Each user's state is one `ShallowRef` with one writer set, and the type has no consumer key to get wrong.
- A keyed map would add a key, a map and an "is this mine" read to both users for nothing. Only one mention field has focus at a time: blur closes and `end()`s before the next field's focus.

**Why no new Rust command:**

- `search_people` asks `autocompleteUsers`, which searches the same `project.authorized_users` as GitLab's own `@` backend (facts §4, `mr-people-design.md:31-33`). It returns 20, and the list shows 10.
- What GitLab adds is participants first, and rule 2 supplies those from the slice (§2.2).
- GitLab's `autocomplete_sources/members` is a web route, not `/api/v4`. Reaching it through `glab api` is unverified (facts §4).
- Before 16.3 the search fails, and rule 5 covers that case.

### 2.4 The list's content (rules 2, 5) — `mentionList({ known, typed, search, platform })`

- `found` is `search.people` for `searching`/`found`, else `[]`.
- `note` is `peopleSearchText(search, platform)` for `refused`/`failed` (the people box's words, rule 5), else null.
- `lines` is `mentionLines(known, found, typed)` as `{ username, picture: person, label: displayName(person) }`.
- The result is **null (closed)** when there are no lines and no note. "Searching…" and "No one found" are not drawn: the list shows people or the reason the search is missing, and nothing else (#192).

Each line is drawn as in the people box: `MergeRequestPicture size="box"`, the name, a muted `@username`. The note is a muted `role="status"` line under the lines (rule 5 says muted; the people box draws it as an error).

Pictures come only from rows, threads and searches, all of which Rust offered (RK53).

### 2.5 Placing the list under the caret — question 4

**Caret measure** (`textareaCaret.ts` `caretBox(field, index)`): the mirror-div method, with no library.

1. Append a `div` to `document.body` with `position: absolute; visibility: hidden; top: 0; left: -9999px`.
2. Give it `mirrorStyle(getComputedStyle(field), field.clientWidth)`. This copies `direction`, `boxSizing` (set to `content-box`), padding, every `font*`, `lineHeight`, `letterSpacing`, `wordSpacing`, `tabSize`, `textIndent`, `textTransform`, `textAlign`. It sets `whiteSpace: pre-wrap` and `overflowWrap: break-word`. Its `width` is `clientWidth − paddingLeft − paddingRight` px, so a shown scrollbar's width is excluded.
3. Put `value.slice(0, index)` in it as a text node, then a `span` holding `value.slice(index) || "."`.
4. Read the span:
   - `left = span.offsetLeft + borderLeftWidth − field.scrollLeft`
   - `top = span.offsetTop + borderTopWidth − field.scrollTop`
   - `bottom = top + span.offsetHeight`
5. Remove the div.

The list is anchored at the `@` (`word.start`), not the moving caret, so it stays still while typing (#192).

**Room** (`visibleRoom(element)`): the viewport intersected with the border box of every ancestor whose computed `overflow-x` or `overflow-y` is not `visible`. In the thread panel this is the panel (`overflow-hidden`). In the range window it is the CodeMirror scroller.

**Placement:** pure `mentionPlace({ caret, field, room }, list: Size)`.

- **Below** at `caret.bottom` when the list's height fits under it inside the room.
- **Otherwise above**, at `caret.top − height`, when it fits there.
- **Otherwise** on the side with more room, with `maxHeight` set to that room (the list scrolls; the active option scrolls into view as in the people box, `MergeRequestPeopleSearch.vue:48-56`).
- `left = caret.left`, clamped so the list's right edge stays inside the room and its left edge never leaves it.

**DOM.**

- The list is an **absolute child of a `relative` wrapper around the textarea**, `z-10`. This means:
  - the list scrolls with the field's box in the CodeMirror pane with no scroll listener (plan §2 #51 keeps scroll paths free of layout reads);
  - the pointer on the list stays inside the panel's and the box's hover areas (RK73);
  - nothing is teleported.
- The composable measures `caret`, `field` and `room` after Vue's post flush (`nextTick`, so the reply field's `fit` has run), on every read that leaves the list open, and on the field's own `scroll`.
- The list measures its own size (`useElementSize`, as `usePlacement` does) and places itself.

**Engine of record.** WebKitGTK is checked in the WebKit smoke (`read` of the list's rect against the field's line metrics). The pure parts are in the gate.

### 2.6 Keys and focus — question 5

`mentionKey(event, list)` returns null when the list is closed, while `isComposing`, or with any of Ctrl/Meta/Alt/Shift. Otherwise:

| key                                  | result                    |
| ------------------------------------ | ------------------------- |
| `Escape`                             | `close`                   |
| `ArrowDown`/`ArrowUp`, lines present | `step ±1` (`ARROW_STEPS`) |
| `Enter`/`Tab`, lines present         | `pick`                    |
| anything else                        | null                      |

Consequences: Ctrl+Enter still reaches `boxKeydown` and sends. Shift+Enter writes a line break. Shift+Tab moves focus, and the blur closes the list.

**Order in each field.** The field's own `keydown` calls `mentions.keydown(event)` first. A taken key is `preventDefault` + `stopPropagation`, and `boxKeydown` is skipped. So the taken key reaches neither `boxKeydown`, nor the panel element's listener (it stops bubbling), nor the window listener (it checks `defaultPrevented`, `MergeRequestThread.vue:110`), nor RangeApp's window keys or CodeMirror (RK35).

**Escape sequence.** The first Escape closes the list (the word is dismissed). The next Escape is the field's as today: it closes the panel, or cancels the Post box.

**Highlight.**

- The first line is highlighted when the list opens.
- `highlightAfter(before, after, current)` keeps the index while the usernames are the same, else 0.
- The wrap is `menuKeys.ts`'s rule, extracted as `wrappedIndex(count, index, step)` from `stepMenuItem` (its two users).

**Clicks.** Options have `@mousedown.prevent` (focus stays in the field) and `@click` pick.

**Closing.** The composable closes (`end()`s the mention search) on:

- `blur`;
- a read with no word;
- `close()`, which the reply field calls on Preview and on a send (Add comment, Add review, Mod-Enter), and the Post box on Queue.

The composable reads the field on `input` (skipped while composing), `click`, `keyup`, `focus` and `compositionend`. `compositionstart`/`compositionend` hold the composing flag.

**ARIA.** The textarea keeps its role (textbox) and gets `aria-autocomplete="list"`. While the list is open it also gets `aria-controls` (the listbox id) and `aria-activedescendant` (WAI-ARIA 1.2 allows both on `textbox`). The list is `role="listbox"` with the label "People to mention", and each option is `role="option"` with `aria-selected`.

### 2.7 Writing the pick (rule 4) — question 6

`pick(index)` runs these steps:

1. `const edit = mentionEdit(word, line.username)`, which is `{ from: word.start, to: word.end, insert: "@" + username + " " }`.
2. `field.focus()`.
3. `field.setSelectionRange(edit.from, edit.to)`.
4. `document.execCommand("insertText", false, edit.insert)`.

What follows from this:

- The browser fires `input`, so `v-model`/`setReplyText` and `@input`/`writePost` remain the one writer of each text.
- The caret lands after the space.
- The next read finds no word, so the list closes and the search ends.

This is the call `linuxPaste.ts:81` already uses.

**Measured step (the list slice, before anything else ships).** In the WebKit fixture (MiniBrowser on the system WebKitGTK, the engine of record):

1. Type `@an`.
2. Down, then Enter → `@anna `.
3. Ctrl+Z → `@an`, with the caret after it.

Paste the `read` values.

**If the undo does not restore `@an` in one step**, or `execCommand` returns false: ship `field.setRangeText(edit.insert, edit.from, edit.to, "end")` followed by `field.dispatchEvent(new Event("input", { bubbles: true }))`, and report the measurement in `open_risks`. Rule 4 says "when the browser allows". Exactly one path ships, the measured one.

### 2.8 Fixtures and logs — question 7

- No new search log: every search already logs `mergeRequests.fixture_people_search {"text":…}` in both windows (§0). A bare `@` logs nothing, because no call is made.
- **Range fixture:** a new GitLab script `?gitlab=listed`. It lines the range up with the `?mr=list` row !640: `reference "!640"`, the row's title, and `web_url` = the row's `page`, all from `fixtureRows`, which stays the one source. `pendingPosting` links follow the script's merge request. With `--mr list --open-mr` the Post box then knows !640's people, and the WebKit run proves the loaded-row path. Without it the Post box shows search results only.
- **Real app:** `tests/glab/mr-threads/graphql-people-an.json` (anna, as `mr-threads/`'s people) is added, so the reply field's search answers on the fake glab. Every call is already logged as an `argv:` line.

### 2.9 What the user sees, in short

- `@` at a word start → the merge request's people, at once, no call.
- More letters → those people filtered, then GitLab's matches after 250 ms. At most 10 lines.
- Up/Down move, Enter/Tab/click write `@username `, Escape closes only the list.
- If GitLab cannot search, the known people stay, with one muted line saying why.

## 3. Decision record (proposed rows; the orchestrator records them, DR5)

**#191 — `@` completion in the reply field and the range window's Post box is yamt's own list over the textareas** (owner 2026-11-05; request `docs/slices/request-mr-mentions.md` rules 1–7; design `briefs/mr-mentions-design.md` option A; reopens `request-mr-threads.md` non-goal "`@` completion"; amends #169, #183, #185, #189, #118).

- **Core** `mergeRequests/internal/mentions.ts`: `mentionWordAt`, `knownMentions`, `mentionLines` (known before found, starts before contains on `"<NameWithoutSpaces> <username>"`, each once, ≤ `MENTION_LINES` 10, GitLab's `limit`), `mentionEdit` (`@username `).
- **Search:** `createPeopleSearch(source)` instantiated twice per slice, `peopleSearch` (people box) and `mentionSearch`. Each has its own pause and stale-answer counter, so neither changes the other (rule 6). The same text again asks nothing. No new command: `autocompleteUsers` covers GitLab's `@` member set.
- **List:** `MergeRequestMentionList.vue`, an absolute child of a wrapper around the field, under the `@`'s caret line (mirror measure `textareaCaret.ts`). It flips above or caps its height inside the nearest clipping ancestor and the viewport.
- **Keys:** taken by `useMentions` before `boxKeydown` and the panel's Escape listeners, while open: Up/Down, Enter/Tab, Escape. Any modifier passes.
- **Writing:** `execCommand("insertText")` over the word, so the field's input handler stays the one writer.
- **Post box people:** the loaded row whose `page` is the lined-up `webUrl`, else none.

Rejected:

- CodeMirror fields with `@codemirror/autocomplete`: a dependency (DR3), the bundle rejection (`plan.md:407-409`), a second editor seam and the Markdown-editor non-goal, for a people list.
- The lined-up merge request's people over IPC (option B): a Rust, picture-offer and bindings path for people the search finds one key later.
- GitLab's `autocomplete_sources/members` via `glab api`: a web route, not v4, unverified.
- One window search shared by both users: breaks rule 6.
- A search keyed by consumer: a key and a map for two users that never search at once.
- The list teleported to `body`: leaves the hover areas (RK73) and needs scroll listeners (#51).
- The list under the field instead of the caret: the owner asked for "under the caret".
- `setRangeText` as the first choice: no native undo.

Visions 1, 2, 3, 4, 5.

**#192 — Defaults decided with the mentions design** (orchestrator, OR13; the owner may veto):

- Word characters are letters of any script, digits, `_ . -`. A word starts after whitespace or `( [ {`.
- A caret in the middle of a word searches the text before it, and the pick replaces the whole word.
- Escape dismisses the list for that word until the caret leaves it.
- The list is anchored at the `@` and flips above when there is no room below.
- No "Searching…"/"No one found" line: an empty list closes.
- Search results are matched again by the same rule (an email-only match is dropped, as on GitLab).
- The viewer is listed like anyone else.
- In the Post box the merge request's people show only after the merge-request page has loaded in that window.

**Amended rows:**

- **#169:** "the window's one search" becomes "one search factory, two instances: the people box's `peopleSearch` and the mention list's `mentionSearch`"; the slice's `searchPeople`/`endPeopleSearch` become `peopleSearch.search`/`.end`.
- **#183, #185, #189 (Escape order, "no Escape leaves the page"):** an open mention list takes the first Escape in the reply field; the panel's rules apply from the next one.
- **#118:** the Post box's text may carry `@username` mentions. It is posted unchanged as a draft note.
  - GitLab notifies the mentioned person when the review is published, not at Send `[INFERENCE: GitLab creates a draft's note, and its mention to-dos, on publish]`.
  - The same holds for the reply field's "Add review".
- **Reopened non-goal:** `docs/slices/request-mr-threads.md:186-187` and `briefs/mr-threads-panel.md:34-35` ("`@` completion"). The rest of "a Markdown editor" stays a non-goal.

**Risk register (`skill://risk-register`):**

- **RK65 (amend).** Risk adds: "or one search's answer or end changes the other search's results". Owner adds `ui/mergeRequestPeople.ts` `createPeopleSearch` (one state per instance). Proving tests add `the_people_box_and_mention_searches_never_touch_each_other`, `the_same_text_again_asks_nothing`.
- **RK73 (amend).** Risk adds: "an Escape with the mention list open closes the panel". Owner adds `ui/mergeRequestMentions.ts` (`keydown` first, prevented and stopped). Proving tests add `an_open_list_takes_escape_enter_tab_and_arrows_only` and the WebKit step "Escape twice".
- **RK35 (amend).** Owner adds `ui/mergeRequestMentions.ts`. Proving adds the WebKit Post-box step (the keys taken by the list reach neither the pane nor the window).
- **RK76 (new).**
  - **Risk:** a pick writes the wrong text: it replaces text outside the `@` word, keeps the rest of the word, writes no space or two, leaves the caret elsewhere, or bypasses the field's writer. Or the list opens inside an address or a word (`a@b.c`, `x@y`), or an IME composition opens or drives it.
  - **Owner:** core `mergeRequests/internal/mentions.ts` (`mentionWordAt`, `mentionEdit`) + `ui/mergeRequestMentionLines.ts` (`mentionRead`, `mentionKey`) + `ui/mergeRequestMentions.ts` (`pick`).
  - **Proving tests:** `an_at_after_a_letter_starts_no_word`, `a_caret_inside_the_word_searches_the_text_before_it`, `the_pick_replaces_the_whole_word_and_adds_one_space`, `a_composition_never_opens_the_list`, and the WebKit steps "Down + Enter" and "Ctrl+Z".
- **RK53, RK54:** unchanged, and the slices name them. The search writes nothing. Every picture shown was offered.

**Docs keeper (once, after `mr-mentions-post`):**

- `skill://project-map` `tree.md`: the four new `ui/` files and core `mentions.ts`.
- `state.md`: `mentionSearch` (owner the slice `ui/mergeRequests.ts`, writer `useMentions`), and `peopleSearch`'s new shape.
- `docs/architecture.md`: the merge-request page's people section.
- `CHANGELOG.md`.

## 4. Slices (option A)

| slice                | owns (summary)                                                                                                                                                                                                    | needs                                                        | wires                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `mr-mentions-core`   | core `mentions.ts` + test, `suggestions.ts` export, `index.ts`, `mergeRequests/AGENTS.md`                                                                                                                         | —                                                            | —                                                                               |
| `mr-mentions-search` | `mergeRequestPeople.ts`, `mergeRequests.ts` + tests, `MergeRequestPeople.vue`, `MergeRequestPeopleSearch.vue`                                                                                                     | —                                                            | —                                                                               |
| `mr-mentions-list`   | the four new `ui/` files + tests, `menuKeys.ts`, `mergeRequestsText.ts`, `MergeRequestReplyField.vue`, the panel SSR test, `ui/AGENTS.md`, `tests/glab/mr-threads/graphql-people-an.json`, `tests/glab/README.md` | core, search                                                 | the reply field in the compare window and the range window's merge-request page |
| `mr-mentions-post`   | `RangeMessageEditor.vue`, `rangeGitLab.ts` + test, `fixtureGitLab.ts` + test, `fixtureReview.ts` + test, `fixtureThreads.ts`, `ipc/AGENTS.md`                                                                     | list                                                         | the range window's Post box                                                     |
| `mr-mentions-verify` | none (read-only)                                                                                                                                                                                                  | smoke after list and after post; final after the docs keeper | —                                                                               |

`core` and `search` run in parallel. `list` follows both. `post` follows `list`.

## 5. Consequences the owner will notice

- In the range window's "Text to post", a bare `@` lists the merge request's people only after the merge-request page has loaded in that window. Before that, typing letters finds people through GitLab's search. Option B would remove that wait at the price of a Rust path. This is open question 1.
- A mention written in "Text to post" or with "Add review" reaches the person when the review is published on GitLab, not when yamt sends it `[INFERENCE]`. "Add comment" notifies at once.
- On GitLab before 16.3 the list still offers the merge request's people. Search results are replaced by the people box's sentence.
