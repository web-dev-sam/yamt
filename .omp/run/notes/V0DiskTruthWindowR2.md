# V0DiskTruthWindowR2 — window rework 2 report (commit a8c2bde, base 6d11698)

```json
{
  "summary": "I fixed all four rework-2 findings. `takesASide` (views.ts) now only asks whether the listed entry is unsupported, so only choice files get `taken {by:\"disk\"}` after a Staged change. The deleted-side view gets \"resolved on disk\" from `middle.kind` alone. I renamed `deletedSideView`'s `loaded` parameter to `middleKind`. `isEditable(data)` moved from MergeView.vue into the pure module ui/views.ts, which MergeView now imports, and it has a new table test in ui/views.test.ts. I retitled the version-forwarding store test.",
  "files_changed": [
    "frontend/src/ui/views.ts",
    "frontend/src/ui/views.test.ts",
    "frontend/src/ui/MergeView.vue",
    "frontend/src/ui/deletedSide.ts",
    "frontend/src/ui/deletedSide.test.ts",
    "frontend/src/ui/store.test.ts"
  ],
  "tests_added": [
    {
      "name": "views.test.ts › deleted on side %s with a %j middle is editable: %s (6 rows)",
      "proves": "isEditable: not deleted with a Stages or Disk middle → true; not deleted with DiskNotText → false; deleted on either side → false whatever the middle (Stages, Disk, DiskNotText). Under the temporary && → || edit, 3 of the 6 rows fail."
    },
    {
      "name": "store.test.ts › a choice staged from the disk is taken by the disk, a deleted-side file is not, and both are shown again (rewritten from the 'a choice or a deleted-side file…' test)",
      "proves": "After a Staged change only the choice file is `taken {by:\"disk\"}`. The deleted-side file has no `taken` entry and is still loaded again."
    },
    {
      "name": "store.test.ts › finish, take and reset forward the disk version they are given (retitled, body unchanged)",
      "proves": "The store forwards the disk version it is given to finishFile, takeSide and resetFile."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; typecheck; fmt:check; test; just sfc-order; just web-unused (each with stdout discarded, then echo $?)",
      "observed": "pnpm -C frontend lint exit=0\npnpm -C frontend typecheck exit=0\npnpm -C frontend fmt:check exit=0\npnpm -C frontend test exit=0\njust sfc-order exit=0\njust web-unused exit=0"
    },
    {
      "command": "tails of the same recipes",
      "observed": "$ oxfmt --check … All matched files use the correct format. Finished in 422ms on 113 files\n$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (no output)\n$ vue-tsc -b (no output)\nTest Files  35 passed (35)  Tests  401 passed (401)\n$ tsx scripts/check-sfc-order.ts (no output)\n$ knip --include exports,types (no output)"
    },
    {
      "command": "temporary edit in views.ts:26 `deleted === null && …` → `deleted === null || …`; pnpm -C frontend exec vitest run --project node src/ui/views.test.ts",
      "observed": "FAIL |node| src/ui/views.test.ts > deleted on side local with a {\"kind\":\"Disk\",\"text\":\"m\\n\"} middle is editable: false\nAssertionError: expected true to be false\nTest Files  1 failed (1)  Tests  3 failed | 3 passed (6)\n— then reverted to `&&`; the full suite passes again (401/401)."
    }
  ],
  "deviations_from_brief": [
    "I put isEditable in views.ts rather than deletedSide.ts, because the rule covers DiskNotText middles too, not only deleted sides. The project-map line for views.ts (.omp/skills/project-map/SKILL.md, read-only for me) should say: 'shown views: fetch, put, reload; takesASide (choice file); isEditable (editor writable for this data)'. The curator's text from #566 still mentions 'deleted-side file' for takesASide, which is no longer true.",
    "deletedSide.test.ts:80: the 'disk resolved the file' case now calls `deletedSideView(\"remote\", null, \"Disk\")` instead of `(\"remote\", DISK, \"Disk\")`, because a deleted-side file no longer gets `taken {by:\"disk\"}`. The DISK rows in the Stages table are unchanged: `deletedSideView` still accepts every `Taken`.",
    "The brief's finding numbers are offset from the task's Change list (the brief's #566 is a docs item for the curator). I followed the content and touched no docs."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeView.vue:95-100, frontend/src/ui/ChoiceView.vue (diskVersion bindings)",
      "risk": "No unit test checks that the views pass their own `data.diskVersion` / `sides.diskVersion` to finish, take and reset. Only the desktop smoke covers those bindings; store.test.ts only checks that the store forwards whatever version it is given."
    },
    {
      "location": "frontend/src/ui/views.ts:21-23",
      "risk": "This relies on Rust always serving a Disk/DiskNotText middle for a deleted-side file after a Staged settle (Seen::ViewFromDisk). If a Stages middle ever followed a Staged change, the deleted-side view would show 'not resettable' and stay in the choosing state. I did not check this against crates/session; it comes from the orchestrator's decision. [INFERENCE]"
    }
  ]
}
```
