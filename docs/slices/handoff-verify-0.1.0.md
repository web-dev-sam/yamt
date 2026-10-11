# Handoff — checks for 0.1.0 after publishing

Your call (2026-10-11): ship 0.1.0 today and check the rest afterwards. Every automated check of the
last feature (a conflicted file changed on disk is the truth, plan §2 #52/#53) has since finished
and **passed**. What is left is yours: two tries with real use. Problems found there go into 0.1.1.

## Proven

- **Reviews.** Every review passed: the Rust side and the window side, each with two rounds of fixes.
- **`just check`** exit 0, at `deb7c66` and at `9747d99`: 326 Rust tests, all web tests, 10 goldens.
- **Desktop app on a copy of the Vue merge**, all 8 steps:
  1. untouched start: no notice;
  2. regenerated `pnpm-lock.yaml` → staged, with a notice;
  3. `renderer.ts` with one block fixed on disk → one conflict left, and applying a side works;
  4. edits in yamt dropped when the file changed on disk, and the notice says so;
  5. a deleted file → staged as deleted;
  6. Mark resolved after an outside change yamt had not seen → the outside text kept and staged;
  7. a file fixed before start → "differs on disk from git's merge — 1 conflict left";
  8. closing with files open → exit 1.

  The start-up check takes 64 ms for the 7 files.

- **Switching files, with real clicks**, in the browser engine the app uses. Apply, Undo, bulk apply
  and Mark resolved all act on the file shown; the other file stays as it was. The earlier "wrong
  file" report came from a test script that clicked hidden buttons (#579), not from yamt.
- **Mutation testing** (`just mutants 5eb25c8`, 10 min):
  - Rust: 227 caught, 27 missed, 99 unviable, 1 timeout.
  - TypeScript: 93 % killed.
  - The new 4 GB cap stopped 6 runaway test copies; available memory never dropped below 9.3 GB.
  - The missed ones are untested edge cases (error paths, boundaries), listed on the work board as
    follow-up tests (row 13''', findings #581–#582). None of them is a known wrong behaviour.

## Yours

1. **A real merge of your own** in the desktop app, side by side with WebStorm (board row C').
   - The Vue trial merge in `~/yamt-trial/vue-merge-yamt` is ready.
   - Try the new behaviour too: fix a file in another editor, or regenerate a lock file, then click
     back into yamt.
2. **The macOS build** from the release, on your Mac (board row 4). Open the `.dmg`, drag yamt to
   Applications, then right-click → Open the first time (the build is unsigned). Run it on a merge.
   Note how long the window takes to appear.

If you find something, tell me what you saw (which file, what you clicked, what happened).

## Follow-ups already known (not blocking, board row 13''')

- Tests for the mutation survivors above.
- Make the conflict-marker parser unable to loop forever by construction. The mutants the cap
  stopped show how close the loop is to that.
- One more Rust assertion that a deleted-side file shows the disk view after staging.
- Remove two test cases that can no longer happen.
- Decide whether `just test` should get the same 4 GB cap.
