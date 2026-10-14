# FileListVerify — 3.L final run

Brief `docs/slices/briefs/3.L-verify.md`, at `4fd906c`. Transcript `history://FileListVerify`. Gate **pass**.

- Environment: rustc 1.99.0, node v24.21.0, pnpm 12.0.0; real app through tauri-driver (WRY 0.57) on Xvfb :2,
  1600×1000.
- `just check` exit 0: 370 Rust tests + 1 skipped, 694 web tests in 62 files, 10 goldens, arch/map ok, hooks 16/16.
- `just mutants 1a57989`: no Rust; Stryker 81.50 overall (fileIcon, fileListMode, folderIcon, iconTable, listing
  100; fileTree 93.81; store 97.47). Survivors on feature lines: keyText.ts constants (#732, judged), fileTree.ts six
  equivalents (judged), keys.ts:20 `KEY_ACTIONS → []` (#819: gate-covered by web-test, dropped).
- Real app, steps 1–7 pass: Ctrl+B moves the merge view to x 5 and back to 250 with the list at 240 px; also on the
  binary choice view and the deleted-side view; tree rows exactly the 15 expected, icons and chevrons
  (`/tmp/yamt-v3l-tree.png`); hide/show keeps the tree and a closed folder; resolving `notes/crlf.txt` by keys opens
  `App.vue` with its folder reopened, `git ls-files -u` empty for it; Keymap "Window" → "Toggle file list" Ctrl+B;
  restart (raw WebDriver, same HOME) starts in the tree with the list shown; switched back to the list. Owner's
  storage untouched.
- Helper gaps (#820): `just app-session read` quoting, no same-storage restart, unnamed band arrows.
