import { language } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState, Text, type TransactionSpec } from "@codemirror/state";
import { expect, test, vi } from "vitest";

import { columnOpening, CompareLanguage } from "./compareLanguage";
import { OPENING_CHARS } from "./detectLanguage";
import { languageNames } from "./language";
import { languageCompartment } from "./pane";

type Held = { state: EditorState; dispatch(spec: TransactionSpec): void };

function column(text: string): Held {
  const held: Held = {
    state: EditorState.create({ doc: text, extensions: languageCompartment.of([]) }),
    dispatch(spec) {
      held.state = held.state.update(spec).state;
    },
  };
  return held;
}

function typed(held: Held, text: string): void {
  held.dispatch({ changes: { from: 0, to: held.state.doc.length, insert: text } });
}

function shownLanguage(held: Held): string | null {
  return held.state.facet(language)?.name ?? null;
}

test("Auto finds JSON at build, fires once for it, colours both columns and offers JSON's Format", async () => {
  const left = column('{"a": 1}\n');
  const right = column("");
  const detected = vi.fn<(name: string | null) => void>();

  const auto = new CompareLanguage({ kind: "auto" }, { left, right }, detected);
  auto.settled();
  typed(right, '{"b": 2}\n');
  auto.settled();

  expect(detected.mock.calls).toEqual([["JSON"]]);
  expect(auto.formatLanguage()).toBe("JSON");
  await vi.waitFor(() => {
    expect([shownLanguage(left), shownLanguage(right)]).toEqual(["json", "json"]);
  });

  typed(left, "<a/>\n");
  auto.settled();

  expect(detected.mock.calls).toEqual([["JSON"], ["XML"]]);
  expect(auto.formatLanguage()).toBe("XML");
  auto.destroy();
});

test("plain text is reported once as no language and leaves the columns uncoloured", () => {
  const left = column("just words\n");
  const right = column("more words\n");
  const detected = vi.fn<(name: string | null) => void>();

  const auto = new CompareLanguage({ kind: "auto" }, { left, right }, detected);
  auto.settled();

  expect(detected.mock.calls).toEqual([[null]]);
  expect(auto.formatLanguage()).toBeNull();
  expect(shownLanguage(left)).toBeNull();
});

test("a picked language never fires detected, and Format follows the pick, not the text", async () => {
  const left = column('{"a": 1}\n');
  const right = column('{"a": 2}\n');
  const detected = vi.fn<(name: string | null) => void>();

  const picked = new CompareLanguage({ kind: "picked", name: "XML" }, { left, right }, detected);
  picked.settled();

  expect(picked.formatLanguage()).toBe("XML");
  await vi.waitFor(() => {
    expect(shownLanguage(right)).toBe("xml");
  });

  picked.set({ kind: "picked", name: "TypeScript" });
  picked.settled();

  expect(picked.formatLanguage()).toBeNull();
  expect(detected).not.toHaveBeenCalled();

  picked.set({ kind: "auto" });

  expect(detected.mock.calls).toEqual([["JSON"]]);
  picked.destroy();
});

test("languageNames lists every language-data name once, in alphabetical order", () => {
  const names = languageNames();

  expect(names).toHaveLength(languages.length);
  expect(new Set(names)).toEqual(new Set(languages.map((description) => description.name)));
  for (const [index, name] of names.slice(1).entries()) {
    expect(names[index]?.localeCompare(name)).toBeLessThan(0);
  }
  expect(names).toEqual(expect.arrayContaining(["JSON", "XML", "TypeScript", "Python"]));
});

test("Auto reads each column's opening only, past any leading blank lines", () => {
  const blank = Array.from({ length: OPENING_CHARS }, () => "  ");
  const body = Array.from({ length: OPENING_CHARS }, (_, line) => `  "k${line}": ${line},`);
  const doc = Text.of([...blank, '{"a": 1,', ...body, "}", ""]);
  const detected = vi.fn<(name: string | null) => void>();

  const opening = columnOpening(doc);
  const auto = new CompareLanguage(
    { kind: "auto" },
    { left: column("\n \n"), right: column(doc.toString()) },
    detected,
  );

  expect(opening).toHaveLength(OPENING_CHARS);
  expect(opening.startsWith('{"a": 1,\n  "k0": 0,')).toBe(true);
  expect(columnOpening(Text.of(["  ", "\t", ""]))).toBe("");
  expect(detected.mock.calls).toEqual([["JSON"]]);
  auto.destroy();
});
