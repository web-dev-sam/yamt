# Slice ci-job-log-core — a GitLab job log as styled lines, matches placed on runs, the search's steps

Feature: CI job log (request `docs/slices/request-ci-job-log.md` rules 4–6 and the "colours, search" parts of the
acceptance; design `docs/slices/briefs/ci-job-log-design.md` option A, §1.2, §1.7–1.9, §2.2; proposed plan §2 #159;
proposed RK57). Framework-free, pure, tested (PM3: `mergeRequests/` imports no other `src/` module; no DOM, no
timers, no storage, `mergeRequests/AGENTS.md`). Runs beside `ci-job-log-rust`.

## Target

Owned: `frontend/src/mergeRequests/**` (new `internal/jobLog.ts`, `internal/ansiColours.ts`,
`internal/jobLogSearch.ts` and their tests; `index.ts`; `AGENTS.md`).

Read-only: everything else. `search/` is the page's matcher (`matcherOf`, `search/index.ts:1`); this slice only
receives its hits as `LogHit`. The callers (`ui/mergeRequestJobLogs.ts`, `ui/CiStatusJobLog.vue`,
`ui/mergeRequestLogLook.ts`) are `ci-job-log-state`'s and `ci-job-log-page`'s. `docs/**` is the docs keeper's.

Non-goals: folding sections, timestamps shown, durations (request non-goals); regex or match-case search; truecolor;
blink, inverse, fonts (GitLab applies none); any colour value (the palette slice's tokens; the page maps
`AnsiColour` to classes).

## Contract

Fixed; existing exports stay. All types `readonly`; `index.ts` exports exactly these new names.

```ts
// internal/jobLog.ts
export type AnsiColour =
  | "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white"
  | "brightBlack" | "brightRed" | "brightGreen" | "brightYellow"
  | "brightBlue" | "brightMagenta" | "brightCyan" | "brightWhite";
export type LogStyle = {
  readonly foreground: AnsiColour | null; // null: the box's own text colour
  readonly background: AnsiColour | null; // null: the box's own background
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly struck: boolean;
};
export type LogRun = { readonly text: string; readonly style: LogStyle }; // text never ""
export type LogLine = { readonly runs: readonly LogRun[] }; // at least one run
export type JobLogView = {
  readonly lines: readonly LogLine[];
  /** Every line's runs' texts joined, the lines joined by "\n": what the search runs over (rule 8: what is shown). */
  readonly text: string;
};
/** The log as GitLab's job page shows it (rules below). Total: any string gives a view, "" none of its lines. */
export function jobLogView(raw: string): JobLogView;

export type LogHit = { readonly line: number; readonly from: number; readonly to: number }; // UTF-16, from < to
export type RunPoint = { readonly run: number; readonly offset: number };
export type HitPlace = { readonly line: number; readonly start: RunPoint; readonly end: RunPoint };
/** Where each hit of `view.text` starts and ends among its line's runs, in order. A `from` at a run's end starts in
 *  the next run (offset 0); a `to` at a run's end ends in that run (offset = its length); a hit outside the view is
 *  left out. */
export function hitPlaces(view: JobLogView, hits: readonly LogHit[]): readonly HitPlace[];

// internal/ansiColours.ts
/** A 256-colour index as one of the 16: 0–7 the basic, 8–15 the bright ones; 16–231 (xterm's cube, levels 0, 95, 135,
 *  175, 215, 255) and 232–255 (grays 8 + 10·k) the nearest of the 16 by squared RGB distance on xterm's default
 *  palette (0,0,0) (205,0,0) (0,205,0) (205,205,0) (0,0,238) (205,0,205) (0,205,205) (229,229,229) (127,127,127)
 *  (255,0,0) (0,255,0) (255,255,0) (92,92,255) (255,0,255) (0,255,255) (255,255,255), a tie to the lower index;
 *  anything else `null`. The triples are numbers that classify, never a colour painted (palette fence, design §1.8). */
export function basicColour(index: number): AnsiColour | null;

// internal/jobLogSearch.ts
export const NO_RESULTS = "No results";
/** The first current match: the last one in the log (rule 6); null when there is none. */
export function firstHit(count: number): number | null;
/** Enter (forward) / Shift+Enter (backwards), wrapping at both ends; `count` ≥ 1, `current` in [0, count). */
export function steppedHit(current: number, count: number, backwards: boolean): number;
/** "3 of 17" for current 2 of 17 (`count` ≥ 1). */
export function hitCountText(current: number, count: number): string;
```

**`jobLogView`'s rules** (design §1.2, §1.9; GitLab `lib/gitlab/ci/ansi2json/converter.rb`, `parser.rb`,
`style.rb`, `line.rb`, and `ansi2html.rb` for bold):

1. **Lines.** Physical lines end at `\n`; a trailing `\n` makes no extra line. A line break is `\r*\n` (the `\r`s
   before it belong to the break).
2. **Timestamps.** When the first physical line starts with `^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d{6}Z
   [0-9a-f]{2}[EO][+ ]` (32 characters), every physical line starting with that pattern loses those 32 characters;
   otherwise none does (a later line that looks like one keeps it). A physical line whose **next** line has the prefix
   with `+` in its 32nd character continues into it: only the `\n` between them goes (any `\r` before it stays, so it
   then clears, rule 5), and the next line's text after its prefix follows on the same line.
3. **Section markers** `section_(start|end):\d+:[A-Za-z0-9_.-]+` + an optional `[k=v, k=v]` (`\w+=\w+`, `, ` or `,`
   between) + `\r\e[0K` are dropped. A start or an end ends the current line when it has text; what follows starts a
   new line (so a section's header shows as a plain line).
4. **Escapes.** `\e` + one character of `@`–`_` + the shortest run of characters up to one of `@`–`~` is one escape:
   applied when it is `\e[` … `m` (SGR, rule 6), dropped otherwise (`\e[0K`, cursor moves, `\e]0;t…`). An `\e` with no
   such end before the line's end drops the rest of the line.
5. **Characters.** A lone `\r` clears the text gathered for the current line (the style stays): a progress bar shows
   its last state. Other C0 controls but tab (U+0000–U+001F) and U+007F are dropped. Everything else is text in the
   current style, never markup (`<b>` is three characters).
6. **SGR.** The parameters are the text between `\e[` and `m` split at `;`, trailing empty ones dropped (Ruby's
   `split`); none at all resets. Read left to right, each by its exact text (`01`, `+1`, `031` do nothing):
   `0` reset; `1` bold; `3` italic; `4` underline; `8` nothing visible (conceal is shown, design §2.4); `9` struck;
   `21` `22` bold off; `23` italic off; `24` underline off; `28` nothing; `29` struck off; `30`–`37` foreground basic;
   `39` and `99` foreground default; `40`–`47` background basic; `49` and `109` background default; `90`–`97`
   foreground bright; `100`–`107` background bright; `38` / `48`: when at least two parameters follow and the next is
   exactly `5`, both are consumed and the second (`Number.parseInt(p, 10)`, NaN as 0, as Ruby's `to_i`) when 0–255
   sets the foreground / background by `basicColour`; otherwise `38`/`48` consume nothing (so `38;2;255;0;0` reads
   `2`, `255`, `0` — a reset — `0`: GitLab's "no truecolor"). Anything else is ignored.
7. **Shown colours.** A foreground set by `30`–`37` shows as its bright variant while bold (ansi2html `:274-278`,
   rule 4); a bright or 256-colour one never changes with bold; backgrounds never do.
8. **Style across lines.** The style carries from line to line until changed.
9. **Lines without text are not shown** (the job page drops them: `line.rb` `empty?`, `converter.rb`
   `flush_current_line`): a blank line, a line of markers or escapes only, a line cleared by `\r` with nothing after.
10. **Runs.** Neighbouring text in equal styles is one run; no empty run; a line has at least one run.

## Change

1. `internal/ansiColours.ts` and its test.
2. `internal/jobLog.ts`: `jobLogView` as one scan over the text with the rules above, `hitPlaces`; tests. Name what you
   can after GitLab's names (`section`, `timestamp`, `SGR`); no comment restating code (`skill://comment-policy`).
3. `internal/jobLogSearch.ts` and its test.
4. `index.ts` exports; `AGENTS.md`: a paragraph for the log (the rules' sources, `text` is what search runs over,
   `hitPlaces`' boundary rule, `basicColour`).

## Acceptance

- Vitest (`pnpm -C frontend test -- src/mergeRequests`), each named for the bug it catches, at least:
  - `ansiColours.test.ts`: `the_first_sixteen_are_themselves` (0–15), `a_256_colour_is_its_nearest_basic_one` (16
    black, 21 blue, 28 green, 46 brightGreen, 124 red, 196 brightRed, 208 yellow, 226 brightYellow, 232 black, 244
    brightBlack, 250 white, 255 white), `anything_else_is_no_colour` (−1, 256, 1.5).
  - `jobLog.test.ts`: `timestamps_are_stripped_and_plus_lines_join`,
    `a_log_whose_first_line_has_no_timestamp_keeps_text_that_looks_like_one`,
    `section_markers_vanish_and_their_header_is_a_plain_line`, `a_section_marker_ends_a_line_that_has_text`,
    `a_lone_carriage_return_clears_the_line_and_crlf_is_a_break`, `a_joined_line_keeps_the_carriage_return_before_its_join`,
    `only_sgr_styles_and_every_other_escape_vanishes`, `an_escape_cut_off_at_the_line_end_drops_the_rest`,
    `codes_follow_gitlabs_exact_table` (`01`, `22`, `39`, `49`, `99`, `109`, `21`, unknown `5`),
    `bold_shows_basic_foregrounds_bright_but_not_indexed_or_bright_ones`, `a_256_colour_goes_through_basic_colour`
    (`38;5;208`, `48;5;196`, `38;5` alone, `38;5;300`), `truecolor_is_ignored_and_its_numbers_read_as_codes`,
    `the_style_carries_across_lines`, `empty_lines_are_not_shown`, `control_characters_but_tab_vanish`,
    `markup_in_a_log_stays_text` (RK57: `<script>x</script>` and `&amp;` are run text as written),
    `the_text_is_the_lines_joined_by_line_breaks` (over every test input of the file),
    `equal_styles_merge_into_one_run_and_no_run_is_empty`,
    `hit_places_at_run_boundaries` (a hit ending at a run's end, one starting there, one across three runs, one
    outside the view).
  - `jobLogSearch.test.ts`: `the_first_current_match_is_the_last`, `steps_wrap_both_ways`, `the_count_reads_one_based`.
  - A whole-log test: a 500 KB input built in the test (9,000 coloured lines with timestamps) gives 9,000 lines in
    under 300 ms in node (`performance.now()`; record the number) — the parser is linear.
- `pnpm -C frontend lint`, `typecheck` (clean: nothing uses the new exports yet), `test`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://comment-policy`, `skill://risk-register` (proposed RK57), `skill://verification`.
