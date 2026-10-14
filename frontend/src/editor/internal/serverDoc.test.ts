import { diagnosticCount } from "@codemirror/lint";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, type FileMergeData } from "../../ipc";
import {
  isDocVersion,
  type DocVersion,
  type FormatReply,
  type OpenDocument,
  type ResultDocument,
  type ServerProblem,
} from "../../lsp";
import type { ResultPane } from "./format";
import { paneState, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";
import { problemsField, type ProblemCounts } from "./problems";
import { openResult, type ServerDoc } from "./serverDoc";

type Eol = FileMergeData["eol"];

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};
const PATH = "src/app.ts";
const ERROR: ServerProblem = {
  from: { line: 0, character: 0 },
  to: { line: 0, character: 3 },
  severity: "error",
  message: "bad",
  source: null,
  code: null,
};

class FakePane implements ResultPane {
  state: EditorState;
  doc: ServerDoc | null = null;

  constructor(state: EditorState) {
    this.state = state;
  }

  dispatch(spec: TransactionSpec): void {
    const tr = this.state.update(spec);
    this.state = tr.state;
    this.doc?.updated({
      docChanged: tr.docChanged,
      startState: tr.startState,
      state: tr.state,
      transactions: [tr],
    });
  }
}

class FakeServers {
  readonly calls: string[] = [];
  readonly opened: ResultDocument[] = [];
  reply: Promise<FormatReply> = Promise.resolve({ kind: "noFormatter" });

  open(doc: ResultDocument): OpenDocument {
    this.opened.push(doc);
    this.calls.push(`open ${doc.path}`);
    return {
      changed: () => this.calls.push("changed"),
      format: () => {
        this.calls.push("format");
        return this.reply;
      },
      close: () => this.calls.push("close"),
    };
  }
}

type Panes = { readonly left: FakePane; readonly center: FakePane; readonly right: FakePane };

function version(n: number): DocVersion {
  if (!isDocVersion(n)) {
    throw new RangeError(`not a document version: ${n}`);
  }
  return n;
}

function pane(text: string, eol: Eol = "Lf"): FakePane {
  const doc = paneDocs({ local: text, remote: text, middle: { kind: "Stages", text }, eol }).center;
  return new FakePane(
    paneState({
      kind: "center",
      doc,
      eol,
      language: null,
      settings: SETTINGS,
      extensions: problemsField,
    }),
  );
}

function panes(text = "let a;\n", eol: Eol = "Lf"): Panes {
  return { left: pane(text, eol), center: pane(text, eol), right: pane(text, eol) };
}

function opened(
  servers: FakeServers,
  views: Panes = panes(),
  readOnly = false,
): { doc: ServerDoc; views: Panes } {
  const doc = openResult(servers, { path: PATH, readOnly }, () => views);
  if (doc === null) {
    throw new Error("expected an opened Result");
  }
  views.center.doc = doc;
  return { doc, views };
}

test("rule 1: an editable Result is opened under its path, says changed on each edit only, and closes once", () => {
  const servers = new FakeServers();
  const { doc, views } = opened(servers);

  views.center.dispatch({ changes: { from: 0, insert: "x" } });
  views.center.dispatch({ selection: { anchor: 1 } });
  views.center.dispatch({ changes: { from: 1, insert: "y" } });
  doc.close();

  expect(servers.opened).toEqual([doc]);
  expect(doc.path).toBe(PATH);
  expect(servers.calls).toEqual([`open ${PATH}`, "changed", "changed", "close"]);
});

test("rule 1: a read-only Result, or no servers, opens nothing", () => {
  const servers = new FakeServers();

  expect(openResult(servers, { path: PATH, readOnly: true }, () => panes())).toBeNull();
  expect(openResult(null, { path: PATH, readOnly: false }, () => panes())).toBeNull();
  expect(servers.calls).toEqual([]);
});

test("rule 2: take gives the Result's text with its own line breaks", () => {
  const { doc } = opened(new FakeServers(), panes("a\r\nb\r\n", "CrLf"));

  expect(doc.take(version(1))).toBe("a\r\nb\r\n");
});

test("rule 2: problems show in the middle pane only", () => {
  const { doc, views } = opened(new FakeServers());

  doc.take(version(1));
  doc.showProblems("oxlint", version(1), [ERROR]);

  expect(diagnosticCount(views.center.state)).toBe(1);
  expect(diagnosticCount(views.left.state)).toBe(0);
  expect(diagnosticCount(views.right.state)).toBe(0);
});

test("rule 4: counts go out when they change, not for an edit that leaves them", () => {
  const { doc, views } = opened(new FakeServers());
  const heard: ProblemCounts[] = [];
  doc.onProblemsChange((counts) => heard.push(counts));

  doc.take(version(1));
  doc.showProblems("oxlint", version(1), [ERROR]);
  views.center.dispatch({ changes: { from: 6, insert: " " } });
  doc.showProblems("oxlint", version(1), [ERROR, { ...ERROR, severity: "hint" }]);
  views.center.dispatch({ changes: { from: 0, to: 3 } });

  expect(heard).toEqual([
    { errors: 1, warnings: 0, other: 0 },
    { errors: 1, warnings: 0, other: 1 },
    { errors: 0, warnings: 0, other: 0 },
  ]);
});

test("rule 4: a closed Result tells no one about later counts", () => {
  const { doc } = opened(new FakeServers());
  const heard: ProblemCounts[] = [];
  doc.onProblemsChange((counts) => heard.push(counts));
  doc.take(version(1));

  doc.close();
  doc.showProblems("oxlint", version(1), [ERROR]);

  expect(heard).toEqual([]);
});

test("rule 5: a second format while one runs returns the same promise; the next call asks again", async () => {
  const servers = new FakeServers();
  const { doc } = opened(servers);
  servers.reply = Promise.resolve({ kind: "unchanged", server: "oxfmt" });

  const first = doc.format();
  const second = doc.format();
  await first;
  const third = doc.format();

  expect(second).toBe(first);
  expect(third).not.toBe(first);
  await expect(third).resolves.toEqual({ kind: "unchanged", server: "oxfmt" });
  expect(servers.calls.filter((call) => call === "format")).toHaveLength(2);
});
