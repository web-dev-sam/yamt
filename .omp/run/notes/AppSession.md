# AppSession — implementer report (fields read one by one)

```json
{
  "summary": "I added `frontend/scripts/app-session.ts`, a committed CLI with the 12 commands from the brief: start-app, start-fixture, click, press, type, scroll, read, shot, focus-away, focus-back, colours and stop. Every command prints one JSON line, or an `app-session:` error line and exit 1. Each `--name` keeps its state in `/tmp/yamt-app-session/<n>.json`, so separate shell calls share one session. start-app always runs with HOME and XDG_CONFIG_HOME inside the session's own temp folder. stop kills each started process group (after checking it is still the process that was started), removes the temp folder and deletes the state file. It uses Node built-ins only. The pure parts (argument parsing, key mapping, element matching, screen and scroll arithmetic, colour counting, state file, folder rules) live in `frontend/scripts/app-session/` and have 56 node tests. Both real runs from the brief passed.",
  "files_changed": [
    "frontend/scripts/app-session.ts",
    "frontend/scripts/app-session/args.ts",
    "frontend/scripts/app-session/argv.ts",
    "frontend/scripts/app-session/colours.ts",
    "frontend/scripts/app-session/drive.ts",
    "frontend/scripts/app-session/find.ts",
    "frontend/scripts/app-session/fixture.ts",
    "frontend/scripts/app-session/focus.ts",
    "frontend/scripts/app-session/folders.ts",
    "frontend/scripts/app-session/json.ts",
    "frontend/scripts/app-session/keys.ts",
    "frontend/scripts/app-session/placement.ts",
    "frontend/scripts/app-session/processes.ts",
    "frontend/scripts/app-session/session.ts",
    "frontend/scripts/app-session/start.ts",
    "frontend/scripts/app-session/state.ts",
    "frontend/scripts/app-session/stop.ts",
    "frontend/scripts/app-session/video.ts",
    "frontend/scripts/app-session/webdriver.ts",
    "frontend/scripts/app-session/args.test.ts",
    "frontend/scripts/app-session/colours.test.ts",
    "frontend/scripts/app-session/find.test.ts",
    "frontend/scripts/app-session/folders.test.ts",
    "frontend/scripts/app-session/keys.test.ts",
    "frontend/scripts/app-session/placement.test.ts",
    "frontend/scripts/app-session/state.test.ts"
  ],
  "tests_added": [
    {
      "name": "keys.test.ts › named keys map to their WebDriver code points and X keysyms",
      "proves": "Every named key gets the right WebDriver code and X keysym: Enter is U+E007 (not Return U+E006) and \"Return\" for xdotool, PageUp is \"Prior\", F1–F12 are U+E031–E03C. Any wrong key mapping fails this test."
    },
    {
      "name": "keys.test.ts › Ctrl+Shift+Z presses the modifiers first and releases them in reverse order (+ Shift+Tab/Alt/Meta, aliases, Ctrl++, punctuation keysyms, refused keys, grapheme typing)",
      "proves": "Checks the exact order of the WebDriver key actions and the xdotool chord text, \"Ctrl++\" as the plus key, an error for characters with no X keysym, newline sent as Enter, and an emoji with a skin-tone modifier sent as one key."
    },
    {
      "name": "find.test.ts › a hidden element with the same name is never picked",
      "proves": "An element hidden by visibility:hidden or with a 0×0 box is skipped even when it comes first in document order; the visible one is chosen."
    },
    {
      "name": "find.test.ts › only hidden matches / several visible matches / --role / missing name suggests",
      "proves": "Each failure gives an error that names the candidates (and counts hidden matches). --nth counts visible elements only. --role tells the Settings button from the Settings region. A missing name lists visible names that contain it."
    },
    {
      "name": "find.test.ts › text names only roles that take their name from content; roles; visibility rules; parseCandidates",
      "proves": "Names follow aria-label, then title, then trimmed text. Text counts only for ARIA name-from-content roles, so a div or li wrapper never matches by text. Roles come from the role attribute or the HTML tag. aria-hidden and inert ancestors hide an element. A malformed reply from the page is refused."
    },
    {
      "name": "colours.test.ts › frames split across chunks, mid-pixel, keep each frame's own counts",
      "proves": "A matching pixel at the last pixel of frame 0 and at the first pixel of frame 1, with stream chunks split inside pixels, gives counts [1],[1],[0]. An off-by-one at a frame boundary fails this test."
    },
    {
      "name": "colours.test.ts › only exact pixels count / a colour straddling two pixels / feedFrames leftovers / collapse / framesWithMatch",
      "proves": "A pixel one step off in any channel does not count. Pixels are read at a 3-byte stride. An unfinished frame is carried over to the next chunk. Collapsed rows have inclusive frame ranges, and equal rows that are not next to each other stay separate."
    },
    {
      "name": "state.test.ts › every process survives a write and a read, in order",
      "proves": "An app state with 4 processes (including the focus window) and a fixture state come back unchanged from writeState/readState."
    },
    {
      "name": "state.test.ts › a process without a usable pid is refused, not dropped (+ unknown kind, partial-file rename, start ticks with ') ' in comm)",
      "proves": "A state file that has lost a pid fails to load instead of quietly leaving out a process that should be killed. pid 1 and fractional pids are refused. The start time is read from /proc stat field 22 even when the command name contains \") \"."
    },
    {
      "name": "folders.test.ts › stop removes only this tool's temp folders / a config folder inside the owner's is refused",
      "proves": "stop deletes only `<tmp>/yamt-app-session-*` folders. The private-config check refuses a config folder that is the owner's config folder or inside it, and allows look-alikes such as `/home/u/.config-other`."
    },
    {
      "name": "placement.test.ts › viewport/screen points and scroll deltas",
      "proves": "The click point is the rounded centre. --x11 screen coordinates add the window position and frame. --to top, bottom and px give the right wheel delta."
    },
    {
      "name": "args.test.ts (13 tests)",
      "proves": "start-app defaults, every acceptance option, --repo/--fresh-repo excluding each other, --record and --record-seconds only together, --settings must be a JSON object, --size format, session names that cannot be paths, 0-based --nth, press parsing every key, `--` before a value starting with --, scroll --to forms, colours needing no session, and the usage text plus unknown, valueless or repeated option errors."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\nlint exit=0"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b\ntypecheck exit=0"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  55 passed (55)\n      Tests  623 passed (623)\ntest exit=0   (app-session alone: Test Files 7 passed (7), Tests 56 passed (56))"
    },
    {
      "command": "just web-unused",
      "observed": "$ knip --include exports,types\nweb-unused exit=0"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format."
    },
    {
      "command": "cargo tauri build --debug --no-bundle",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 45.00s\nBuilt application at: /home/wds/.omp/wt/t70c3f4bf2/m/target/debug/yamt"
    },
    {
      "command": "pnpm -C frontend exec tsx scripts/app-session.ts start-app --name smoke --fresh-repo --settings '{\"theme\":\"light\"}' --record /tmp/s.mkv --record-seconds 5",
      "observed": "{\"display\":\":2\",\"driverPort\":35699,\"session\":\"521220dc-0ffb-4cf3-a3fd-60070dc8ff6e\",\"configDir\":\"/tmp/yamt-app-session-smoke-uKv2Yn/home/.config\",\"repoDir\":\"/tmp/yamt-app-session-smoke-uKv2Yn/repo\",\"record\":{\"file\":\"/tmp/s.mkv\",\"seconds\":5}}"
    },
    {
      "command": "… read --name smoke document.documentElement.dataset.theme",
      "observed": "{\"value\":\"light\"}"
    },
    {
      "command": "… colours /tmp/s.mkv 26282c 191a1c e9eaee",
      "observed": "{\"file\":\"/tmp/s.mkv\",\"size\":\"1600x1000\",\"frames\":300,\"table\":[{\"frames\":\"0-17\",\"26282c\":0,\"191a1c\":0,\"e9eaee\":0},{\"frames\":\"18-28\",\"26282c\":0,\"191a1c\":0,\"e9eaee\":1599824},{\"frames\":\"29-31\",\"26282c\":0,\"191a1c\":0,\"e9eaee\":1362292},{\"frames\":\"32-299\",\"26282c\":0,\"191a1c\":0,\"e9eaee\":96330}],\"framesWithMatch\":{\"26282c\":0,\"191a1c\":0,\"e9eaee\":282}}   → no dark frame (0 frames with either dark colour)"
    },
    {
      "command": "… click --name smoke Settings; … click --name smoke Dark; … read --name smoke document.documentElement.dataset.theme",
      "observed": "{\"clicked\":{\"role\":\"button\",\"name\":\"Settings\"},\"viewport\":{\"x\":1573,\"y\":25}}\n{\"clicked\":{\"role\":\"button\",\"name\":\"Dark\"},\"viewport\":{\"x\":592,\"y\":125}}\n{\"value\":\"dark\"}"
    },
    {
      "command": "… shot --name smoke /tmp/smoke-settings.png; … shot --name smoke /tmp/smoke-display.png --display",
      "observed": "{\"file\":\"/tmp/smoke-settings.png\",\"source\":\"page\"}\n{\"file\":\"/tmp/smoke-display.png\",\"source\":\"display\"}   (an earlier shot of the same view showed the settings screen in the dark theme: Back, Theme with Dark pressed, Keymap list)"
    },
    {
      "command": "… read --name smoke '(window.__keys = [], addEventListener(\"keydown\", (e) => window.__keys.push(e.key)), true)'; … press --name smoke Escape; … read --name smoke window.__keys",
      "observed": "{\"value\":true}\n{\"pressed\":[{\"modifiers\":[],\"key\":{\"kind\":\"named\",\"name\":\"Escape\"}}],\"via\":\"webdriver\"}\n{\"value\":[\"Escape\"]}"
    },
    {
      "command": "… focus-away --name smoke; … read --name smoke 'document.hasFocus()'; … focus-back --name smoke; … read --name smoke 'document.hasFocus()'",
      "observed": "{\"focused\":\"xmessage\",\"window\":\"2097188\"}\n{\"value\":false}\n{\"focused\":\"app\",\"window\":\"4194308\"}\n{\"value\":true}"
    },
    {
      "command": "pgrep -a -f 'yamt-app-session-smoke-uKv2Yn|Xvfb -displayfd|tauri-driver --port 35699|WebKitWebDriver --port'   (before stop)",
      "observed": "1825634 Xvfb -displayfd 3 -screen 0 1600x1000x24 -nolisten tcp\n1825636 tauri-driver --port 35699 --native-port 36269\n1825637 /usr/bin/WebKitWebDriver --port=36269 --host=127.0.0.1\n1825680 /home/wds/.omp/wt/t70c3f4bf2/m/target/debug/yamt --repo /tmp/yamt-app-session-smoke-uKv2Yn/repo"
    },
    {
      "command": "… stop --name smoke; pgrep -a -f '<same pattern>|xmessage'; ls -d /tmp/yamt-app-session-smoke-uKv2Yn /tmp/yamt-app-session/smoke.json",
      "observed": "{\"stopped\":\"smoke\",\"session\":\"ended\",\"procs\":[{\"role\":\"ffmpeg\",\"pid\":1825640,\"result\":\"gone\"},{\"role\":\"tauri-driver\",\"pid\":1825636,\"result\":\"stopped\"},{\"role\":\"xvfb\",\"pid\":1825634,\"result\":\"stopped\"}],\"folder\":\"removed /tmp/yamt-app-session-smoke-uKv2Yn\"}\nstop exit=0\npgrep exit=1\nls: cannot access '/tmp/yamt-app-session-smoke-uKv2Yn': No such file or directory\nls: cannot access '/tmp/yamt-app-session/smoke.json': No such file or directory"
    },
    {
      "command": "… start-fixture --name fx",
      "observed": "{\"url\":\"http://localhost:38159/\",\"driverPort\":35533,\"session\":\"927680ea-ebea-4515-a3f0-7c8caab3e8bb\"}"
    },
    {
      "command": "… read --name fx '[...document.querySelectorAll(\"[role=status]\")].filter((e) => getComputedStyle(e).visibility === \"visible\").map((e) => e.textContent)'   (before)",
      "observed": "{\"value\":[\"3 changes · 1 conflict\"]}"
    },
    {
      "command": "… click --name fx \"Next change\"; … press --name fx Enter; … read --name fx '<same status expression>'   (after)",
      "observed": "{\"clicked\":{\"role\":\"button\",\"name\":\"Next change\"},\"viewport\":{\"x\":433,\"y\":25}}\n{\"pressed\":[{\"modifiers\":[],\"key\":{\"kind\":\"named\",\"name\":\"Enter\"}}],\"via\":\"webdriver\"}\n{\"value\":[\"2 changes · 1 conflict\"]}"
    },
    {
      "command": "… stop --name fx; pgrep -a -f 'MiniBrowser|WebKitWebDriver|yamt-app-session-fx|--strictPort'",
      "observed": "{\"stopped\":\"fx\",\"session\":\"ended\",\"procs\":[{\"role\":\"webdriver\",\"pid\":1831437,\"result\":\"stopped\"},{\"role\":\"vite\",\"pid\":1831308,\"result\":\"stopped\"}],\"folder\":\"removed /tmp/yamt-app-session-fx-NbQ7y9\"}\npgrep exit=1"
    },
    {
      "command": "… stop --name fx   (again, unknown name)",
      "observed": "{\"note\":\"no session named \\\"fx\\\"; nothing to stop\"}\nexit=0"
    },
    {
      "command": "Extra paths exercised (not in acceptance): press/click/type with --x11, scroll, error messages",
      "observed": "press --x11 Escape ctrl+z → page keydowns [\"Escape\",\"Control\",\"z\"]; click --x11 Back → {\"clicked\":{\"role\":\"button\",\"name\":\"Back\"},\"screen\":{\"x\":604,\"y\":44}}, settings closed; scroll Settings --to 60 / bottom / top → scrollTop 60 / 125 / 0; fixture: press Ctrl+F, type yield → active input value \"yield\"; scroll .cm-scroller --nth 1 --to 400 → scrollTop 400; click Nope → \"no element named \\\"Nope\\\"; nothing similar\"; scroll .cm-scroller (3 panes) → \"3 visible elements matching CSS \\\".cm-scroller\\\": …; pass --nth <i> or --role <role>\""
    },
    {
      "command": "Commands for skill://verification (repo root; until the `just app-session` recipe exists, `S` = `pnpm -C frontend exec tsx scripts/app-session.ts`; relative paths are taken from the repository root)",
      "observed": "Tauri app on a private display:\n  cargo tauri build --debug --no-bundle\n  $S start-app --name smoke --fresh-repo --settings '{\"theme\":\"light\"}' --record /tmp/s.mkv --record-seconds 5\n  $S read --name smoke document.documentElement.dataset.theme\n  $S colours /tmp/s.mkv 26282c 191a1c e9eaee\n  $S click --name smoke Settings\n  $S click --name smoke Dark\n  $S read --name smoke document.documentElement.dataset.theme\n  $S shot --name smoke /tmp/smoke.png            # page; add --display for the private display\n  $S press --name smoke Escape                  # add --x11 to send through xdotool\n  $S focus-away --name smoke && $S focus-back --name smoke\n  $S stop --name smoke\nFixture page (MiniBrowser through just webdriver):\n  $S start-fixture --name fx\n  $S read --name fx '[...document.querySelectorAll(\"[role=status]\")].filter((e) => getComputedStyle(e).visibility === \"visible\").map((e) => e.textContent)'\n  $S click --name fx \"Next change\"\n  $S press --name fx Enter\n  $S read --name fx '<same expression>'\n  $S scroll --name fx .cm-scroller --nth 1 --to bottom\n  $S stop --name fx"
    }
  ],
  "deviations_from_brief": [
    "scroll also takes [--role <role>] [--nth <i>] (an addition to the contract, nothing changed). Panes found by CSS (`.cm-scroller`) match 3 elements, and without --nth they can only be told apart by a longer selector.",
    "--nth counts from 0, among visible matches only.",
    "start-app with --record waits for ffmpeg to finish (--record-seconds) before printing its line, so `colours` can run on the file straight after. The recording starts after tauri-driver is ready and before the WebDriver session launches the app.",
    "The recording is lossless ffv1 in Matroska, so the colour counts are exact.",
    "The display number comes from Xvfb's -displayfd, so there is no race when picking a free display.",
    "Xvfb's screen is --size and the app window is set to the same size at 0,0 with setWindowRect.",
    "Relative paths (--binary, --repo, --record, shot and colours files) are taken from the repository root, because `pnpm -C frontend exec` changes the working directory to frontend/.",
    "start-app needs --repo <dir> or --fresh-repo; the brief marks both as optional but gives no default.",
    "The app's environment also has XDG_DATA_HOME, XDG_CACHE_HOME and XDG_STATE_HOME unset, so WebKit and app data go under the temp HOME too.",
    "focus-away starts an `xmessage` window at +0+0 on the private display and focuses it. focus-back focuses the window whose title ends in \"yamt\" and stops the xmessage. Both need a start-app session.",
    "Accessible names follow aria-label, then title, then trimmed text, as the brief says. aria-labelledby is not followed, and text counts only for ARIA 1.2 name-from-content roles (button, option, heading, link…), so wrapper elements never match by text. Hidden means visibility not 'visible', a 0×0 box, or an aria-hidden=\"true\" or inert ancestor. Before computing the click point, click and scroll scroll the element into view.",
    "perform() releases the input state (DELETE /actions) after every action. WebKitWebDriver (WebKitGTK 2.54) otherwise measures a wheel delta from the previous scroll: deltaY 10 sent after 40 fired a wheel of -30. scroll then waits until scrollTop stops changing (at most 2 s).",
    "Process safety: each child is started in its own process group with its /proc start time recorded. stop skips a pid whose start time has changed (reported as \"not ours\"), then sends SIGTERM to the group and SIGKILL after 3 s. It removes only `<tmp>/yamt-app-session-*` folders. freePort never returns 5173.",
    "If start-app or start-fixture fails partway, it stops everything already started and removes the state file and temp folder before reporting the error.",
    "The tests sit next to their modules in frontend/scripts/app-session/*.test.ts. frontend/scripts/app-session.test.ts was not created: the entry file is only the command switch.",
    "Line for the project map (the orchestrator adds it): `frontend/scripts  … app-session.ts (+ app-session/: args, argv, keys, find, placement, colours, state, folders, json pure and tested; start, fixture, drive, focus, video, stop, processes, session, webdriver thin) — the shared CLI for driving the real app on a private Xvfb through tauri-driver and the fixture page through just webdriver`."
  ],
  "open_risks": [
    {
      "location": "frontend/scripts/app-session/placement.ts:59",
      "risk": "click --x11 assumes the window frame is even on the left and right with the rest on top. It is exact on the WM-less Xvfb (chrome 0, window at 0,0, checked with click --x11 Back) and untested anywhere else."
    },
    {
      "location": "frontend/scripts/app-session/fixture.ts:21",
      "risk": "start-fixture returns once WebDriver's navigation finishes, but the fixture's file list loads after that. A `read` straight after start-fixture can see an empty status; my runs waited 2 s first. The tool does not retry (retries are a non-goal)."
    },
    {
      "location": "frontend/scripts/app-session/fixture.ts:38",
      "risk": "`just webdriver` puts MiniBrowser on the owner's Samsung screen when one is connected (VF8). In my run it did (page screenshot 3200x1928 at scale 2), so the fixture session uses the real desktop, not a private display. That is why focus-away/back and shot --display refuse fixture sessions."
    },
    {
      "location": "frontend/scripts/app-session/start.ts / processes.ts / drive.ts / video.ts / focus.ts",
      "risk": "`just mutants` mutates every changed non-test .ts under scripts/. The process, HTTP and ffmpeg layers have no unit tests; only the real runs above cover them. Expect survivors there, which the verifier must classify as wiring or gate-covered."
    },
    {
      "location": "frontend/scripts/app-session/focus.ts:9",
      "risk": "focus-back finds the app window by a title ending in \"yamt\" (`<repo folder> — yamt`, plan §2 #41). If the title format changes, this lookup has to change too."
    },
    {
      "location": "frontend/scripts/app-session/video.ts:57",
      "risk": "Readiness of the recording is detected by \"Output #0\" in ffmpeg's log. The first window frames were captured (frames 0–17 black, the light window from frame 18), but this depends on ffmpeg's log wording."
    }
  ]
}
```
