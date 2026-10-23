# RawCompareFormatR2 (3.C-format rework 2, board Raw compare row 3)

Both source-text tests (#1492, #1493) are deleted, and every acceptance check passes.

```
summary
  The two tests that read the scanners' own source code are gone: formatJson.test.ts had one at :172
  (#1492) and formatXml.test.ts had one at :189 (#1493). These were the only tests in those files to
  use `import.meta.glob(?raw)`. Nothing else was imported only by them (the files import just vitest
  and the module under test), so nothing else was removed. formatJson.ts and formatXml.ts are untouched.

files_changed
  frontend/src/editor/internal/formatJson.test.ts
  frontend/src/editor/internal/formatXml.test.ts

tests_added
  none (the brief only removes tests)

smoke_evidence
  pnpm -C frontend typecheck && lint && unused && fmt:check && test (chained with &&, so each one passed):
    $ vue-tsc -b                                   → exit 0
    $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue" → exit 0
    $ knip --include exports,types                 → exit 0
    $ oxfmt --check → "All matched files use the correct format. Finished in 928ms on 372 files"
    test → "Test Files  129 passed (129)" / "Tests  1797 passed (1797)"
  grep 'import\.meta\.glob|\?raw' in both test files → "No matches found"

deviations_from_brief
  []

open_risks
  Nothing guards against NUMBER/ESCAPE (formatJson.ts) or NAME (formatXml.ts) being moved back to
  module level any more. The brief removes that guard on purpose (tests never assert source text).
```