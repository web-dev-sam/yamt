# Build W.2 — one shared helper for driving the real app and the fixture page

Board "Workflow" row 2. Why (owner #740, Gate D W6): every builder and checker writes its own
throwaway WebDriver scripts (`/tmp/sv-wd/*.mjs`, copied again by the next round); the first settings
final check spent 68 of 156 actions driving the app. One committed, tested helper removes that
setup cost without lowering what is checked.

## Target

Owned: `frontend/scripts/app-session.ts` (CLI entry), `frontend/scripts/app-session/**` (its
modules, if you split), their `*.test.ts`. Read-only: everything else. The orchestrator adds a
`just app-session *args` recipe and the project-map line from your report; until then run it as
`pnpm -C frontend exec tsx scripts/app-session.ts <command> …`.

Non-goals: a test framework, assertions, retries, parallel sessions per name, macOS/Windows,
anything in `src/`.

## Contract — the CLI (exactly these commands; every command prints one JSON line on success, an

error line and a non-zero exit otherwise)

```
app-session start-app     --name <n> [--binary target/debug/yamt] [--repo <dir> | --fresh-repo]
                          [--settings <json text>] [--size 1600x1000] [--record <file.mkv> --record-seconds <s>]
app-session start-fixture --name <n> [--size 1600x1000]
app-session click   --name <n> <accessible name> [--role <role>] [--nth <i>] [--x11]
app-session press   --name <n> <key> [<key> …]          # "Ctrl+Z", "Shift+Tab", "Enter", "a"; --x11 for xdotool
app-session type    --name <n> <text> [--x11]
app-session scroll  --name <n> <accessible name or css> --to <bottom|top|px>
app-session read    --name <n> <js expression>          # prints {"value": <JSON>}
app-session shot    --name <n> <file.png> [--display]   # page screenshot, or the private display
app-session focus-away --name <n>                       # give X focus to another window (re-read on focus)
app-session focus-back --name <n>
app-session colours <file.mkv> <hex> [<hex> …]          # per-frame counts, consecutive equal rows collapsed
app-session stop    --name <n>                          # kills everything it started, removes its temp folders
```

- **start-app**: a private `Xvfb` on a free display; `tauri-driver` with `env -u WAYLAND_DISPLAY`,
  `GDK_BACKEND=x11`, `DISPLAY`, and **always** `XDG_CONFIG_HOME` and `HOME` under the session's own
  temp folder (never the owner's `~/.config`; refuse to start if it would resolve there);
  `--settings` writes `<config>/yamt/settings.json` before the app starts; `--fresh-repo` runs
  `scripts/conflict-repo.sh <tmp>/repo`; the WebDriver session uses
  `{"tauri:options": {"application": <binary>, "args": ["--repo", <dir>]}}`; `--record` starts
  `ffmpeg -f x11grab` at 60 fps on the display before the app so the first frames are captured.
  Prints `{display, driverPort, session, configDir, repoDir, record}`.
- **start-fixture**: `pnpm -C frontend dev --port <free> --strictPort` and `just webdriver <free>`
  with the MiniBrowser capabilities from `skill://verification`; prints `{url, driverPort, session}`.
- State per `--name` in `/tmp/yamt-app-session/<n>.json` (pids, ports, session id, folders), so
  separate shell calls share one session; `stop` reads it, ends the WebDriver session, kills every
  pid it started (process group), removes the temp folders, deletes the state file; `stop` on an
  unknown name exits 0 with a note.
- **click/scroll** find a visible element by accessible name (`aria-label`, else `title`, else
  trimmed text; optional role) through one `execute` that returns its rect; then a WebDriver
  pointer action at its centre (or `xdotool mousemove/click` on the display with `--x11`).
  Ambiguous or missing → an error naming the candidates found.
- **colours** decodes the recording with `ffmpeg -f rawvideo -pix_fmt rgb24` and counts exact
  matches of each hex per frame; prints the collapsed table and, per hex, the number of frames
  with ≥ 1 match.

## Constraints

- Node built-ins only (`fetch`, `child_process`, `fs`); no new dependency (vision 5).
  `skill://ts-conventions`; files ≤ 300 lines, functions ≤ 40; lint, typecheck and knip pass.
- Pure parts (argument parsing, key-name → WebDriver/xdotool key mapping, the element-finding
  script's matching rules as a plain function, colour counting over an RGB buffer, state-file
  shape) live in modules with node tests; process and HTTP code stays thin.
- Never kill a process it did not start; never touch the owner's dev server (port 5173) or
  `~/.config/yamt`; screenshots only of the page or the private display (VF9).

## Acceptance

- `pnpm -C frontend lint`, `typecheck`, `test`, `just web-unused` exit 0; paste the tails.
- Unit tests that fail for plausible bugs (wrong key mapping, a hidden element matched, colour
  off-by-one at frame boundaries, a state file that loses a pid).
- A real run, pasted (build `cargo tauri build --debug --no-bundle` first):
  1. `start-app --name smoke --fresh-repo --settings '{"theme":"light"}' --record /tmp/s.mkv
     --record-seconds 5`; `read … document.documentElement.dataset.theme` → `"light"`;
     `colours /tmp/s.mkv 26282c 191a1c e9eaee` → no dark frame;
     `click … Settings`; `click … Dark`; `read …` → `"dark"`; `shot …`; `press … Escape`;
     `focus-away`/`focus-back`; `stop` → `pgrep` finds none of its processes, temp folders gone.
  2. `start-fixture --name fx`; `click … "Next change"`; `press … Enter`; `read` the toolbar
     status text before/after; `stop`.
- Report the exact commands an agent would type for each, ready to paste into
  `skill://verification`.
