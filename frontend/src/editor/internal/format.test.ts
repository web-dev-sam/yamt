import { undo, undoDepth } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { forEachDiagnostic, setDiagnostics } from "@codemirror/lint";
import { EditorState, type StateField, type TransactionSpec } from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../../ipc";
import type { FormatReply, FormattingOptions } from "../../lsp";
import { chunkField, placeSpans, type ChunkSpan } from "./chunkField";
import { formatResult, formattingOptions, type ResultPane } from "./format";
import { gapArrows } from "./gap";
import { paneState, paneText, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";
import type { Side } from "./side";
import type { ApplyMode, ChunkStatus } from "./status";

type Eol = FileMergeData["eol"];

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};
const LINES = 410;
const BLOCK = { start: 199, len: 3 };
const SERVER = "oxfmt";

class FakePane implements ResultPane {
  state: EditorState;
  dispatched = 0;

  constructor(state: EditorState) {
    this.state = state;
  }

  dispatch(spec: TransactionSpec): void {
    this.dispatched += 1;
    this.state = this.state.update(spec).state;
  }
}

type Merge = { readonly field: StateField<readonly ChunkSpan[]>; readonly pane: FakePane };

type Formatter = {
  readonly asked: FormattingOptions[];
  format(options: FormattingOptions): Promise<FormatReply>;
};

function numbered(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);
}

function separator(eol: Eol): string {
  return eol === "CrLf" ? "\r\n" : "\n";
}

function fileText(eol: Eol, block: readonly string[]): string {
  const lines = numbered("line", LINES);
  const before = lines.slice(0, BLOCK.start);
  const after = lines.slice(BLOCK.start + BLOCK.len);
  return [...before, ...block, ...after, ""].join(separator(eol));
}

function chunkRecord(middleLen: number): unknown {
  return {
    chunk: {
      id: 0,
      kind: "Conflict",
      base: BLOCK,
      local: { start: BLOCK.start, len: 2 },
      remote: { start: BLOCK.start, len: 4 },
    },
    middle: { start: BLOCK.start, len: middleLen },
    words: {
      chunk: 0,
      local: { changed: [], removed_at: [] },
      remote: { changed: [], removed_at: [] },
    },
    waiting: {
      kind: "Markers",
      open: "<<<<<<< ours",
      between: ["======="],
      close: ">>>>>>> theirs",
    },
  };
}

async function conflicted(eol: Eol = "Lf", middleLen = BLOCK.len): Promise<Merge> {
  const data = await loadFixture("synthetic.ts", {
    "synthetic.json": {
      path: "synthetic.ts",
      deleted: null,
      middle: { kind: "Stages", text: fileText(eol, numbered("block", middleLen)) },
      local: fileText(eol, numbered("ours", 2)),
      remote: fileText(eol, numbered("theirs", 4)),
      eol,
      disk_version: 0,
      chunks: [chunkRecord(middleLen)],
    },
  });
  const field = chunkField(data.chunks);
  const state = paneState({
    kind: "center",
    doc: paneDocs(data).center,
    eol,
    language: null,
    settings: SETTINGS,
    extensions: [field],
  });
  return { field, pane: new FakePane(state) };
}

function plain(doc: string, eol: Eol): Merge {
  const field = chunkField([]);
  const lineBreak = eol === "CrLf" ? [EditorState.lineSeparator.of("\r\n")] : [];
  return { field, pane: new FakePane(EditorState.create({ doc, extensions: [lineBreak, field] })) };
}

function decided(merge: Merge, status: ChunkStatus): void {
  const { field, pane } = merge;
  const spans = pane.state.field(field).map((span) => ({ ...span, status }));
  pane.state = pane.state.update({ effects: placeSpans.of(spans) }).state;
}

function formatter(pane: FakePane, reply: (sent: string) => FormatReply): Formatter {
  const asked: FormattingOptions[] = [];
  return {
    asked,
    format: (options) => {
      asked.push(options);
      return Promise.resolve(reply(paneText(pane.state)));
    },
  };
}

function answering(result: string): (sent: string) => FormatReply {
  return (sent) => ({ kind: "formatted", server: SERVER, sent, result });
}

function reindent(line: string): string {
  return `  ${line}`;
}

function reformatted(
  sent: string,
  lineNumbers: readonly number[],
  eol: Eol,
  change: (line: string) => string = (line) => `${line};`,
): string {
  const lines = sent.split(separator(eol));
  return lines
    .map((line, index) => (lineNumbers.includes(index + 1) ? change(line) : line))
    .join(separator(eol));
}

function problemTexts(state: EditorState): string[] {
  const texts: string[] = [];
  forEachDiagnostic(state, ({ message }, from, to) => {
    texts.push(`${message}: ${state.doc.lineAt(from).number} ${state.sliceDoc(from, to)}`);
  });
  return texts;
}

function formatting(
  { field, pane }: Merge,
  reply: (sent: string) => FormatReply,
): Promise<unknown> {
  return formatResult(
    formatter(pane, reply),
    () => pane,
    field,
    () => false,
  );
}

function status({ field, pane }: Merge): string {
  const span = pane.state.field(field)[0];
  return span === undefined ? "gone" : `${span.status.local} ${span.status.remote}`;
}

function arrows({ field, pane }: Merge, side: Side): ApplyMode[] {
  const rows = pane.state.field(field).map((span) => ({
    ...span,
    left: { top: span.chunk.local.start + 1, bottom: 0 },
    center: { top: 0, bottom: 0 },
    right: { top: span.chunk.remote.start + 1, bottom: 0 },
  }));
  return gapArrows(rows, side).map(({ mode }) => mode);
}

function blockText({ field, pane }: Merge): string {
  const span = pane.state.field(field)[0];
  return span === undefined ? "" : pane.state.sliceDoc(span.from, span.to);
}

function linesNextToBlock({ field, pane }: Merge): [string, string] {
  const span = pane.state.field(field)[0];
  if (span === undefined) {
    throw new Error("the block is gone");
  }
  const { doc } = pane.state;
  return [doc.lineAt(span.from - 1).text, doc.lineAt(span.to).text];
}

function seeded(seed: number): (below: number) => number {
  let current = seed;
  return (below) => {
    current = (current * 48_271) % 2_147_483_647;
    return current % below;
  };
}

const LINE_VARIANTS: readonly ((line: string) => string[])[] = [
  (line) => [`  ${line}`],
  (line) => [`${line};`],
  (line) => [`"${line}"`],
  () => [],
  (line) => [line, ""],
  (line) => line.split(" "),
];

function perturbed(
  lines: readonly string[],
  at: (index: number) => boolean,
  random: (below: number) => number,
): string[] {
  const next: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const following = lines[index + 1];
    const choice = at(index) ? random(LINE_VARIANTS.length * 3) : -1;
    if (choice === LINE_VARIANTS.length && following !== undefined && at(index + 1)) {
      next.push(`${line} ${following}`);
      index += 1;
    } else {
      next.push(...(LINE_VARIANTS[choice]?.(line) ?? [line]));
    }
  }
  return next;
}

test.each<Eol>(["Lf", "CrLf"])(
  "rule 5: formatting lines 3 and 400 around an open block is one undo step that keeps the block's statuses and arrows (%s)",
  async (eol) => {
    const merge = await conflicted(eol);
    const { pane } = merge;
    const sent = paneText(pane.state);
    const block = blockText(merge);
    const result = reformatted(sent, [3, 400], eol);

    const outcome = await formatting(merge, answering(result));

    expect(outcome).toEqual({ kind: "formatted", server: SERVER });
    expect(paneText(pane.state)).toBe(result);
    expect(pane.state.doc.line(3).text).toBe("line 3;");
    expect(blockText(merge)).toBe(block);
    expect(status(merge)).toBe("pending pending");
    expect(arrows(merge, "local")).toEqual(["replace"]);
    expect(arrows(merge, "remote")).toEqual(["replace"]);
    expect(undoDepth(pane.state)).toBe(1);

    undo({
      state: pane.state,
      dispatch: (tr) => {
        pane.state = tr.state;
      },
    });

    expect(paneText(pane.state)).toBe(sent);
    expect(status(merge)).toBe("pending pending");
    expect(undoDepth(pane.state)).toBe(0);
  },
);

test.each<Eol>(["Lf", "CrLf"])(
  "rule 5: reindenting lines 198–204 formats 198 and 204 only; the open block, the lines next to it, its arrows and the problems stay (%s)",
  async (eol) => {
    const merge = await conflicted(eol);
    const { pane } = merge;
    const { doc } = pane.state;
    pane.dispatch(
      setDiagnostics(pane.state, [
        { from: doc.line(3).from, to: doc.line(3).to, severity: "error", message: "untouched" },
        { from: doc.line(198).to - 3, to: doc.line(198).to, severity: "error", message: "moved" },
        { from: doc.line(200).from, to: doc.line(200).to, severity: "error", message: "untouched" },
        { from: doc.line(205).from, to: doc.line(205).to, severity: "error", message: "untouched" },
      ]),
    );
    const sent = paneText(pane.state);
    const result = reformatted(sent, [198, 199, 200, 201, 202, 203, 204], eol, reindent);

    await formatting(merge, answering(result));

    expect(paneText(pane.state)).toBe(reformatted(sent, [198, 204], eol, reindent));
    expect(status(merge)).toBe("pending pending");
    expect(blockText(merge)).toBe([...numbered("block", BLOCK.len), ""].join(separator(eol)));
    expect(linesNextToBlock(merge)).toEqual(["line 199", "line 203"]);
    expect(arrows(merge, "local")).toEqual(["replace"]);
    expect(arrows(merge, "remote")).toEqual(["replace"]);
    expect(problemTexts(pane.state)).toEqual([
      "untouched: 3 line 3",
      "moved: 198 198",
      "untouched: 200 block 1",
      "untouched: 205 line 205",
    ]);
  },
);

test.each([
  {
    name: "(A) a line split before the block, its first line reindented",
    middleLen: 3,
    old: "line 199\nblock 1\n",
    next: "line\n  199\n  block 1\n",
  },
  {
    name: "(A) a line split before the block, its first line reindented and given a `;`",
    middleLen: 3,
    old: "line 199\nblock 1\n",
    next: "line\n  199\n  block 1;\n",
  },
  {
    name: "(B) two lines joined before a one-line block, the block reindented",
    middleLen: 1,
    old: "line 198\nline 199\nblock 1\n",
    next: "line 198 line 199\n  block 1\n",
  },
  {
    name: "(B) two lines joined before a one-line block, the block reindented and given a `;`",
    middleLen: 1,
    old: "line 198\nline 199\nblock 1\n",
    next: "line 198 line 199\n  block 1;\n",
  },
  {
    name: "(B) two lines joined before a one-line block, the block reindented and quoted",
    middleLen: 1,
    old: "line 198\nline 199\nblock 1\n",
    next: 'line 198 line 199\n  "block 1"\n',
  },
  {
    name: "(B2) two lines joined before a two-line block, its first line reindented",
    middleLen: 2,
    old: "line 198\nline 199\nblock 1\n",
    next: "line 198 line 199\n  block 1\n",
  },
  {
    name: "(B2) two lines joined before a two-line block, its first line reindented and given a `;`",
    middleLen: 2,
    old: "line 198\nline 199\nblock 1\n",
    next: "line 198 line 199\n  block 1;\n",
  },
  {
    name: "(C) a blank line added after the block's reindented last line",
    middleLen: 3,
    old: "block 3\nline 203\n",
    next: "  block 3\n\nline 203\n",
  },
  {
    name: "(C) a blank line added after the block's reindented last line, given a `;`",
    middleLen: 3,
    old: "block 3\nline 203\n",
    next: "  block 3;\n\nline 203\n",
  },
])(
  "rule 5: $name is left out; the block stays pending with its own text and arrows, line 3 is formatted, one undo step",
  async ({ middleLen, old, next }) => {
    const merge = await conflicted("Lf", middleLen);
    const { pane } = merge;
    const block = blockText(merge);
    const away = reformatted(paneText(pane.state), [3], "Lf");
    const result = away.replace(old, next);

    const outcome = await formatting(merge, answering(result));

    expect(result).not.toBe(away);
    expect(outcome).toEqual({ kind: "formatted", server: SERVER });
    expect(paneText(pane.state)).toBe(away);
    expect(status(merge)).toBe("pending pending");
    expect(blockText(merge)).toBe(block);
    expect(arrows(merge, "local")).toEqual(["replace"]);
    expect(arrows(merge, "remote")).toEqual(["replace"]);
    expect(undoDepth(pane.state)).toBe(1);
  },
);

test.each<Eol>(["Lf", "CrLf"])(
  "rule 5: a formatter reformatting the lines inside an open block leaves them as they were (%s)",
  async (eol) => {
    const merge = await conflicted(eol);
    const { pane } = merge;
    const block = blockText(merge);
    const away = reformatted(paneText(pane.state), [3], eol);

    await formatting(merge, answering(reformatted(away, [200, 201, 202], eol)));

    expect(paneText(pane.state)).toBe(away);
    expect(status(merge)).toBe("pending pending");
    expect(blockText(merge)).toBe(block);
  },
);

test.each<ChunkStatus>([
  { local: "applied", remote: "pending" },
  { local: "ignored", remote: "pending" },
  { local: "pending", remote: "applied" },
])(
  "rule 5: a half-decided conflict ($local $remote) and the lines next to it are not formatted",
  async (half) => {
    const merge = await conflicted();
    decided(merge, half);
    const { pane } = merge;
    const block = blockText(merge);
    const away = reformatted(paneText(pane.state), [3], "Lf");

    await formatting(merge, answering(reformatted(away, [199, 200, 201, 202, 203], "Lf")));

    expect(paneText(pane.state)).toBe(away);
    expect(pane.state.field(merge.field)[0]?.status).toEqual(half);
    expect(blockText(merge)).toBe(block);
  },
);

test.each<ChunkStatus>([
  { local: "applied", remote: "applied" },
  { local: "ignored", remote: "ignored" },
  { local: "ignored", remote: "applied" },
])("rule 5: a decided change ($local $remote) is formatted like any other line", async (done) => {
  const merge = await conflicted();
  decided(merge, done);
  const { pane } = merge;
  const result = reformatted(paneText(pane.state), [3, 199, 200, 201, 202, 203], "Lf");

  const outcome = await formatting(merge, answering(result));

  expect(outcome).toEqual({ kind: "formatted", server: SERVER });
  expect(paneText(pane.state)).toBe(result);
  expect(blockText(merge)).toBe("block 1;\nblock 2;\nblock 3;\n");
  expect(pane.state.field(merge.field)[0]?.status).toEqual(done);
});

test("rule 5: an answer that only touches an open change or the lines next to it is unchanged and dispatches nothing", async () => {
  const merge = await conflicted();
  const { pane } = merge;
  const before = pane.state;
  const sent = paneText(before);
  const answers = [
    sent.replace("block 1\nblock 2\nblock 3\n", ""),
    reformatted(sent, [199], "Lf"),
    reformatted(sent, [203], "Lf"),
    reformatted(sent, [199, 200], "Lf", reindent),
    reformatted(sent, [200, 201, 202], "Lf"),
    sent.replace("line 199\n", "line 199\n\n"),
    sent.replace("block 3\n", "block 3\n\n"),
  ];

  const outcomes = [];
  for (const result of answers) {
    outcomes.push(await formatting(merge, answering(result)));
  }

  expect(outcomes).toEqual(answers.map(() => ({ kind: "unchanged", server: SERVER })));
  expect(pane.dispatched).toBe(0);
  expect(pane.state).toBe(before);
  expect(status(merge)).toBe("pending pending");
});

test("rule 5: random answers around an open block never change it or the lines next to it", async () => {
  const merge = await conflicted();
  const { pane } = merge;
  const start = pane.state;
  const block = blockText(merge);
  const random = seeded(11);

  for (let round = 0; round < 200; round += 1) {
    pane.state = start;
    const lines = paneText(start).split("\n");
    const result = perturbed(lines, (index) => index >= 190 && index <= 212, random).join("\n");

    await formatting(merge, answering(result));

    expect(blockText(merge)).toBe(block);
    expect(linesNextToBlock(merge)).toEqual(["line 199", "line 203"]);
    expect(status(merge)).toBe("pending pending");
  }
});

test("rule 5: random answers away from an open block are applied exactly", async () => {
  const merge = await conflicted();
  const { pane } = merge;
  const start = pane.state;
  const random = seeded(13);
  for (let round = 0; round < 200; round += 1) {
    pane.state = start;
    const result = perturbed(
      paneText(start).split("\n"),
      (index) => (index >= 180 && index <= 196) || (index >= 203 && index <= 220),
      random,
    ).join("\n");

    await formatting(merge, answering(result));

    expect(paneText(pane.state)).toBe(result);
    expect(status(merge)).toBe("pending pending");
  }
});

test("rule 5: a formatter's LF answer to a CRLF Result is split on every line break, and the Result stays CRLF", async () => {
  const merge = await conflicted("CrLf");
  const { pane } = merge;
  const result = reformatted(paneText(pane.state), [3, 400], "CrLf").replaceAll("\r\n", "\n");

  const outcome = await formatting(merge, answering(result));
  const same = await formatting(merge, (text) => answering(text.replaceAll("\r\n", "\n"))(text));

  expect(outcome).toEqual({ kind: "formatted", server: SERVER });
  expect(paneText(pane.state)).toBe(result.replaceAll("\n", "\r\n"));
  expect(pane.state.doc.lines).toBe(result.split("\n").length);
  expect(status(merge)).toBe("pending pending");
  expect(same).toEqual({ kind: "unchanged", server: SERVER });
});

test("rule 5: a CRLF Result keeps CRLF line breaks in every formatted line", async () => {
  const merge = await conflicted("CrLf");
  const { pane } = merge;
  const sent = paneText(pane.state);
  const result = sent.replace("line 1\r\nline 2\r\n", "line 1\r\nnew a\r\nnew b\r\nline 2\r\n");

  await formatting(merge, answering(result));

  expect(paneText(pane.state)).toBe(result);
  expect(paneText(pane.state).replaceAll("\r\n", "")).not.toContain("\n");
});

test("rule 5: a Result typed in since it was sent is changedMeanwhile and nothing is applied", async () => {
  const merge = await conflicted();
  const before = merge.pane.state;

  const outcome = await formatting(merge, (text) => ({
    kind: "formatted",
    server: SERVER,
    sent: `${text}typed`,
    result: "formatted\n",
  }));

  expect(outcome).toEqual({ kind: "changedMeanwhile", server: SERVER });
  expect(merge.pane.state).toBe(before);
});

test("rule 5: a closed Result is changedMeanwhile and nothing is applied", async () => {
  const { field, pane } = await conflicted();
  const before = pane.state;

  const outcome = await formatResult(
    formatter(pane, answering("x\n")),
    () => pane,
    field,
    () => true,
  );

  expect(outcome).toEqual({ kind: "changedMeanwhile", server: SERVER });
  expect(pane.state).toBe(before);
});

test("rule 5: a result equal line by line is unchanged; the client's unchanged and refusals pass through", async () => {
  const merge = await conflicted();
  const replies: readonly FormatReply[] = [
    { kind: "unchanged", server: SERVER },
    { kind: "noFormatter" },
    { kind: "notRunning", server: SERVER, state: { kind: "stopped" } },
    { kind: "failed", server: SERVER, message: "boom" },
    { kind: "timedOut", server: SERVER },
  ];

  const same = await formatting(merge, (text) => answering(text)(text));
  const passed = await Promise.all(replies.map((reply) => formatting(merge, () => reply)));

  expect(same).toEqual({ kind: "unchanged", server: SERVER });
  expect(passed).toEqual(replies);
  expect(merge.pane.dispatched).toBe(0);
});

test("rule 5: the options follow the Result's indent unit: a tab with the pane's tab size, or n spaces", () => {
  function unit(text: string): EditorState {
    return EditorState.create({ extensions: indentUnit.of(text) });
  }

  expect(formattingOptions(unit("\t"))).toEqual({ tabSize: 4, insertSpaces: false });
  expect(
    formattingOptions(
      EditorState.create({ extensions: [indentUnit.of("\t"), EditorState.tabSize.of(8)] }),
    ),
  ).toEqual({ tabSize: 8, insertSpaces: false });
  expect(formattingOptions(unit("    "))).toEqual({ tabSize: 4, insertSpaces: true });
  expect(formattingOptions(unit("  "))).toEqual({ tabSize: 2, insertSpaces: true });
});

test("rule 5: the formatter is asked with the options of the Result pane as built", async () => {
  const { field, pane } = await conflicted();
  const asking = formatter(pane, () => ({ kind: "noFormatter" }));

  await formatResult(
    asking,
    () => pane,
    field,
    () => false,
  );

  expect(asking.asked).toEqual([{ tabSize: 2, insertSpaces: true }]);
});

test.each<Eol>(["Lf", "CrLf"])(
  "rule 5: any formatted result is applied exactly, insertions and deletions at the ends included (%s)",
  async (eol) => {
    const random = seeded(5);
    function text(): string {
      const words = ["a", "b", "", "c;", "  d"];
      return Array.from({ length: random(12) + 1 }, () => words[random(words.length)] ?? "").join(
        separator(eol),
      );
    }

    for (let round = 0; round < 300; round += 1) {
      const merge = plain(text(), eol);
      const result = text();

      await formatting(merge, answering(result));

      expect(paneText(merge.pane.state)).toBe(result);
      expect(merge.pane.state.doc.lines).toBe(result.split(separator(eol)).length);
    }
  },
);

test.each<Eol>(["Lf", "CrLf"])(
  "rule 5: a result differing mostly in whitespace, lines split and joined, is applied exactly (%s)",
  async (eol) => {
    const random = seeded(7);
    const words = ["a", "  a", "b c", "b", "c", "\tb c", "", "  ", "d;", " d ;"];
    function lines(): string[] {
      return Array.from({ length: random(12) + 1 }, () => words[random(words.length)] ?? "");
    }

    for (let round = 0; round < 300; round += 1) {
      const old = lines();
      const next = old.flatMap((line) => (random(3) === 0 ? lines().slice(0, random(3)) : [line]));
      const merge = plain(old.join(separator(eol)), eol);
      const result = next.join(separator(eol));

      await formatting(merge, answering(result));

      expect(paneText(merge.pane.state)).toBe(result);
    }
  },
);
