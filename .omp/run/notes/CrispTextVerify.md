# CrispTextVerify — final run at `199a0e1` (brief `docs/slices/briefs/3.X-crisp-text-verify.md`)

Gate **pass**. Logs and images in `/tmp/yamt-crisp-verify/`.

- `just check` exit 0: 370 Rust tests + 1 skipped, 643 web tests in 58 files, deny ok, bindings/fixtures ok, arch/map ok,
  10 goldens, sfc-order, hooks 16/16.
- `just mutants 9da4adb`: Rust 61 (36 caught, 16 unviable, 9 missed): 8 already judged (#789, #792); 1 new — start.rs:284
  `is_link` guard → false (#800, dropped as near-equivalent by the owner's Gate B call). TypeScript 91.60 %, survivors
  only on unchanged lines judged in #799; every new line killed.
- Windows target: `cargo clippy --workspace --all-targets --target x86_64-pc-windows-msvc -- -D warnings` exit 0;
  actionlint 1.7.12 clean (no shellcheck). CI not run: publishing the branch is the owner's action (#780).
- Real app (private Xvfb): default log `antialiasing="subpixel" rgba="rgb"`, fringe 0.903; settings view Theme /
  Antialiasing (Subpixel pressed, note) / Keymap / Settings file; Greyscale writes the file; restart `rgba="none"`, fringe
  0.027; line tops step 20 px in all panes; selection and tints visible; file list corner rounded in dark and light.
- Chromium 156 at dsf 1.5 (rgba=rgb): panes 0.50 (0.48 scrolled), file list 0.74, settings 0.67, question list 0.68.
- Scroll timing (scale 1, renderer.ts, all opened, middle): late frames 30/24/25 → median 25 (base 23–25).
