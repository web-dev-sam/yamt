# IconFixFormat

Agent output (`agent://IconFixFormat`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/IconFixFormat.md), collected 2026-11-04T08:06:03.696Z.

{
  "summary": "Ran oxfmt on frontend/src/ui/MergeRequestLinks.vue only. It split the link-line icon's `<component>` tag, which had grown too long when `self-center` was added in 3012182c, into one attribute per line. The class list still reads `size-4 shrink-0 self-center`. `fmt:check` now passes.",
  "files_changed": [
    "frontend/src/ui/MergeRequestLinks.vue"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec oxfmt src/ui/MergeRequestLinks.vue",
      "observed": "Finished in 347ms on 1 files using 24 threads."
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "$ oxfmt --check\nChecking formatting...\n\nAll matched files use the correct format.\nFinished in 1240ms on 800 files using 24 threads."
    },
    {
      "command": "git diff -- frontend",
      "observed": "@@ -110,7 +110,11 @@\n-              <component :is=\"icons[group.kind]\" class=\"size-4 shrink-0 self-center\" aria-hidden=\"true\" />\n+              <component\n+                :is=\"icons[group.kind]\"\n+                class=\"size-4 shrink-0 self-center\"\n+                aria-hidden=\"true\"\n+              />\n(1 file changed, 5 insertions(+), 1 deletion(-))"
    }
  ],
  "mutation": {
    "command": "not run: the brief excludes it because this change is formatting only (and .vue files are not mutated anyway)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [],
  "open_risks": []
}
