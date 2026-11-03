# CiJobLogCoreBoundary

Agent output (`agent://CiJobLogCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogCoreBoundary.md), collected 2026-11-03T10:28:27.910Z.

{
  "verdict": "pass",
  "checked": [
    "Only mergeRequests/** touched; index.ts adds exactly the 15 contract names. Accepted: AnsiColour in ansiColours.ts (avoids a cycle), sgr.ts for TS11, tree.md rows left to the docs keeper",
    "PM3/PM5: internal imports are only ./ansiColours and ./sgr, tests import ../index (as their siblings do); no vue/tauri/icons import, no cycle; XTERM_RGB is plain numbers, not rgb()/hex (palette.ts:17-19)",
    "One source each: BASIC_COLOURS and BRIGHT_OF feed SIXTEEN and digitCodes; Record<AnsiColour,Rgb> (TS17); Token is a kind-union, switch exhaustive (TS2/TS3); no as/!/any; no module state in source",
    "'n of m' and NO_RESULTS repeat editor findMatch.ts:26-31, but the brief and design (:222) name them and PM3 bars the import: accepted. steppedHit's 3 positional params are the brief's fixed contract",
    "Comments are only the contract's docs (CP rules met). AGENTS.md paragraph covers sources, text as search input, hitPlaces' boundary rule, basicColour; sgr is noted as tested via jobLogView",
    "Open risks accepted: SGR_CODES prototype keys unreachable (letters and _ end an escape); section options per brief; 300 ms test is brief-mandated, ~40 ms measured. Pure code, no state.md row; #159 proposed (design :296)"
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/jobLog.test.ts",
      "line": 26,
      "severity": "should",
      "rule_id": "TS15",
      "problem": "The_text_is_the_lines_joined_by_line_breaks (:345) only passes when it runs last, after the other tests have pushed their raw inputs into the module-level `inputs` array. Running it alone (`-t`) or with shuffled tests fails at `> 50`, and every new test must be added above it.",
      "fix": "Check the invariant inside `viewOf` on every call (text equals the lines joined by \\n, no empty run or line), then delete the `inputs` array and the order-dependent test, or keep that test name over a local list of inputs."
    },
    {
      "file": "frontend/src/mergeRequests/internal/sgr.ts",
      "line": 10,
      "severity": "should",
      "rule_id": "TS6",
      "problem": "`Pen` copies five of LogStyle's six fields by hand, and `sameStyle` (jobLog.ts:124) lists all six again. If an attribute is added, `sameStyle` still compiles without it and merges runs whose styles differ. Today four places must change in step.",
      "fix": "Declare the shared attributes once (e.g. `LogStyle = Omit<Pen, \"foreground\"> & { readonly foreground: AnsiColour | null }` in jobLog.ts, which imports sgr already) so only `foreground` differs."
    },
    {
      "file": "frontend/src/mergeRequests/internal/jobLog.ts",
      "line": 154,
      "severity": "nit",
      "problem": "`applied(scan, token): void` mutates `scan`, but in this module past-participle names (`clicked`, `searched`, `filtered`, `rechecked`, `penAfter`) return a new value. A reader of `scanLine` would expect a result. Nothing gets harder as the module grows.",
      "fix": "Rename it to an imperative verb like its siblings `addText`/`endLine`, e.g. `applyToken(scan, token)`."
    }
  ]
}
