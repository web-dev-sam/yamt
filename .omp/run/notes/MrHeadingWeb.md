# MrHeadingWeb

Agent output (`agent://MrHeadingWeb`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingWeb.md), collected 2026-11-25T09:53:46.564Z.

{
  "summary": "The range window now has a merge-request line as the first bar on the files screen. It shows !iid, the title, source chip → target chip and the range's +A −R. A typed range shows its two names around its own `..`/`...`. Column headers are structured: name, then muted 'where X branched off', then the muted mono short id. `rangeText.columnNames` is the one naming rule, shared by the headers, the search pane titles and emptyRangeText. `toRangeStart` brands heading.iid. The fixture takes ?heading=. app-session takes --heading and --mr-title/--mr-source/--mr-target.",
  "files_changed": [
    "frontend/src/ipc/rangeDomain.ts",
    "frontend/src/ipc/fixtureRange.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/rangeText.ts",
    "frontend/src/ui/rangeSearch.ts",
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/RangeView.vue",
    "frontend/src/ui/RangeHeadingLine.vue",
    "frontend/src/ui/RangeColumnHeading.vue",
    "frontend/src/ui/AGENTS.md",
    "frontend/scripts/app-session/startArgs.ts",
    "frontend/scripts/app-session/args.ts",
    "frontend/src/ipc/rangeDomain.test.ts",
    "frontend/src/ipc/fixtureRange.test.ts",
    "frontend/src/ipc/fixtureGitLab.test.ts",
    "frontend/src/ipc/fixtureReview.test.ts",
    "frontend/src/ipc/fixtureReviewed.test.ts",
    "frontend/src/ipc/tauriRange.test.ts",
    "frontend/src/ui/rangeText.test.ts",
    "frontend/src/ui/rangeSearch.test.ts",
    "frontend/src/ui/rangeStore.test.ts",
    "frontend/src/ui/rangeThreads.test.ts",
    "frontend/src/ui/rangeThreadText.test.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/RangeColumnHeading.test.ts",
    "frontend/src/ui/RangeHeadingLine.test.ts",
    "frontend/scripts/app-session/args.test.ts",
    "frontend/scripts/app-session/startArgs.test.ts"
  ],
  "tests_added": [
    {
      "name": "rangeDomain.test: a $kind heading and the totals are kept as the app sent them; a heading iid of -1/1.5 is refused naming heading.iid",
      "proves": "toRangeStart keeps heading and totals and brands the iid for both merge-request variants"
    },
    {
      "name": "rangeText.test: columnNames of (two typed names | three dots | a merge request | without names) + merge-base label on the right",
      "proves": "one test per row of the contract table, checking both sides with branchedOff and subject"
    },
    {
      "name": "rangeText.test: columnText of %o; branched-off note; emptyRangeText x3; headingLine of each kind incl. .. vs ...",
      "proves": "the contract's wording, e.g. 'main (1b2cfed) and dev (2b3b4b5) have the same files.'"
    },
    {
      "name": "rangeText.test: no header text of a merge request without names holds a 40-character name",
      "proves": "the unnamed start's headers, empty text and line hold only short ids"
    },
    {
      "name": "rangeSearch.test: a merge request's panes are titled as its column headers",
      "proves": "pane titles are 'main, where feature branched off (531ea52)' and 'feature (9c1ba3f)'"
    },
    {
      "name": "fixtureRange.test: ?heading=mergeRequest|fork|hiddenFork|unnamed; unknown heading logs range.fixture_heading_miss; no/empty heading keeps typed without a log",
      "proves": "the fixture replaces the heading only, keeping the case's totals, sides and files; the miss event and its fields"
    },
    {
      "name": "fixtureRange.test: committed review totals equal the sum of counted lines; parse refusals for heading kind, names, iid, totals",
      "proves": "the regenerated fixtures agree with the list; the schema refuses bad heading or totals data, naming the file"
    },
    {
      "name": "RangeColumnHeading.test: header reads 'main where feature branched off 531ea52', words one space apart; classes and subject title",
      "proves": "a copied header reads as it looks; name emphasised, short id muted mono"
    },
    {
      "name": "RangeHeadingLine.test: parts of each kind, no separator text; labelled group; chip titles",
      "proves": "VU18: the parts are exactly reference/title/chips/arrow or dots/totals"
    },
    {
      "name": "startArgs.test: --heading after --reviewed's, only with --range-case; --mr-* after --review-of=; refused when partial (6 cases) or without --review-of",
      "proves": "the app-session flag contract, including a title with quotes and '='"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; pnpm -C frontend lint; pnpm -C frontend fmt:check",
      "observed": "vue-tsc -b: no errors; oxlint + eslint: no output (exit 0); oxfmt: All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  316 passed (316)  Tests  4790 passed (4790)"
    },
    {
      "command": "just web-unused",
      "observed": "$ knip --include exports,types (no findings, exit 0)"
    },
    {
      "command": "just app-session start-fixture --name mhw --range-case review --heading mergeRequest --size 1280x800; read line/headers/colours",
      "observed": "parts [!12, Reminders before a card is due, feature, →, main, +64−67]; separator regex false; jq .start.totals = {added:64, removed:67}; h3 ['main where feature branched off 531ea52','feature 9c1ba3f']; line +64 rgb(120,191,123) / −67 rgb(246,107,113), same as a RangeFileRow's +1/−1; maxButtonRight 1267 ≤ innerWidth 1280"
    },
    {
      "command": "click Settings, read; click Back, read; restart with --mr list, click 'Merge requests', read; Back, read",
      "observed": "Settings: line false, side [false,false]; Back: line restored, side [true,true]. MR list: line null, side [false,false]; Back: line and side back"
    },
    {
      "command": "--heading fork and hiddenFork at 1280x800 and 900x600 (dark + light shots)",
      "observed": "source chip 'sam:feature/reminders-grouped-by-due-day' / '(fork) feature/reminders-grouped-by-due-day' with its full name as title; title overflow 165 px (1280) and 545 px (900), so it truncates; source chip overflow 70/93 px, truncated; maxButtonRight 1267/1280 and 887/900"
    },
    {
      "command": "--heading unnamed; no --heading; --range-case empty (dark + light shots)",
      "observed": "unnamed: [!12, 9c1ba3f, →, 531ea52, +64−67], h3 ['531ea52','9c1ba3f']. Typed: [main, ..., feature, +64−67], left header 'main where feature branched off 531ea52'. Empty: line [feature, .., feature, +0−0] with bottom 41 px, above the empty text (top 91 px) 'feature (9c1ba3f) and feature (9c1ba3f) have the same files.'"
    },
    {
      "command": "read --name mhw \"document.documentElement.dataset.theme = 'light'\" + shot, every case",
      "observed": "/tmp/mhw-*-dark.png and /tmp/mhw-*-light.png; I looked at them: chips, muted arrow and dots, green/red totals in both themes"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (2nd run, after the survivor tests): 808 killed, 17 timeout, 110 survived, 8 no-cov, 3 errors over 5 web files (score 87.49)",
    "survivors": [
      "src/ipc/fixtureRange.ts:98-135 CASE schema, FORK_*, HEADINGS literals — gate-covered: static mutants the vitest runner never re-evaluates (#732); the ?heading= tests assert these values",
      "src/ipc/rangeDomain.ts:85 case \"typed\"→\"\" — equivalent: the default arm returns the same heading value",
      "src/ipc/rangeDomain.ts:98, src/ui/rangeText.ts:139,188 default {never} → {} (NoCoverage) — equivalent: unreachable exhaustive arms (TS3)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "MergeRequestNames, RangeHeading and RangeTotals are declared in rangeDomain.ts but not exported, from there or from ipc/index.ts (no diff left in index.ts). Exporting them as the Contract asks fails `just web-unused` (TS16, knip): they have no importer. RangeStart still carries them.",
    "Range case literals fed to the fixture parser at runtime gained heading and totals: rangeStore.test.ts, rangeThreads.test.ts, fixtureReviewed.test.ts, rangeSearch.test.ts. They are untyped, so the brief's typecheck list misses them, but the new CASE schema refuses them without these fields.",
    "RangeView.vue: the old local computed `columns` (content is columns) is renamed `isColumns`, because the new prop `columns` would be shadowed in the template.",
    "Two new component render tests (RangeColumnHeading.test.ts, RangeHeadingLine.test.ts), SSR the same way as MergeRequestFilter.test.ts.",
    "The fixture applies ?heading= while the cases are parsed, so toRangeStart still brands the iid. The missing-case start (unknown ?range) keeps typed even when ?heading= is given.",
    "startArgs.ts had to stay ≤300 lines (max-lines). MergeRequestNames is a one-line Record type, the --mr-* app args come from Object.entries over {title, source, target}, and one `if (...) return null;` has no braces (scripts/contrast.ts has the same form).",
    "RangeColumnHeading.vue puts the space between words inside the name and note spans (`${name} `), because Vue drops whitespace between elements written on separate lines."
  ],
  "open_risks": [
    {
      "location": "frontend/scripts/app-session/startArgs.ts:270",
      "risk": "The --mr-* order depends on mergeRequestNames building {title, source, target} in that order (Object.entries). The startArgs test pins it."
    },
    {
      "location": ".omp/skills/project-map/tree.md",
      "risk": "tree.md does not yet name the new RangeHeadingLine.vue and RangeColumnHeading.vue; the design leaves that to the docs keeper. `just map-check` passes today."
    },
    {
      "location": "frontend/src/ui/RangeHeadingLine.vue:19",
      "risk": "Copying the whole line gives no spaces between the chips, because the gaps between flex items are not text. The brief asks for copy spacing only in the column headers."
    }
  ]
}
