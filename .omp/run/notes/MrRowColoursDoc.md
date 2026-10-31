# MrRowColoursDoc

Agent output (`agent://MrRowColoursDoc`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowColoursDoc.md), collected 2026-10-31T09:02:44.964Z.

{
  "summary": "Line 5 of frontend/src/mergeRequests/AGENTS.md now describes the `size` entry as `sizeParts` `{ added \"+120\", removed \"−40\", files \"6 files\" }` with U+2212, and says the row colours the parts green, red and text colour. The rest of the line is unchanged. The names `sizeParts` and `sizeTitle` match what internal/size.ts exports (size.ts:17, :25).",
  "files_changed": [
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "$ oxfmt --check ... All matched files use the correct format. Finished in 1076ms on 686 files using 24 threads."
    }
  ],
  "mutation": {
    "command": "not run: docs-only change (a Markdown file), so no mutants apply; `just mutants HEAD` mutates no .md files",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [],
  "open_risks": []
}
