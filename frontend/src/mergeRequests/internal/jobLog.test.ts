import { expect, test } from "vitest";

import {
  hitPlaces,
  jobLogView,
  type HitPlace,
  type JobLogView,
  type LogHit,
  type LogLine,
  type LogRun,
  type LogStyle,
  type RunPoint,
} from "../index";

const E = "\x1b";
const MARKER_END = `\r${E}[0K`;
const PLAIN: LogStyle = {
  foreground: null,
  background: null,
  bold: false,
  italic: false,
  underline: false,
  struck: false,
};

const inputs: string[] = [];

function viewOf(raw: string): JobLogView {
  inputs.push(raw);
  return jobLogView(raw);
}

function lineText(line: LogLine): string {
  return line.runs.map((run) => run.text).join("");
}

function shown(raw: string): string[] {
  return viewOf(raw).lines.map(lineText);
}

function runs(raw: string): [string, LogStyle][][] {
  return viewOf(raw).lines.map((line) => line.runs.map((run: LogRun) => [run.text, run.style]));
}

function point(run: number, offset: number): RunPoint {
  return { run, offset };
}

function styled(style: Partial<LogStyle>): LogStyle {
  return { ...PLAIN, ...style };
}

function styleAfter(codes: string): LogStyle | undefined {
  return viewOf(`${E}[${codes}mx`).lines[0]?.runs[0]?.style;
}

function stamped(text: string, stream: "O" | "E" = "O", join = " "): string {
  return `2026-11-03T10:15:42.123456Z 0f${stream}${join}${text}`;
}

function joined(text: string): string {
  return stamped(text, "O", "+");
}

test("timestamps_are_stripped_and_plus_lines_join", () => {
  const raw = [
    stamped("$ make"),
    stamped("build", "E"),
    joined("ing"),
    joined(" all"),
    "not stamped",
    `note ${stamped("inside")}`,
    stamped("done"),
    "",
  ].join("\n");
  expect(shown(raw)).toEqual([
    "$ make",
    "building all",
    "not stamped",
    `note ${stamped("inside")}`,
    "done",
  ]);
});

test("a_log_whose_first_line_has_no_timestamp_keeps_text_that_looks_like_one", () => {
  const raw = ["hello", stamped("world"), joined("again")].join("\n");
  expect(shown(raw)).toEqual(["hello", stamped("world"), joined("again")]);
});

test.each([
  "2026-11-03T10:15:42.123456Z 0fX hello",
  "2026-11-03T10:15:42.12345Z 0fO hello!",
  "2026-11-03 10:15:42.123456Z 0fO hello",
  "2026-11-03T10:15:42.123456Z 0FO hello",
  "2026-11-03T10:15:42.123456Z 0fO-hello",
  `x${stamped("hello")}`,
])("a_first_line_whose_prefix_breaks_the_pattern_keeps_it (%s)", (first) => {
  expect(shown(`${first}\n${stamped("next")}`)).toEqual([first, stamped("next")]);
});

test("section_markers_vanish_and_their_header_is_a_plain_line", () => {
  const raw = [
    `${E}[0Ksection_start:1762164942:prepare_script[collapsed=true]${MARKER_END}${E}[36;1mPreparing${E}[0;m`,
    "Running on runner-1",
    `${E}[0Ksection_end:1762164943:prepare_script${MARKER_END}`,
    `section_start:1762164944:step.build-2[collapsed=true, hide_duration=false]${MARKER_END}Building`,
    `section_end:1762164945:step.build-2${MARKER_END}`,
    `section_start:1762164946:other[a=b,c=d, e=f]${MARKER_END}Other`,
  ].join("\n");
  expect(runs(raw)).toEqual([
    [["Preparing", styled({ foreground: "brightCyan", bold: true })]],
    [["Running on runner-1", PLAIN]],
    [["Building", PLAIN]],
    [["Other", PLAIN]],
  ]);
});

test("text_that_is_almost_a_section_marker_stays_text", () => {
  expect(
    shown(
      [
        "section_start:1:name and more",
        "section_middle:1:name",
        `see section_start:1:name[bad]`,
        `section_start:x:name${MARKER_END}after`,
        `abc section_start:x${MARKER_END} section_end:1:a`,
      ].join("\n"),
    ),
  ).toEqual([
    "section_start:1:name and more",
    "section_middle:1:name",
    "see section_start:1:name[bad]",
    "after",
    " section_end:1:a",
  ]);
});

test("a_section_marker_ends_a_line_that_has_text", () => {
  const raw = [
    `before section_start:1:a${MARKER_END}after`,
    `one section_start:1762164942:step.build-2${MARKER_END}two`,
    `three section_end:1762164943:script[collapsed=true]${MARKER_END}four`,
    `five section_start:12:b[a=b,c=d, hide_duration=false]${MARKER_END}six`,
    `section_end:2:a${MARKER_END}next`,
  ].join("\n");
  expect(shown(raw)).toEqual([
    "before ",
    "after",
    "one ",
    "two",
    "three ",
    "four",
    "five ",
    "six",
    "next",
  ]);
});

test("a_lone_carriage_return_clears_the_line_and_crlf_is_a_break", () => {
  expect(shown("10%\r50%\r100%\r\nnext\r\r\nlast\n")).toEqual(["100%", "next", "last"]);
  expect(runs(`${E}[31mred\rnew`)).toEqual([[["new", styled({ foreground: "red" })]]]);
  expect(shown("gone\r")).toEqual([]);
});

test("a_joined_line_keeps_the_carriage_return_before_its_join", () => {
  expect(shown([stamped("10%\r"), joined("100%"), stamped("next")].join("\n"))).toEqual([
    "100%",
    "next",
  ]);
  expect(shown([stamped("10%\r"), stamped("next")].join("\n"))).toEqual(["10%", "next"]);
});

test("only_sgr_styles_and_every_other_escape_vanishes", () => {
  expect(shown(`a${E}[0Kb${E}[2;5Hc${E}[?25ld${E}]0;e${E}[1~f${E}[5@g${E}@zh${E}_zi`)).toEqual([
    "abcdfghi",
  ]);
  expect(shown(`${E}]0;title${E}(B${E}\`x`)).toEqual(["itle(B`x"]);
  expect(runs(`${E}[32mok`)).toEqual([[["ok", styled({ foreground: "green" })]]]);
  expect(runs(`${E}[31ma${E}[0Kb${E}]1mc`)).toEqual([[["abc", styled({ foreground: "red" })]]]);
  expect(shown(`a${E}[1\u00e9mb${E}[\x7fmc`)).toEqual(["abc"]);
});

test("an_escape_cut_off_at_the_line_end_drops_the_rest", () => {
  expect(runs(`abc${E}[31;1 12.5% 3/4\nnext`)).toEqual([[["abc", PLAIN]], [["next", PLAIN]]]);
  expect(shown(`abc${E}\nnext`)).toEqual(["abc", "next"]);
});

test.each<[string, LogStyle]>([
  ["01", PLAIN],
  ["+1", PLAIN],
  ["031", PLAIN],
  ["5", PLAIN],
  ["8", PLAIN],
  ["28", PLAIN],
  [`31m${E}[`, PLAIN],
  [`31m${E}[;;`, PLAIN],
  ["1", styled({ bold: true })],
  ["3", styled({ italic: true })],
  ["4", styled({ underline: true })],
  ["9", styled({ struck: true })],
  ["1;3;4;9;31;42;0", PLAIN],
  ["1;22", PLAIN],
  ["1;21", PLAIN],
  ["3;23", PLAIN],
  ["4;24", PLAIN],
  ["9;29", PLAIN],
  ["31;39", PLAIN],
  ["31;99", PLAIN],
  ["41;49", PLAIN],
  ["41;109", PLAIN],
  ["31;", styled({ foreground: "red" })],
  [";31", styled({ foreground: "red" })],
  ["30", styled({ foreground: "black" })],
  ["37", styled({ foreground: "white" })],
  ["40", styled({ background: "black" })],
  ["47", styled({ background: "white" })],
  ["90", styled({ foreground: "brightBlack" })],
  ["97", styled({ foreground: "brightWhite" })],
  ["100", styled({ background: "brightBlack" })],
  ["107", styled({ background: "brightWhite" })],
  ["38", PLAIN],
  ["48", PLAIN],
  ["39;31", styled({ foreground: "red" })],
  ["1;5;3", styled({ bold: true, italic: true })],
])("codes_follow_gitlabs_exact_table (%j)", (codes, style) => {
  expect(styleAfter(codes)).toEqual(style);
});

test("bold_shows_basic_foregrounds_bright_but_not_indexed_or_bright_ones", () => {
  expect(styleAfter("1;31")).toEqual(styled({ foreground: "brightRed", bold: true }));
  expect(styleAfter("31;1")).toEqual(styled({ foreground: "brightRed", bold: true }));
  expect(styleAfter("1;91")).toEqual(styled({ foreground: "brightRed", bold: true }));
  expect(styleAfter("1;38;5;1")).toEqual(styled({ foreground: "red", bold: true }));
  expect(styleAfter("1;41")).toEqual(styled({ background: "red", bold: true }));
  expect(runs(`${E}[34ma${E}[1mb${E}[22mc`)).toEqual([
    [
      ["a", styled({ foreground: "blue" })],
      ["b", styled({ foreground: "brightBlue", bold: true })],
      ["c", styled({ foreground: "blue" })],
    ],
  ]);
});

test("a_256_colour_goes_through_basic_colour", () => {
  expect(styleAfter("38;5;208")).toEqual(styled({ foreground: "yellow" }));
  expect(styleAfter("48;5;196")).toEqual(styled({ background: "brightRed" }));
  expect(styleAfter("31;38;5")).toEqual(styled({ foreground: "red" }));
  expect(styleAfter("41;48;5")).toEqual(styled({ background: "red" }));
  expect(styleAfter("31;38;5;300")).toEqual(styled({ foreground: "red" }));
  expect(styleAfter("41;48;5;300;4")).toEqual(styled({ background: "red", underline: true }));
  expect(styleAfter("38;5;1")).toEqual(styled({ foreground: "red" }));
  expect(styleAfter("31;38;5;?")).toEqual(styled({ foreground: "black" }));
  expect(styleAfter("38;5;208.9")).toEqual(styled({ foreground: "yellow" }));
  expect(styleAfter("38;6;1")).toEqual(styled({ bold: true }));
});

test("truecolor_is_ignored_and_its_numbers_read_as_codes", () => {
  expect(styleAfter("31;38;2;255;0;0")).toEqual(PLAIN);
  expect(styleAfter("31;38;2;1;3;4")).toEqual(
    styled({ foreground: "brightRed", bold: true, italic: true, underline: true }),
  );
});

test("the_style_carries_across_lines", () => {
  expect(runs(`${E}[32mone\ntwo\n${E}[0mthree`)).toEqual([
    [["one", styled({ foreground: "green" })]],
    [["two", styled({ foreground: "green" })]],
    [["three", PLAIN]],
  ]);
});

test("empty_lines_are_not_shown", () => {
  expect(shown("a\n\n\nb\n")).toEqual(["a", "b"]);
  expect(shown(`a\n${E}[31m\n${E}[0K\n\x07\nb`)).toEqual(["a", "b"]);
  expect(shown("a\n   \n\t\nb")).toEqual(["a", "   ", "\t", "b"]);
  expect(viewOf("")).toEqual({ lines: [], text: "" });
  expect(viewOf("\n")).toEqual({ lines: [], text: "" });
});

test("control_characters_but_tab_vanish", () => {
  expect(shown("a\x00b\x07c\td\x7fe\x08f\x1fg h~\u0080i")).toEqual(["abc\tdefg h~\u0080i"]);
});

test("markup_in_a_log_stays_text", () => {
  const text = "<script>x</script> &amp; <b>bold</b>";
  expect(runs(text)).toEqual([[[text, PLAIN]]]);
});

test("equal_styles_merge_into_one_run_and_no_run_is_empty", () => {
  expect(runs(`${E}[31ma${E}[0K${E}[31mb${E}[1m${E}[22mc${E}[32m${E}[0md`)).toEqual([
    [
      ["abc", styled({ foreground: "red" })],
      ["d", PLAIN],
    ],
  ]);
  expect(runs(`${E}[31;1ma${E}[91mb`)).toEqual([
    [["ab", styled({ foreground: "brightRed", bold: true })]],
  ]);
  expect(runs(`${E}[31m${E}[0mx${E}[1m`)).toEqual([[["x", PLAIN]]]);
  expect(runs(`a${E}[3mb`)).toEqual([
    [
      ["a", PLAIN],
      ["b", styled({ italic: true })],
    ],
  ]);
});

test("hit_places_at_run_boundaries", () => {
  const view = viewOf(`ab${E}[31mcd${E}[0mef\nxyz`);
  const hits: LogHit[] = [
    { line: 0, from: 0, to: 2 },
    { line: 0, from: 2, to: 4 },
    { line: 0, from: 1, to: 5 },
    { line: 0, from: 5, to: 6 },
    { line: 0, from: 4, to: 7 },
    { line: 0, from: -1, to: 1 },
    { line: 2, from: 0, to: 1 },
    { line: -1, from: 0, to: 1 },
    { line: 1, from: 1, to: 3 },
  ];
  const places: HitPlace[] = [
    { line: 0, start: point(0, 0), end: point(0, 2) },
    { line: 0, start: point(1, 0), end: point(1, 2) },
    { line: 0, start: point(0, 1), end: point(2, 1) },
    { line: 0, start: point(2, 1), end: point(2, 2) },
    { line: 1, start: point(0, 1), end: point(0, 3) },
  ];
  expect(hitPlaces(view, hits)).toEqual(places);
});

test("a_whole_log_of_500_kb_parses_in_linear_time", () => {
  const LINES = 9000;
  const raw = Array.from({ length: LINES }, (_, at) =>
    stamped(`${E}[3${at % 8};1mStep ${at}${E}[0m: ok`),
  ).join("\n");
  expect(raw.length).toBeGreaterThanOrEqual(500_000);
  expect(raw.length).toBeLessThanOrEqual(512_000);
  const started = performance.now();
  const view = jobLogView(raw);
  const elapsed = performance.now() - started;
  expect(view.lines).toHaveLength(LINES);
  expect(elapsed).toBeLessThan(300);
});

test("the_text_is_the_lines_joined_by_line_breaks", () => {
  expect(inputs.length).toBeGreaterThan(50);
  for (const raw of inputs) {
    const view = jobLogView(raw);
    expect(view.text).toBe(view.lines.map(lineText).join("\n"));
    for (const line of view.lines) {
      expect(line.runs.length).toBeGreaterThan(0);
      expect(line.runs.every((run) => run.text !== "")).toBe(true);
    }
  }
});
