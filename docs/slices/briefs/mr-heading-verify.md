# Slice mr-heading-verify — the gate, the WebKit fixture and the real app for the merge-request heading

Design: `docs/slices/briefs/mr-heading-design.md` option A. Request acceptance: `docs/slices/request-mr-heading.md`
"Acceptance" (read the rules whole). Plan §2 #119, #132, #195, proposed #199; risks RK40, RK42, RK79. Recipes:
`skill://verification`. Read-only (VF6), alone, fix nothing (VF1), no `just mutants` (VF7). `pnpm -C frontend
test:browser` cannot launch Playwright's WebKit on this host: MiniBrowser through `just app-session` is the engine of
record (VF8). Windows open only on a private display; the owner's own yamt may be running: never `pkill`/`killall`.
Scratch under `/tmp/yamt-mh/verify/`.

## Target

**Owned:** none. **Read-only:** the whole tree.

**Needs:**

- **Smoke pass** (steps B–C, E, no `just check`): once `mr-heading-web` is committed (`mr-heading-rust` with the
  regenerated `ipc/bindings.ts` and `fixtures/range/*.json`, and `mr-heading-sides`, before it).
- **Final pass**: once the docs keeper has written `tree.md` (new `ui/RangeHeadingLine.vue`, `ui/RangeColumnHeading.vue`;
  the `src-tauri (range)` row's `RangeOf` and `--mr-*`), `state.md` (`RangeState.heading`, from the arguments, read once),
  architecture §3 (`yamt-range`'s `MergeRequestNames`, `RangeHeading`, `RangeTotals`; `src-tauri` args, `range.rs`,
  `window.rs`, `second_window.rs`), the ipc-contract command list (`open_range`), the ui `AGENTS.md`/architecture rule-7
  text (the side column only on the files screen), `CHANGELOG.md`, plan row #199 and the RK42/RK79 texts: `just check`
  once, then A–E.

**Non-goals:** the owner check below (handed on, not run); fixing anything.

## Contract

**Title bar** (rule 1, VU18: parts **two spaces** apart, no `·`, `|`, `•`; `→` U+2192 content; `−` U+2212; ` — <folder>
— yamt` with U+2014 as today):

- changes window: `!<iid> <title>  <source> → <target>  +A −R — <folder> — yamt`
- plain: `<range as typed>  +A −R — <folder> — yamt`
- started with `--review-of` and no names: `!<iid>  <left short id>..<right short id>  +A −R — <folder> — yamt`

Check every title character by character (`xprop -id <window> _NET_WM_NAME | od -c` shows the two spaces and no `·`).
This host has no `xdotool`, `xwininfo` or `wmctrl`, and the private display has no window manager: find the window ids
as the smoke pass did (`.omp/run/notes/MrHeadingSmoke.md`, an `XQueryTree` walk of the display), and read a window wider
than the display from its page under WebDriver (step 3) rather than from a screenshot.

**Words:** column note "where `<branch>` branched off"; the line's accessible name "What this window compares"; the since
view's left heading "As you reviewed it" (unchanged).

**Fixture** `?range=<case>&heading=<value>` (`just app-session start-fixture --name <n> --range-case <case> [--heading
<value>] --size <w>x<h>`): `review` = `main...feature` (left `531ea52`, right `9c1ba3f`, 13 files), `empty` =
`feature..feature`; `heading` `mergeRequest` = !12 "Reminders before a card is due", `feature` → `main`; `fork` = !8, a
title of about 120 characters, `sam:feature/reminders-grouped-by-due-day` → `main`; `hiddenFork` = the same with the
source `(fork) feature/reminders-grouped-by-due-day`; `unnamed` = !12 without names. The
case's totals: `jq '.start.totals' frontend/fixtures/range/<case>.json`; the list's sums: `jq '[.start.files[].lines |
select(.kind == "counted") | .added] | add'` (and `.removed`).

**Real app:** `scripts/range-repo.sh`'s repository with the fake glab scenario `merge-requests` (project
`taskboard/taskboard`): !13 = `531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19`,
"Snooze a reminder", `snooze` → `main`, its head only on the fake GitLab until opened; !12 = `531ea52..9c1ba3f`, the pair
`main...feature` shows. `app-session start-app` takes `--review-of <project!iid>` and `--mr-title <text> --mr-source
<branch> --mr-target <branch>` (all three, with `--review-of`).

## Change (the steps)

### A. Gate (final pass only)

`just check` → pass, or the failing recipe and its first 30 lines.

### B. WebKit fixture (dark and light: `read --name <n> "document.documentElement.dataset.theme = 'light'"`)

1. `--range-case review --heading mergeRequest --size 1280x800`: the line, above the file's header: `!12` muted, the
   title in bold, `feature` and `main` as monospace chips with a muted `→`, `+A −R` at the right end with A/R equal to the
   case's totals **and** to the list's sums (`jq` above); the `+A`/`−R` spans' computed colours equal a file row's
   (`RangeFileRow`). Left header `main where feature branched off 531ea52` (name bold, note muted, id muted monospace),
   right `feature 9c1ba3f`; hovering a header shows the commit subject (`title`). Every `header` button's right edge ≤
   `innerWidth` (`read`). No `·`, `|`, `•` or `-` in the line's text. Open three files: the line stays, the numbers
   never change; mark a file Reviewed and search a word: the numbers do not change (rule 4). Open Settings and the
   merge-request list: no line and no side column there (rule 2, rule 7); back on files both as they were.
2. `--heading fork` and `--heading hiddenFork` at 1280x800 and 900x600: chips `sam:feature/…` and `(fork) feature/…`;
   the title truncates first, the chips truncate with the full name on hover, the totals and every header button stay
   visible.
3. `--heading unnamed`: line `!12`, chips `9c1ba3f` → `531ea52`; both headers are short ids only.
4. No `--heading`: chips `main`, `...`, `feature`; headers as in 1 (the `...` wording); no `!`. Search panel's pane
   titles read `main, where feature branched off (531ea52)` and `feature (9c1ba3f)`.
5. `--range-case empty`: the line (`feature`, `..`, `feature`, `+0 −0`) above the empty-range text `feature (9c1ba3f) and
   feature (9c1ba3f) have the same files.`
6. In no header of steps 1–5 is there a 40-hex id (`read` with `/[0-9a-f]{40}/` over every `h3`).
7. `shot` of steps 1, 2 (900x600), 3 and 5, dark and light.

### C. Real app (`cargo tauri build --debug --no-bundle`, `cargo build -p yamt-cli`), on a private display

Repository `scripts/range-repo.sh /tmp/yamt-mh/verify/repo`; record `git -C …/repo for-each-ref` and `git status
--porcelain` before step 1. A separate `--home` per window (`…/home1` …) so pair locks never meet.

1. `just app-session start-app --name mh-page --range main...feature --repo …/repo --glab merge-requests --mr --home
   …/home1 --size 1280x800`. Its title bar (`xprop -id <window> _NET_WM_NAME`, window id as above):
   `main...feature  +A −R — repo — yamt`, A/R equal to `target/debug/yamt-cli range …/repo main...feature | jq
   '.start.totals'` and to its list's sums; on the merge-request page there is neither the line nor the side column.
2. On the page, `!12`'s Show Diff answers already open (the same pair); `!13`'s Show Diff starts a second yamt. Its title
   bar (`xprop -id <window> _NET_WM_NAME`) reads exactly `!13 Snooze a reminder  snooze → main
   +A −R — repo — yamt` (two spaces before `snooze` and before `+A`), A/R equal to `yamt-cli range …/repo 531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19`'s
   totals and list sums (the head is local now). The session's log holds `starting a second window` with `--mr-title=Snooze
   a reminder`, `--mr-source=snooze`, `--mr-target=main`. `shot --name mh-page --display`: the second window's line
   (`!13`, title, `snooze` → `main` chips, coloured totals) and headers (`main where snooze branched off 531ea52`,
   `snooze 6ea97d8`). Close it as `app-session stop` does (WM_DELETE_WINDOW), or `kill -TERM` the pid the session log's
   `starting a second window` line names; record its exit status.
3. The same window under WebDriver: `start-app --name mh-child --range 531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19
   --repo …/repo --glab merge-requests --review-of 'taskboard/taskboard!13' --mr-title 'Snooze a reminder' --mr-source
   snooze --mr-target main --home …/home2 --size 1280x800`: the same title bar; `read` the line and headers as in 2; no
   40-hex id in any `h3`. Posting still lines up (rule 6, #119): queue one comment on a listed text file (drag over a right
   line number, type `check`, Queue) → the Send button's title reads `Send the 1 queued comment to your pending review on
   !13`, no not-lined-up notice. Do not send. Stop.
4. Rule 6, an older start: `start-app --name mh-old --range <the same pair> --repo …/repo --glab merge-requests
   --review-of 'taskboard/taskboard!13' --home …/home3`: title `!13  531ea52..6ea97d8  +A −R — repo — yamt`; line
   `!13`, chips `6ea97d8` → `531ea52`; headers short ids only. Stop.
5. Refusals: `target/debug/yamt --diff=a..b --repo …/repo --mr-title=x` → exit 2 with "give --mr-title, --mr-source and
   --mr-target together, each once"; with all three and no `--review-of` → exit 2, "--mr-title, --mr-source and
   --mr-target go with --review-of=<project>!<iid>".
6. Nothing written to the repository: `git for-each-ref` and `git status --porcelain` as recorded (RK40).
7. `shot` of steps 2 (display), 3 and 4, dark and light. Stop every app you started; exit statuses recorded.

### D. Checks the request names

Map each request acceptance clause to the step that observed it: the title bar from the page (C2), A/R = the list's sums
(B1, C1, C2), the coloured line and both headers by branch with muted short ids (B1, C2, C3), posting lines up (C3), a
plain window's totals in title bar and line (C1, B4), older arguments (C4), Settings and the merge-request list hide the
side column and the line in all three windows and files brings both back as they were (B1, C1, E), `just check` (A),
dark and light (B7, C7, E5).

### E. Rule 7 in all three windows (WebKit fixture, 1280x800, dark and light)

1. Range `start-fixture --name mh-sr --range-case review --heading mergeRequest --mr list`: switch the list to tree
   mode, close one folder, scroll the list down, drag the column wider, open search and type a word; `read` the list's
   `scrollTop`, the column's width, the query. Open Settings → no side column and no line, the screen starts at the
   window's left island edge; press Ctrl+B and Ctrl/Cmd+Shift+S there → nothing changes. Back to files → the column and
   the line as left (`read` the same values). The merge-request list: the same.
2. Range: hide the list with Ctrl+B on files, open Settings, come back → still hidden; the search panel as left.
3. Compare `start-fixture --name mh-sc --diff --mr list`: Settings and the merge-request list hide the tab list; back on
   files the same tab shown, the list's scroll as left.
4. Merge `start-fixture --name mh-sm` (the default merge page): Settings hides the side column; back on files as left; a
   server log screen likewise if the fixture offers one (else say so).
5. `shot` of each window's hidden and restored state, dark and light.

## Acceptance

For each step: pass or fail, with the observed words, the `read` results, `xprop`/`od` outputs, `jq` outputs, the log lines
pasted verbatim, and the screenshots' paths. Report `gate: pass|fail` and the `just check` result line.

**Owner check** (hand on, not run). On the owner's playground (`samubr/glab-yamt-playground` on gitlab.com): from the
merge-request page open an MR's changes → the title bar reads `!<iid> <title>  <source> → <target>  +A −R — <folder> —
yamt` and the window shows the line and headers by branch; a merge request from a fork (if the playground has one)
shows `<namespace>:<branch>` as GitLab's own page does; Settings and the merge-request list hide the side column in the
merge, compare and range windows.
