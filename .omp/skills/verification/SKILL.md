---
name: verification
description: What counts as proof in yamt — the `just check` gate, per-layer smoke recipes (CLI goldens, fixture browser in Epiphany, Tauri on a scripted conflict repo), and how to report evidence. Autoloaded into verifier; implementers read it for the smoke recipe of their layer.
---

# Verification

Proof is observed output, pasted. "Tests pass" without the command and its last lines is not
evidence. The verifier runs the gate once per wave; implementers run their layer's recipes (SP3).

## The gate

```
just check
```

Runs, in order: `fmt-check` → `clippy` → `test` → `deny` → `bindings-check` → `fixtures-check` →
`web-lint` → `web-typecheck` → `web-test` → `web-unused` → `arch-check` → `golden` → `sfc-order` → `hooks-test`. Any non-zero exit is `gate: fail`
with the failing recipe name and the first 30 relevant lines in `failures[].excerpt`.

- [VF1] The verifier never fixes anything. A failure goes back to the owning slice.
- [VF2] Flaky ≠ pass. A test that fails once and passes on rerun is reported as a failure
  with `excerpt: "flaky: …"`; flakiness is a correctness finding.
- [VF3] The gate is run from a clean tree state as merged by the orchestrator, not inside
  an implementer's isolated workspace.
- [VF6] Verifier recipes are read-only commands; a detector's failing path is proven by a
  committed test, never by tamper-and-restore. Detector: hook `ownership.ts` (no slice ⇒ no writes).
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
pnpm -C frontend dev --port <own port>   # M1 has one source (fixtures); no VITE_CHUNK_SOURCE switch until M2
just webdriver <own port>                # WebKitWebDriver on a private virtual display (Xvfb)
# session capabilities: browserName "MiniBrowser",
#   webkitgtk:browserOptions { binary: "/usr/lib/webkitgtk-6.0/MiniBrowser", args: ["--automation"] }
```

- [VF8] Agents never open a browser window on the owner's screens (owner, 2026-10-09: windows
  appeared under their mouse). Drive WebKit only through `just webdriver`; never start
  `WebKitWebDriver`, `MiniBrowser` or `epiphany` directly. Set the window size with WebDriver
  `setWindowRect`. Stop the driver and the dev server when done.

observed: three panes, bands between them, apply a change via its arrow, undo, bulk apply;
console shows `[info] file.loaded {…}` from `log.ts`; no errors. Screenshot path.

**editor layout tests (WebKit)**

```
pnpm -C frontend test:browser
```

observed: `scrollSync`, `strips` tests green in the `browser` project (Playwright WebKit). If
WebKit cannot launch on this machine, say so verbatim: `pnpm test` (the `node` project) excludes
`src/editor/**`, so the layout tests did not run, which is reported, not hidden.

**tauri shell (M2+)**

```
scripts/conflict-repo.sh /tmp/yamt-smoke     # (planned, M2) a repo with 3 conflicted files incl. add/add and CRLF
cargo tauri dev -- --repo /tmp/yamt-smoke
```

observed: sidebar lists 3 files; finish one ⇒ `git -C /tmp/yamt-smoke ls-files -u` no longer
lists it; reset it ⇒ listed again with three stages and markers in the worktree.

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
