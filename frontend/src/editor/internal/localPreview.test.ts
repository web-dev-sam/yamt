import { expect, test } from "vitest";

import { GITLAB_DRAWN_LANGUAGES, localPreview } from "./localPreview";
import { MAX_NESTING } from "./markdownTree";

type Entry = {
  readonly name: string;
  readonly text: string;
  readonly local: boolean;
  readonly blocks: unknown;
};

const CORPUS_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../fixtures/markdown/gitlab-preview.json",
  { eager: true, import: "default" },
);

const NESTED = MAX_NESTING - 1;

const TRIGGERS: readonly (readonly [rule: string, text: string])[] = [
  ["C1 escape", "a\\*b"],
  ["C2 link", "[x](y)"],
  ["C2 image", "![a](b)"],
  ["C2 footnote", "[^1]"],
  ["C2 task", "- [ ] t"],
  ["C3 html", "<b>x</b>"],
  ["C3 autolink", "<https://x>"],
  ["C4 attributes", "![a](b){width=1}"],
  ["C4 braces", "{width=1}"],
  ["C5 math", "$x$"],
  ["T1 issue", "#12"],
  ["T1 merge request", "!3"],
  ["T1 epic", "&4"],
  ["T1 milestone", "%v1"],
  ["T1 mention", "@anna"],
  ["T1 e-mail", "a@b.org"],
  ["T1 entity", "&amp;"],
  ["T2 label", "~bug"],
  ["T3 emoji code", ":smile:"],
  ["T4 pictograph", "😀"],
  ["T4 flag", "🇩🇪"],
  ["T5 http", "http://x"],
  ["T5 https", "https://x"],
  ["T5 www", "www.x.org"],
  ["T5 mailto", "mailto:a"],
  ["T6 commit", "abc1234"],
  ["T1 GitLab issue", "see GL-123"],
  ["T1 project reference", "see group/project> now"],
  ["T1 iteration", 'see *iteration:"Sprint 1" now'],
  ["T1 iteration number", "see *iteration:12 now"],
  ["T7 link", "see [x](y)"],
  ["S1 setext h1", "Title\n==="],
  ["S1 setext h2", "Sub\n---"],
  ["S1 setext in a quote", "> Title\n> ==="],
  ["S1 dash setext in a quote", "> a\n> -"],
  ["S2 indented code", "p\n\n    code"],
  ["S2 indented first line", "    code"],
  ["S2 indented code in a quote", ">     code"],
  ["S2 indented code in an item", "-     code"],
  ["S3 paren item", "1) a"],
  ["S3 paren item in a quote", "> 1) a"],
  ["S3 paren item in an item", "- 1) a"],
  ["S4 plus item", "+ a"],
  ["S4 plus item in a quote", "> + a"],
  ["S5 mixed bullets", "- a\n* b"],
  ["S5 mixed bullets in a quote", "> - a\n> * b"],
  ["S6 multi-line quote", ">>>\nq\n>>>"],
  ["S7 front matter", "---\nk: v\n---"],
  ["S7 toml front matter", "+++\nk = 1\n+++"],
  ["S7 front matter with a language", "+++toml\nk = 1\n+++"],
  ["S7 front matter closed by dots", "---json\nx\n..."],
  ["S7 front matter after a blank line", "\n---\nk: v\n..."],
  ["S7 front matter after an encoding line", "coding: utf-8\n\n+++\nk = 1\n+++"],
  ["S8 description list", "term\n: def"],
  ["S9 tab", "a\tb"],
  ["S9 nul", "a\0b"],
  ["S9 nul in a fence", "```\na\0b\n```"],
  ["S9 ideographic space line", "a\n\u3000\nb"],
  ["S9 ideographic space indent", "\u3000x"],
  ["S13 info words", "```rust ignore\nlet a = 1;\n```"],
  ["S13 info words in a quote", "> ```rust ignore\n> let a = 1;\n> ```"],
  ["S14 quick action", "/close"],
  ["S15 empty item", "-"],
  ["S15 empty numbered item", "1."],
  ["K1 upper case", "```TS\nconst a = 1;\n```"],
  ["K1 unknown language", "```nosuchlanguage\nx\n```"],
  ["K3 blank last line", "```\na\n\n```"],
  ["K3 blank first line", "```\n\na\n```"],
  ["K3 empty block", "```\n```"],
  ["N quote", `${"> ".repeat(NESTED)}deep`],
  ["N emphasis", `${"*a ".repeat(NESTED)}x${" a*".repeat(NESTED)}`],
];

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "text" in value &&
    typeof value.text === "string" &&
    "local" in value &&
    typeof value.local === "boolean" &&
    "blocks" in value &&
    Array.isArray(value.blocks)
  );
}

function corpus(): readonly Entry[] {
  const [file] = Object.values(CORPUS_FILES);
  const entries =
    typeof file === "object" && file !== null && "entries" in file ? file.entries : [];
  if (!Array.isArray(entries) || entries.length === 0 || !entries.every(isEntry)) {
    throw new Error("gitlab-preview.json: entries are not { name, text, local, blocks }");
  }
  return entries;
}

function kindOf(item: unknown): unknown {
  return typeof item === "object" && item !== null && "kind" in item ? item.kind : null;
}

function textOf(item: unknown): string | null {
  return kindOf(item) === "text" &&
    typeof item === "object" &&
    item !== null &&
    "text" in item &&
    typeof item.text === "string"
    ? item.text
    : null;
}

function merged(items: readonly unknown[]): unknown[] {
  const joined: unknown[] = [];
  for (const item of items) {
    const text = textOf(item);
    const last = textOf(joined.at(-1));
    if (text !== null && last !== null) {
      joined[joined.length - 1] = { kind: "text", text: last + text };
    } else {
      joined.push(item);
    }
  }
  return joined;
}

function visibleInlines(items: readonly unknown[]): unknown[] {
  const joined = merged(items.map(visible));
  return joined
    .map((item, at) => {
      const text = textOf(item);
      if (text === null) {
        return item;
      }
      let shown = text.replace(/[ \t\n]+/g, " ");
      if (at === 0 || kindOf(joined[at - 1]) === "lineBreak") {
        shown = shown.trimStart();
      }
      if (at === joined.length - 1 || kindOf(joined[at + 1]) === "lineBreak") {
        shown = shown.trimEnd();
      }
      return { kind: "text", text: shown };
    })
    .filter((item) => textOf(item) !== "");
}

function visible(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(visible);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      key === "inlines" && Array.isArray(field) ? visibleInlines(field) : visible(field),
    ]),
  );
}

test("every_local_entry_of_gitlabs_corpus_renders_to_its_blocks", () => {
  const local = corpus().filter((entry) => entry.local);
  expect(local.length).toBeGreaterThan(0);
  for (const entry of local) {
    expect
      .soft(visible(localPreview(entry.text)), entry.name)
      .toEqual(visible({ blocks: entry.blocks }));
  }
});

test("every_other_entry_of_the_corpus_goes_to_gitlab", () => {
  const other = corpus().filter((entry) => !entry.local);
  expect(other.length).toBeGreaterThan(0);
  for (const entry of other) {
    expect.soft(localPreview(entry.text), entry.name).toBeNull();
  }
});

test("each_trigger_sends_the_text_to_gitlab", () => {
  const drawn = GITLAB_DRAWN_LANGUAGES.map(
    (language) => [`K1 ${language}`, `\`\`\`${language}\nx\n\`\`\``] as const,
  );
  for (const [rule, text] of [...TRIGGERS, ...drawn]) {
    expect.soft(localPreview(text), rule).toBeNull();
  }
});

test("a_trigger_inside_code_stays_local", () => {
  const span = "#12 @anna a\\b [x](y) <b> {x} $5 ~x :x: abc1234";
  expect(localPreview(`see \`${span}\``)).toEqual({
    blocks: [
      {
        kind: "paragraph",
        inlines: [
          { kind: "text", text: "see " },
          { kind: "code", text: span },
        ],
      },
    ],
  });
  const code = 'fn a() {\n\tlet who = "@anna #12 <b> [x](y)";\n\n    let b = 1;\n}';
  expect(localPreview(`\`\`\`rust\n${code}\n\`\`\``)).toEqual({
    blocks: [{ kind: "code", language: "rust", text: code }],
  });
});

function startRow(header: boolean, texts: readonly string[]): unknown {
  return {
    cells: texts.map((text) => ({ header, align: "start", inlines: [{ kind: "text", text }] })),
  };
}

test("a_table_reads_start_whatever_its_alignment", () => {
  expect(localPreview("| l | c | r |\n| :- | :-: | -: |\n| 1 | 2 | 3 |")).toEqual({
    blocks: [
      {
        kind: "table",
        head: [startRow(true, ["l", "c", "r"])],
        body: [startRow(false, ["1", "2", "3"])],
      },
    ],
  });
});
