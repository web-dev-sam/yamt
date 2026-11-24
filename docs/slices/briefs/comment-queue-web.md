# Slice comment-queue-web — Queue / Note buttons, Shift+Send of one comment, Post queues a note at once

Request `docs/slices/request-comment-queue.md` (rules 1–7, non-goals, acceptance; read it whole); plan §2 **#198**
(amends #118, #123). Needs `comment-queue-rust` (committed): the orchestrator regenerated `bindings.ts` with
`commands.sendMessage(message: MessageId, progress: Channel<SendProgress>)` → `SendReply` | `IpcError`
(`SendRunning` while any send runs; an unknown id → the existing unknown-message error; a known message that does not
wait → `sent` with 0/0; other queued messages untouched).

Facts (given):

- `ipc/ReviewSource.ts` is the window's review surface (`addThread`, `addNote`, `queueMessage`, `sendQueue(onProgress)`
  …); `ipc/tauriReview.ts` camelCases (`sendQueue` at :42 builds the `Channel`); `ipc/fixtureReview.ts` mirrors
  Rust in memory (`sendQueue` :217, `postQueue` :196, `SendRunning` :221, `?gitlab=<script>` with a 300 ms pause per
  message).
- `ui/rangeThreads.ts`: `addThread(key, text)` → the new `ThreadId` (`ThreadAdded.list` has it last),
  `addNote(thread, text)`, `queue(message, text)` (drops the message's `post` draft), `isQueued`; `addedTurn` (:206)
  reads a thread's last message — the pattern for finding the message just added.
- `ui/rangeGitLab.ts`: `gate(state)` (lined up or the hover reason), `send(state)` (progress in `sending`, `result`
  notice, a `notLinedUp` reply updates `check`), `postButton` (`write` opens the Post box for any message with text).
- `ui/RangeThreadBox.vue`: the new-comment box and an open thread's reply box; `submit()` adds (`addThread` or
  `addNote`), button "Comment" (`COMMENT_LABEL`, primary look) then Ask AI / Stop, Cancel; keys via
  `boxKeydown(event, platform, { submit, cancel })` (Ctrl/Cmd+Enter submits).
- `ui/RangeMessage.vue`: Post → `pressPost` (`write` → `threads.writePost`, the `RangeMessageEditor.vue` box
  `box="post"`, "Text to post", button Queue); `message.body.kind` is `"note"` or `"aiAnswer"`.
- `ui/useShiftHeld.ts`: `useShiftHeld()` — the window's one shared Shift-held state (real key release handled, #2146);
  reuse it, never a second Shift listener. The click's own `event.shiftKey` decides what a press does.
- Words live only in `ui/rangeThreadText.ts`.

## Target

Owned: `frontend/src/ipc/{ReviewSource,tauriReview,tauriReview.test,fixtureReview,fixtureReview.test}.ts`,
`frontend/src/ipc/AGENTS.md`, `frontend/src/ui/{rangeThreads,rangeThreads.test,rangeGitLab,rangeGitLab.test,
rangeThreadText,rangeThreadText.test,rangeDrafts,rangeStore,rangeStore.test,problem,problem.test,problemText,
problemText.test}.ts`, `frontend/src/ui/{RangeThreadBox,RangeMessage,RangeMessageEditor,RangeSendButton}.vue`,
`frontend/src/ui/AGENTS.md`.

Read-only: everything else; `bindings.ts` is generated; `ui/useShiftHeld.ts`, `ui/boxKeys.ts`. Docs outside the two
`AGENTS.md` are the orchestrator's: needed lines in `deviations_from_brief`.

Non-goals: request's non-goals; the merge-request page; Rust.

## Contract (fixed; you may add, never change)

```ts
// ipc/ReviewSource.ts
sendMessage(message: MessageId, onProgress: (progress: SendProgress) => void): Promise<SourceResult<SendReply>>;
// ipc/fixtureReview.ts: the same rules as Rust (facts above), sharing postQueue's path, not a copy
// ui/rangeThreadText.ts: QUEUE_LABEL "Queue" (exists), SEND_LABEL "Send", NOTE_LABEL "Note"; COMMENT_LABEL removed
```

## Change

1. `RangeThreadBox.vue`: "Comment" becomes **Queue** (primary look, first; reads **Send** while `useShiftHeld()` is
   true) and **Note** (outlined, today's add). Ctrl/Cmd+Enter = Note. Queue = add, then queue the added message with
   its text. Send = add, queue, then send only that message (`sendMessage`) with the Send to GitLab button's progress,
   result notice and `notLinedUp` handling — one send routine in `rangeGitLab.ts` serving both, not a copy. A failure
   after the add leaves the message as it stands (note or queued) and reports through the existing problem path.
2. Disabled states (rule 6) with hover texts: Queue/Send off when blank or not lined up (the gate's reason, as Post);
   Send also while `sending` (say a send is running). Note off only when blank. Hover texts: Queue "Queue this comment
   as a draft on <ref>; Send to GitLab sends the queue", Send "Send only this comment to <ref> as a draft now", Note
   "Keep this comment in yamt; Post queues it later" (orchestrator; adjust wording only for length).
3. `RangeMessage.vue`/`rangeGitLab.ts`: Post on a **note** queues it at once (no Post box); Post on an **AI answer**
   opens the Post box as today, whose Queue reads Send with Shift held and then queues and sends only that message.
4. Dead weight goes: `COMMENT_LABEL`, a note's `post` draft path if nothing else uses it.
5. `ipc/AGENTS.md`, `ui/AGENTS.md`: the lines describing these surfaces updated.

## Acceptance

- Node tests: `fixtureReview.test.ts` (sendMessage: only the named message posted, others stay queued; refusal;
  `SendRunning`; unknown id; not waiting → 0/0), `tauriReview.test.ts` (camelCasing, failures unchanged),
  `rangeThreads.test.ts`/`rangeGitLab.test.ts` (Queue adds+queues; Send adds+queues+sends one; disabled reasons; Post
  on a note queues without a draft, on an AI answer writes the draft; a failure mid-chain reported, nothing lost).
- WebKit fixture (`just app-session start-fixture --range-case review --threads seeded --gitlab linedUp [--ai]`,
  MiniBrowser), real Shift key down/up through WebDriver actions (`\uE008`), dark and light: new comment → Queue →
  queued, count +1, Send to GitLab sends it; Shift held → label Send, release → Queue; Shift+click Send → that
  message pending, a seeded queued one still queued; reply box same; Note → local, Post → queued at once, no box; AI
  answer Post → box, Shift → Send; Ctrl+Enter → Note; without `--gitlab` (or a not-lined-up script) Queue/Send
  disabled with the reason, Note works. Observed values and screenshots pasted.
- Real app (`just app-session start-app --range main...feature --repo <scripts/range-repo.sh dir> --glab lined-up`):
  Queue then Send to GitLab, and one Shift+Send; `threads.json` shows the postings.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`; `just mutants HEAD`.

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://ipc-contract`, `skill://verification`.
