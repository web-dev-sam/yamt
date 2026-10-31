# MrRowColours

Agent output (`agent://MrRowColours`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowColours.md), collected 2026-10-31T09:02:11.331Z.

{
  "summary": "`sizeParts(size)` replaces `sizeText` and returns `{ added: \"+75\", removed: \"−12\", files: \"5 files\" }`. The minus is U+2212, and \"file\" or \"files\" works as before. `MergeRequestRow.vue` line 2 now puts each part in its own span: `+X` uses text-success-signal, `−Y` uses text-problem-error and `N files` uses text-fg. The iid, the age and the plain-text ` · ` separators keep the paragraph's muted colour. The textContent, the hover titles, truncation and the click rules are unchanged. The row paragraphs in ui/AGENTS.md are updated.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/size.ts",
    "frontend/src/mergeRequests/internal/size.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "the size comes in parts: +added, −removed, the files",
      "proves": "sizeParts returns { added: \"+120\", removed: \"−40\", files: \"6 files\" }: the plus sign on added, the minus on removed, plural files"
    },
    {
      "name": "the removed count's minus is a real minus sign (U+2212), not a hyphen",
      "proves": "removed starts with code point 0x2212"
    },
    {
      "name": "one file is a file, not files",
      "proves": "files is \"1 file\" for one file (the plural is pinned by the first test)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt && fmt:check && typecheck && lint && sfc-order && unused && test",
      "observed": "oxfmt: 'All matched files use the correct format. Finished in 989ms on 686 files'; vue-tsc -b, oxlint+eslint, check-sfc-order and knip: all passed with no output; vitest: 'Test Files 244 passed (244) Tests 3412 passed (3412)'"
    },
    {
      "command": "cargo tauri build --debug --no-bundle; scripts/mr-conflict-repo.sh /tmp/yamt-mrcol-repo; just app-session start-app --name mrcol --diff --dir /tmp/yamt-mrcol-repo --glab mr-conflicts --size 1400x900; click \"Merge requests\"",
      "observed": "Built target/debug/yamt; the app started on private display :3; the page lists 11 of 11 merge requests"
    },
    {
      "command": "just app-session read --name mrcol '[...document.querySelectorAll(\"li p.text-xs\")].map(p => p.textContent)'",
      "observed": "\"!32 · created 1 day ago · +75 −12 · 5 files\", … \"!27 · created 3 days ago\", … (the textContent is unchanged)"
    },
    {
      "command": "just app-session read --name mrcol <computed color of each part of !32> (default dark theme)",
      "observed": "iid !32 rgb(129, 126, 141); age 'created 1 day ago' rgb(129, 126, 141); separator (the p's text nodes ' · ') rgb(129, 126, 141); size span title '75 lines added, 12 removed in 5 files' rgb(129, 126, 141); +75 rgb(120, 191, 123); −12 rgb(246, 107, 113); '5 files' rgb(214, 212, 221), the same as the title 'Board themes' rgb(214, 212, 221)"
    },
    {
      "command": "just app-session start-app --name mrcol2 … --settings '{\"theme\":\"webstorm-light\"}'; read the computed colours of !32",
      "observed": "theme webstorm-light; iid rgb(115, 118, 124); age rgb(115, 118, 124); separator rgb(115, 118, 124); +75 rgb(51, 133, 85); −12 rgb(255, 0, 0); files rgb(0, 0, 0)"
    },
    {
      "command": "just app-session shot --name mrcol /tmp/yamt-mrcol-shots/dark.png; just app-session shot --name mrcol2 /tmp/yamt-mrcol-shots/light.png",
      "observed": "Both source 'page'. Dark: each row reads muted '!32 · created 1 day ago ·', green +75, red −12, muted ·, white '5 files'; !27 ends after the age. Light: the same layout, with green, red and black. Both sessions stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — size.ts: 17 mutants, 17 killed, 0 timeout, 0 survived, 0 no-cov, 0 errors (score 100.00)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Four doc lines outside Owned still name `sizeText` and should say `sizeParts` (returns { added, removed, files }). For the docs keeper: frontend/src/mergeRequests/AGENTS.md:5, .omp/skills/project-map/tree.md:187, docs/architecture.md:1509 and docs/architecture.md:1520."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:110-117",
      "risk": "Vue's template fragment adds empty text nodes (\"\") next to the separators. They do not change the textContent, but a test that counts child nodes would see them."
    }
  ]
}
