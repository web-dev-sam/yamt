import { forEachDiagnostic, setDiagnosticsEffect } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { isDocVersion, type DocVersion, type ProblemSeverity, type ServerProblem } from "../../lsp";
import { problemCounts, problemsField, problemsSpec, tookSpec } from "./problems";

type At = readonly [line: number, character: number];

const TEXT = "let a = 1;\nlet b = 2;\nlet c = 3;\n";

function version(n: number): DocVersion {
  if (!isDocVersion(n)) {
    throw new RangeError(`not a document version: ${n}`);
  }
  return n;
}

function problem(
  [fromLine, fromCharacter]: At,
  [toLine, toCharacter]: At,
  { message = "bad", severity = "error", code = null }: Partial<ServerProblem> = {},
): ServerProblem {
  return {
    from: { line: fromLine, character: fromCharacter },
    to: { line: toLine, character: toCharacter },
    severity,
    message,
    source: "oxc",
    code,
  };
}

function opened(text = TEXT): EditorState {
  return EditorState.create({ doc: text, extensions: [problemsField] });
}

function took(state: EditorState, ...versions: readonly number[]): EditorState {
  return versions.reduce((done, n) => done.update(tookSpec(done, version(n))).state, state);
}

function answer(
  state: EditorState,
  server: string,
  n: number,
  problems: readonly ServerProblem[],
): EditorState {
  const spec = problemsSpec(state, { server, version: version(n), problems });
  return spec === null ? state : state.update(spec).state;
}

function shown(state: EditorState): string[] {
  const lines: string[] = [];
  forEachDiagnostic(state, ({ message, severity, source }, from, to) => {
    lines.push(`${state.sliceDoc(from, to)} ${severity} ${message} (${source ?? ""})`);
  });
  return lines;
}

test("rule 2: positions are read on the version's own text and mapped through every edit made since", () => {
  const sent = took(opened(), 1);
  const edited = sent.update({ changes: { from: 0, insert: "// added\n" } }).state;

  const after = answer(edited, "oxlint", 1, [problem([1, 4], [1, 5], { message: "b is unused" })]);

  expect(shown(after)).toEqual(["b error b is unused (oxlint)"]);
});

test("rule 2: a character past the line ends at the line's end, a line past the text at its end", () => {
  const sent = took(opened(), 1);

  const after = answer(sent, "oxlint", 1, [
    problem([0, 8], [0, 99], { message: "long" }),
    problem([2, 4], [9, 0], { message: "to the end" }),
  ]);

  expect(shown(after)).toEqual(["1; error long (oxlint)", "c = 3;\n error to the end (oxlint)"]);
});

test("rule 2: a problem whose text was deleted since its version is not shown", () => {
  const sent = took(opened(), 1);
  const deleted = sent.update({ changes: { from: 11, to: 22 } }).state;

  const after = answer(deleted, "oxlint", 1, [problem([1, 4], [1, 5])]);

  expect(shown(after)).toEqual([]);
});

test("rule 2: answers for a version never taken or forgotten are dropped; a second answer for the same version replaces the first", () => {
  const sent = took(opened(), 1, 2);
  const newer = answer(sent, "oxlint", 2, [problem([0, 4], [0, 5], { message: "newer" })]);
  const slow = answer(answer(sent, "tsgo", 1, []), "oxlint", 2, [
    problem([0, 4], [0, 5], { message: "newer" }),
  ]);

  const stillOpen = answer(slow, "tsgo", 1, [problem([1, 4], [1, 5], { message: "remembered" })]);
  const forgotten = answer(newer, "tsgo", 1, [problem([1, 4], [1, 5], { message: "forgotten" })]);
  const unknown = answer(newer, "tsgo", 3, [problem([1, 4], [1, 5], { message: "unknown" })]);
  const same = answer(newer, "tsgo", 2, [problem([2, 4], [2, 5], { message: "same" })]);
  const again = answer(newer, "oxlint", 2, [problem([1, 4], [1, 5], { message: "again" })]);

  expect(shown(stillOpen)).toEqual(["a error newer (oxlint)", "b error remembered (tsgo)"]);
  expect(shown(forgotten)).toEqual(["a error newer (oxlint)"]);
  expect(shown(unknown)).toEqual(["a error newer (oxlint)"]);
  expect(shown(same)).toEqual(["a error newer (oxlint)", "c error same (tsgo)"]);
  expect(shown(again)).toEqual(["b error again (oxlint)"]);
});

test("rule 2: an answer that changes nothing shown sets no diagnostics, so an open problem tooltip stays", () => {
  const sent = took(opened(), 1);
  const first = answer(sent, "oxlint", 1, [problem([0, 4], [0, 5], { message: "kept" })]);
  const both = answer(first, "tsgo", 1, [problem([1, 4], [1, 5], { message: "typed" })]);
  const edited = both.update({ changes: { from: 0, insert: "// added\n" } }).state;
  function sets(problems: readonly ServerProblem[]): boolean {
    const spec = problemsSpec(edited, { server: "oxlint", version: version(1), problems });
    return [spec?.effects ?? []].flat().some((effect) => effect.is(setDiagnosticsEffect));
  }

  const repeated = answer(edited, "oxlint", 1, [problem([0, 4], [0, 5], { message: "kept" })]);
  const cleared = answer(repeated, "tsgo", 1, []);

  expect(sets([problem([0, 4], [0, 5], { message: "kept" })])).toBe(false);
  expect(sets([problem([0, 4], [0, 5], { message: "changed" })])).toBe(true);
  expect(sets([problem([0, 4], [0, 6], { message: "kept" })])).toBe(true);
  expect(sets([problem([0, 4], [0, 5], { message: "kept", severity: "warning" })])).toBe(true);
  expect(sets([problem([0, 4], [0, 5], { message: "kept", code: "x" })])).toBe(true);
  expect(sets([])).toBe(true);
  expect(shown(repeated)).toEqual(["a error kept (oxlint)", "b error typed (tsgo)"]);
  expect(shown(cleared)).toEqual(["a error kept (oxlint)"]);
});

test("rule 2: a version stays answerable until every server that answered is past it", () => {
  const sent = took(opened(), 1, 2, 3);
  const first = answer(sent, "oxlint", 2, []);

  const late = answer(first, "tsgo", 2, [problem([0, 4], [0, 5], { message: "late" })]);
  const tooLate = answer(first, "tsgo", 1, [problem([0, 4], [0, 5], { message: "too late" })]);

  expect(shown(late)).toEqual(["a error late (tsgo)"]);
  expect(shown(tooLate)).toEqual([]);
});

test("rule 2: with no answers at all only the newest 32 versions are kept", () => {
  const many = took(opened(), ...Array.from({ length: 33 }, (_, index) => index + 1));

  const oldest = answer(many, "oxlint", 1, [problem([0, 4], [0, 5], { message: "oldest" })]);
  const kept = answer(many, "oxlint", 2, [problem([0, 4], [0, 5], { message: "kept" })]);

  expect(shown(oldest)).toEqual([]);
  expect(shown(kept)).toEqual(["a error kept (oxlint)"]);
});

test("rule 2: two servers' problems are shown together, and [] clears only that server's", () => {
  const sent = took(opened(), 1);
  const both = answer(
    answer(sent, "oxlint", 1, [problem([0, 4], [0, 5], { code: "eslint(no-unused-vars)" })]),
    "tsgo",
    1,
    [problem([1, 4], [1, 5], { severity: "warning", message: "maybe" })],
  );
  const edited = both.update({ changes: { from: 0, insert: "\n" } }).state;

  const cleared = answer(edited, "oxlint", 1, []);

  expect(shown(both)).toEqual([
    "a error bad (oxlint eslint(no-unused-vars))",
    "b warning maybe (tsgo)",
  ]);
  expect(shown(cleared)).toEqual(["b warning maybe (tsgo)"]);
});

test("rule 4: counts are errors, warnings, and info with hints as other", () => {
  const severities: readonly ProblemSeverity[] = ["error", "warning", "warning", "info", "hint"];
  const sent = took(opened(), 1);

  const after = answer(
    sent,
    "oxlint",
    1,
    severities.map((severity, index) => problem([0, index], [0, index + 1], { severity })),
  );

  expect(problemCounts(opened())).toEqual({ errors: 0, warnings: 0, other: 0 });
  expect(problemCounts(after)).toEqual({ errors: 1, warnings: 2, other: 2 });
});
