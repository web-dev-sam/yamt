# Slice mr-fast-preview-local — yamt renders a comment itself when GitLab would render it the same (editor)

Feature: an instant comment preview when yamt can render it. Sources:

- Request `docs/slices/request-mr-fast-preview.md` A1–A4 and the core acceptance "every A2 trigger sends the text to
  GitLab; every A1 construct of the corpus renders locally to the same blocks GitLab's recorded answer gives; a doubtful
  text goes to GitLab".
- Design `docs/slices/briefs/mr-fast-preview-design.md` option A, §1.1 (what matches), §1.2 (every rule, its source),
  §1.3 (home), §3.1 row #186, §3.2 RK74, §4.1–4.2.

Runs in round 2, once `mr-fast-preview-corpus` is committed (its fixture is your test data), beside
`mr-fast-preview-remembered`. `mr-fast-preview-panel` calls your function.

## Target

**Owned:**

- `frontend/src/editor/internal/localPreview.ts` (new), `frontend/src/editor/internal/localPreview.test.ts` (new)
- `frontend/src/editor/internal/markdownInline.ts`, `frontend/src/editor/internal/markdownInline.test.ts`
- `frontend/src/editor/internal/markdownBlocks.ts`, `frontend/src/editor/internal/markdownBlocks.test.ts`
- `frontend/src/editor/index.ts` (one export line)
- `frontend/src/editor/AGENTS.md`

**Read-only:** everything else.

- `frontend/fixtures/markdown/gitlab-preview.json`: `mr-fast-preview-corpus`'s; read it, never edit it. A verdict you
  think wrong is a deviation, not an edit.
- `frontend/src/editor/internal/markdownTree.ts`, `markdownTable.ts`, `markdownDom.ts`, `language.ts`, `editor/markdown.ts`:
  used as they are.
- `frontend/src/ipc/**`: the `Description` domain type (`ipc/descriptionDomain.ts:14-53`) as it is.
- `frontend/src/ui/**`: `mr-fast-preview-panel`'s.
- `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** any change to the AI chat's Markdown (A4: `markdownDom.ts` keeps calling `parseInline(source)` in its
default mode; every existing markdown test stays green unchanged); links, images, task boxes, `details` built locally;
reading a table's alignment into anything but `start` (design §4.1); the panel.

## Contract

Fixed; you may add, never change.

```ts
// editor/internal/localPreview.ts — exported by editor/index.ts: `export { localPreview } from "./internal/localPreview";`
import type { Description } from "../../ipc";

/** `text` as yamt's Markdown subset draws it, in the blocks GitLab's preview reduces to, when that is exactly what
 *  GitLab's preview shows (plan §2 #186); null when anything in it may render otherwise on GitLab — then GitLab must.
 *  The one owner of that decision (design §1.2). Never called with a blank text (the caller words it). */
export function localPreview(text: string): Description | null;

// editor/internal/markdownInline.ts
/** How a delimiter run may open or close: "yamt" — the AI chat's rule since plan #112 (not beside white space; `_`
 *  not inside a word); "commonMark" — CommonMark 0.31.2 §6.2's left- and right-flanking rule, with Unicode
 *  punctuation (P and S categories) and white space (Zs, tab, line ending; a text's start and end count as white
 *  space); `*` and `~` open when left-flanking and close when right-flanking; `_` as §6.2 rules 2 and 4. */
export type Flanking = "yamt" | "commonMark";
export function parseInline(source: string, flanking: Flanking = "yamt"): Inline[];

// editor/internal/markdownBlocks.ts
/** The indices of `text`'s lines (split as `parseBlocks` splits) inside fenced code: for each line where `fence`
 *  finds a fence (indent 0–3), the lines after it up to its closing line or the text's end, the fence lines
 *  themselves excluded; scanning resumes after the closing line. */
export function fencedLines(text: string): ReadonlySet<number>;
```

**The rules** (design §1.2, cited there; null when any holds). "Code" is a code inline or a fenced block.

- **C — characters outside code**, per inline source (each paragraph's and heading's text, each table cell's string):
  for each of `\`, `[`, `<`, `{`, `$`, its count in the source is greater than its count in the source's code inlines'
  text (at any depth).
- **T — in a text inline** (at any depth; code inlines are never checked):
  T1 `/[#!%@][\p{L}\p{N}_"]/u` or `/&[\p{L}\p{N}_#]/u`; T2 any `~`; T3 `/:[A-Za-z0-9_+-]+:/`; T4
  `/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/u`; T5 `/[A-Za-z][A-Za-z0-9+.-]*:\/\//`,
  `/www\./i`, `/mailto:|xmpp:/i`; T6 `/(?<![\p{L}\p{N}_])[0-9A-Fa-f]{7,40}(?![\p{L}\p{N}_])/u`; T7 a `link` inline.
- **S — lines not in `fencedLines(text)`:** S1 `/^ {0,3}(=+|-+)[ \t]*$/` right after a non-blank line; S2 a line indented
  4 or more columns (a tab counts to the next multiple of 4) that is the first line or follows a blank line; S3 `/^\s*\d{1,9}\)(\s|$)/`;
  S4 `/^\s*\+(\s|$)/`; S5 lines matching `/^\s*-\s/` and lines matching `/^\s*\*\s/` both present; S6 `/^ {0,3}>>>/`; S7
  the first line is `---`, `+++` or `;;;` (trailing white space allowed); S8 `/^\s*:\s/`; S9 a tab or U+0000; S13 a line
  where `FENCE` (`markdownBlocks.ts:32`) matches and its info (the rest, trimmed) holds white space; S14 `/^\/[A-Za-z]/`;
  S15 `/^\s*([-*]|\d{1,9}\.)\s*$/`; **S12 only if** the fixture marks `table_after_paragraph` `local: false`: a line that
  `startsTable` (`markdownTable.ts:33`) with its next line, right after a non-blank line.
- **K — a code block** (any depth): K1 `info` is not `""` and not (all of: `/^[a-z0-9_+-]+$/`, `languageNamed(info) !==
  null` (`editor/internal/language.ts:19`), not in `GITLAB_DRAWN_LANGUAGES`); K3 its first or last line is blank (an
  empty block included).
- **N — nesting:** a block or an inline 15 deep.
- **Code exemption, conditional:** if the fixture marks `code_hides_refs` or `fence_hides_refs` `local: false`, C and T
  count code too (code inlines are checked as text; fenced lines are not exempt from S9) — say so in
  `deviations_from_brief`.

```ts
/** Fenced-block languages GitLab draws instead of showing code (docs.gitlab.com: Diagrams and flowcharts, Math,
 *  GeoJSON, STL, suggestions); each goes to GitLab even if yamt colours it. */
const GITLAB_DRAWN_LANGUAGES = [
  "mermaid",
  "plantuml",
  "math",
  "suggestion",
  "geojson",
  "topojson",
  "stl",
  "kroki",
  "actdiag",
  "blockdiag",
  "bpmn",
  "bytefield",
  "c4plantuml",
  "d2",
  "dbml",
  "ditaa",
  "dot",
  "erd",
  "excalidraw",
  "graphviz",
  "nomnoml",
  "nwdiag",
  "packetdiag",
  "pikchr",
  "rackdiag",
  "seqdiag",
  "structurizr",
  "svgbob",
  "symbolator",
  "tikz",
  "umlet",
  "vega",
  "vegalite",
  "wavedrom",
  "wireviz",
] as const;
```

**The blocks** (`parseBlocks(text)`, every inline source through `parseInline(source, "commonMark")`):

| subset                                | `Description`                                                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paragraph { text }`                  | `{ kind: "paragraph", inlines }`                                                                                                                                             |
| `heading { tag, text }`               | `{ kind: "heading", level: tag, inlines }` (`"h1"`…`"h6"` are the same strings)                                                                                              |
| `code { info, code }`                 | `{ kind: "code", language: info === "" ? null : info, text: code }`                                                                                                          |
| `list { numbering, items }`           | `{ kind: "list", numbering: bullet → { kind: "bullets" }, ordered → { kind: "numbers", start }, items: each { task: "none", blocks } }`                                      |
| `quote { blocks }`                    | `{ kind: "quote", blocks }`                                                                                                                                                  |
| `table { header, rows }`              | `{ kind: "table", head: [{ cells: header → { header: true, align: "start", inlines } }], body: rows → { cells: … header: false, align: "start" } }` (`body: []` for no rows) |
| `rule`                                | `{ kind: "rule" }`                                                                                                                                                           |
| inline `text`, `code`, `break`        | `{ kind: "text", text }`, `{ kind: "code", text }`, `{ kind: "lineBreak" }`                                                                                                  |
| inline `emphasis`, `strong`, `strike` | the same kinds with `inlines`                                                                                                                                                |
| inline `link`                         | null (T7)                                                                                                                                                                    |

## Change

1. `Flanking` and the `commonMark` flags in `delimiterRun` (`markdownInline.ts:127-140`): the default stays
   `"yamt"`, so `markdownDom.ts` and the AI chat are unchanged.
2. `fencedLines` in `markdownBlocks.ts`, through `fence` itself (one fence rule).
3. `localPreview.ts`: the rules, then the blocks; one module, no class. The order is free; null at the first rule that
   holds.
4. The export line in `editor/index.ts`; `editor/AGENTS.md`: what `localPreview` decides, its rules by letter, that the
   corpus fixture is its proof and that the AI chat keeps the `yamt` mode.

## Acceptance

**Tests** (node, `pnpm -C frontend test`), each named for the bug it catches:

- `every_local_entry_of_gitlabs_corpus_renders_to_its_blocks` (`localPreview.test.ts`) — **owns A1**: the fixture
  loaded as `ipc/fixture.ts:25-28` loads JSON (`import.meta.glob("../../../fixtures/markdown/gitlab-preview.json",
  { eager: true, import: "default" })`), parsed by a type guard (no `as`); for every `local: true` entry,
  `visible(localPreview(text))` equals `visible(blocks)`, the failure naming the entry. `visible` is a test helper over
  plain JSON values that changes nothing a reader sees (design §1.1): in every `inlines` array, adjacent `text` items
  merge; every run of space, tab and `\n` in a text becomes one space; the first item's start and the last item's end
  are trimmed when they are texts, as are a text's end before a `lineBreak` and its start after one; empty texts go.
- `every_other_entry_of_the_corpus_goes_to_gitlab` — every `local: false` entry → null.
- `each_trigger_sends_the_text_to_gitlab` — **owns A2**: one text per rule (C1–C5, T1–T7, S1–S9, S13–S15, S12 when
  on, K1, K3, N) and each of `GITLAB_DRAWN_LANGUAGES` as a fence → null; at least `#12`, `!3`, `&4`, `~bug`, `%v1`,
  `$x$`, `@anna`, `a@b.org`, `:smile:`, `😀`, `🇩🇪`, `http://x`, `https://x`, `www.x.org`, `mailto:a`, `abc1234`,
  `[x](y)`, `![a](b)`, `[^1]`, `- [ ] t`, `<b>x</b>`, `<https://x>`, `{width=1}`, `a\*b`, `&amp;`, `Title\n===`,
  `Sub\n---`, `p\n\n    code`, `1) a`, `+ a`, `- a\n* b`, `>>>\nq\n>>>`, `---\nk: v\n---`, `term\n: def`, `a\tb`,
  `/close`, `-`, ` ```rust ignore `, ` ```TS `, ` ```mermaid `, ` ```suggestion `, a fence with a blank last line,
  a quote 15 deep.
- `a_trigger_inside_code_stays_local` — the C and T characters inside code spans (`` `#12 @anna a\b [x](y) <b> {x} $5 ~x
  :x: abc1234` ``) and inside a `rust` fence (with tabs and a 4-space-indented line) → a local rendering (unless the
  exemption is off, then null).
- `a_table_reads_start_whatever_its_alignment` (`| l | c | r |\n| :- | :-: | -: |\n| 1 | 2 | 3 |`) → every cell
  `align: "start"`; head cells `header: true`, body `false`.
- `commonmark_flanking_refuses_what_yamts_allows` (`markdownInline.test.ts`): `a**"b"**` → strong in `yamt`, text in
  `commonMark`; `**bold**.`, `(*it*)`, `snake_case_name`, `***both***` equal in both; the existing tests unchanged — **owns
  A4 for the AI chat**.
- `fenced_lines_are_the_insides_of_each_fence` (`markdownBlocks.test.ts`): closed, unclosed, `~~~`, indented 2, two
  fences, a backtick fence whose info holds a backtick (no fence), a quoted fence (not counted).

**Failing paths** (editor/ is not mutated; do each, see the named test fail, undo, paste the failure line): drop T1's
`@` → `each_trigger…` and `every_other_entry…` (`mention`) fail; pass `"yamt"` instead of `"commonMark"` in
`localPreview` → `every_local_entry…` (`emphasis_punct`) fails; drop the code exemption → `a_trigger_inside_code…`
fails; map aligned cells to `center` → `a_table_reads_start…` and `every_local_entry…` (`table_align`) fail; return
`fencedLines` empty → `a_trigger_inside_code…` (the tab in the fence) fails.

**Commands:** `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check`, `pnpm -C frontend
test` (it runs `frontend/scripts/fences.test.ts` too: `editor/` still imports only `ipc` and its own files), `pnpm -C
frontend unused` (the new export has its caller only after `mr-fast-preview-panel`: if knip reports it, say so in
`open_risks`; expected until then), `just mutants HEAD` for the record (editor/ is excluded; the failing paths above
stand in).

**Smoke:** the tests above are this slice's end-to-end proof (a pure function); paste the counts of `local: true`
entries rendered and `local: false` entries refused.

## Skills

`skill://cm6-rules` (editor/), `skill://ts-conventions`, `skill://risk-register` (RK66, RK71; RK74 proposed),
`skill://verification`.
