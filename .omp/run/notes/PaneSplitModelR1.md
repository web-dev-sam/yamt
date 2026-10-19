All four findings are fixed. Every hand mutant fails the new tests, and all five frontend recipes exit 0. One assertion from the brief, `dragged(w,'local',0) = {0.2, 0.3}`, is not met: the committed code gives a different result for it, so I tested the same thing with other widths (see `deviations_from_brief`).

```
summary
  - ui/windowStorage.ts exports parseStored(raw): unknown (JSON.parse, or null on a parse error). It is the only JSON.parse left in
    non-test ui/*.ts. paneSplit.ts, toolbarButtons.ts and serverPins.ts all use it; their local copies (parsed, parseJson, readPins' try/catch) are deleted.
  - useColumnDrag's output type ColumnDragHandle is renamed to ColumnDragBinding (also in usePaneDividers.ts). ColumnHandle is no longer exported (it has no importer).
  - The remote-boundary tests now use widths where Local and Remote differ: {200,500,300} in paneSplit.test.ts and usePaneDividers.test.ts.
  - A new usePaneDividers test runs in an effectScope with stubbed globals and sends pointerdown + pointermove (dx 100) through each divider's own listeners.

files_changed
  frontend/src/ui/windowStorage.ts
  frontend/src/ui/windowStorage.test.ts
  frontend/src/ui/paneSplit.ts
  frontend/src/ui/paneSplit.test.ts
  frontend/src/ui/toolbarButtons.ts
  frontend/src/ui/serverPins.ts
  frontend/src/ui/useColumnDrag.ts
  frontend/src/ui/usePaneDividers.ts
  frontend/src/ui/usePaneDividers.test.ts

tests_added
  - windowStorage.test.ts "stored JSON is parsed; text that is not JSON gives null": an object and an array are parsed;
    "{not json" and "" give null. This is the fallback all three callers rely on.
  - paneSplit.test.ts "the remote divider mirrors the local one and keeps Local's pixels" (replaces "the remote divider mirrors the local one"),
    widths {200,500,300}:
    - remote -100 gives {0.2, 0.4}, with local*1000 === 200
    - remote 50 gives {0.2, 0.25}
    - remote -400 clamps at remote*1000 580, local 200
    - remote 400 clamps at remote*1000 220, local 200
    This kills the survivors at paneSplit.ts:44:17 and :45:16.
  - paneSplit.test.ts "a press without a move gives the measured shares" (now asymmetric):
    {250,450,300} gives {0.25, 0.3} at dx 0 for both boundaries; {200,500,300} remote 0 gives {0.2, 0.3}.
  - usePaneDividers.test.ts "each divider's listeners drag its own boundary": pointerdown at x 0, then pointermove at x 100, through
    .local.listeners and then .remote.listeners, records [{0.3,0.3}, {0.2,0.22}]. This kills the swapped-keys mutant at :43–44.
    The '' mutant also fails it: '' is handled as remote.
  - usePaneDividers.test.ts: WIDTHS is now {200,500,300}; the expected values in "a press measures once…" are updated to
    {0.3,0.3}, {0.22,0.3}, {0.2,0.4}.

smoke_evidence
  1. pnpm -C frontend fmt:check && lint && typecheck && unused && test  → exit 0
       $ oxfmt --check … All matched files use the correct format. Finished in 922ms on 337 files
       $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"   (no findings)
       $ vue-tsc -b                                                     (no output)
       $ knip --include exports,types                                    (no output)
       $ vitest run --project node
        Test Files  114 passed (114)
             Tests  1557 passed (1557)
  2. Hand mutants. Each was applied with the edit tool, run with
     `pnpm -C frontend exec vitest run --project node <files>`, then restored.
     a) Both survivors at once (moved → widths.local, kept → widths.remote for the remote boundary):
        × the remote divider mirrors the local one and keeps Local's pixels
          AssertionError: expected { local: 0.3, remote: 0.3 } to deeply equal { local: 0.2, remote: 0.4 }   paneSplit.test.ts:169
        × a press without a move gives the measured shares
          expected { local: 0.3, remote: 0.25 } to deeply equal { local: 0.25, remote: 0.3 }                  paneSplit.test.ts:184
        × (usePaneDividers) a press measures once… : -"local": 0.2,"remote": 0.4  +"local": 0.3,"remote": 0.3
        × (usePaneDividers) each divider's listeners drag its own boundary : -"local": 0.2 +"local": 0.3
        Test Files  2 failed (2)   Tests  4 failed | 36 passed (40)
     b) moved only (44:17): expected { local: 0.2, remote: 0.3 } to deeply equal { local: 0.2, remote: 0.4 }
        and expected { local: 0.25, remote: 0.25 } to deeply equal { local: 0.25, remote: 0.3 }   Tests 2 failed | 31 passed
     c) kept only (45:16): expected { local: 0.3, remote: 0.4 } to deeply equal { local: 0.2, remote: 0.4 }
        and expected { local: 0.3, remote: 0.3 } to deeply equal { local: 0.25, remote: 0.3 }      Tests 2 failed | 31 passed
     d) usePaneDividers local/remote keys swapped (:43–44):
        × each divider's listeners drag its own boundary
          AssertionError: expected [ { local: 0.2, remote: 0.22 }, …(1) ] to deeply equal [ { local: 0.3, remote: 0.3 }, …(1) ]
          usePaneDividers.test.ts:137
        Tests  1 failed | 6 passed (7)
     After restoring: the targeted run passes 93/93, and the full run passes 1557/1557.
  3. grep "JSON.parse" in frontend/src/ui/*.ts: outside *.test.ts the only hit is
       windowStorage.ts:9      return JSON.parse(raw);
     The other hits are serverPins.test.ts:36, serverSetup.test.ts:93, servers.test.ts:33, toolbarButtons.test.ts:49 (all tests).

deviations_from_brief
  - #1279: the brief asks for dragged({200,500,300},'local',0) = {0.2, 0.3}. The committed code gives {0.22, 0.3}, because a press
    snaps a Local narrower than the 220 px minimum up to 220. Making the assertion pass would change behaviour, which is a non-goal.
    Instead, "press without a move" uses {250,450,300} for both boundaries, giving {0.25, 0.3}, and keeps the brief's
    remote-0 case on {200,500,300}, giving {0.2, 0.3}.
  - #1279: the brief's remote -250 clamp case (480) needed new numbers with the new widths. It became remote -400 → 580
    (pair 800 − 220), with Local kept at 200.
  - #1275: the new name is ColumnDragBinding. No row 6 file imports ColumnHandle or ColumnDragHandle (grep over frontend/src),
    so no file outside the owned set changed.
  - #1280: the new test stubs PointerEvent, MouseEvent, Element and also document (documentElement.classList). It has to,
    because usePaneDividers passes no class root to useColumnDrag, which then falls back to document.documentElement.
  - serverPins.ts: readPins now calls parseStored, so a parse error gives null, which then gives {}. Every stored form reads as
    before (the serverPins tests pass unchanged).
  - Docs not updated (read-only for this slice): the project map's windowStorage.ts entry ("`storedValue`: …") does not list parseStored.

open_risks
  - frontend/src/ui/usePaneDividers.test.ts:115: this test passes two hand-written fake objects (a fake pointer event and a fake
    element) where the real code expects a PointerEvent and an Element, so it relies on how useColumnDrag uses them (only
    `instanceof`, button, pointerId, clientX, currentTarget, setPointerCapture). If useColumnDrag starts using another event
    field, these fakes need it too.
```

The orchestrator should run `just check` on the merged tree and `just mutants` on paneSplit.ts and usePaneDividers.ts to confirm the earlier survivors and NoCoverage mutants are gone.