# MrLinksCrateDoc

Agent output (`agent://MrLinksCrateDoc`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksCrateDoc.md), collected 2026-11-04T02:30:39.558Z.

{
  "summary": "I changed the links paragraph in crates/merge-requests/AGENTS.md (line 11). It cited plan §2 '#175, #177 proposed' and now cites '#176, #178'. docs/plan.md records #176 as the crate's links rule (read_links, the lookup) and #178 as the links defaults, so I dropped 'proposed'. The file had no other links-row numbers; #171–#174 on line 9 are description rows and I left them as they were.",
  "files_changed": [
    "crates/merge-requests/AGENTS.md"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "git diff --word-diff=plain -U0 crates/merge-requests/AGENTS.md",
      "observed": "@@ -11 +11 @@ ... A merge request's linked epics, issues and commits (plan §2 [-#175, #177 proposed;-]{+#176, #178;+} request `docs/slices/request-mr-links.md` rules 2–6, ..."
    },
    {
      "command": "grep '^\\|\\s*17[5-8]\\b' docs/plan.md",
      "observed": "175 = uploads rule; 176 = linked epics/issues/commits read by read_links (design rows #175–#177 recorded as #176–#178); 177 = the window's per-row queue (ui); 178 = defaults decided with the links design"
    }
  ],
  "mutation": {
    "command": "not run: Markdown-only change, no code touched, so no build, tests or mutants",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [],
  "open_risks": []
}
