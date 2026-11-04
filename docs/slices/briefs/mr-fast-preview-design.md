# An instant comment preview when yamt can render it, and GitLab's login and project asked once — design

Request: `docs/slices/request-mr-fast-preview.md` (parts A and B settled by the owner, #2419–#2422; this design closes its
"To be measured" list and refines only details marked "(orchestrator)" or named below as a refinement). Base
`49b7912c`. Earlier designs reused, not reopened: `briefs/mr-threads-design.md` (the preview command, the thread panel;
its §1.3 rejection of yamt's subset is reopened only within A2/A3) and `briefs/mr-description-design.md` (the
`Description` reducer and its renderers, §1.7 code colours).

GitLab's rendering is the orchestrator's recording: `.omp/run/notes/PlanFastPreviewCorpus.md` (observations) and
`.omp/run/notes/PlanFastPreviewCorpus.json` (62 named text → html pairs, the JSON's keys; the notes' "66 texts" counts
`h2_h6`'s five headings apart), `POST /markdown` with `gfm: true` and project `samubr/glab-yamt-playground` on
gitlab.com. An entry is cited as `corpus:<name>`.

Facts are cited `file:line` at the base; `[INFERENCE]` marks what no file or measurement shows. A fact still missing
is a measurement step in the brief that needs it, with its command.

## 1. The request's "to be measured", closed

### 1.1 A — what yamt's subset gives, against GitLab's recorded answer

**How the comparison is made.** Both sides end as `Description` blocks (`description.rs:45-244`): GitLab's answer goes
through the one reducer `described` (`description/html.rs:65-92`) as every preview does (`markdown_preview.rs:115-118`);
the local side is yamt's parser (`editor/internal/markdownBlocks.ts:273`, `markdownInline.ts:226`) turned into the same
blocks. "The same blocks" means equal after one normalisation that changes nothing a reader sees: the renderers draw
text by interpolation in normal white-space flow (`ui/MergeRequestDescriptionInlines.vue:29`; the preview box
`ui/MergeRequestReplyField.vue:192-202` and a comment `ui/MergeRequestThreadComment.vue:50-52` set no `pre`), so
adjacent texts merge, white-space runs read as one space, and white space at a block's edges or beside a line break
disappears. Without it GitLab's `"one\n"` before a nested list (`corpus:nested_list`) or `"\nline two"` after a `<br>`
(`corpus:hard_break_spaces`) would differ from an identical drawing.

**Constructs that match** (verdict `local` in the fixture; the corpus test proves each):

| construct                                  | GitLab's answer, reduced                                                                                                                                                                                 | yamt's subset                                                                                                             | entries                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| paragraphs, soft break                     | `Paragraph`; a soft break stays `\n` in the text (`corpus:soft_break`)                                                                                                                                   | paragraph lines joined by `\n` (`markdownBlocks.ts:232-240`), `\n` kept as text (`markdownInline.ts:178-179`)             | paragraph, two_paragraphs, soft_break, trailing_spaces_para                               |
| hard break, two spaces                     | `LineBreak` (`html.rs:223`)                                                                                                                                                                              | `break` (`markdownInline.ts:84-90`)                                                                                       | hard_break_spaces                                                                         |
| emphasis, strong, `***x***`, intraword `_` | `Emphasis`/`Strong`, `***` → `<em><strong>`, `snake_case` plain                                                                                                                                          | CommonMark delimiter runs (`markdownTree.ts:55-125`), in the stricter flanking mode §1.2 adds                             | emphasis_star, emphasis_underscore, strong, strong_em, intraword_underscore               |
| strikethrough `~~`                         | `Strike` (`<del>`)                                                                                                                                                                                       | `~~` runs only (`markdownTree.ts:44`, `markdownInline.ts:188-195`)                                                        | strike                                                                                    |
| inline code                                | `Code` (`html.rs:220-222`)                                                                                                                                                                               | code spans, one padding space stripped (`markdownInline.ts:62-74`)                                                        | inline_code, inline_code_backticks                                                        |
| fenced code                                | `Code { language: data-canonical-lang, text }` — `ts` stays `"ts"` (`corpus:fenced_ts`), none → `null` (`element.rs:12-20`); Rouge's token spans are dropped by `plain_text` (`html.rs:170`, `:293-302`) | `code { info, code }` (`markdownBlocks.ts:79-94`)                                                                         | fenced_plain, fenced_rust, fenced_ts, fenced_tilde                                        |
| headings, anchors, duplicates              | `Heading { level, inlines }`; the empty anchor `<a class="anchor">` is dropped (`html.rs:242`) so ids and `-1` suffixes never reach the blocks                                                           | ATX headings, closing `#`s stripped (`markdownBlocks.ts:96-113`)                                                          | h1, h2_h6, heading_formatting, heading_duplicate                                          |
| lists, nested, loose, `start`              | `List { numbering, items }`; a tight `<li>one</li>` and a loose `<li><p>one</p></li>` both reduce to one `Paragraph` (`html.rs:124-158`); `start="3"` → `start: 3` (`element.rs:23-30`)                  | `-`/`*` and `N.` items, nesting by column (`markdownBlocks.ts:130-230`)                                                   | bullet_dash, bullet_star, ordered, ordered_start, nested_list, loose_list, list_with_para |
| quotes, nested, with lists                 | `Quote { blocks }`                                                                                                                                                                                       | `markdownBlocks.ts:162-179`                                                                                               | quote, quote_nested, quote_with_list                                                      |
| tables, inline cells                       | `Table { head, body }`, `th` → `header`                                                                                                                                                                  | `markdownTable.ts:37-46`                                                                                                  | table, table_inline                                                                       |
| table alignment                            | **every cell `start`**: GitLab writes `align="center"` (`corpus:table_align`) and the reducer reads only `style="text-align: …"` (`element.rs:72-78`)                                                    | the subset parses `:---:` (`markdownTable.ts:10-31`); the local blocks must say `start` too to look like GitLab's preview | table_align                                                                               |
| rules `---` `***` `___`                    | `Rule`                                                                                                                                                                                                   | `markdownBlocks.ts:35`, `:115-117`                                                                                        | rule_dash, rule_star, rule_underscore                                                     |
| plain punctuation                          | `C#`, `# alone`, `100%`, `10:30`, `Great!`, straight quotes, `--`, `...` stay text (no smart punctuation)                                                                                                | literal text                                                                                                              | hash_no_ref, percent_number, colon_words, exclaim, smart_quotes, hex_word_plain           |
| a mixed comment                            | heading, strong, code, list, quote, fence                                                                                                                                                                |                                                                                                                           | mixed_doc                                                                                 |

That is 44 of the 62 entries. **Code colours match by construction**: both paths' `Code { language, text }` reach the same
`MergeRequestDescriptionCode.vue` → `MarkdownView.showCode` → `languageNamed` and the panes' highlighters
(`editor/markdown.ts:44-55`, `mr-description-design.md` §1.7); GitLab's own Rouge colours never reach the window. So no
construct is a trigger for its colours — only a language string that could differ (§1.2 K1).

**Constructs that do not match** (verdict GitLab):

- **Setext headings** (`corpus:setext`): GitLab `h1`/`h2`; the subset has no setext rule, `Sub\n---` becomes a paragraph
  and a rule.
- **Indented code** (`corpus:indented_code`): GitLab a `Code` block; the subset trims the indent into a paragraph
  (`markdownBlocks.ts:232-240`).
- **`1)` lists** (`corpus:ordered_paren`): GitLab `<ol>`; the subset's item marker is `[-*]|\d{1,9}\.` only
  (`markdownBlocks.ts:37`).
- **Emphasis next to punctuation, in a few configurations**: the subset's flanking test ignores punctuation
  (`markdownInline.ts:127-140`: `canOpen` is "not followed by space"), so `a**"b"**` is strong in yamt and literal in
  CommonMark §6.2. §1.2 adds the CommonMark rule as a second mode of the same parser; the AI chat keeps its mode (A4).
- Everything A2 and the corpus name (§1.2).

**Not recorded yet, recorded by the corpus slice** (`mr-fast-preview-corpus.md`, with its command): references and
emoji inside code (the code exemption below rests on GitLab linking nothing in code — RK71 already treats "a code span
… counted as a mention" as a failure, `skill://risk-register` — recorded here, not assumed), a fence holding reference-like
text, closing `#`s, mixed bullet characters, a short table row, a table right after a paragraph line, lazy quote and
list lines, numbered items with paragraphs, emphasis beside punctuation, a fence with blank edges, an upper-case or
multi-word info string, a single `~`, a quick action, an ordered start written `010`. Their verdicts are in that brief;
two are decided by the recording (table after a paragraph; code exemption).

### 1.2 A — the trigger list and its one owner

**One owner:** `editor/internal/localPreview.ts` `localPreview(text): Description | null` — null means "GitLab must
render it". It parses with yamt's subset, checks every rule below, and builds the blocks; the panel asks it before
anything else (§1.3). No other file decides local or GitLab: the fixture does not imitate it, Rust does not see it.

A text goes to GitLab when any of these holds (A2's list first, then what the corpus and the parser comparison add):

**C — characters outside code** (counted in each paragraph's, heading's and cell's inline source minus the text of its
code spans: more in the source than in the code means one is outside; code spans copy their content verbatim,
`markdownInline.ts:62-74`):

- C1 `\` — a backslash escape or a trailing-backslash break (A2; `corpus:hard_break_backslash`).
- C2 `[` — a link, image `![`, footnote `[^`, task box `[ ]`, reference definition, `[[_TOC_]]`, alert `> [!note]`, inline
  diff `[- -]` (A2; `corpus:link`, `corpus:task`). Counted in the source because the subset turns `![a](b)` into the
  text `a (b)` (`markdownInline.ts:213-217`), which no text check would see.
- C3 `<` — raw HTML, comments, autolinks `<scheme:…>` (the subset strips the brackets, `markdownInline.ts:92-95`) (A2;
  `corpus:html`). This sends `a < b` to GitLab too (`corpus:ampersand`): the cautious reading of A2's "raw HTML (`<`)".
- C4 `{` — attribute lists, inline diff `{+ +}` (A2).
- C5 `$` — math `$…$`, ``$`…`$`` (`corpus:math_inline`), snippet references `$12` (A2: "`$` followed by a word or a
  number"; GitLab kept `$5` plain only because no snippet 5 exists, `corpus:dollar_word`).

**T — in a parsed text inline** (after parsing, so `#` of a heading marker, `~~` and `**` runs already consumed; code
inlines are never checked):

- T1 `#`, `!`, `&`, `%`, `@` followed by a letter, digit, `_`, `"` or (for `&`) `#` — issue, merge request, epic,
  milestone, mention, e-mail, entity (A2; `corpus:ref_issue`, `corpus:mention`, `corpus:entity`). `C#`, `# alone`,
  `100%`, `Great!` stay local (`corpus:hash_no_ref`, `percent_number`, `exclaim`).
- T2 any `~` left in text — labels `~bug`, `~"x"`, and a single-tilde strike the subset does not draw (A2).
- T3 an emoji code `:[A-Za-z0-9_+-]+:` (A2; `corpus:emoji`); `note: 10:30` stays local (`corpus:colon_words`).
- T4 a pictograph: a character of `\p{Extended_Pictographic}` or `\p{Regional_Indicator}`, U+FE0F, U+20E3 — GitLab wraps
  a literal 😀 in `<gl-emoji>` (`corpus:unicode`; the corpus adds this to A2).
- T5 a web address: `<scheme>://`, `www.` (any case), `mailto:`, `xmpp:` (A2; `corpus:url`).
- T6 a hexadecimal word of 7 to 40 characters (A2; `corpus:hex_short`: `deadbeef` and `abc1234` would link to commits
  that exist).
- T7 a link inline (the subset's `[x](y)`; C2 catches it first).

**S — lines outside fenced code** (`fencedLines`, §1.2's one fence rule, so code keeps its indentation and tabs):

- S1 a line of only `=` or only `-` (≤ 3 spaces before) right after a non-blank line — a setext heading (`corpus:setext`).
- S2 a line indented 4 or more columns that is the first line or follows a blank line — indented code
  (`corpus:indented_code`); nested lists at 2 and 3 columns stay local (`corpus:nested_list`).
- S3 a `1)` item marker (`corpus:ordered_paren`). S4 a `+` bullet. S5 both `-` and `*` bullets in one text (CommonMark
  starts a new list; the subset continues one, `markdownBlocks.ts:224`; recorded as `mixed_bullets`). S15 an item marker
  with nothing after it.
- S6 a line starting `>>>` (GitLab's multi-line quote). S7 a first line of `---`, `+++` or `;;;` (front matter). S8 a line
  starting `: ` (description lists). S14 a line starting `/` and a letter (a quick action).
- S9 a tab or a NUL anywhere outside fenced code (tab stops and U+0000 replacement are where parsers differ most).
- S12 a table whose header line follows a non-blank line — **only if** the corpus slice records that GitLab's answer for
  `table_after_paragraph` differs from the subset's paragraph-then-table (`markdownBlocks.ts:158-160`).
- S13 a fence whose info string has more than one word (`rust ignore`).

**K — fenced code** (the converter):

- K1 a language other than none, unless it is lower-case `[a-z0-9_+-]+`, a language yamt colours (`languageNamed`,
  `editor/internal/language.ts:19-21`, the same test that colours it) and not one GitLab draws: `mermaid`, `plantuml`,
  `math`, `suggestion`, `geojson`, `topojson`, `stl` and Kroki's diagram names (A2; `corpus:fenced_mermaid`;
  docs.gitlab.com "Diagrams and flowcharts", "Math", "GeoJSON", "STL" `[INFERENCE: list from GitLab's documentation,
  pinned by a test that each name goes to GitLab]`). Upper case is GitLab's (`data-canonical-lang` for `TS` is not
  recorded; recorded as `code_language_upper`).
- K3 a code block whose first or last line is blank (GitLab's per-line spans and the reducer's one-`\n` strip,
  `element.rs:18`, may differ; recorded as `fence_blank_edges`).

**N — nesting:** a block or inline 15 deep (the subset stops nesting at 16, `markdownTree.ts:43`,
`markdownBlocks.ts:243`; the reducer at 32, `html.rs:18`).

**Code is exempt** from C and T (and fenced lines from S): GitLab's reference, emoji and link filters skip code
(RK71; recorded as `code_hides_refs`, `fence_hides_refs`). If the recording shows a link or `<gl-emoji>` inside code,
the exemption goes and C/T count code too (the local brief says so).

**Doubt rule kept:** every rule errs toward GitLab; a missed rule shows text plainly that GitLab would draw (owner #2421),
an extra rule costs one 0.65 s call (`request` §"Measured": `glab api markdown` 0.65–0.66 s).

### 1.3 A — where local rendering happens, and one preview state

**In the window, in `editor/`.** yamt's parser lives in `editor/internal/` (plan #112), which `ui/` may not import
(PM5); `editor/` already imports `ipc` types (`editor/internal/apply.ts:13`) and exports non-view names to `ui/`
(`editor/index.ts:1-18`; the Markdown fence forbids only `MarkdownView` outside `useMarkdown.ts`,
`frontend/scripts/markdownFence.ts:33-47`). So `editor/index.ts` exports `localPreview`; `ui/mergeRequestPreview.ts`
calls it. A Rust home is option B (§2).

**One preview state.** `ui/mergeRequestPreview.ts` `Preview` (`:10-19`) is unchanged: a local rendering is the same
`{ kind: "read", preview }` GitLab's answer becomes (`:36-38`). `mergeRequestThread.ts` `preview` (`:197-214`) gains one
step between the blank check and `loading`: `previewHere(iid, text)` → a read at once, no call, no `loading`, so the
reply field never draws "Loading…" (`MergeRequestReplyField.vue:80-99`). The stale-answer guard (`:211`) is untouched:
a local read never awaits. A2's switch (typing `#12`) is the existing GitLab path.

**The fixture** keeps its `previewMarkdown` (`ipc/fixtureMergeRequestThreads.ts:212-216`) for GitLab-bound texts; a
plain text never reaches it, which is the acceptance's "no `fixture_preview`". Its "fail" texts now need a trigger to
reach it (`fail #1`).

### 1.4 B — the remembered login and project

- **Home: the crate's `GitLabRepository`** (`detect.rs:14-18`), one per app process: the shell builds it once from the
  window's folder (`src-tauri/src/merge_requests.rs:80-90`, `MergeRequestState.gitlab`) and passes it to every action.
  Its key is that instance: the repository root and its GitLab remotes, read once at start (`detect.rs:28-49`). The
  memory is a `Remembered` value (private `Mutex<Option<Project>>`) defined in `project.rs`, so only `project.rs` reads
  or writes it (vision 2); `Project` gains `Clone`.
- **Asked once:** `GitLabRepository::logged_in_project(glab)` replaces the free `logged_in_project(glab, root)`
  (`project.rs:39-49`): the remembered project, else today's `glab auth status` then `glab api projects/:fullpath`,
  remembered when found. The lock is held while asking: commands run on blocking threads at once
  (`merge_requests.rs:241`, `blocking_reply`), so the page's first loads ask once; a refusal is never remembered.
- **The 13 call sites** (the request's "15 callers" are its actions; grep `logged_in_project(` at the base):
  `description.rs:322`, `discussions.rs:223`, `job_log.rs:88`, `links.rs:177`, `list.rs:57`, `markdown_preview.rs:102`,
  `open.rs:63`, `people_change.rs:146`, `people_search.rs:83`, `rerequest.rs:117`, `resolve.rs:45`,
  `discussion_thread/read.rs:100`, `discussion_thread/write.rs:140`. Each becomes `repository.logged_in_project(glab)`;
  the free function goes (no second path).
- **What forgets** (`is_lost(words)`, `project.rs`):
  - glab's line for HTTP 401, ending `(HTTP 401)` — glab prints `glab: <message> (HTTP <code>)` for any HTTP error
    (`tests/glab/README.md:73-76`, measured); `tests/glab/mr-threads-refused/markdown.err` holds `glab: 401
    Unauthorized (HTTP 401)`; the exact 401 line from gitlab.com is measured by the remembered slice (M1–M2).
  - `404 Project Not Found` — measured (`tests/glab/README.md:73-75`).
  - `page.rs:19` `NO_PROJECT` — GraphQL's `project: null`, which is also what a private project looks like to a call
    without a valid login.
  - Not 403: GitLab answers 403 for an action this user may not take (a locked discussion's write, RK54's refusals,
    `ipc/fixtureMergeRequestThreads.ts:34`), while login and project still hold; a project the reader may not see
    answers 404 (RK69). A refinement of the request's "403": a 403 keeps the memory.
  - The `Refresh` button (`ask_gitlab_again`).
- **"Not logged in" detail after a forget:** one `glab auth status` right after the forgetting answer; logged out →
  `NotLoggedIn { detail }` with glab's first line exactly as today (`gitio/src/glab.rs:122-138`); logged in or failed →
  the action's own failure words as today. The call is never repeated (RK54: a write is one call per press). The next
  action asks both again because nothing is remembered.
- **Where each action applies it:** once, on the failure it is about to reply with: a read's `Failed { message }`
  words, a write's `HttpAnswer.glab_line` (`gitio/src/glab/http.rs:13-14`; `reason()` prefers GitLab's body
  message, which lacks `(HTTP 401)`, `:39-45`). `logged_out_after(glab, words) -> Option<String>` returns the detail.
- **Refresh asks again:** a new command `ask_gitlab_again` (forgets; waits for a lookup in flight through the same lock),
  called by the page's `refresh` before it lists (`ui/mergeRequests.ts:285`). A parameter on `list_merge_requests` was
  rejected: every source and many tests call `listMergeRequests(onPage, onChecked)` (`ipc/MergeRequestSource.ts:34-37`),
  and only Refresh, not the list's first show or its 30 s stale reload (`ui/mergeRequests.ts:134-142`,
  `ui/glab.ts:3`), asks again (B1 keeps the list among the reusing actions).
- **What stays:** the range window's review send keeps its own check (another crate); pictures never asked the login.
- **A case B3 cannot cover without B1's cost:** glab without a token still calls GitLab anonymously
  (`tests/glab/README.md:67-70`, measured). After `glab auth logout` while yamt runs, reads of a **public** project
  answer what anyone may see; writes (401), a thread read (its draft notes need a login) and every read of a private
  project (`project: null` → forget → `glab auth status` → "not logged in") still fail with today's words. Open
  question 1.

## 2. Options

Part B is the same in every option (§1.4). The options differ in where the decision and the local rendering live.

### Option A — the window decides and draws, over yamt's subset (recommended)

**Data structures:** no new IPC type. `localPreview(text): Description | null` (the domain `Description`,
`ipc/descriptionDomain.ts:53`); the parser's `Flanking = "yamt" | "commonMark"` mode for `parseInline`; `fencedLines(text):
ReadonlySet<number>` from `markdownBlocks.ts` (the fence rule's one owner); the corpus fixture
`frontend/fixtures/markdown/gitlab-preview.json` (`{ recorded, entries: [{ name, text, html, local, blocks }] }`).
Rust: `Remembered`, `GitLabRepository::{logged_in_project, forget_project, logged_out_after}`, `ask_gitlab_again`.

**Files:** `editor/internal/localPreview.ts` (new), `markdownInline.ts`, `markdownBlocks.ts`, `editor/index.ts`;
`ui/mergeRequestPreview.ts`, `ui/mergeRequestThread.ts`, `ui/mergeRequests.ts`; `ipc/MergeRequestSource.ts`,
`tauriMergeRequests.ts`, `fixtureMergeRequests.ts`; the crate's `project.rs`, `detect.rs` and 13 callers; the fake glab;
`src-tauri/src/merge_requests.rs`, `commands.rs`; tests and the fixture.

**Risks:** a construct the corpus misses renders plainly where GitLab would draw (RK74 proposed, the doubt rules);
the subset is a second builder of `Description` (vision 2 tension) — bounded because GitLab stays the one source of
"what renders": the fixture's `blocks` are GitLab's answers through the one reducer (a Rust test), and the local
side must equal them (a TS test).

**Tests:** Rust `every_recorded_answer_reduces_to_its_blocks`; TS
`every_local_entry_of_gitlabs_corpus_renders_to_its_blocks`, `every_other_entry_of_the_corpus_goes_to_gitlab`,
`each_trigger_sends_the_text_to_gitlab`, `a_trigger_inside_code_stays_local`; the panel's
`a_plain_preview_is_read_at_once_without_a_call`; Rust against the fake glab `a_second_preview_thread_read_and_write_ask_glab_nothing`,
`a_401_forgets_and_answers_not_logged_in`, `refresh_asks_again`.

**Visions:** 1 (TypeScript the owner reads; one function decides), 3 (the corpus pinned on both sides), 4 (no flag
says "local": the state is the same read), 5 (no dependency, no IPC change for A).

**Cost:** about 1,300 changed lines over four implementer slices; the WebKit fixture exercises the real local path.

### Option B — Rust decides and draws with a Markdown crate through the one reducer

**Data structures:** `preview_markdown` checks the triggers in Rust; a safe text is rendered by `comrak` (GitLab's own
parser family, `[INFERENCE: GitLab's glfm_markdown gem wraps comrak]`) to HTML, then `described` — one reducer; the
reply unchanged.

**Files:** `markdown_preview.rs` (+ a trigger module), `Cargo.toml` (new dependency); the window unchanged.

**Risks:** the window still awaits an IPC reply, so "Loading…" shows unless the panel delays it (a timer the request
does not want); fixture mode cannot run Rust, so the fixture would imitate the decision (a second trigger owner) or
always log `fixture_preview`, failing the acceptance's WebKit line; a new dependency (DR3) and its licence review.

**Tests:** the same corpus, all in Rust.

**Visions:** 2 (one reducer), 3.

**Cost:** a dependency row (vision 5), a fixture stand-in, a "Loading…" flash or a timer.

### Option C — the window decides, Rust draws

**Data structures:** `localPreview`'s triggers in TS; a new command `render_markdown(text) -> Description` with `comrak` +
`described`; the panel calls it only for safe texts.

**Risks:** one decision split across two languages (TS says "safe", Rust must agree on what that means); the IPC hop
and the dependency of B; the fixture needs a stand-in renderer, so WebKit again never shows the real path.

**Visions:** 2 for the blocks, against 2 for the decision.

**Cost:** B's dependency plus A's trigger code plus a command.

## 3. Recommendation

**Option A.** The decision and the drawing both live beside yamt's parser in `editor/`; the panel asks them first and
GitLab only on null; GitLab's recorded answers, reduced by the one Rust reducer, are the fixture both languages test
against. Part B remembers the project in `GitLabRepository`, forgets it on a lost login, a missing project or
Refresh, and gets today's "not logged in" words from one `glab auth status` after the failure. It costs a second
builder of `Description` blocks (bounded by the corpus), a stricter flanking mode in the shared parser (the AI chat
keeps its mode), and the anonymous-read gap of open question 1.

### 3.1 Proposed plan §2 rows (DR5: the orchestrator records them; next free #186)

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rejected alternatives & why                                                                                                                                                                                                                                                                            | Vision  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 186 | **A comment's preview is yamt's own when it renders exactly as GitLab would** (owner #2420, #2421; request A1–A4; reopens #182 for those texts, #112's reach — yamt's subset now also builds `Description` blocks — and `mr-threads-design.md` §1.3). `editor/internal/localPreview.ts` `localPreview(text): Description \| null`, exported by `editor/index.ts`, is the one owner of the decision: yamt's subset parsed (`parseInline` in its `commonMark` flanking mode; the AI chat keeps `yamt`), every rule of design §1.2 (characters outside code, text triggers, line rules outside fences, fenced-code languages, nesting), then the blocks (cells always `start`, as GitLab's preview reduces today). The panel's `previewHere` asks it before GitLab; one `Preview` state. Pinned by `frontend/fixtures/markdown/gitlab-preview.json` (GitLab's recorded answers): Rust proves each reduces to its `blocks`, TS that each `local` text builds them and every other goes to GitLab. | Rust with `comrak` through the one reducer (a dependency; the window still waits for a reply, "Loading…"; fixture mode cannot run it); TS decides and Rust draws (one decision in two languages, the same dependency); a local preview replaced by GitLab's (owner #2421)                              | 1, 3, 5 |
| 187 | **GitLab's login and project are asked once per repository while yamt runs** (owner #2422; request B1–B3). `GitLabRepository` remembers the `Project` (`project.rs` `Remembered`, its only writer); `logged_in_project` asks `glab auth status` and `projects/:fullpath` only when nothing is remembered, holding the lock while asking. An action's failure words ending `(HTTP 401)`, holding `404 Project Not Found`, or `NO_PROJECT` forget it and run one `glab auth status`: logged out → "not logged in" with glab's first line, else today's words; the call is never repeated (RK54). The page's Refresh calls `ask_gitlab_again` first. A 403 keeps it.                                                                                                                                                                                                                                                                                                                             | The shell holding the project and passing it to 13 functions (a second owner of GitLab facts); a wrapper around glab calls (GraphQL's `project: null` is found after parsing, so a second path anyway); the list always asking again (B1 lists it among the reusing actions); a time limit (not asked) | 1, 2    |
| 188 | **Defaults decided with the fast-preview design** (orchestrator, OR13; the owner may veto): aligned table columns show left in a local preview, as GitLab's preview shows them today; `a < b`, `$5`, `Q&A`, tabs, `/` lines and mixed bullet characters go to GitLab; a 403 keeps the remembered project; Refresh asks again through its own command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                                                                                                      | 5       |

### 3.2 Risks for the register (next free id RK74)

| id   | risk                                                                                                                                                                                      | owner                                                  | proving test                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK74 | a local preview differs from GitLab's: a reference, mention, emoji, address, diagram, math or task box shown plain, or a block drawn otherwise; the AI chat's Markdown changes            | `editor/internal/localPreview.ts`, `markdownInline.ts` | `every_local_entry_of_gitlabs_corpus_renders_to_its_blocks`, `every_other_entry_of_the_corpus_goes_to_gitlab`, `each_trigger_sends_the_text_to_gitlab`, the subset's existing tests in `yamt` mode |
| RK75 | an action reuses a login or project GitLab said is gone, a forget repeats the failed call (a second write), "not logged in" turns into other words, or actions started together ask twice | `crates/merge-requests/src/project.rs`                 | `a_401_forgets_and_answers_not_logged_in`, `a_401_while_logged_in_keeps_todays_words`, `a_missing_project_forgets`, `two_actions_started_together_ask_once`                                        |

### 3.3 Shared edits

- **None to `Cargo.toml`, `package.json` or a lockfile** (option A adds no dependency).
- **After `mr-fast-preview-remembered`:** `just bindings` (the new `askGitlabAgain` command) before
  `mr-fast-preview-panel` starts.
- **Docs keeper, once per feature:** `docs/architecture.md` (§3 the remembered project and the forget rules; §4 the
  command `ask_gitlab_again` and the source method `askGitLabAgain`; the local preview), `skill://project-map`
  `tree.md` (`editor/internal/localPreview.ts`, `frontend/fixtures/markdown/`), `state.md` (the remembered project, its
  writer `project.rs`), `ipc-contract` (the command). `just map-check` (PM6) is red for the new command and file until
  then; the verifier's final pass runs after.
- **Orchestrator:** plan rows #186–#188 and RK74–RK75 above.

## 4. Decided without the owner (row #188; the owner may veto)

1. **Aligned table columns show left** in a local preview — that is what GitLab's preview shows in yamt today
   (`corpus:table_align` through `element.rs:72-78`). Fixing the reducer would change posted comments and descriptions
   (a non-goal); open question 2.
2. **Cautious characters:** any `<`, `$`, `{`, `[`, `\` outside code, any `~` left in text, `&`/`#`/`!`/`%`/`@` before a
   word, a tab — GitLab renders those texts (0.65 s), never a guess.
3. **A 403 keeps the remembered project** (§1.4).
4. **Refresh asks again through `ask_gitlab_again`**, not by changing the list command.

### 4.1 Open questions for the owner

1. **Logged out while yamt runs, on a public project.** If you log glab out in a terminal while yamt is open, the
   merge-request page of a **public** project keeps loading what anyone may see (no drafts) until you press Refresh;
   posting, a thread (it reads your drafts) and everything on a private project fail with "not logged in" as today.
   Accept that, or check the login before every read again (each read about 0.6 s slower, as before this feature)?
   Default built: accept (`mr-fast-preview-remembered` says so in its Target).
2. **Aligned table columns.** Columns aligned with `:---:` show left-aligned in yamt's previews today, and
   `[INFERENCE]` in posted comments and descriptions too, because GitLab now marks alignment in a form yamt's reader
   ignores (`element.rs:72-78` against `corpus:table_align`). Fix it as its own small change (comments and descriptions
   would then show the alignment GitLab shows), or leave it? The owner check's step 4 shows which.

## 5. Slice graph

At most two implementers at once.

| round | brief                                                                                                               | owner        | needs                        | beside                   |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------- | ------------------------ |
| 1     | `mr-fast-preview-corpus.md` — GitLab's answers recorded and pinned (fixture, Rust test, extra recordings)           | rust-impl    | —                            | remembered               |
| 1     | `mr-fast-preview-remembered.md` — the remembered login and project, 13 callers, `ask_gitlab_again`, fake glab       | rust-impl    | —                            | corpus, then local       |
| 2     | `mr-fast-preview-local.md` — `localPreview`, the flanking mode, `fencedLines`, the corpus and trigger tests         | web-impl     | corpus committed             | remembered               |
| —     | orchestrator: `just bindings`                                                                                       | orchestrator | remembered committed         | —                        |
| 3     | `mr-fast-preview-panel.md` — the panel's local read, Refresh's ask-again, sources and fixture; **wires the window** | web-impl     | local, remembered + bindings | —                        |
| 4     | docs keeper (architecture, project map, ipc-contract)                                                               | docs-keeper  | panel                        | verify smoke             |
| 4     | `mr-fast-preview-verify.md` — smoke after panel; final `just check`, WebKit, real app                               | verifier     | all above                    | docs keeper (smoke only) |
| 5     | owner check on the GitLab playground (in the verify brief)                                                          | human        | verify                       | —                        |

### Rule coverage

| request item                     | owning brief and acceptance                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 local when safe               | local: `every_local_entry_of_gitlabs_corpus_renders_to_its_blocks`; panel: `a_plain_preview_is_read_at_once_without_a_call`; verify B1                      |
| A2 GitLab whenever unsure        | local: `each_trigger_sends_the_text_to_gitlab`, `every_other_entry_of_the_corpus_goes_to_gitlab`; verify B3                                                 |
| A3 one look                      | corpus: `every_recorded_answer_reduces_to_its_blocks`; verify B4–B5, owner check                                                                            |
| A4 nothing else changes          | panel: the existing empty, Write and failure tests; local: the subset's existing tests in `yamt` mode                                                       |
| B1 asked once                    | remembered: `a_second_preview_thread_read_and_write_ask_glab_nothing`, `two_actions_started_together_ask_once`; verify C                                    |
| B2 forgotten when wrong, Refresh | remembered: `a_401_forgets_and_answers_not_logged_in`, `a_missing_project_forgets`, `refresh_asks_again`; panel: `refresh_asks_gitlab_again_before_listing` |
| B3 nothing else changes          | remembered: `a_401_while_logged_in_keeps_todays_words`, the existing logged-out tests                                                                       |
