# Request — a comment in the diff window goes to GitLab's queue in one click

Settled with the owner on 2026-11-24 (session 59); details by the orchestrator (OR13) where marked, the owner may
veto. "Diff window" is the range window (`yamt --diff=…`, and the changes window a merge-request row opens). Amends
plan §2 #118 (Send sends the whole queue) and #123's Post box for a note; recorded as plan §2 #198.

## Owner's words

- "I need to click 4 buttons to send a comment to gitlab as draft. Most of the comments I write I intend to send as is
  to gitlab. So the primary option should be to send to gitlab as a draft (it queues so the user still has to send the
  queue, so 2 button clicks, but this can be improved, if the user holds shift the button says "send" instead of
  "queue"). Then there should be another option called "Note" which is a local comment (I can also send to gitlab if I
  decide to). The only comment that I should be asked to edit before sending is a comment from AI."
- Answers (form, 2026-11-24): Shift+Send sends **only this comment** (the rest of the queue stays queued); when the
  window does not line up with an open merge request, **Queue is disabled with the reason on hover**, Note still works;
  **Ctrl/Cmd+Enter keeps adding a local Note**.

## Rules

1. **Two buttons.** The new-comment box and every thread's reply box offer **Queue** (primary look, first) and
   **Note** (outlined), then Ask AI / Stop and Cancel as today. "Comment" goes.
2. **Queue** adds the text as the user's message and queues it as a draft for the lined-up merge request in the same
   press; the message shows as queued, the top bar's "Send to GitLab" counts it. Nothing is sent until Send to GitLab
   (or rule 3).
3. **Shift turns Queue into Send.** While Shift is held (the window's shared Shift state), the Queue button reads
   **Send**; a press adds the message, queues it and sends **only that message** to GitLab as a draft, with the same
   progress, result notice and refusal handling as Send to GitLab. Other queued messages stay queued. A Shift+click
   sends even if the label had not yet switched (the click's own `shiftKey` decides).
4. **Note** adds the text as a local message exactly as "Comment" does today (not queued). Ctrl/Cmd+Enter in the box
   is Note.
5. **Post on a note queues it at once**, without the edit box. Post on an **AI answer** still opens the edit box with
   its text (Queue, Cancel; with Shift held its Queue reads Send and sends only that message — orchestrator, rule 3 on
   the same button word).
6. **Disabled states.** Queue and Send are disabled when the text is blank, and with GitLab's reason on hover while the
   window does not line up with an open merge request (as Post today). Send is also disabled while a send runs. Note
   is disabled only when the text is blank.
7. Typing a message and pressing Ask AI keeps adding it as a local Note (orchestrator: it is addressed to the AI).

## Non-goals

Publishing GitLab's review (yamt only creates drafts); the merge-request page's reply field; Shift on Post, Unqueue
or Send to GitLab; new keyboard shortcuts.

## Acceptance

Fixture page and real app with a lined-up merge request: write → Queue → one queued message, Send to GitLab sends it
(2 presses); write → Shift+Queue → that message pending on GitLab, another queued message still queued; write → Note →
local, Post → queued at once; AI answer → Post → edit box; not lined up → Queue/Send disabled with the reason, Note
works; Ctrl+Enter adds a Note.
