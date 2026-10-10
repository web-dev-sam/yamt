---
name: verification
description: What counts as proof in yamt — the `just check` gate, per-layer smoke recipes (CLI goldens, fixture browser in WebKit (MiniBrowser through `just webdriver`), Tauri on a scripted conflict repo), and how to report evidence. Autoloaded into verifier; implementers read it for the smoke recipe of their layer.
---

# Verification

Proof is observed output, pasted. "Tests pass" without the command and its last lines is not
evidence. The verifier runs the gate once per wave; implementers run their layer's recipes (SP3).

## The gate

```
just check
```

Runs, in order: `fmt-check` → `clippy` → `test` → `deny` → `bindings-check` → `fixtures-check` →
`web-lint` → `web-typecheck` → `web-test` → `web-unused` → `arch-check` → `map-check` → `golden` → `sfc-order` → `hooks-test`. Any non-zero exit is `gate: fail`
with the failing recipe name and the first 30 relevant lines in `failures[].excerpt`.

- [VF1] The verifier never fixes anything. A failure goes back to the owning slice.
- [VF2] Flaky ≠ pass. A test that fails once and passes on rerun is reported as a failure
  with `excerpt: "flaky: …"`; flakiness is a correctness finding.
- [VF3] The gate is run from a clean tree state as merged by the orchestrator, not inside
  an implementer's isolated workspace.
- [VF6] Verifier recipes are read-only commands; a detector's failing path is proven by a
  committed test, never by tamper-and-restore. Detector: hook `ownership.ts` (no slice ⇒ no
  repository writes; the scratch dir is exempt).
- [VF7] After `just check`, once per wave: `just mutants <base>` (`<base>` = the commit before the
  wave's patches; not in `check`). It mutates the wave's changed Rust lines (cargo-mutants) and
  changed non-test `.ts` under `src/{ipc,ui,model,connectors}`, `scripts/` (StrykerJS); reports in
  `target/`. Each surviving mutant goes into `smoke[]` as `file:line mutation`; `editor/` is not mutated.

## Smoke recipes (pick the one for the layer; paste `observed`)

**merge-core / cli**

```
just golden-show <case>    # classify tests/golden/<case>/{base,local,remote}.<ext>; `just smoke-cli` for the sample
```

observed: chunk table with kinds and ranges; compare against `expected.json` by eye for one case.

**gitio / session**

```
cargo nextest run -p yamt-gitio -p yamt-session
```

observed: test names from the risk register (RK1, RK2, RK5, RK15, RK17) in the output.

**frontend, fixture mode**

```
pnpm -C frontend dev --port <own port>   # M1 has one source (fixtures); no VITE_CHUNK_SOURCE switch until 2.1
just webdriver <own port>                # test windows on the Samsung screen (scripts/test-screen.sh place); private display without one
# session capabilities: browserName "MiniBrowser",
#   webkitgtk:browserOptions { binary: "/usr/lib/webkitgtk-6.0/MiniBrowser", args: ["--automation"] }
just test-window-check                   # optional: lists where each test window went (VF8)
```

- [VF8] WebKit test sessions start through `just webdriver`: it places test windows on the owner's
  Samsung screen when one is connected, otherwise on a private virtual display (plan §2 #40). A test
  window on another screen is not a failure (owner 2026-10-10: "atm not important spawn wherever").
  `just test-window-check` is optional, useful to see where a window went. Set the window size with
  WebDriver `setWindowRect`. When done, stop the driver, the dev server and the app you started.

observed: three panes, bands between them, apply a change via its arrow, undo, bulk apply;
console shows `[info] file.loaded {…}` from `log.ts`; no errors. Screenshot path.

**editor layout tests (WebKit)**

```
pnpm -C frontend test:browser
```

observed: `engine.browser.test.ts` green in the `browser` project (Playwright WebKit); every other
editor test runs in `node` (`pnpm test`). If WebKit cannot launch on this machine, say so verbatim:
the probe did not run, which is reported, not hidden.

**tauri shell (2.0+)**

```
scripts/conflict-repo.sh /tmp/yamt-test-merge   # 7 conflicts: 3 goldens, CRLF, add/add, binary, deleted on one side
scripts/test-screen.sh place                    # re-points the KWin rules; exits non-zero without a Samsung screen
just dev-app --repo /tmp/yamt-test-merge        # = cargo tauri dev -- -- --repo …; NVIDIA: WEBKIT_DISABLE_DMABUF_RENDERER=1 until the guard lands
```

The smoke repository's folder contains `yamt-test` and the window title is `<repository folder> — yamt`
(plan §2 #41), so the title rule places the window on the Samsung screen when it can and the owner's
own `yamt` windows are not moved (VF8).

observed: sidebar lists the 7 files; finish one ⇒ `git -C /tmp/yamt-test-merge ls-files -u` no longer
lists it; reset it ⇒ listed again with three stages and markers in the worktree; close ⇒ exit 1 and
`yamt: n of m files still unresolved` while any file is open.

## Output schema

```
gate        "pass" | "fail"
failures    [{ step, excerpt }]
smoke       [{ recipe, observed, pass }]
```

- [VF4] `observed` is verbatim output or a concrete description of what the screen showed;
  never "works as expected".
- [VF5] Report environment facts that affect reproducibility: toolchain versions
  (`rustc -V`, `node -v`, `pnpm -v`), WebKit provider availability.
