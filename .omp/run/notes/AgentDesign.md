# 3.RV-agent — design of C's engine: the agent pipe, the window's agent client, the temporary checkout, the close question, settings, Markdown and edit diffs

I read the brief, the request (delivery C), `docs/plan.md` rows #57, #70, #94 and the rows around #93–#102, and the code of `crates/lsp-host`, `crates/settings`, `src-tauri` (`args.rs`, `window.rs`, `servers.rs`, `compare.rs`, `commands.rs`, `ipc_error.rs`) and `frontend/src/{lsp,ipc,ui,editor}`. I also read omp's ACP side. Every protocol fact below is either the orchestrator's measurement or cited to a file and line. Unmeasured points are marked `[INFERENCE]`.

The three options differ in where the code lives. Most rules about behaviour are the same in all three and are written out once under **Common answers**. Each option then states only what it does differently.

---

## Common answers (points 1–12, the same in every option unless the option says otherwise)

### 1. `--ai`
- **Parser (`args.rs`):** `--ai` is accepted with every mode and never stored. `Invocation::Range { repo, range, ai: Ai }` keeps it, where `enum Ai { Off, On }`. For `Merge`, `Compare`, `Help` and `Version` the parser accepts the flag and drops it. A test pins that.
- **How the page learns it:** `start_script(theme, kind, ai)` adds `document.documentElement.dataset.ai = "on";` only for a range window started with `--ai`. In fixture mode the equivalent is `?ai` / `?ai=<case>`. `main.ts` reads it once.
- **Rust guarantee by structure (vision 4):**
  - The shell always manages `AiState = Mutex<Ai>` with `enum Ai { Off, On(Workspace) }`.
  - Every agent command reaches the workspace only through `Ai::workspace()`, which is the one place that maps `Off` to `IpcError::AiOff` (like `Merge::session()`).
  - `Workspace` is built in exactly one place: the range window's start, in the `Ai::On` arm.
  - The leftover sweep also runs only there.
- **Window guarantee:** `createTauriAgentSource` / `createFixtureAgentSource` and `new AgentClient(...)` are called only in `main.ts`, under the `data-ai` check. A new fence in `fences.ts` makes them importable only from `main.ts`. The range store receives `ai: AgentClient | null`; "Ask AI" and the AI settings section exist only where that value is present.

### 3. The agent protocol in the window
These are the measured omp facts plus the ACP subset yamt reads.

- **`initialize`:** sent once per process with `protocolVersion: 1`, `clientCapabilities { fs: { readTextFile: false, writeTextFile: false }, terminal: false }` and `clientInfo { name: "yamt" }`. Any other version in the reply means a `refused` failure.
- **Starting or resuming a conversation, per thread:**
  - A new thread uses `session/new { cwd: <checkout>, mcpServers: [] }`. The `sessionId` reaches B at once through the `session` event, so a crash mid-turn still keeps it.
  - A thread with an id uses `session/load { sessionId, cwd: <checkout>, mcpServers: [] }`. A process that has not loaded the id yet must load it before a `session/prompt`.
    - When the load comes from `loadConversation`, the replay is delivered as turns. A replay is split into turns at each `user_message_chunk`, and each turn is folded exactly like a live one.
    - When the load only prepares a prompt (for example after a crash restart), the replay is dropped.
- **A turn:** `session/prompt { sessionId, prompt: [{ type: "text", text }] }` has no deadline. `session/cancel { sessionId }` is a notification. The `stopReason` maps as follows:

  | `stopReason` | turn end |
  |---|---|
  | `end_turn` | `finished` |
  | `cancelled` | `stopped` |
  | `max_tokens`, `max_turn_requests`, `refusal`, anything else | `failed { ended, reason }` |

- **Turn model (`agent/internal/turn.ts`, one pure fold):**
  ```ts
  type StepKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "other";
  type StepStatus = "pending" | "running" | "done" | "failed" | "noResult";
  type FileEdit = { readonly path: string; readonly oldText: string | null; readonly newText: string }; // path relative to the checkout when inside it
  type StepOutput =
    | { readonly kind: "text"; readonly text: string }
    | { readonly kind: "edit"; readonly edit: FileEdit }
    | { readonly kind: "refused"; readonly title: string; readonly paths: readonly string[] };
  type Step = { readonly id: string; readonly kind: StepKind; readonly title: string; readonly status: StepStatus; readonly outputs: readonly StepOutput[] };
  type TurnEntry =
    | { readonly kind: "thought"; readonly text: string }
    | { readonly kind: "said"; readonly text: string }
    | { readonly kind: "step"; readonly step: Step };
  type TurnView = { readonly entries: readonly TurnEntry[]; readonly answer: string };
  ```
  - `agent_thought_chunk` text is appended to the last `thought` entry.
  - `agent_message_chunk` text accumulates as `answer`. When a `tool_call` follows, that text moves into a `said` entry. So `answer` is always the text after the last step, which is B's "final text" for Post.
  - `tool_call` adds a step. `tool_call_update` sets its status, and its `content` replaces the outputs, as ACP specifies.
  - When the turn ends, a step still `pending` or `running` becomes `noResult`.
  - `plan`, `usage_update`, `session_info_update`, `available_commands_update` and anything unknown are ignored.
  - `changed` events are coalesced to at most one per `TURN_FLUSH_MS` (50 ms) and always sent at the end.
- **Requests from the agent: a fixed table (`agent/internal/answers.ts`).** The bridge always sends permission requests to the client (`acp-client-bridge.ts:38`). The request carries `toolCall.kind` (`"execute"` for a command), a `title` and `locations[].path`, which omp already resolves to absolute paths against the session's cwd (`session-tools.ts:1092-1102`, `acp-permission-gate.ts:120-141`).

  | request | answer | does the user see it? |
  |---|---|---|
  | `session/request_permission`, `toolCall.kind == "execute"` (a command) | the option whose `kind` is `allow_once` | no: the step shows anyway, with its output |
  | the same, any other kind (delete, move, an edit that deletes or moves, `acp-permission-gate.ts:53-97`), every `locations[].path` inside the checkout | `allow_once` | no |
  | the same, a path outside the checkout, or no locations | `reject_once` | yes: the step gets a `refused` output, "yamt refused: Move a to b — outside the AI's checkout" |
  | options lacking the wanted kind | `{ outcome: { outcome: "cancelled" } }` | logged |
  | `fs/*`, `terminal/*` (never sent: the capabilities say false), anything else | error −32601 | logged |

  - `allow_always` / `reject_always` are never chosen: omp caches them per session (`session-tools.ts:1129-1133`), and every request must be judged on its own paths.
  - **"Inside"** (`agent/internal/inside.ts`, pure): both paths are split on `/` and `\`, `.` and `..` are resolved lexically, and segments are compared one by one. The comparison ignores case when the folder starts with a drive letter. `/a/checkout2` is not inside `/a/checkout`. Symlinks are not followed (see risks).
- **What yamt appends to the command: nothing.** With omp's default configuration (its approval mode not set explicitly), every command and every delete or move is asked (`session-tools.ts:921-932`). An explicit `yolo` — `--approval-mode yolo`, `--yolo`, or `tools.approvalMode: yolo` in omp's settings — turns off the questions for deletes and moves (`session-tools.ts:927-931`, `1150-1155`; `main.ts:1929-1937`). Whether yamt should override that is open question Q3.
- **Several threads at once over one process:**
  - Updates are routed by `sessionId`. omp keeps one record and one `promptTurn` per session (`acp-agent.ts:791`, `1003-1005`); I did not measure two prompts running at once `[INFERENCE]`, and a real-app step proves it.
  - A second `ask` on a session that already has a running turn ends at once with `failed { busy }`. B disables that button anyway.
- **Failures:** each is one sentence in `ui/aiText.ts`, and each offers "Retry", which is simply `ask` again.

  | `AgentFailure` | sentence |
  |---|---|
  | `checkoutFailed { message }` | "The AI's checkout could not be made: …" |
  | `notFound { program, searched }` | "`omp` was not found (searched: …). Set the Agent command in Settings." |
  | `spawnFailed { program, message }` | (the program and its error) |
  | `noCommand` | (the Agent command in Settings is empty) |
  | `crashed { code, lastLog }` | "The AI stopped unexpectedly (exit code 1): `<last stderr line>`" |
  | `refused { method, message }` | (the request omp refused and its message) |
  | `sessionGone` | "omp no longer has this thread's conversation." |
  | `ended { reason }` | (the reason omp gave) |
  | `busy` | (never shown: B disables the button) |

  - `sessionGone` is a `session/load` error whose message holds "session not found" (`acp-agent.ts:1625`). Any other load error is `refused`, for example "ACP session load was cancelled" (`:1682`). Only `inside.ts`'s sibling `failure.ts` matches error text, and it is tested on recordings.
  - After a crash, every running turn ends `crashed` exactly once; the pipe sends `Exited` once and last. The next `ask` starts a new process and reloads the session silently.
  - A failed checkout is not cached, so Retry makes it again.

### 4. The temporary checkout
Each option makes it differently. These parts are the same everywhere:

- **Path:** `<data_dir>/yamt/<A's pair folder>/<pair key>/checkout/`. The pair key is A's input. I ask A to keep it short, because of Windows `MAX_PATH`.
- **Has changes:** anything `git status --porcelain=v1 -z --untracked-files=all` lists (untracked files included, ignored files not), or `HEAD` ≠ the pair's right-side commit (the AI committed).
- **Removal:** rename to `checkout.removing`, then `remove_dir_all`, so a crash mid-removal never leaves half a checkout that looks like a kept one.
- **Making it:** into `checkout.partial`, then rename to `checkout`. So a `checkout/` folder is always complete, and leftover `*.partial` / `*.removing` folders are always safe to delete.
- **A checkout git cannot read** (for example its borrowed objects were pruned): `Unreadable`. It is never removed unasked.
- **Leftovers after a crash or kill:** removed only by a later range window started with `--ai`, at its start, on a background thread:
  - For every other pair folder whose lock A lets it take, it deletes `checkout.partial`/`checkout.removing`, deletes `checkout` when it is `Clean`, keeps it otherwise, and releases the lock.
  - For its own pair it deletes only `.partial`/`.removing`. A clean `checkout` of its own pair is reused at the first Ask AI and judged again at close.
  - A window that is open holds its pair's lock, so its checkout is never touched.

### 5. The close question
- **How the close is intercepted:** the range root's close guard (`onWindowClose` → `ipc/window.ts` `guardWindowClose`, unchanged) calls `aiMayClose` from `ui/aiClose.ts`:
  1. No `AgentClient` (no `--ai`) → close.
  2. `checkoutChanges()`: `Missing` or `Clean` → close without a word.
  3. `Changed { folder, files, head_moved }` or `Unreadable { folder, message }` → `asking.ask({ kind: "keepAiChanges", folder, files, headMoved })` or `{ kind: "keepUnreadableCheckout", folder, message }`. The QuestionDialog is unchanged; its confirm button already has `autofocus`, so Enter answers it.
     - Title: **"Keep the AI's changes?"** Text: "The AI changed these files in its checkout at `<folder>`:" followed by the file list; when `headMoved`, add "It also made commits there."
     - Confirm **"Keep Changes"** (Enter) → close.
     - Cancel **"Discard Changes"** → `discardCheckout()`. On success → close. On failure → the problem "The AI's checkout could not be removed: …" is shown and the window stays open.
     - Escape → dismissed → the close is cancelled.
- **A running turn at close** is not stopped before the question, so Escape leaves it running. Keep or Discard ends it:
  - Discard stops the agent in Rust before removing anything.
  - Keep or Clean: the shell stops the agent at exit.
- **The shell at exit:** after `run_return`, `Workspace::end(self)` stops and reaps the agent, then looks again and removes the checkout only when it is `Clean`. A change made after the window's look is therefore kept, never lost. Exit status is 0 either way, and `end`'s errors are logged.
- **Page reload** (`PageLoadEvent::Started`): stops the agent. It uses `try_lock`, so a prepare in flight is skipped; no agent runs during a prepare. The checkout stays.

### 6. Settings
- **File entry:** `"agent": { "command": ["omp","acp"], "firstMessage": "…" }`. Each field is written only when it differs from the default. As with #57, the window owns the defaults (a later default still reaches users), so `null` or a missing field means the default.
- **Rust:** `AgentSettings { command: Option<Vec<String>>, first_message: Option<String> }` (`serde(default, rename_all = "camelCase")`) in `StoredSettings.agent`, kept-entries rules in `file.rs`, one function `set_agent(places, current, agent)`, and one command `set_agent`.
- **Command splitting:** the view splits the typed text on spaces, with no quoting and no shell. This is the same rule as hand-added servers, moved to `ui/commandWords.ts`, which `serverSetup.ts` `parseAddedServer` then uses (two users). A program path containing spaces goes into the file as a list.
- **Program lookup:** Rust looks up `program` on PATH, then in the home entries `[".bun/bin", ".local/bin"]` (omp installs through bun). This matters for a yamt started from a desktop launcher whose PATH lacks them. On Windows, PATHEXT and CREATE_NO_WINDOW come from the shared lookup; whether Rust's std runs `.cmd` shims through `cmd.exe` is `[INFERENCE]`.
- **Settings view:** an "AI" section, `ui/AgentSettings.vue`, put into `SettingsView`'s existing `<slot />` by the range root only when AI is on. The merge and compare roots never import it.
  - "Agent command" field with "Use" and "Default".
  - "First message" text area with "Use" and "Default", the five placeholders listed, and each unknown placeholder named: "`{{ FOO }}` is not a placeholder; it is sent as typed."
- **Placeholders: unknown ones are left as typed, not refused at save.** The file can be edited by hand, so the fill has to handle unknown ones anyway; one rule covers both. `firstMessage(template, values: Readonly<Record<Placeholder, string>>)` replaces `/\{\{\s*([A-Z_]+)\s*\}\}/g`; known names get their value, unknown names keep the matched text. `unknownPlaceholders(template)` feeds the hint. `Placeholder = "RELATIVE_FILE_PATH_WITH_LINE" | "MESSAGE" | "RANGE" | "OLD_COMMIT" | "NEW_COMMIT"`. B computes the values.
- **Default First message (`DEFAULT_FIRST_MESSAGE`):**
  ```
  You are helping me review the changes {{ RANGE }} ({{ OLD_COMMIT }}..{{ NEW_COMMIT }}).
  The current folder is a checkout of {{ NEW_COMMIT }}; `git diff {{ OLD_COMMIT }} {{ NEW_COMMIT }}` shows the changes.
  A line removed by the changes is named by its place in {{ OLD_COMMIT }}.

  My comment on {{ RELATIVE_FILE_PATH_WITH_LINE }}:

  {{ MESSAGE }}
  ```
  Later turns send only the messages joined with blank lines; B builds that text.

### 7. Markdown
- **No HTML string is ever built.** The renderer is yamt's own: a block parser, an inline parser, and a DOM builder using `createElement`, `textContent` and `className` only, never `innerHTML`.
- **Subset:** paragraphs, `*`/`_` emphasis and strong, `~~strike~~`, inline code, fenced code with an info string, `-`/`*`/`1.` lists (nested by indent), ATX headings, block quotes, GFM tables, `---`. Anything else shows as literal text.
- **Never shown as markup:** raw HTML is literal text; images show as `alt (url)` text and are never loaded.
- **Links are shown as text:** the link text followed by the URL in a muted, selectable span. Nothing is navigable, so the page never leaves and the agent never stops by accident. Q4 asks the owner about clickable links.
- **Code blocks:** `LanguageDescription.matchLanguageName(languages, info)` (`editor/internal/language.ts` `languageNamed`), `await description.load()`, `parser.parse(code)`, then `@lezer/highlight`'s `highlightCode` with the **same** `[paletteHighlight, fontHighlight]` HighlightStyles the panes use. Their style modules are mounted once with `StyleModule.mount`. There is no second colour rule. An unknown language is shown plain.
- **Streaming:** `MarkdownView.show(text)` re-renders from the first block whose source text changed.

### 8. Edit diffs
- **Data:** each `edit` output (`{ path, oldText, newText }`) is collapsed by default as "Edited `<path>`" ("Created `<path>`" when `oldText` is null).
- **Opening it** calls `AgentClient.editDiff(edit)` → `diff_texts(old, new)`, which runs `merge_core::compare` (plan #95: one diff engine for 2-way views) on a worker and returns `Vec<Difference>`. `ui/editDiffLines.ts` builds unified rows: 3 context lines, line numbers, at most `MAX_DIFF_ROWS` = 2,000 rows, then "n more lines not shown". `EditDiff.vue` renders them in the theme's inserted and removed colours.
- **Limits:** a side over `MAX_COLUMN_BYTES` (8 MiB) answers `ColumnTooLarge` and the view says "too large to show as a diff". A created file needs no call.
- **Cost:** nothing per turn until a diff is opened. Opening one costs one round trip carrying both texts (at most 2 × 8 MiB) plus the diff (ms) plus at most 2,000 DOM rows.
- **Not built:** word marks inside the unified lines. They arrive in `Difference.words` and are ignored.

### 9. IPC: the generated TS shape
The Rust side is in the options.

```ts
export type AgentRun = number;                          // branded AgentRun in ipc/domain.ts (isAgentRun)
export type AgentCommand = { program: string; args: string[]; home_folders: string[] };
export type AgentStartReply =
  | { kind: "Started"; run: AgentRun }
  | { kind: "NotFound"; program: string; searched: string[] }
  | { kind: "SpawnFailed"; program: string; message: string }
  | { kind: "NoCheckout" };
export type CheckoutReply = { kind: "Ready"; folder: string } | { kind: "Failed"; message: string }; // folder → CheckoutFolder brand in domain.ts
export type CheckoutLook =
  | { kind: "Missing" }
  | { kind: "Clean" }
  | { kind: "Changed"; folder: string; files: string[]; head_moved: boolean }   // non-empty: built only when status listed something or HEAD moved
  | { kind: "Unreadable"; folder: string; message: string };
export type AgentSettings = { command: string[] | null; firstMessage: string | null };
// IpcError gains: { kind: "AiOff" } | { kind: "RemoveFailed"; folder: string; message: string }
// HostEvent (existing): Message{text} | Log{line} | Exited{code}; reused for the agent's channel
commands.prepareCheckout(): Result<CheckoutReply, IpcError>             // async, worker; AiOff
commands.startAgent(command: AgentCommand, events: Channel<HostEvent>): Result<AgentStartReply, IpcError> // a running agent is stopped first; folder = the checkout, never sent by the window
commands.sendToAgent(run: AgentRun, message: string): Result<null, IpcError>   // one line; framing is Rust's
commands.stopAgent(run: AgentRun): Result<null, IpcError>               // signal; killed after 2 s; Exited follows
commands.checkoutChanges(): Result<CheckoutLook, IpcError>              // async: folder taken under the lock, git status outside it
commands.discardCheckout(): Result<null, IpcError>                      // async: stop + reap the agent, then remove; RemoveFailed
commands.diffTexts(old: string, next: string): Result<Difference[], IpcError> // async; ColumnTooLarge, WorkerStopped; needs no AI state
commands.setAgent(current: StoredSettings, agent: AgentSettings): Result<SettingsRead, IpcError>
```

**Window side:**
```ts
// ipc/AgentSource.ts
export interface AgentSource {
  prepareCheckout(): Promise<SourceResult<CheckoutReady>>;          // { kind: "Ready"; folder: CheckoutFolder } | { kind: "Failed"; message }
  startAgent(command: AgentCommand, onEvent: (event: HostEvent) => void): Promise<SourceResult<AgentStartReply>>;
  sendToAgent(run: AgentRun, message: string): void;                // fire and forget, a failure logged
  stopAgent(run: AgentRun): Promise<void>;
  checkoutChanges(): Promise<SourceResult<CheckoutChanges>>;        // CheckoutLook with the folder branded
  discardCheckout(): Promise<SourceResult<null>>;
  diffTexts(old: string, next: string): Promise<SourceResult<readonly Difference[]>>; // converted as compareDomain.ts converts Comparison.differences
}
// SettingsSource (ipc/ChunkSource.ts) gains setAgent(current, agent): Promise<SourceResult<SettingsRead>>
```

**The seam for B (`agent/index.ts`, its full public surface):**
```ts
export type AgentSessionId = string & { readonly __brand: "AgentSessionId" };
export function agentSessionId(text: string): AgentSessionId | null;    // B's store parses its stored id once
export type { TurnView, TurnEntry, Step, StepKind, StepStatus, StepOutput, FileEdit };
export type AgentFailure = /* the sentences under point 3 */;
export type TurnEnd =
  | { readonly kind: "finished"; readonly turn: TurnView }
  | { readonly kind: "stopped"; readonly turn: TurnView }
  | { readonly kind: "failed"; readonly turn: TurnView; readonly failure: AgentFailure };
export type AskRequest = { readonly session: AgentSessionId | null; readonly text: string };
export type TurnEvents = { readonly session: (session: AgentSessionId) => void; readonly changed: (turn: TurnView) => void };
export interface RunningTurn { readonly ended: Promise<TurnEnd>; stop(): void }      // stop = session/cancel
export type ConversationLoad =
  | { readonly kind: "loaded"; readonly turns: readonly TurnView[] }               // turn i = the session's i-th AI answer
  | { readonly kind: "failed"; readonly failure: AgentFailure };
export type EditDiff =
  | { readonly kind: "differences"; readonly differences: readonly Difference[] }
  | { readonly kind: "tooLarge"; readonly limit: number }
  | { readonly kind: "failed"; readonly message: string };
export type AgentSetup = { readonly source: AgentSource; readonly command: () => readonly string[]; readonly timers?: Timers };
export class AgentClient {
  constructor(setup: AgentSetup);
  ask(request: AskRequest, events: TurnEvents): RunningTurn;     // makes the checkout and starts the process on first use
  loadConversation(session: AgentSessionId): Promise<ConversationLoad>;
  editDiff(edit: FileEdit): Promise<EditDiff>;
  isRunning(): boolean;
  destroy(): void;
}
export { firstMessage, unknownPlaceholders, PLACEHOLDERS, DEFAULT_FIRST_MESSAGE, type Placeholder };
export { DEFAULT_AGENT_COMMAND };   // ["omp", "acp"]
```
**UI pieces B embeds:** `<AiTurn :turn :end @retry>` (the collapsed "Thinking and steps" with `AiStep`/`EditDiff` inside, the answer through `useMarkdown`, and the stopped or failed line with Retry) and `<AgentSettings>`.

**Fixture mode:** `ipc/fixtureAgent.ts` is a scripted fake agent.
- It answers `initialize`, `session/new`, `session/load` and `session/prompt` by replaying recorded agent lines from `frontend/fixtures/agent/<case>.jsonl`, with timers and `{{CHECKOUT}}`/`{{SESSION}}` substituted. `session/cancel` ends playback with `cancelled`.
- `?ai=crash` sends `Exited { code: 1 }` mid-turn. `?ai=checkout-fails` makes `prepareCheckout` answer `Failed`. `?ai-changes` makes `checkoutChanges` answer `Changed`.
- `diffTexts` answers from fixtures generated by `just fixtures` through the existing `yamt-cli compare` (`tests/agent/<case>/edit-<n>/{left,right}.txt`), and only when both texts match, as `fixtureCompare.ts` does.

**Rust test agent:** the `agent-echo` binary (see the option). It replies to lines, and also `pwd`, `edit <file>`, `stderr <text>`, `exit <code>`, `huge`, and `hold <file>` (keeps a file open).

### 10. Tests
**Rust (mutated).** Names say the behaviour.
- **yamt-pipe lines:**
  - `a_line_message_comes_back_whole_with_a_multi_byte_body`
  - `a_line_split_across_two_writes_arrives_as_one_message`
  - `two_lines_in_one_write_arrive_as_two_messages`
  - `a_crlf_line_end_is_not_part_of_the_message`
  - `a_line_over_the_cap_is_dropped_with_a_log_line_and_the_next_one_arrives`
  - `a_line_that_is_not_utf8_is_dropped_with_a_log_line`
  - the existing lsp-host `run.rs` tests unchanged (Content-Length framing)
- **gitio:**
  - `a_shared_clone_without_origin_checks_out_the_commit_detached`
  - `the_clone_borrows_objects_and_keeps_no_refs_of_the_source`
  - `status_lists_modified_added_deleted_and_untracked_files_but_not_ignored_ones`
  - `head_commit_moves_after_a_commit_in_the_clone`
  - `a_commit_in_the_clone_leaves_the_source_refs_and_config_untouched`
- **yamt-compare:** `text_differences_refuses_a_side_over_the_column_limit`
- **yamt-agent:**
  - `prepare_makes_the_checkout_in_the_pair_folder_and_reuses_it_the_second_time`
  - `prepare_reuses_a_kept_checkout_with_its_changes_and_commits`
  - `a_partial_checkout_left_by_a_crash_is_removed_before_prepare`
  - `look_is_missing_before_prepare_and_clean_after`
  - `an_edited_file_an_untracked_file_and_a_moved_head_each_count_as_changed`
  - `an_ignored_file_alone_counts_as_clean`
  - `a_checkout_git_cannot_read_is_unreadable_and_never_removed_by_end_or_sweep`
  - `discard_stops_the_agent_before_removing_the_checkout` (`agent-echo hold`)
  - `end_removes_a_clean_checkout_and_keeps_a_changed_one`
  - `the_agent_runs_in_the_checkout`
  - `start_without_a_checkout_answers_no_checkout`
  - `a_crashed_agent_reports_exited_once_with_its_code`
  - `start_while_an_agent_runs_stops_the_old_one_first`
  - `a_missing_program_lists_path_and_the_home_entries`
  - `a_clean_leftover_of_an_unheld_pair_is_removed`
  - `a_changed_leftover_is_kept`
  - `a_leftover_of_a_held_pair_is_untouched`
  - `the_own_pair_keeps_its_checkout_and_loses_partial_and_removing_folders`
  - `a_checkout_left_after_a_kill_is_reused_by_the_next_window` (the `Workspace` is dropped without `end`)
- **src-tauri:**
  - `ai_is_accepted_with_every_mode_and_reaches_only_the_range_window`
  - `the_start_script_marks_ai_only_when_on`
  - `every_agent_command_answers_ai_off_without_the_flag`
  - `a_page_load_stops_the_agent_and_keeps_the_checkout`
  - `IpcError` mapping for `AiOff` and `RemoveFailed`
- **settings:**
  - `set_agent_writes_only_the_fields_given_and_keeps_unknown_entries`
  - `a_file_without_agent_reads_as_defaults`
  - `an_agent_entry_of_the_wrong_shape_is_reported_broken`

**Window, node (agent/ and ui/ are mutated):**
- **Recorded streams:**
  - the fold: thinking concatenated, steps by id moving pending → running → done, a diff output, the answer = text after the last step, `cancelled` → stopped, an unfinished step → `noResult`
  - the replay splits into as many turns as `user_message_chunk`s
  - two sessions' updates are routed apart
  - a crash ends every running turn once, then the next ask reloads before prompting, with the replay dropped
  - a load "not found" → `sessionGone`, any other error → `refused`
  - a failed prepare is not cached
  - the command is read at each process start
- **Permission table:** a command is allowed; a delete inside is allowed; a move whose destination is outside is refused; no locations and not a command → refused; options without `allow_once` → cancelled.
- **`inside.ts`:** a sibling prefix, `..`, a Windows drive in another case.
- **`firstMessage`:** known, unknown kept, repeated, spacing variants.
- **ui:**
  - `aiClose`: Missing or Clean closes without asking; Changed → Keep closes; Discard → discards, then closes; a failed discard stays open with the problem; Escape stays.
  - `editDiffLines`: context 3, adjacent hunks joined, line numbers, the cap.
  - `commandWords`, `aiText` (exhaustive), `agentSettingsFields`.

**Markdown (`editor/` is not mutated, VF7), each test with the bug it catches and the one-line hand mutation that makes it fail:**
- "a fenced block keeps a line that looks like a heading" (mutation: check headings before the fence state)
- "a list item's indented continuation joins the item" (drop the indent check)
- "a table needs its delimiter row" (accept any pipe line)
- "backticks win over emphasis" (parse emphasis first)
- "an unmatched `*` stays literal"
- **Browser test:** "the tree holds only allowed tags and only `class` attributes for an answer with `<script>`, `<img onerror>`, an HTML block and a `javascript:` link" (mutation: `innerHTML` for paragraphs); "a ts code block carries the editor's highlight classes" (drop the highlighter).

**Recording fixtures:**
- `frontend/scripts/record-agent.ts` (`just record-agent <case> <folder> "<prompt>"`) spawns `omp acp` in `<folder>`, sends `initialize` / `session/new` / `session/prompt`, and writes every line both ways as `{ "from": "agent" | "yamt", "line": … }`. It answers permissions with the yamt table, replaces the folder with `{{CHECKOUT}}` and the id with `{{SESSION}}`.
- Four cases, recorded once in a checkout of A's smoke repository and committed:
  - `edit-and-command` ("Add a line `hello` to README.md, then run `git status`")
  - `cancelled` (`sleep 30`, cancelled once its `tool_call` is running)
  - `load` (the first case's session loaded in a fresh process)
  - `permission-outside` ("Delete /tmp/yamt-record-outside.txt", answered `reject_once`)

**WebKit steps (fixture mode, MiniBrowser through `just webdriver`), before B exists:**
- A dev-only page `frontend/ai-harness.html` + `src/aiHarness.ts` (served by `pnpm dev`, not in the app build): a text field, Ask AI / Stop / Close buttons and a list of `AiTurn`s over `createFixtureAgentSource`. The steps:
  - Ask → "Thinking and steps" collapsed, then live when opened.
  - The edit step opens to unified lines.
  - The answer's Markdown, with a coloured `ts` block and a link as text.
  - Stop (`?ai=cancelled`) → partial text stays, marked "Stopped".
  - `?ai=crash` → one sentence + Retry → Retry works.
  - Close with `?ai-changes` → the question names the files and folder; Enter keeps; Escape stays; Discard closes.
- C8 deletes the harness and repeats these steps inside B's thread (`?range=<case>&ai`).

**Real-app steps (after B), with `omp acp` against A's smoke repository:**
- A turn that edits a file → its diff is shown.
- Stop during a long command.
- Two threads asking at once.
- Close → Keep (Enter) → reopen the range → the conversation comes back → Ask AI continues in the same checkout.
- Close → Discard → the folder is gone.
- A clean checkout is removed without a word.
- `kill -9` during a turn → reopen → the checkout is reused.
- A leftover of another pair is swept.

### 12. Proposed plan §2 rows
The orchestrator records them (DR5). The cited visions apply to option B.
- **R-AI1 `--ai` is a switch, decided once.** `Invocation::Range { ai: Ai }`, dropped by the other modes; `data-ai="on"` from the start script; `AiState = Mutex<Ai>` with `Ai = Off | On(Workspace)` and `Ai::workspace()` the one `AiOff` mapping; the agent source and client built only in `main.ts` (fence); the sweep only with `--ai`. *Rejected:* checks in each command or component (scattered, vision 4); tauri's unmanaged-state error (a string, IPC4); remembering the flag (owner default). **Visions 4, 3, 1.**
- **R-AI2 The agent pipe: one process core, two framings; the window speaks ACP.** `yamt-pipe` (run, program lookup, framing `ContentLength | Lines`, 64 MiB per message, a longer line dropped with a log line) used by `yamt-lsp-host` and `yamt-agent`; the window's `agent/` over a shared `jsonrpc/` (connection, messages, timers, moved from `lsp/internal`); permission answers from one table (commands allowed, deletes and moves only inside the checkout, never `*_always`); the command is a list of words split at spaces, PATH then `~/.bun/bin`, `~/.local/bin`, nothing appended. *Rejected:* Rust parsing ACP (#70's reason); a sibling crate copying the supervisor (two copies, vision 2); `yolo` appended (yamt could refuse nothing); an ACP SDK dependency (vision 5). **Visions 2, 3, 1, 5.**
- **R-AI3 The AI's checkout is a shared clone without remotes.** `git clone --shared --no-checkout` into `<pair>/checkout.partial`, `remote remove origin`, `checkout --detach <right commit>`, rename to `checkout`; "changed" = status (untracked included) or HEAD moved; removed through `checkout.removing`; leftovers swept at an `--ai` range window's start under A's pair locks; crate `yamt-agent` (`Workspace` = checkout + agent; agent before removal by construction). *Rejected:* `git worktree` (the user's worktree list, shared refs, config and stash: the AI's `git` reaches the user's branches; a crash leaves a worktree entry); `clone --local` (a full copy across filesystems); a tree extract (no `git` for the AI; finding changes means hashing every file); the system temp folder (lost at reboot; omp's `session/load` needs the same `cwd`). **Visions 4, 3, 1.**
- **R-AI4 The close question.** "Keep the AI's changes?" with the files and folder, Keep Changes preferred (Enter), Discard Changes removes, Escape cancels the close; a running turn is not stopped by the question; at exit the shell stops the agent, looks again and removes only a clean checkout; exit 0. **Visions 4, 1.**
- **R-AI5 yamt's own Markdown subset, DOM nodes only.** The subset under point 7; links as text; code coloured by `paletteHighlight` + `fontHighlight` through language-data names; `MarkdownView` reached by `ui/useMarkdown.ts` only. *Rejected:* `marked`/`markdown-it` + DOMPurify (HTML strings and a sanitiser as the security boundary, two dependencies); micromark/mdast (about ten packages for a subset). **Visions 5, 2, 1.**
- **R-AI6 Agent settings.** `agent.command` (words) and `agent.firstMessage`, written only when they differ from the window's defaults; unknown placeholders sent as typed and named in the view. *Rejected:* refusing them at save (a hand-edited file needs the fill rule anyway); one stored string with Rust splitting it (a second split rule). **Visions 2, 1.**
- **R-AI7 Edit diffs are unified lines from `merge_core::compare`,** collapsed, computed on opening through `diff_texts`, 3 context lines, 2,000-row cap. *Rejected:* a two-column editor per edit (two `EditorView`s each); Myers in the window (#70's `lineDiff`: O(N·D) can freeze on a rewrite of a large file). **Visions 2, 1.**
- **R-AI8 amends #70 / RS5 / §7:** `yamt-lsp-host` keeps `Host`, its files and `lsp-echo`; its run, program and frame code live in `yamt-pipe`; a fourth Mutex, `AiState`, never held with another; fences PM1 (new edges), PM2/PM3/PM5 (`agent/`, `jsonrpc/` framework-free; `agent/` imports only `ipc/`, `jsonrpc/`), PM2 (`useMarkdown` is the third importer of `editor/`).

---

## Option B — shared process core, an agent crate that owns the workspace (recommended)

**Data structures first.**
- Rust: `yamt_pipe::{Framing { ContentLength, Lines }, Running, HostEvent, ProgramFolders, ProgramFound, ProgramPlace}`, and in `yamt_agent`:
  ```rust
  pub struct Workspace { pair: Pair, checkout: Option<PathBuf> /* Some = complete */, agent: Option<(AgentRun, Running)>, next_run: u32 }
  pub struct Pair { pub repo: PathBuf, pub folder: PathBuf, pub new_commit: String } // all from A
  impl Workspace {
      pub fn new(pair: Pair) -> Workspace;
      pub fn prepare(&mut self) -> CheckoutReply;                                   // blocking, on a worker, lock held (no agent can run yet)
      pub fn start(&mut self, command: &AgentCommand, events: Sender<HostEvent>) -> AgentStartReply; // NoCheckout unless prepared
      pub fn send(&self, run: AgentRun, message: String);
      pub fn stop(&self, run: AgentRun);
      pub fn stop_agent(&self);                                                     // page reload
      pub fn look_job(&self) -> LookJob;                                            // under the lock; LookJob::look() outside it
      pub fn discard(&mut self) -> Result<(), Error>;                              // stop + reap, then remove
      pub fn end(self);                                                             // exit: stop + reap, remove only when Clean
  }
  pub fn sweep_leftovers(pairs_folder: &Path, own: &Path);
  pub enum Error { Git(yamt_gitio::Error), Remove { folder: PathBuf, source: io::Error } }
  ```
  `end(self)` consumes the workspace and `discard` takes the agent out before removing, so "agent stopped before removal" is the only order the type allows.
- Window: `AgentClient` (the common surface), with process state `{ kind: "none" } | { kind: "starting"; ready: Promise<…> } | { kind: "running"; run; connection; loaded: Set<AgentSessionId>; folder: CheckoutFolder }`.

**Visions served:**
- 2: one supervisor, one program lookup, one JSON-RPC connection, one diff engine.
- 3: each crate's edges are checked by arch-check, and the fences cover `agent/` and `jsonrpc/`.
- 4: the `Ai` switch; `Workspace` ordering; `CheckoutLook` as a sum type.
- 1: every crate's name says what it owns.

**Point 2 (pipe):**
- `Running::start(program, args, folder, framing, events)`. `Framing::Lines` writes `message + "\n"` and reads with the existing `bounded_line` capped at `MAX_MESSAGE_BYTES` (64 MiB). A cut line is dropped with `Log "yamt: dropped a message of more than 64 MiB"` and reading goes on, so a huge diff costs a step's output rather than the turn. A line that is not UTF-8 is dropped with a log line.
- stderr arrives as `Log`. The client keeps the last line for the crash sentence and logs every line at `debug` (`agent.stderr`).
- `find_program(folder, folder, program, &ProgramFolders { project: [], home })`.
- One `Channel<HostEvent>` per start, forwarded as `servers.rs` does.

**Point 4 (checkout):** gitio gains `checkout.rs`:
```rust
Repo::clone_shared_into(&self, into: &Path) -> Result<Repo>  // clone --shared --no-checkout --quiet, no deadline
Repo::remove_remote(&self, name: &str) -> Result<()>
Repo::checkout_detached(&self, commit: &Oid) -> Result<()>    // no deadline
Repo::status_entries(&self) -> Result<Vec<StatusEntry>>       // --porcelain=v1 -z --untracked-files=all --no-renames
Repo::head_commit(&self) -> Result<Oid>
```
- **What the AI can break in your repository:** its own refs and config are separate. Its `git push` has no remote, so it needs an absolute path or URL on purpose. Its commits go into the clone's own object store. Through absolute paths in commands it can still write anywhere (the request's risk; no sandbox).
- **Cost on a large repository:** the clone links your objects instead of copying them (`objects/info/alternates`), so the cost is writing the working tree, the same as a worktree. There is no entry in your `git worktree list`.

**Builds** (≤ 2 at once; "∥" = side by side; each line is Owned files):

| build | needs | files (C create · M change · D delete · V move) | ≈ lines |
|---|---|---|---|
| **C1 rust: pipe core** | — | C `crates/pipe/{Cargo.toml, AGENTS.md, src/lib.rs, src/bin/line-echo.rs, tests/lines.rs}` · V `crates/lsp-host/src/{run,program,frame}.rs` → `crates/pipe/src/` (`Framing`, `plain_name` moves into `program.rs`) · M `crates/lsp-host/{Cargo.toml, AGENTS.md, src/lib.rs, src/files.rs}`, `Cargo.toml`, `Cargo.lock`, `scripts/arch-check.sh`, `docs/architecture.md` §3/§7, `.omp/skills/project-map/SKILL.md` | 650 |
| **C6 web: Markdown** ∥ C1 | — | C `frontend/src/editor/{markdown.ts, internal/markdownBlocks.ts, internal/markdownInline.ts, internal/markdownDom.ts, internal/codeBlock.ts, internal/markdownBlocks.test.ts, internal/markdownInline.test.ts, internal/markdownDom.browser.test.ts}`, `frontend/src/ui/useMarkdown.ts` · M `editor/index.ts`, `editor/theme.css`, `editor/AGENTS.md`, `frontend/scripts/fences.ts`, `fences.test.ts` | 1,200 |
| **C3a rust: git and diff reads** | C1 committed (docs) | C `crates/gitio/src/checkout.rs`, `crates/gitio/tests/checkout.rs` · M `crates/gitio/src/lib.rs`, `crates/compare/src/lib.rs` (`text_differences`), `docs/architecture.md` §3.2/§3.7 | 450 |
| **C5a web: `jsonrpc/` out of `lsp/`** ∥ C3a | — | V `lsp/internal/{connection,connection.test,messages,timers}.ts` → `frontend/src/jsonrpc/` (+ `index.ts`, `AGENTS.md`; `Answer` type moves; options `cancelNotification`, `requestUntilAnswered`) · M `lsp/index.ts`, `lsp/internal/{answers,attempt,attempt.test,documents,formatting,handshake,problems,server,serverDocs}.ts`, `frontend/.oxlintrc.json`, `frontend/scripts/fences.ts`, `fences.test.ts`, `frontend/vite.config.ts` | 350 |
| **C2 rust+web: agent settings entry** | C3a, C5a (docs, fences) | M `crates/settings/src/{lib.rs, file.rs}`, `src-tauri/src/{settings.rs, commands.rs}`, `frontend/src/ipc/{bindings.ts (gen), ChunkSource.ts, domain.ts, tauri.ts, tauriCompare.ts, fixtureSettings.ts, fixtureCompare.ts}`, `frontend/src/ui/{settings.ts, settingsStore.ts, settings.test.ts}`, `docs/architecture.md` §3.6/§4, `.omp/skills/ipc-contract/SKILL.md` | 400 |
| *A lands (its crate, the pair key and lock, `Invocation::Range`, the range builder, its root and store)* | | | |
| **C3b rust: `yamt-agent`** | A, C1, C3a | C `crates/agent/{Cargo.toml, AGENTS.md, src/lib.rs, src/workspace.rs, src/checkout.rs, src/look.rs, src/process.rs, src/sweep.rs, src/bin/agent-echo.rs, tests/checkout.rs, tests/process.rs, tests/sweep.rs}` · M `Cargo.toml`, `Cargo.lock`, `scripts/arch-check.sh` (yamt-agent → gitio, pipe, A's crate; no tauri), `docs/architecture.md` §3 | 1,300 |
| **C4 rust+ipc: the shell** | C3b, C2 | C `src-tauri/src/ai.rs`, `frontend/src/ipc/{AgentSource.ts, tauriAgent.ts}` · M `src-tauri/src/{args.rs, window.rs, lib.rs, commands.rs, ipc_error.rs}`, `src-tauri/Cargo.toml`, `Cargo.lock`, `scripts/arch-check.sh`, `frontend/src/ipc/{bindings.ts (gen), domain.ts, index.ts}`, `frontend/src/ui/problemText.ts` (the two new kinds), `.omp/skills/ipc-contract/SKILL.md`, `docs/architecture.md` §3.5/§4 | 700 |
| **C5b web: agent client** | C4 | C `frontend/src/agent/{index.ts, AGENTS.md, index.test.ts, internal/{process,protocol,turn,conversation,answers,inside,failure,session,firstMessage,command}.ts, internal/{turn,conversation,answers,inside,firstMessage}.test.ts}`, `frontend/src/ipc/fixtureAgent.ts`, `frontend/fixtures/agent/{edit-and-command,cancelled,load,permission-outside}.jsonl`, `tests/agent/…/{left,right}.txt`, `frontend/scripts/record-agent.ts` · M `justfile` (`record-agent`, `fixtures`), `frontend/src/ipc/index.ts` | 1,500 |
| **C7 web: turn view, close, settings view** | C5b, C6, C2 | C `frontend/src/ui/{AiTurn.vue, AiStep.vue, EditDiff.vue, editDiffLines.ts (+test), AgentSettings.vue, agentSettingsFields.ts (+test), aiText.ts (+test), aiClose.ts (+test), commandWords.ts (+test)}`, `frontend/ai-harness.html`, `frontend/src/aiHarness.ts` · M `ui/serverSetup.ts`, `ui/question.ts`, `ui/AGENTS.md`, `frontend/scripts/fences.ts`, `fences.test.ts` | 1,400 |
| *B lands (threads, their store per pair)* | | | |
| **C8 web: integration** | B, C7 | M `frontend/src/main.ts`, A's range store and root, B's thread view (Ask AI, Stop, Retry, session ids, `loadConversation`), `ui/AGENTS.md`, project map · D `frontend/ai-harness.html`, `src/aiHarness.ts` | 500 |

- **Docs rule:** in a side-by-side pair, `docs/architecture.md` and the project map are owned by the Rust build. The web build lists its map lines in `deviations_from_brief`.
- **Contracts fixed for the next build:**
  - C1: the `yamt_pipe` API.
  - C3a: the gitio methods above and `yamt_compare::text_differences(left: &str, right: &str) -> Result<Vec<Difference>>`.
  - C2: `AgentSettings`, `set_agent` and `SettingsSource.setAgent`.
  - C4: the IPC block under point 9 and `AgentSource`.
  - C5b: the `agent/index.ts` surface.
  - C7: the `AiTurn`/`AgentSettings` props and emits, and `aiMayClose(target): Promise<boolean>`.
- **Inputs from A (names matched at C3b):** `pair_folders(data_dir) -> Vec<PathBuf>`; `PairLock::try_hold(&Path) -> io::Result<Option<PairLock>>`, released when dropped; and, for the window's pair, the repository root, the pair folder, the full right commit id, the left commit id and the range as typed.

**Cost:**
- Two new crates: §7, arch-check and the map change.
- A move build (C1) whose moved lines go through `just mutants` again.
- `yamt-agent` depends on A's crate for the lock.
- About 700 lines of yamt's own Markdown to maintain.
- Edit diffs send both texts to Rust again when opened.
- Nine builds, about 8,450 changed lines in total.

## Option A — generalise in place; the checkout in A's crate

**Data structures:**
- `yamt-lsp-host` is renamed to `crates/host` (`yamt-host`). It keeps `Host` and gains `Framing` in `frame.rs` and `AgentHost { run: Option<(AgentRun, Running)> }` in `agent.rs`.
- The checkout is `checkout.rs` in A's crate (make, look, remove, sweep beside A's lock).
- `src-tauri/src/ai.rs` holds `Ai = Off | On { host: AgentHost, pair, checkout: Option<PathBuf> }`. The ordering is written there: `discard_checkout` = `host.stop_and_wait()` then `range::remove_checkout`. So is `end`.
- The window is the same as option B.

**What differs:** builds C1+C3b become
- "rename and frame": `crates/lsp-host` → `crates/host`; every `yamt_lsp_host` import in `src-tauri`; arch-check; map; about 500 lines; and
- "checkout in A's crate", plus the gitio methods: about 900 lines.

`yamt-agent` does not exist.

**Visions:** 5 (no new crate). Vision 3 is weaker: stop-before-remove is a sequence in `src-tauri`, tested only without git (`src-tauri` may not depend on `gitio`, PM1). Vision 1 is weaker: one crate hosts language servers and an agent.

**Cost:** the ordering rule sits in glue that mutants only see with fake folders; A's crate owns two unrelated jobs; the crate rename churns every import.

## Option C — a sibling crate sharing nothing, a git worktree, a Markdown dependency

**Data structures:**
- `crates/agent-host` copies `run.rs`, `program.rs` and line framing (about 600 duplicated lines).
- The checkout is `git worktree add --detach <pair>/checkout <commit>` and `worktree remove --force` + `worktree prune`, in gitio.
- `agent/` has its own connection and message copies (about 250 duplicated lines).
- Markdown through `marked` + `dompurify` into `innerHTML`, with code coloured afterwards on `<pre><code class="language-x">`.
- Edit diffs are the same.

**Builds:** about 6, each smaller; no move build; `lsp/` untouched.

**Visions:** 5 only partly (fewer files changed, but two dependencies are added).

**Cost:**
- Vision 2: two supervisors and two connections drift apart.
- The worktree shares your refs, config and stash: the AI's `git branch -D`, `git config` or `git stash` acts on your repository. It also adds an entry to your worktree list, and a crash leaves that entry.
- The sanitiser becomes the security boundary for agent text in a page that can reach the IPC.

---

## Recommendation: **Option B**

It keeps the #70 rule (Rust pipes bytes, the window speaks the protocol) with one supervisor and one connection. It puts "stop the agent, then remove" and "never remove a changed checkout" into a type (`Workspace::discard`, `end(self)`) inside a library crate tested with real git. And it keeps your repository's refs and config out of the AI's reach without a full copy.

**Its cost:**
- Two new crates (`yamt-pipe`, `yamt-agent`), each a plan row, an architecture §7 entry and an arch-check edge.
- A mechanical move of about 600 lines out of `yamt-lsp-host`, with mutants re-run on it.
- A dependency of `yamt-agent` on A's crate's lock API.
- About 700 lines of its own Markdown renderer.
- Nine builds, of which C3b, C4, C5b and C7 wait for A, and C8 waits for B.

**Risks to name in each build's `open_risks`:**

| risk | plan |
|---|---|
| Two prompts running at once in one process | unmeasured; real-app step |
| Whether omp writes files into its cwd, which would make every checkout "changed" | real-app step; `.git/info/exclude` if it does |
| `remove_dir_all` on read-only pack files on Windows; Rust running `.cmd` shims | Windows CI test |
| A shallow or partial-clone source repository, and LFS smudge without `origin` | `prepare` answers `Failed` with git's message |
| Symlinks inside the checkout that point outside it | not followed by `inside.ts` |
| AppImage environment variables inherited by the agent | as for language servers, RK21 |

## Open questions (product owner)

1. **Earlier AI conversations when a range opens again:** should they appear as soon as the window opens? That makes the AI's checkout at once, costing seconds to a minute on a large repository even if you never ask the AI. Or only when you open that thread? The default proposed is when the thread is opened.
2. **A thread whose conversation omp no longer has** (`omp gc`): should the next "Ask AI" start a new conversation that sends all your messages in the thread, wrapped in First message? The AI would lose its earlier answers. Or should you choose which messages go?
3. **If your omp is set to never ask** (`--yolo`, or an explicit `approvalMode: yolo`), yamt can no longer refuse a delete or move outside the checkout. Accept that, with a note under "Agent command"? Or should yamt add `--approval-mode` itself, ignoring your omp setting inside yamt?
4. **Links in the AI's answers:** keep them as copyable text? Or make them clickable, opening your browser? That costs one more dependency (Tauri's opener).
5. **Rebuildable files:** a checkout where the AI only created ignored files (`node_modules`, build output) counts as unchanged and is removed at close without a question, so the next window's AI reinstalls them. Is that acceptable?