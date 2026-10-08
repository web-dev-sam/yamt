---
name: verification
description: What counts as proof in yamt — the `just check` gate, per-layer smoke recipes (CLI goldens, fixture browser in Epiphany, Tauri on a scripted conflict repo), and how to report evidence. Autoloaded into verifier; implementers read it for the smoke recipe of their layer.
---

# Verification

Proof is observed output, pasted. "Tests pass" without the command and its last lines is not
evidence. The verifier runs the gate once per wave; implementers run targeted checks only.

## The gate

```
just check
```

Runs, in order: `fmt-check` → `clippy` → `test` → `deny` → `bindings-check` → `web-lint` →
`web-typecheck` → `web-test` → `arch-check` → `sfc-order`. Any non-zero exit is `gate: fail`
with the failing recipe name and the first 30 relevant lines in `failures[].excerpt`.

- [VF1] The verifier never fixes anything. A failure goes back to the owning slice.
- [VF2] Flaky ≠ pass. A test that fails once and passes on rerun is reported as a failure
  with `excerpt: "flaky: …"`; flakiness is a correctness finding.
- [VF3] The gate is run from a clean tree state as merged by the orchestrator, not inside
  an implementer's isolated workspace.

## Smoke recipes (pick the one for the layer; paste `observed`)

**merge-core / cli**
```
cargo run -p yamt-cli -- classify tests/golden/<case>/{base,local,remote}.txt
```
observed: chunk table with kinds and ranges; compare against `expected.json` by eye for one case.

**gitio / session**
```
cargo nextest run -p yamt-gitio -p yamt-session
```
observed: test names from the risk register (RK1, RK2, RK5, RK15, RK17) in the output.

**frontend, fixture mode**
```
just dev-web            # VITE_CHUNK_SOURCE=fixture
epiphany http://localhost:5173
```
observed: three panes, bands between them, apply a chunk via gutter, undo, bulk apply;
devtools console shows `[info] file.loaded {…}` from `log.ts`; no errors. Screenshot path.

**editor layout tests (WebKit)**
```
pnpm -C frontend vitest run --browser
```
observed: `scrollSync`, `strips` tests green under the `webkit` provider. If Playwright
WebKit cannot launch on this machine, say so verbatim and run `vitest run` (jsdom) — the
layout tests are then marked skipped, which is reported, not hidden.

**tauri shell (M2+)**
```
scripts/conflict-repo.sh /tmp/yamt-smoke     # creates a repo with 3 conflicted files incl. add/add and CRLF
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
