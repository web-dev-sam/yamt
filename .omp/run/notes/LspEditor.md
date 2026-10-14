# LspEditor (3.Y-editor, board row 5) — committed 190ad2e

I've built slice 3.Y-editor as the brief describes. Node tests, `lint`, `typecheck`, `unused`, `fmt:check` and `sfc-order` all pass. One gap: `pnpm -C frontend test:browser` still cannot start Playwright's WebKit on this Arch host (known since finding #5). I checked the tooltip in the system WebKit (MiniBrowser) with a temporary page instead, and the new `problems.browser.test.ts` has not run.

```
summary
  An editable Result with servers !== null is now an lsp document: opened when the controller is built, told "changed" on every edit, closed on destroy. Read-only views open nothing.
  Server problems show only in the middle pane through @codemirror/lint. They are placed on the version's own text and moved through every edit made since. Each server has its own list, and the lists are merged.
  The look is a wavy underline per severity from new palette tokens, and a tooltip in panel tokens with "<server> <code>" in muted text. Counts (errors, warnings, other) go out through onProblemsChange into MergeHandle.problems.
  format() takes its options from the Result's indent unit and applies the formatter's result as yamt's own line diff (pure Myers, linear space). It is one "yamt.format" transaction of Text inserts, so CRLF stays CRLF and one undo restores everything.
  A second format() while one runs returns the same promise. Read-only or no servers gives noFormatter.

files_changed
  frontend/src/editor/index.ts                      (271 lines, was 296)
  frontend/src/editor/internal/serverDoc.ts         (new)
  frontend/src/editor/internal/problems.ts          (new)
  frontend/src/editor/internal/format.ts            (new)
  frontend/src/editor/internal/lineDiff.ts          (new)
  frontend/src/editor/internal/paneViews.ts         (new, moved out of index.ts)
  frontend/src/editor/internal/pane.ts              (one selector)
  frontend/src/editor/internal/{serverDoc,problems,format,lineDiff}.test.ts (new)
  frontend/src/editor/problems.browser.test.ts      (new)
  frontend/src/editor/theme.css, frontend/src/editor/AGENTS.md, frontend/src/style.css
  frontend/src/ui/useMergeController.ts, frontend/src/ui/useMergeController.test.ts
  frontend/src/ui/MergeView.vue                     (only `servers: null`)

tests_added
  serverDoc.test.ts (7 tests)
    rule 1: an editable Result is opened under its path, gets "changed" on each edit only (not on a selection), and is closed once
    rule 1: a read-only Result, or no servers, opens nothing
    rule 2: take gives the Result's text with its own line breaks (CRLF)
    rule 2: problems show in the middle pane only (left and right have 0 diagnostics)
    rule 4: counts go out when they change, not for an edit that leaves them
    rule 4: a closed Result tells no one
    rule 5: a second format while one runs returns the same promise; the next call asks again
  problems.test.ts (8 tests)
    rule 2: positions are mapped through an edit made after the version
    rule 2: a character past the line or a line past the text is clamped
    rule 2: a problem whose text was deleted since its version is not shown
    rule 2: answers are dropped for a version never taken, a forgotten one, or one older than that server's last answer
    rule 2: a version stays answerable until every server that answered is past it
    rule 2: with no answers at all, only the newest 32 versions are kept
    rule 2: two servers merged; [] clears only that server's problems, and the other's mapped positions are kept
    rule 4: counts are errors, warnings, and info + hint as other
  format.test.ts (11 tests)
    rule 5 (Lf and CrLf): lines 3 and 400 of a 410-line file with an open conflict at 200–202. The block keeps "pending pending", its text, and a "replace" arrow on both sides; undoDepth is 1; one undo brings back the text and statuses.
    rule 5: CRLF stays CRLF
    rule 5: formatting that removes every line of an open block ignores it on both sides (CM8)
    rule 5: changedMeanwhile, nothing applied
    rule 5: a closed Result gives changedMeanwhile
    rule 5: a result equal line by line gives unchanged; the client's unchanged and all four refusals pass through, nothing dispatched
    rule 5: options from the indent unit (tab with the pane's tab size 4 or 8; 2 and 4 spaces)
    rule 5: options as built
    rule 5 (Lf and CrLf): property test, 300 random results applied exactly, including edits at both ends
  lineDiff.test.ts (5 tests)
    property: applying the edits to old gives new; edits are ordered, never empty, never touching (500 seeded rounds)
    identical inputs give no edits
    changes far apart stay two edits
    a pure insertion and a pure deletion
    a 5,000-line rewrite of every other line gives 2,500 edits
  useMergeController.test.ts (4 new tests)
    problems follows the controller's counts, then each change it reports; null after the file goes away or the scope stops
    problems and format are null without a controller
    format answers with the outcome of the controller in use (a rebuilt one after a rebuild)
    the controller is built with the servers given and rebuilt when they change (the very same instances are passed)
  problems.browser.test.ts (4 tests, not run here, see smoke_evidence): tooltip visible above the panes inside will-change: transform; open / changed / counts / close through MergeController; read-only and no servers give noFormatter; format plus undo through the controller

smoke_evidence
  Acceptance 1, node tests:
    pnpm -C frontend test → "Test Files  83 passed (83) / Tests  984 passed (984)"
    Failing-path proofs (rule broken, test file run, rule restored; the files were re-run green afterwards):
      serverDoc.ts, 5 breaks at once (toString instead of paneText, changed on every update, = instead of ??=, readOnly ignored, panes().left):
        "× rule 1: … says changed on each edit only …" expected [ …(3) ] to deeply equal [ …(2) ]
        "× rule 1: a read-only Result, or no servers, opens nothing" expected ServerDoc{…} to be null
        "× rule 2: take gives the Result's text …" expected 'a\nb\n' to be 'a\r\nb\r\n'
        "× rule 2: problems show in the middle pane only" expected +0 to be 1
        "× rule 5: a second format while one runs returns the same promise …" expected Promise{…} to be Promise{…}
        ("× rule 4: counts go out …" also failed, a side effect of the left-pane break)
      serverDoc.ts, listener not cleared on close, alone:
        "× rule 4: a closed Result tells no one about later counts" expected [ { errors: 1, … } ] to deeply equal []
      problems.ts, 4 breaks at once (no mapping, no out-of-order check, no floor or cap, owner check dropped):
        "× … mapped through every edit made since" expected [ '= error b is unused (oxlint)' ] …
        "× … whose text was deleted … is not shown" expected [ 'c error bad (oxlint)' ] to deeply equal []
        "× … a version stays answerable …" expected [ 'a error too late (tsgo)' ] to deeply equal []
        "× … only the newest 32 versions are kept" expected [ 'a error oldest (oxlint)' ] to deeply equal []
        "× … [] clears only that server's" expected [ …(2) ] to deeply equal [ 'b warning maybe (tsgo)' ]
        ("× … answers … dropped" also failed, from the floor break)
      problems.ts, out-of-order check removed alone (the first test did not catch it, so I tightened the test):
        "× rule 2: answers for a version … older than the server's last answer are dropped" expected [ 'b error older (oxlint)' ] …
      problems.ts, hint not counted:
        "× rule 4: counts are errors, warnings, and info with hints as other" expected { …, other: 1 } to deeply equal { …, other: 2 }
      format.ts, 5 breaks (fixed tabSize, join("\n") instead of Text, no sent check, no empty-diff check, one dispatch per change):
        "× rule 5: formatting lines 3 and 400 … (Lf)" and "(CrLf)" expected 2 to be 1 (undoDepth)
        "× … changedMeanwhile and nothing is applied" expected { kind: 'formatted' … }
        "× … equal line by line is unchanged …" expected { kind: 'formatted' … }
        "× … options follow the Result's indent unit …" expected { tabSize: 4 … } to deeply equal { tabSize: 8 … }
        "× … any formatted result is applied exactly … (CrLf)" expected 'b\nb\r\n…' to be 'b\r\nb\r\n…'
      lineDiff.ts, no merge of touching edits and no split of boxes larger than one line:
        "× … in order and without overlap" expected 1 to be greater than 1
        "× … changes far apart stay two edits …" expected [ { from: 2, to: 400 … } ]
        "× … 5,000-line file …" expected [ … ] to have a length of 2500 but got 1
      tooltip parent (WebKit, below): before tooltips({ parent: document.body }) the tooltip was squeezed inside the pane (width 143, right 785.65 at the pane edge, 127 px tall); after, width 438.66 and it covers the strip.
  Acceptance 2, WebKit:
    pnpm -C frontend test:browser → "Error: browserType.launch: Host system is missing dependencies to run browsers … sudo apt-get install libicu74 libxml2 libflite1". The vitest WebKit probe did not run.
    Instead, system WebKit: a temporary page frontend/src/editor/probe.html (deleted afterwards) with the same scenario as the probe. Real MergeController, three panes inside a will-change: transform wrapper with will-change strip layers. Driven through `just webdriver 4791` (test-screen: Samsung HDMI-A-1) by a throwaway WebDriver script in /tmp, with a real pointer move.
      browser MiniBrowser 2.54.1, userAgent "… AppleWebKit/605.1.15 … Version/60.5 Safari/605.1.15"
      range {"text":"undefinedThing","decoration":"wavy","colour":"rgb(247, 84, 100)","top":125.5,…}
      before hover, tooltip: null
      after hover, tooltip: {"shown":{"top":75.5,"bottom":124.5,"left":642.33,"right":1080.98,"width":438.66},"strip":{"left":787.66,"right":825.66},"atLeft":true,"overStrip":true,"background":"rgb(25, 26, 28)","text":"'undefinedThing' is not defined. Consider declaring it before this line.oxlint eslint(no-undef)"}
      counts {"warnings":1,"other":0,"errors":1}
      scenarios {"samePromise":true,"formatted":{"kind":"formatted","server":"oxfmt"},"formattedText":true,"undoneText":true,"liveCalls":["open src/probe.ts","changed","changed","close"],"readOnlyFormat":{"kind":"noFormatter"},"readOnlyCalls":[],"withoutFormat":{"kind":"noFormatter"}}
      light palette: tooltip background "rgb(255, 255, 255)", underline "rgb(229, 82, 48)"
    Screenshots (scratch): /tmp/yamt-lsp-editor/problem-tooltip.png (dark: tooltip above the text, over the right strip and right pane; red wavy line under undefinedThing, yellow under `a`) and /tmp/yamt-lsp-editor/problem-tooltip-light.png
    Vite, WebDriver and MiniBrowser are stopped: `pgrep -af "MiniBrowser|WebKitWebDriver|vite --port 5391"` → none
  Acceptance 3 (each exit 0):
    lint      "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", no findings
    typecheck "$ vue-tsc -b", no errors
    test      "Tests  984 passed (984)"
    unused    "$ knip --include exports,types", no findings
    fmt:check "All matched files use the correct format."
    sfc-order "$ tsx scripts/check-sfc-order.ts", no findings

deviations_from_brief
  1. Moved out of index.ts: #createViews and #sideExtensions became internal/paneViews.ts (createPaneViews, plus the types ViewSources and PaneWiring). The bodies are the same; the controller passes a wiring object.
  2. New exports. editor/index.ts: type FormatOutcome (from internal/format.ts), type ProblemCounts (from internal/problems.ts), MergeOptions.servers, and MergeController.format / problems / onProblemsChange (Contract).
     Internal: format.ts (FormatOutcome, ResultPane, formattingOptions, formatResult), problems.ts (ProblemCounts, problemsField, tookSpec, problemsSpec, problemCounts), serverDoc.ts (PaneUpdate, ServerDoc, openResult), lineDiff.ts (LineEdit, lineDiff), paneViews.ts (ViewSources, PaneWiring, createPaneViews).
     useMergeController.ts: ControllerOptions.servers, MergeHandle.problems, MergeHandle.format. It does not re-export FormatOutcome or ProblemCounts, because knip fails with no importer; the Save and status-area builds add them when they import them.
  3. The WebKit check found the tooltip squeezed inside the pane: CodeMirror switches to absolute positioning under a transformed ancestor. So the center pane gets tooltips({ parent: document.body }) (paneViews.ts), as the brief allowed.
     That container also gets the editor's theme classes, so pane.ts's theme rule "&" became "&.cm-editor". Without it the container took height 100% and the panel background and covered the window.
  4. useMergeController: servers is a rebuild source (a change closes, then opens). To stay within 40 lines per function, the watch body moved into emptyShown() and reloaded(previous, build, shown). The old controller is still destroyed before the new one is built, so a document is closed before it is opened again.
  5. Decisions the brief left open:
     - Forgetting versions: a version is kept while it is ≥ the lowest last-answered version among servers that have answered, and only the newest KEPT_VERSIONS = 32 are kept (for servers that never answer).
     - An answer older than that server's last answer is dropped (a late pull must not replace a newer push).
     - A line past the text means the document end; negative values clamp to 0.
     - A non-empty problem whose text was deleted since its version is dropped.
     - Mapping: from with +1, to with -1.
     - Tooltip label: source = "<server> <code>", or just "<server>" when there is no code.
     - A format reply that arrives after destroy gives changedMeanwhile, nothing applied.
  6. Tests build DocVersion with a test-local type guard (the brand's constructor is lsp-internal, PM5).
  7. Acceptance 2 was observed in MiniBrowser through a temporary page, not through `pnpm test:browser`, which cannot launch on this host. problems.browser.test.ts is written, linted and typechecked, but has not run.
  8. Needed outside my files: skill://project-map and docs/architecture.md must name editor/internal/{serverDoc,problems,format,lineDiff,paneViews}.ts for `just map-check`, and the state table should gain "problems per Result: the lint field plus problemsField in the middle pane".
  9. I had to run `pnpm install --frozen-lockfile --offline`, because the worktree had no node_modules.

open_risks
  1. editor/internal/format.ts:24-37: line-level replacements remove the problems on every reformatted line until the server answers again. Seen in WebKit: heard [{other:1}, {other:0}] after format.
  2. [INFERENCE] @codemirror/lint dist/index.js:124 hides an open tooltip on every setDiagnostics, so each server answer (problems.ts:125) closes a tooltip being read.
  3. editor/internal/problems.ts:39-45: a server that has not answered yet (TypeScript while starting) can have its first answer dropped once a faster server has answered a newer version. It shows on its next answer.
  4. editor/internal/serverDoc.ts:40-45: take() dispatches. If the client ever calls take() during a CodeMirror update, CodeMirror throws; today it is called only from timers, open and format.
  5. editor/internal/format.ts:44: "never rejects" relies on OpenDocument.format never rejecting (the client's guarantee). There is no catch.
  6. ui/useMergeController.ts:160: a LanguageServers passed in a deep ref() would be proxied and its #private fields would break. The status-area slice should use a shallowRef or a plain getter.
  7. [INFERENCE] style.css:32-34 and 86-88: the problem colours (dark #f75464 / #f2c55c / #868a91, light #e55230 / #e8a33e / #8c8c8c) are from memory of WebStorm New UI and not checked against its colour schemes.
  8. The vitest WebKit probe has not run on any host. Run `pnpm -C frontend test:browser` where Playwright WebKit launches.
```