# PlanScoutAi — facts on the AI's thread box, thinking list and conversation per thread

Read-only scout run by the orchestrator on 2026-10-28 at main `15ab31c` (session 32, planning the requests after 0.6.0-beta.1). Facts cite `path:line` at that commit; `[INFERENCE]` marks guesses.

## Summary
The thinking text is rendered by `AiTurn.vue`. Today the thinking list has no max-height, no overflow box and no auto-scroll. **Ask AI** sits in the thread box header (top right). The reply editor sits at the bottom. Ask AI never sends the text in the editor; it sends the stored notes. **Is an omp session already maintained across asks in one thread? Yes.** Each thread keeps one ACP session id (`Thread.session`). A follow-up sends only the new notes. One `omp acp` process per window is shared by all threads. After a reload the session is loaded again with `session/load`, not created anew.

## Files
- `frontend/src/ui/AiTurn.vue:14-56`: the "Thinking and steps" toggle and list (thoughts, `said` lines, `AiStep`), then the answer as Markdown.
- `frontend/src/ui/AiStep.vue:28`: a step's output box, `max-h-48 overflow-auto`.
- `frontend/src/ui/RangeThreadBox.vue:66-211`: the thread box (header with Ask AI/Stop/collapse, messages, live turn, reply textarea, Comment/Cancel).
- `frontend/src/ui/RangeMessage.vue:127-151`: one message. A recorded AI answer is its own `<AiTurn>`.
- `frontend/src/ui/rangeAi.ts:96-261`: picks the session, builds the prompt, `canAsk`, run, load, records the answer.
- `frontend/src/ui/rangeAiView.ts:46-56`: `answering` and `liveTurn`.
- `frontend/src/agent/index.ts:79-217`: `AgentClient` (one per window), `ask`, `loadConversation`, `#session`.
- `frontend/src/agent/internal/process.ts:39-146`: `AgentProcess`, which loads each session once per process.
- `frontend/src/agent/internal/starter.ts:20-108`: one process at a time.
- `src-tauri/src/ai.rs:84-108`: the agent is stopped when a page starts loading.
- `crates/review/src/thread_store.rs:102-131`, `thread_types.rs:53-58,119-120`: `Thread.session`, `set_session`, `add_ai_answer`.
- `frontend/src/ui/rangeThreadText.ts:22-35`: the button and prompt texts.

## Architecture
`RangeThreadLayer` teleports one `RangeThreadBox` into each CodeMirror block-row host. `RangeThreadBox` calls `ai.ask/stop/retry/load` (`rangeAi.ts`). That calls `AgentClient.ask/loadConversation`, which goes to `Starter` → `AgentProcess` → JSON-RPC over the Tauri agent pipe. The session id is saved with `setThreadSession`, and each answer is stored as `AiAnswer { session, turn }` through `addAiAnswer`.

## Report

### 1. Thinking block
- **Component:** `AiTurn.vue`. `opened = shallowRef(false)` (`:14`) drives the toggle. The list is `<ol v-if="opened" class="flex min-w-0 flex-col gap-2 border-l border-control-border pl-3">` (`:41`). A thought is a `<li>` with `wrap-break-word whitespace-pre-wrap text-fg-muted italic` (`:44-45`).
- **Max-height / overflow:** none on the `<ol>` or the `<section>` (`:26`). Only a step's text output is capped: `AiStep.vue:28` `max-h-48 overflow-auto`.
- **Styling:** Tailwind classes in the template only. There is no `<style>` block and no CSS file.
- **Auto-scroll:** none. A grep for `scroll` in AiTurn, AiStep, RangeThreadBox, RangeMessage and useMarkdown finds nothing. Updates arrive through `changed`, at most once per 50 ms (`turnRun.ts:28` `TURN_FLUSH_MS = 50`, `:42`).
- **Thoughts accumulate:** `turn.ts:64-69`; each chunk is appended to the last `thought` entry.
- **Opened state is lost:** `opened` lives in each AiTurn instance. The live turn (`RangeThreadBox.vue:194`) and the recorded answer (`RangeMessage.vue:147`) are separate instances, so the toggle resets when a turn moves from live to recorded. `liveTurn` (`rangeAiView.ts:51-53`) decides which one shows. [INFERENCE]
- **Existing max-height patterns:** all ad hoc Tailwind literals; there is no shared constant or CSS variable.
  - `AiStep.vue:28` `max-h-48`
  - `EditDiff.vue:103` `max-h-96 overflow-auto … opaque-scroller`
  - `QuestionDialog.vue:34` `max-h-40 overflow-y-auto opaque-scroller`
  - `CompareLanguagePicker.vue:62` and `ServerGroup.vue:74` `max-h-[60vh]`
  - `editor/theme.css:305` `max-height: 20lh`
  - Shared utility: `style.css:161` `@utility opaque-scroller` (needed for subpixel text in a scroller, plan #60).
- **Existing stick-to-bottom pattern:** `ServerLogView.vue:17` `following = shallowRef(true)`. `:53-55` `scrollToEnd` sets `scrollTop = scrollHeight`. `:94-97` `scrolled()` sets `following` to `scrollTop + clientHeight >= scrollHeight - 1`. `:78-91` `keepPlace` keeps the reader's place when not following.
- **Height changes are tracked:** the box sits in a CodeMirror block row whose height is measured. `threadWidget.ts:13,38-41` sets `cell.style.height`, and `threadHosts.ts:30` `new ResizeObserver` leads to `requestMeasure` (`:218`). Any max-height change moves the aligned bands too.

### 2. Thread box layout and Ask AI
- **Structure of `RangeThreadBox.vue`:**
  - `<section class="mx-2 my-1.5 flex flex-col gap-1 rounded-md border …">` (`:145-148`).
  - `<header class="flex min-w-0 items-center gap-2">` (`:150-185`): the place text (`flex-1 truncate`), then **Stop** while a turn runs (`:153`), else **Ask AI** (`@click="askAi"`, `:170`), then the collapse chevron (`:181`). So Ask AI is in the header, top right, just left of the collapse button.
  - `<ul>` of `RangeMessage` (`:186`). Each message has Post/Edit/Delete under it.
  - The live `<AiTurn>` (`:194-201`).
  - `<textarea>` reply field (`:202`), placeholder "Reply…", `rows: 1` (`:30`).
  - Comment/Cancel row (`:212`), shown only while there is a draft or the text is not blank.
- **No inner scroll:** the box is teleported into the code column (`RangeThreadLayer.vue:13`), so a long thread is scrolled with the column itself.
- **Where you must scroll to ask again:** the reply field is at the bottom and Ask AI is at the top. The user types at the bottom, presses Comment or Ctrl/Cmd+Enter (`rangeKeys.ts:12`, which calls `submit` → `threads.addNote`, `RangeThreadBox.vue:116-123`), then scrolls back up to the header to press Ask AI.
- **What Ask AI sends:** the stored notes, never the textarea text. `askAi` → `ai.ask(thread.id)` (`:84-86`) → `promptText` (`rangeAi.ts:110-120`), which reads `thread.messages` notes after the session's last answer.
- **Hover texts:** `ASK_AI_TITLE` = "Send your messages since the AI's last answer to the AI" (`rangeThreadText.ts:23`). When disabled, `ASK_AI_WAITING` = "Nothing to ask yet: write a message after the AI's last answer, or wait for its conversation to load" (`:24-25`).

### 3. Session continuity
- **One session per thread:** `Thread.session: Option<String>` (`thread_types.rs:119-120`).
  - The first ask sends `session/new` (`index.ts:214`).
  - The `session` event then calls `threads.setSession(thread, created)` at once (`rangeAi.ts:212-215`), which runs the `set_thread_session` command (`review.rs:114`, `thread_store.rs:103-110`).
  - The next ask uses `askedSession` = `thread.session` unless omp no longer has it (`rangeAi.ts:96-98`). `#session` then calls `agent.load(session)` (`index.ts:211`), which sends `session/load` once per process (`process.ts:105-106` `this.#loads.get(session) ?? this.#sendLoad(session)`). A session the process created counts as loaded (`process.ts:100-101`).
- **Prompt text (`rangeAi.ts:110-120`):**
  ```ts
  const last = thread.messages.findLastIndex((message) => isAnswerIn(message, session));
  const notes = thread.messages.slice(last + 1).flatMap(({ body }) => (body.kind === "note" ? [body.text] : []));
  const text = notes.join(NOTE_JOIN);   // "\n\n" (:53)
  return last === -1 ? firstMessage(context.template, { ...context.values, MESSAGE: text }) : text;
  ```
  - A follow-up contains only the notes since the last answer. omp keeps the history itself.
  - The session's first turn is wrapped in the First message template (`firstMessage.ts:11-18`, with `{{ MESSAGE }}`).
  - Sent as `prompt = [{ type: "text", text }]` with `session/prompt` (`index.ts:199-200`).
- **Process lifetime:** one per window, kept between asks.
  - `index.ts:79` "The window's one agent: the checkout made and the process started at the first ask."
  - `starter.ts:20,47` "one process at a time", reused through `this.#agent ?? this.#start(...)`.
  - A process that exits is dropped (`starter.ts:106-108`). The next ask starts a new one and loads the session silently (`AgentDesign.md:91`).
  - Plan #109 (`plan.md:141`): "One agent process per window, one conversation per thread".
- **After a reload:** Rust stops the old page's agent (`ai.rs:84-87`, `stop_agent_on_page_start`). Threads come back collapsed. Opening one runs `ai.load` (`RangeThreadBox.vue:66`, watching `[id, session]`, immediate), which calls `loadConversation(session)` → `replay` → `session/load` (`index.ts:113-121`, `process.ts:110`). Asking waits for that load (`rangeAi.ts:127`, `waiting = session !== null && (loadedSession !== session || loaded === null || unrecorded)`). The session is loaded, not recreated.
- **omp supports load:**
  - `initialize` returns `agentCapabilities { loadSession: true, … sessionCapabilities { list, fork, resume, close } }` (`3.RV-agent-design.md:27-28`; `request-review-range.md:127-128` cites `acp-agent.ts:835-844`).
  - In a new process `session/load` replays the whole conversation in 0.45 s and refuses any other `cwd` (`3.RV-agent-design.md:45-48`).
  - A load in the same live process also works (`.omp/run/notes/RVAiThreads.md:20`).
- **Session gone (`omp gc`):** a `sessionGone` end calls `ask` again with session `null` (`rangeAi.ts:189-192`). [INFERENCE] With `session = null`, `last = -1`, so every note of the thread is wrapped in First message. Old AI answers are left out, because only `note` bodies are taken (`:114`).

**Difficulties for keeping one session:**
- **Reload or restart:** the process is killed and the next one must `session/load` before any prompt. Ask AI stays disabled until the replay lands (`rangeAi.ts:127`).
- **Shared process:** all threads use one process, with updates routed by `sessionId` (`process.ts:39`). "Whether one omp process runs two prompts at once is unmeasured" (`RVAgentClient.md:97`).
- **Busy session:** a second ask on a running session ends `busy` (`index.ts:96-97`), and a load during an ask is `busy` (`:114-115`).
- **Interruption:**
  - A stop or crash within ~30 ms of the prompt leaves no prompt in omp. Recording such a turn is decided by a check-up replay (`RVAiThreads.md` measurement table; `rangeAi.ts:55-71` `HELD_*`). If that check-up load fails, later answers shift by one (`RVAiThreads.md:103`).
  - A Stop during `session/new` drops the created session unreported, so the next ask opens a new one (`RVAgentClientR1.md:66`).
  - Two `loadConversation` calls at once send two loads (`RVAgentClientR1.md:65`).
- **Folder:** `cwd` must be the same checkout path (`3.RV-agent-design.md:47`). Two processes can load one session at once; the one window per pair is the only guard (`request-review-range.md:169-171`).

### 4. Constraining decisions
- **#109** (`plan.md:141`): "`session/new` or `session/load` per thread … One agent process per window, one conversation per thread".
- **#115** (`plan.md:147`): "a thread's earlier AI conversation loads when the thread is shown open; a conversation omp no longer has (`omp gc`) → the next "Ask AI" starts a new one with every message of the thread wrapped in First message".
- **#120** (`plan.md:152`): "threads come back collapsed (opening one with `--ai` loads its conversation, #115) … text typed but not added is not kept".
- **#121** (`plan.md:153`):
  - "`Thread.session` is the conversation the next "Ask AI" continues, stored the moment omp names it (`set_thread_session` …)"
  - "`add_ai_answer` … numbered by the store … once omp holds the prompt"
  - "The window shows `loadConversation(session)`'s turn i for `AiAnswer { session, turn: i }`". Rejected there: "storing the answer text (omp's session is its truth)".
- **#123** (`plan.md:155`): "The AI's conversation is not changed: it keeps what it was sent, and the next "Ask AI" sends what is new". Edit and Delete are off "while the AI works in that thread".
- **Request C rule 2** (`request-review-range.md:92-94`): "Ask AI" (one per thread) "sends the AI every message of yours written since its last answer; the thread's first turn goes out wrapped in the "First message" template. Disabled while this thread's AI turn runs … "Stop" interrupts".
- **B rule 2** (`:72-73`): "nothing you write reaches the AI until you press "Ask AI"". The owner's answer (`:41`): "their own button, disabled while an AI turn runs".
- **C rule 3** (`:95-97`): a collapsed "Thinking and steps" section, "live while it runs, openable at any time and afterwards".
- **C rule 4** (`:98-99`): "each thread is its own AI conversation … one agent process per window. The AI's side lives in omp's own session (yamt keeps only its id)".
- None of these rows fixes the thread box layout (where the button sits, any max-height); B rule 1 (`:70-71`) only puts the thread under its line inside the code.

[You have received this identical output 3 times. Re-reading 'agent://ScoutAi' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]