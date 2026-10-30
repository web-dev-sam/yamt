---
name: verification
description: What counts as proof in yamt — the `just check` gate, per-layer smoke recipes (CLI goldens, fixture browser in WebKit (MiniBrowser through `just webdriver`), Tauri on a scripted conflict repo), and how to report evidence. Autoloaded into verifier; implementers read it for the smoke recipe of their layer.
---

# Verification

Proof is observed output, pasted. "Tests pass" without the command and its last lines is not evidence. The verifier
runs the gate in the final check and in a re-pass; implementers run their layer's recipes (SP3) and their mutation run.

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
- [VF3] The gate is run from a clean tree state as merged by the orchestrator, not inside an implementer's isolated workspace.
- [VF6] Verifier recipes are read-only commands; a detector's failing path is proven by a committed test, never by
  tamper-and-restore. Detector: hook `ownership.ts` (no slice ⇒ no repository writes; the scratch dir is exempt).
- [VF7] `just mutants <base>` (not in `check`) mutates the Rust lines changed since `<base>` (cargo-mutants, report in
  `target/mutants/`) and changed non-test `.ts` under `src/{ipc,ui,model,connectors}`, `scripts/` (StrykerJS, clear-text);
  `editor/` is not mutated. One patch per run, by the implementer in its own workspace before it finishes
  (`just mutants HEAD`: uncommitted and new files count; SP11); its kept survivors go to the correctness reviewer. The
  orchestrator runs it (`<base>` = the commit before the patch) only for a patch reported without a run. Never over a
  whole feature, by anyone (owner #1630: 791 mutants, ~20 h): the recipe refuses >200 Rust mutants or >30 `.ts` files;
  `cargo mutants` outside it is hook-blocked. Survivors as `file:line mutation`. Keep one only as (a) equivalent (no
  observable difference, the reason given); (b) gate-covered (another `just check` recipe kills it, named); (c) wiring
  (registration or a log call with no decision, observed in the smoke, named). A guard, boundary, constant, filter or
  branch is a real gap: a test kills it, or it is a finding for the owning slice, per `skill://review-protocol`.
- [VF11] Verifier passes (named in its task): **smoke** — as soon as the slice that wires a window together is committed,
  or when a slice reports `acceptance_not_run`: only the named recipes, no `just check`; **final** — once per feature after
  the docs update: `just check` once, then every recipe; **re-pass** — after a fix round for a failed pass: `just check`
  once, then only the failed steps and the steps the fix touched. A verifier pass runs with no implementer and no mutation
  run beside it (patches land in the tree it drives); reviewers may run beside it.

## Smoke recipes (pick the one for the layer; paste `observed`)

Real app and fixture page: `just app-session` (start, click/press/type/scroll/read/shot/colours, stop); no throwaway WebDriver helpers.

**merge-core / cli**

```
just golden-show <case>    # classify tests/golden/<case>/{base,local,remote}.<ext>; `just smoke-cli` for the sample
```

observed: chunk table with kinds and ranges; compare against `expected.json` by eye for one case.

**gitio / session**

```
just test                    # or: {{ hermetic_git }} prefix from the justfile + cargo nextest run -p yamt-gitio -p yamt-session (RK19)
```

observed: test names from the risk register (RK1, RK2, RK5, RK15, RK17) in the output.

**frontend, fixture mode**

```
just app-session start-fixture --name <n>    # dev server + `just webdriver` + MiniBrowser on a private display
# by hand: pnpm -C frontend dev --port <own port>; just webdriver <own port>; session capabilities: browserName "MiniBrowser",
#   webkitgtk:browserOptions { binary: "/usr/lib/webkitgtk-6.0/MiniBrowser", args: ["--automation"] }
```

- [VF8] Test windows open on a private virtual display only, never on the owner's screens (owner 2026-10-30, plan §2
  #136): `just webdriver` always runs on one, and `just app-session` starts the app on its own. The page there has the
  keyboard (`document.hasFocus()` true). Never start MiniBrowser, WebKitWebDriver or the app on the desktop. Set the
  window size with WebDriver `setWindowRect` or `--size`. When done, stop the driver, the dev server and the app you started
  (`just app-session stop --name <n>`).
- [VF9] Screenshots come only from the WebDriver session (page) or the private display; never a desktop capture (hook `bash-guard.ts`).

observed: three panes, bands between them, apply a change via its arrow, undo, bulk apply;
console shows `[info] file.loaded {…}` from `log.ts`; no errors. Screenshot path (VF9).

**editor layout tests (WebKit)**

```
pnpm -C frontend test:browser
```

observed: `engine.browser.test.ts` green in the `browser` project (Playwright WebKit); every other
editor test runs in `node` (`pnpm test`). If WebKit cannot launch on this machine, say so verbatim:
the probe did not run, which is reported, not hidden.

**tauri shell (2.0+)**

```
scripts/conflict-repo.sh /tmp/yamt-test-merge                          # 7 conflicts: 3 goldens, CRLF, add/add, binary, deleted on one side
just app-session start-app --name <n> --repo /tmp/yamt-test-merge      # the debug build (`--binary`), on a private display
just app-session start-app --name <n> --diff --dir <repo> --glab merge-requests  # compare window started in <repo>; fake glab + fake opener (<session>/glab/opened.log)
just app-session start-fixture --name <n> --diff --mr list             # merge-request page scripts (?mr=): list slow many empty noGlab loggedOut timeout refused pageFails
```

`start-app` drives `target/debug/yamt`; after a `just check` that file has no pages built in, so build it first with
`cargo tauri build --debug --no-bundle` (embedded frontend: no dev port, production CSP, #293, #405).

observed: sidebar lists the 7 files; finish one ⇒ `git -C /tmp/yamt-test-merge ls-files -u` no longer
lists it; reset it ⇒ listed again with three stages and markers in the worktree; close ⇒ exit 1 and
`yamt: n of m files still unresolved` while any file is open.

- [VF10] **release / install**: a slice that changes the README's install steps runs them as a new user before review. observed:
  every command's exit status and the window title; the macOS lines cannot run here and stay with the reviewer.

```
h=$(mktemp -d); env -i HOME=$h PATH=/usr/bin:/bin bash -euxc '<every Linux install block, in README order>'
cd /tmp/yamt-test-merge && env -i HOME=$h PATH=/usr/bin:/bin bash -lc yamt
```

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
