# CommentQueueWeb

Agent output (`agent://CommentQueueWeb`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueWeb.md), collected 2026-11-24T18:37:26.048Z.

{
  "summary": "The range window's comment and reply boxes now show Queue (primary; reads Send while Shift is held) and Note (local add, Ctrl/Cmd+Enter). Queue adds the comment and queues it in one press. Send adds, queues and sends only that message through `sendMessage`, using Send to GitLab's send routine. Post on a note queues it at once. Only an AI answer opens the Post box, and its Queue becomes Send with Shift. Node tests, lint, typecheck and mutants pass. The WebKit fixture and real-app checks were NOT run: this machine has no WebKitWebDriver, MiniBrowser or Xvfb.",
  "files_changed": [
    "frontend/src/ipc/ReviewSource.ts",
    "frontend/src/ipc/tauriReview.ts",
    "frontend/src/ipc/tauriReview.test.ts",
    "frontend/src/ipc/fixtureReview.ts",
    "frontend/src/ipc/fixtureReview.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/rangeThreads.ts",
    "frontend/src/ui/rangeThreads.test.ts",
    "frontend/src/ui/rangeGitLab.ts",
    "frontend/src/ui/rangeGitLab.test.ts",
    "frontend/src/ui/rangeThreadText.ts",
    "frontend/src/ui/rangeAi.ts",
    "frontend/src/ui/rangeAi.test.ts",
    "frontend/src/ui/RangeThreadBox.vue",
    "frontend/src/ui/RangeMessage.vue",
    "frontend/src/ui/RangeMessageEditor.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "fixtureReview: sendMessage posts only the named message and leaves the other queued ones waiting",
      "proves": "Only message 1 becomes pending (draft 102, !12); progress is [1 of 1]; all other postings are unchanged."
    },
    {
      "name": "fixtureReview: ?gitlab=refusal / ?gitlab=stopped on the named message",
      "proves": "The outcome follows the message's place in the whole queue: refused 0/1, or stopped with no progress and nothing changed."
    },
    {
      "name": "fixtureReview: sendMessage of a message that does not wait / unknown / not lined up",
      "proves": "Pending or notQueued gives sent 0/0 at once with no progress. An unknown id gives UnknownMessage before the check. Not lined up returns the check's answer and changes nothing."
    },
    {
      "name": "fixtureReview: sendMessage and sendQueue each answer SendRunning while the other runs",
      "proves": "The two sends share one guard, and SendRunning is checked before the unknown-id check."
    },
    {
      "name": "tauriReview: sendMessage passes the message… / a sendMessage failure comes back unchanged",
      "proves": "The message id reaches the command, progress goes through the Channel, the reply is camelCased, and IpcError passes through unchanged."
    },
    {
      "name": "rangeThreads: addTyped on a draft / on a thread / answers null…",
      "proves": "addTyped names the new thread and the message it added (the appended note, not the thread's first). Blank text, a missing draft or a refused add gives null and keeps the text."
    },
    {
      "name": "rangeGitLab: Queue and Send are off with Checking GitLab… / not lined-up / while a send runs",
      "proves": "queueButton gives labels Queue/Send with the gate's reason, the queue/send-one titles, off for blank text, and Send off only while a send runs."
    },
    {
      "name": "rangeGitLab: Queue on a reply / on a new thread",
      "proves": "One press adds and queues the comment: count +1, note draft cleared, draft-0 dropped, nothing sent."
    },
    {
      "name": "rangeGitLab: Send adds, queues and sends only that message…",
      "proves": "sendMessage is called with the new id only. That message is pending; seeded queued and refused messages stay waiting; the result notice is set."
    },
    {
      "name": "rangeGitLab: Send shows its progress… notLinedUp replaces the check",
      "proves": "The top-bar button reads 'Sending 1 of 1…'. A notLinedUp reply updates the check, sets no result, and the message stays queued."
    },
    {
      "name": "rangeGitLab: a failed queue / a failed send / a failed add",
      "proves": "Each failure is reported under its step (queue/send/note). The message stays a note or stays queued; typed text is kept; later steps do not run."
    },
    {
      "name": "rangeGitLab: Queue and Post's Queue do nothing while not lined up or blank…",
      "proves": "The chain re-checks the button rule: not lined up, blank text, or Send during a running send adds nothing and sends nothing."
    },
    {
      "name": "rangeGitLab: Post's Queue on an AI answer queues it; with Shift it sends only that message",
      "proves": "queuePost queues and drops the Post draft. With sendNow it sends only that message (pending with the edited text); others stay queued."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && pnpm -C frontend lint && pnpm -C frontend fmt:check && pnpm -C frontend unused",
      "observed": "vue-tsc -b clean; oxlint + eslint clean; 'All matched files use the correct format.'; knip --include exports,types: no findings"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  314 passed (314); Tests  4734 passed (4734)"
    },
    {
      "command": "pnpm exec vitest run src/ipc/fixtureReview.test.ts / src/ipc/tauriReview.test.ts",
      "observed": "63 passed / 18 passed"
    },
    {
      "command": "pnpm exec vitest run src/ui/rangeGitLab.test.ts src/ui/rangeThreads.test.ts src/ui/rangeAi.test.ts src/ui/rangeStore.test.ts",
      "observed": "Test Files 4 passed; Tests 159 passed (before the 3 addTyped tests); rangeThreads.test.ts alone afterwards: 44 passed"
    },
    {
      "command": "just sfc-order",
      "observed": "tsx scripts/check-sfc-order.ts: no output, exit 0"
    },
    {
      "command": "just app-session start-fixture --name cq --range-case review --threads seeded --gitlab linedUp --ai",
      "observed": "app-session: timed out after 30000 ms waiting for WebKitWebDriver; `just webdriver 4999` → 'exec: xvfb-run: not found'; /usr/bin/WebKitWebDriver, /usr/bin/Xvfb, /usr/lib/webkitgtk-6.0/MiniBrowser absent; pacman: webkitgtk-6.0 and xorg-server-xvfb not installed"
    },
    {
      "command": "just map-check (in this worktree)",
      "observed": "missing: command send_message and ReviewSource.sendMessage in docs/architecture.md / ipc-contract. Main applied my three doc lines on main, where map-check passes; this worktree still has the old docs."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 1105 killed, 2 timeout, 27 survived, 9 no-cov (96.85%); survivors on changed lines: 3, listed below",
    "survivors": [
      "frontend/src/ui/rangeThreads.ts:138 OptionalChaining `find(...)?.messages` → `.messages` — gate-covered: vue-tsc rejects member access on `Thread | undefined` (strict).",
      "frontend/src/ui/rangeThreads.ts:159 `message === undefined ? null` → `false ? null` — gate-covered: vue-tsc rejects `.id` on `Message | undefined`; the case only arises if Rust's add reply lacks the message it just appended.",
      "frontend/src/ui/rangeThreads.ts:238 OptionalChaining `lastMessage(list, id)?.body` → `.body` — gate-covered: vue-tsc rejects it (lastMessage returns `Message | undefined`)."
    ]
  },
  "acceptance_not_run": [
    "WebKit fixture walk (MiniBrowser, real Shift via \\uE008, dark and light, screenshots): not run. This machine has no WebKitWebDriver, MiniBrowser (webkitgtk-6.0) or Xvfb, so `just app-session start-fixture` times out and `just webdriver` fails with 'xvfb-run: not found'.",
    "Real app (`just app-session start-app --range main...feature … --glab lined-up`, threads.json postings): not run. It needs the same private display (Xvfb) and WebKitWebDriver, which are missing."
  ],
  "deviations_from_brief": [
    "Main approved extending ownership to ui/rangeAi.ts and rangeAi.test.ts. AskFrom moved into rangeThreads.ts and was renamed `AddTo`, since Queue and Note now use it too. The add dispatch is now `rangeThreads.addTyped(to, text) → { thread, message } | null`, and rangeAi calls it; one dispatch, no copy.",
    "RangeThreadBox's Note also goes through `addTyped`. The public `addThread` and `addNote` stay because rangeAi.test and rangeThreads.test use them (about 50 call sites).",
    "`rangeThreads.queue` now returns `Promise<boolean>` (whether the queue was stored), so the chain can stop.",
    "Post box (AI answer): its button now uses `gitlab.queueButton`. This adds the lined-up gate (rule 6), the Send-while-sending block and the hover title; before, it had no title and no gate. `RangeMessageEditor` emits `submit(text, sendNow)`.",
    "The fixture keys `?gitlab=refusal|stopped` outcomes to the message's place in the whole queue, so sending message 1 alone is still refused or stopped as in a whole-queue send. The ipc AGENTS.md wording was changed to 'the second queued message'.",
    "The note's `post` draft path removed nothing: the post draft is still the AI answer's Post box, and rangeDrafts keeps the Edit/Post never-open-at-once rule.",
    "Comments use 'plan row 198', not '§2 #198': scripts/palette.test.ts reads '#198' as a colour literal.",
    "Docs outside the two AGENTS.md (architecture.md :798 and :810, ipc-contract after :95) were sent to Main, who applied them on main. map-check in this worktree still fails on those names only."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/RangeThreadBox.vue, RangeMessageEditor.vue",
      "risk": "Never seen in WebKit: the Shift-held label swap, `event.shiftKey` on click, the disabled wrapper titles, and the dark/light look are covered by unit tests only."
    },
    {
      "location": "frontend/src/ui/rangeGitLab.ts:205-224",
      "risk": "If Send to GitLab starts between Send's add/queue and its send, `send()` returns early with no message or notice. The new comment stays queued (nothing lost)."
    },
    {
      "location": "frontend/src/ui/RangeMessage.vue:62-66",
      "risk": "Post on a note calls threads.queue directly and relies on postButton's gate check; a Shift+click on Post only queues (Shift on Post is a non-goal)."
    }
  ]
}
