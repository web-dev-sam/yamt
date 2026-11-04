# MrThreadsRepass

Agent output (`agent://MrThreadsRepass`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsRepass.md), collected 2026-11-04T20:26:45.631Z.

{
  "gate": "fail",
  "failures": [
    {
      "step": "hooks-test (just check, last recipe; fmt-check through sfc-order, arch-check included, all passed before it)",
      "excerpt": "✔ (17 hooks tests passed)\n✖ autoload budget: each autoloaded SKILL.md ≤ 10 KB, each agent's autoloaded total ≤ 28 KB (1.927904ms)\nℹ tests 18\nℹ pass 17\nℹ fail 1\ntest at ../.omp/hooks/test/hooks.test.ts:412:1\n  AssertionError [ERR_ASSERTION]: web-impl.md autoloads 28913 bytes\n      at TestContext.<anonymous> (/home/wds/Projects/yamt/.omp/hooks/test/hooks.test.ts:427:12)\n    actual: false, expected: true, operator: '=='\nerror: recipe `hooks-test` failed on line 72 with exit code 1\nEXIT 1 (wall 55.29 s)"
    }
  ],
  "smoke": [],
  "environment": "HEAD 73538fcc; rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; linux x64. No smoke recipes were run, as instructed."
}
