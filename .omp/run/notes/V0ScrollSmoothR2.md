# V0ScrollSmoothR2

## summary
I added three tests to gap.test.ts; gap.ts is unchanged. Two of them are one `test.each` case run twice: a conflict chunk whose local side is applied, then ignored, has no band on the local strip and still has its exact band on the remote strip. The third is "each strip paints a chunk in its own side's tone". It uses a small made-up file with a local-only deletion and a remote-only deletion, so each strip must show "deleted" while the other side's tone is "modified". I could not edit gap.ts, so I proved the mutants with temporary `vi.mock` stand-ins in the test file instead (see deviations). Each mutant failed its test, and the scaffold is gone.

## deviations_from_brief
[
  "I could not mutate gap.ts by hand: the ownership hook (SP1) blocked the edit (\"frontend/src/editor/internal/gap.ts is outside your slice\"). I applied each mutant with a temporary `vi.mock` in the test file instead. For mutant 1, `isSideOpen` always returned true, which is what gap.ts:32 does with the guard removed (bandPaints is the only `isSideOpen` caller these tests reach). For mutant 2, `chunkTone` was called with the other side, which is gap.ts:40 with the wrong side; I also ran a fixed \"local\" side. I ran the file under each mock, pasted the failures above, and removed the scaffold before the acceptance run.",
  "The golden and showcase fixtures have no non-conflict chunk whose local and remote tones differ. I checked every fixture: none has a non-conflict deletion. So the tone test builds a 3-line file in the test through `loadFixture(\"synthetic.ts\", { \"synthetic.json\": record })`, the same way decorations.test.ts does.",
  "Two non-conflict chunks are needed, one per strip. A non-conflict chunk is painted only on the strip of the side it changed, and a BothSame chunk has equal tones on both sides. So one chunk alone cannot give both strips a paint with different tones.",
  "Small refactor of the existing helpers: `magicRows` now takes the conflict chunk's status, `conflictBand` takes an optional status (default PENDING), and the row mapping moved into `rowOf`. The existing test's local `shifts` became the shared `IN_STRIP` constant, which the new status test also uses."
]

## open_risks
[
  {
    "location": "frontend/src/editor/internal/gap.test.ts:121-133",
    "risk": "The mutants were proved through module mocks, not real edits to gap.ts. The behaviour is the same for these tests, but `just mutants` does not cover editor/ files, so nothing runs a real mutant there yet."
  }
]

## smoke_evidence
[
  {
    "command": "pnpm -C frontend exec vitest run --project node src/editor/internal/gap.test.ts  (final file, no mutant)",
    "observed": "Test Files  1 passed (1)\n      Tests  8 passed (8)"
  },
  {
    "command": "Mutant 1, guard removed: temporary `vi.mock(\"./status\", … isSideOpen: () => true)` in gap.test.ts, then vitest run on the file",
    "observed": "× a chunk whose local side is applied leaves the local strip and stays on the remote one\n× a chunk whose local side is ignored leaves the local strip and stays on the remote one\n× each strip paints a chunk in its own side's tone\nAssertionError: expected 'M0 560 C20 560 20 460 40 460 L40 660 …' to be undefined\n ❯ src/editor/internal/gap.test.ts:133:59  expect(await conflictBand(\"local\", IN_STRIP, status)).toBeUndefined()\nTests  3 failed | 5 passed (8)"
  },
  {
    "command": "Mutant 2, wrong side: temporary `vi.mock(\"./tone\", …)` where `chunkTone` swaps local and remote, then vitest run on the file",
    "observed": "× each strip paints a chunk in its own side's tone\nAssertionError: expected [ [ +0, 'modified' ] ] to deeply equal [ [ +0, 'deleted' ] ]\n ❯ src/editor/internal/gap.test.ts:149:5  ).toEqual([[0, \"deleted\"]]);\nTests  1 failed | 7 passed (8)"
  },
  {
    "command": "Mutant 2b, side fixed to \"local\": temporary `vi.mock(\"./tone\", … chunkTone: (chunk) => tone.chunkTone(chunk, \"local\"))`, then vitest run on the file",
    "observed": "AssertionError: expected [ [ 1, 'modified' ] ] to deeply equal [ [ 1, 'deleted' ] ]\n ❯ src/editor/internal/gap.test.ts:154:5  ).toEqual([[1, \"deleted\"]]);\nTests  1 failed | 7 passed (8)"
  },
  {
    "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test && pnpm -C frontend fmt:check && pnpm -C frontend unused; echo \"exit=$?\"  (after removing the mock scaffold)",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\n$ vue-tsc -b\n$ vitest run --project node\n Test Files  33 passed (33)\n      Tests  339 passed (339)\n$ oxfmt --check\nAll matched files use the correct format.\n$ knip --include exports,types\nexit=0"
  },
  {
    "command": "git status --short",
    "observed": " M frontend/src/editor/internal/gap.test.ts   (gap.ts unchanged)"
  }
]

## tests_added
[
  {
    "name": "a chunk whose local side is applied leaves the local strip and stays on the remote one",
    "proves": "Kills removing the `isSideOpen` guard (gap.ts:32): if the guard is dropped, the local strip still paints the applied conflict chunk 8."
  },
  {
    "name": "a chunk whose local side is ignored leaves the local strip and stays on the remote one",
    "proves": "Same as above for the \"ignored\" status. It also checks that the remote strip keeps its exact band (left 560–760, right 700–980) while the local side is closed."
  },
  {
    "name": "each strip paints a chunk in its own side's tone",
    "proves": "Kills computing `chunkTone` for the wrong side (gap.ts:40). It uses a LocalOnly deletion and a RemoteOnly deletion: the local strip must give [[0, \"deleted\"]] and the remote strip [[1, \"deleted\"]]. The wrong side gives \"modified\". It also kills a fixed \"local\" side through the remote assertion, and by symmetry a fixed \"remote\" side through the local one [INFERENCE: that last case was not run]."
  }
]
