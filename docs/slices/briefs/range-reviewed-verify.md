# Slice range-reviewed-verify — the gate, the WebKit fixture and the real app for Reviewed marks

Design: `docs/slices/briefs/range-reviewed-design.md` option A. Request acceptance: `docs/slices/request-range-reviewed.md`
"Acceptance" (read the rules whole). Plan §2 proposed #195–#196, #48, #107, #117; risks RK40, RK42, RK49 and the proposed
RK79. Recipes: `skill://verification`. Read-only (VF6), alone, fix nothing (VF1), no `just mutants` (VF7).
`pnpm -C frontend test:browser` cannot launch Playwright's WebKit on this host (#1242): MiniBrowser through
`just webdriver`/`just app-session` is the engine of record (VF8). Windows open only on a private display; the owner's
own yamt may be running: never `pkill`/`killall`. Scratch under `/tmp/yamt-rv/verify/`.

## Target

**Owned:** none. **Read-only:** the whole tree.

**Needs:**

- **Smoke pass** (steps B–C, no `just check`): once `range-reviewed-view` is committed (`core`, `app`, `store` before it).
- **Final pass**: once the docs keeper has written `tree.md` (new files: `ipc/{ReviewedSource,reviewedDomain,tauriReviewed,
  fixtureReviewed}.ts`, `ui/{rangeReviewed,rangeVisited}.ts`), `state.md` (the marks: Rust `ReviewedStore` owner, the
  window's mirror in `rangeReviewed.ts`), architecture §3.8 (the crate, the folder, the format), §4 (`ReviewedSource`, four
  commands), §7 (crate list), `CHANGELOG.md`, the plan and risk rows: `just check` once, then A–D.

**Non-goals:** the owner check below (handed on, not run); fixing anything.

## Contract

**Fixture** `?range=review&reviewed=seeded` (`just app-session start-fixture --name rv --range-case review --threads seeded
--reviewed seeded --size 1600x1000`): 13 files in order `config`, `data/big.txt`, `docs/current.md`, `docs/keys.md`,
`docs/legacy.txt`, `public/logo.png`, `src/api/mockBoards.ts`, `src/board/board.ts`, `src/board/reminders.ts`,
`tools/build.sh`, `tools/deploy.sh`, `tools/setup.cmd`, `vendor/ui`; seeded: `docs/keys.md` reviewed, `src/board/board.ts`
and `public/logo.png` changed since review; board.ts's since view = three lines added at right lines 41–43 (1-based);
logo.png's = the no-text sentence. Log lines `range.fixture_reviewed { kind, file }`.

**Words** (plan #196): "Reviewed", "N of M reviewed", "Changed since you reviewed it", "As you reviewed it",
"Review from start", row titles "reviewed" / "changed since reviewed", the no-text sentence of `rangeText.ts`
`SINCE_NO_TEXT`.

**Data folder:** `<home>/.local/share/yamt/reviewed/<repo key>/<16 hex>/` with `lock`, `reviewed.json` (format 1) and
`texts/<blob id>`; `range/<repo key>/<left>-<right>/` holds only the pair's lock and threads.

## Change (the steps)

### A. Gate (final pass only)

`just check` → pass, or the failing recipe and its first 30 lines.

### B. WebKit fixture, the range window (dark and light: set `<html data-theme="light">` live)

1. At open: `docs/keys.md` shows the check with a muted name; `src/board/board.ts` and `public/logo.png` the changed mark,
   visibly different; header "1 of 13 reviewed"; the Reviewed button first in the header, outlined on `config`
   (`aria-pressed="false"`).
2. Rule 2: on `config` (a file ↔ link change) click Reviewed → `config` checked, `data/big.txt` (too large) opens
   ("2 of 13"); Reviewed again → `data/big.txt` checked, `docs/current.md` opens. Open `docs/keys.md` (seeded reviewed):
   the button is filled (`aria-pressed="true"`); click → unmarked, stays on `docs/keys.md`.
3. Wrap: open `vendor/ui` (last, a submodule), Reviewed → checked, and the first not-reviewed file from the top opens
   (`docs/current.md`); binary `public/logo.png` can be marked too.
4. Rule 5: `src/board/board.ts` shows "Changed since you reviewed it", left heading "As you reviewed it", three added
   lines at right 41–43 only, Previous/Next step through that one difference, the collapse toggle hides the rest; no
   thread boxes although `&threads=seeded`; a drag over its line numbers opens no draft. `public/logo.png` shows the
   no-text sentence and "Review from start".
5. Rule 6: "Review from start" on board.ts → the whole change (7 differences, the seeded thread), no row mark, the count
   unchanged in its reviewed part; marking board.ts afterwards → checked, the next file opens; back on board.ts: the whole
   change.
6. A search (Ctrl/Cmd+Shift+F) for a word on board.ts's right side while it is changed since review (reload to re-seed)
   → the right column goes to it; a left-side hit opens board.ts and does not move.
7. The merge fixture page and `?diff` (compare) show no Reviewed button and behave as before.
8. `shot` of steps 1, 4 and 5, dark and light.

### C. Real app (`cargo tauri build --debug --no-bundle`), on a private display

Repository: `scripts/range-repo.sh /tmp/yamt-rv/verify/repo`, then `git -C …/repo switch feature`; home
`/tmp/yamt-rv/verify/home` (pass `--home` to every start so restarts share the data folder). Record
`git -C …/repo for-each-ref` and `git status --porcelain` before step 1.

1. `just app-session start-app --name v-rv --range main...HEAD --repo …/repo --home …/home` (the fixture's 13 files: the
   fixture is generated from this script, plan #103): on `docs/current.md` Reviewed → `docs/keys.md` opens; open
   `src/board/board.ts`, Reviewed → `src/board/reminders.ts` opens; "2 of 13 reviewed". `app-session stop`
   (WM_DELETE_WINDOW), exit status recorded.
2. Start again the same way: `docs/current.md` and `src/board/board.ts` checked, "2 of 13". `cat` the review folder's
   `reviewed.json` (format 1, review `range`, left `{ ref, refs/heads/main }`, `three`, right `{ ref, refs/heads/feature }`,
   two marks with `keptText: true`) and list `texts/` (two files). Stop.
3. Commit on `feature` a one-line change to `src/board/board.ts` (`git -C …/repo -c user.name=v -c user.email=v@v commit
   -am …`); start again: board.ts shows "changed since reviewed" and its view shows only that one-line change;
   `docs/current.md` still checked; "1 of 13". "Review from start" on board.ts → the whole change, no mark. On
   `docs/current.md` Reviewed (filled) → unmarked, stays; "0 of 13". Stop.
4. Moved left side (two dots, so the left is `main`'s tip): `start-app --name v-rv2 --range main..HEAD …`, mark
   `src/board/reminders.ts`, stop; commit on `main` a change to `src/board/reminders.ts`; start again → still checked
   (rule 5: the right side is unchanged). Stop.
5. Merge-request key: `start-app --name v-rvm --range <main id>..<feature id> --repo … --home … --review-of
   group/project!12`: mark `tools/build.sh`, stop; commit on `feature` a change to `tools/setup.cmd`, start with the new
   feature id and the same `--review-of` → `tools/build.sh` still checked; start with `--review-of group/project!13` → no
   marks. Stop.
6. Refusals: write `"format": 2` into one `reviewed.json`, start → exit 2, one line naming the file, the file unchanged;
   `yamt --review-of=group/project!12 --repo …` (no range) → exit 2 with its line.
7. Nothing written to the repository: `git for-each-ref` and `git status --porcelain` as recorded (plus your own commits).
8. `shot` of steps 2 and 3, dark and light. Stop every app you started; exit statuses recorded.

### D. Checks the request names

Map each request acceptance clause to the step that observed it (B2/C1 two marks and the next file; C2 restart; C3 the
changed file and its since view, Review from start, the other stays, unmark; C5 a merge request's marks after a push —
by `--review-of`, the page's own path is the owner check).

## Acceptance

For each step: pass or fail, with the observed words, the `read` results, the log lines, the JSON pasted verbatim, and the
screenshots' paths. Report `gate: pass|fail` and the `just check` result line.

**Owner check** (hand on, not run). On the owner's playground (`samubr/glab-yamt-playground` on gitlab.com), logged in as
`samubr`: from the merge-request page open an MR's changes, mark two files Reviewed (the second click opens the next
file), close; push a commit to the MR changing one of them; open its changes again → the other is still reviewed, the
changed one shows "changed since reviewed" and only the pushed change, "Review from start" shows the whole change.
