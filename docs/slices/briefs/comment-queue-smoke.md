# Smoke pass comment-queue — the Queue / Note / Shift+Send buttons in WebKit and the real app

Request `docs/slices/request-comment-queue.md` (rules 1–7); web slice `briefs/comment-queue-web.md` (its Acceptance
WebKit and real-app lines were NOT run by the implementer: the machine lacked WebKitWebDriver/Xvfb, now installed).
Tree: main at spawn (web round 1 `8aa95cff`). Smoke only (VF11): no `just check`, no mutation run, fix nothing.

## Steps

1. WebKit fixture, MiniBrowser: `just app-session start-fixture --name cq --range-case review --threads seeded
   --gitlab linedUp --ai`, dark and light. Shift through **real** WebDriver key actions (`keyDown`/`keyUp` of
   `\uE008`), not synthetic DOM events.
   - New comment (drag or click a line number) → type → **Queue** → the message shows queued; Send to GitLab's count
     +1; Send to GitLab sends it (pending, link shown).
   - Shift down → the primary button reads **Send**; Shift up → **Queue** at once.
   - Shift+click Send on a new comment → that message pending; a seeded queued message still queued; the result
     notice shown.
   - An open thread's reply box: Queue and Shift+Send as above.
   - **Note** → a local message (no queued label); its **Post** → queued at once, no edit box.
   - Ctrl+Enter in the box → a Note.
   - An AI answer's Post → the edit box ("Text to post"); its Queue reads Send with Shift held; Queue queues it.
   - Blank text → Queue/Send/Note disabled.
   - Restart the fixture without `--gitlab` (or `--gitlab` with a not-lined-up script from `fixtureGitLab.ts`):
     Queue/Send disabled with GitLab's reason on hover; Note works.
   - During a send (`--gitlab slow` if it exists, else any send) Send is disabled with its hover text.
2. Real app: `scripts/range-repo.sh <dir>`, then `just app-session start-app --name cqa --range main...feature --repo
   <dir> --glab lined-up` (build first: `cargo tauri build --debug --no-bundle`): one Queue then Send to GitLab, one
   Shift+Send with another message still queued; `threads.json` in the pair folder shows the postings; the fake glab
   log shows exactly one draft POST for the Shift+Send.

Report each step's observed values and screenshots (dark and light) with pass/fail.
