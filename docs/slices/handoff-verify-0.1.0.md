# Handoff — remaining checks for 0.1.0 (run after publishing)

Your call (2026-10-11): ship 0.1.0 today, check the rest afterwards. This file lists exactly what
is not yet proven for the last feature (a conflicted file changed on disk is the truth, plan §2
#52/#53), how to run each check, and what counts as a pass. A problem found here goes into 0.1.1.

## Already proven (do not redo)

- **Every review passed.** Rust and window, each with two rounds of fixes.
- **`just check`** exit 0 at `deb7c66` and at `9747d99`: 326 Rust tests, all web tests, 10 goldens.
- **Desktop app on a copy of the Vue merge**, all 8 steps:
  1. untouched start: no notice;
  2. regenerated `pnpm-lock.yaml` → staged with a notice;
  3. `renderer.ts` with one block fixed on disk → one conflict left, and applying a side works;
  4. edits in yamt dropped when the file changed on disk, with the notice saying so;
  5. a deleted file → staged as deleted;
  6. Mark resolved after an unseen outside change → the outside text kept and staged;
  7. a file fixed before start → "differs on disk from git's merge — 1 conflict left";
  8. closing with files open → exit 1.

  The start-up check takes 64 ms for the 7 files.

- **Memory safety of the test tools** after the crash: `just mutants` now caps every test program at
  4 GB and builds in `/var/tmp/yamt-mutants`. The mutant that took the machine down is now stopped at
  4.2 GB and counted as caught.

## Still to run

### 1. Mutation testing of the new code

Run it alone: nothing else heavy at the same time (no app, no browser test session).

```bash
cd ~/Projects/yamt
just mutants 5eb25c8 2>&1 | tee /tmp/yamt-mutants.log
```

- **Rust part** (about 350 mutants, ~10 min).
  - The summary line ends like `N caught, M missed, K unviable`.
  - The survivors are listed in `target/mutants/mutants.out/missed.txt`.
- **TypeScript part** (Stryker, on the changed `ipc/` and `ui/` files): longer; the report is printed
  at the end.
- **Desktop notices.** Your desktop may show "terminated by the Linux kernel because the system is low
  on memory" for a `run-…scope`. That is the 4 GB cap stopping a broken test copy, not the system
  running out.
- **Pass.** Each missed mutant is either harmless (no behaviour a user could see) or becomes a small
  follow-up test. A missed mutant in these files deserves a closer look:
  - `crates/session/src/{writes,disk,start,markers,seed,locate}.rs`;
  - `frontend/src/ui/{diskChanges,views,store}.ts`.

  These files decide what gets staged or written.

- **Earlier partial run.** It reached mutant 177 of 354: 115 caught, 10 missed, 52 unviable. The 10
  missed are listed in `target/mutants/mutants.out/missed.txt` until the next run overwrites it.

### 2. Switching files, then acting, with real clicks

The last automated run clicked buttons through a script and hit a hidden copy of the first file's
toolbar. That is an artefact of the test script, not a bug (#579). Confirm it by hand in the
desktop app, which takes 2 minutes:

1. `scripts/conflict-repo.sh /tmp/yamt-switch`, then start yamt on it: the released AppImage
   (`cd /tmp/yamt-switch && ~/Downloads/yamt_0.1.0_amd64.AppImage`) or, from the repository,
   `just app --repo /tmp/yamt-switch`.
2. The first file opens. Click a **second** text file in the list.
3. On that second file: click an apply arrow, then Undo, then "apply non-conflicting from the left".
   The changes show in the second file's middle pane, and its header count changes.
4. Click Mark resolved. The **second** file gets the resolved mark, not the first.
5. Click the first file again. It is as you left it.

Pass: every action lands on the file you are looking at.

### 3. Yours, as before

- **C': a real merge of your own** in the desktop app, side by side with WebStorm.
  - The trial merge in `~/yamt-trial/vue-merge-yamt` is ready.
  - Try the new behaviour there too: fix a file in another editor, or regenerate a lock file, then
    come back to yamt.
- **Row 4: the macOS build** from the release, on your Mac (Safari's engine). Same steps as above,
  plus the start-up time.

## Follow-ups already known (not blocking)

These are on the work board, row 13''' and earlier:

- make the conflict-marker parser unable to loop forever by construction (the mutant that crashed
  the machine showed how close the loop is to that);
- one more Rust assertion that a deleted-side file shows the disk view after staging;
- two test cases in `deletedSide.test.ts` that can no longer happen;
- a decision on whether `just test` should get the same 4 GB cap.
