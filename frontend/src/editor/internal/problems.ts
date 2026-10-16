import { forEachDiagnostic, setDiagnostics, setDiagnosticsEffect } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import {
  ChangeSet,
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Text,
  type Transaction,
  type TransactionSpec,
} from "@codemirror/state";

import type { DocVersion, LinePosition, ServerProblem } from "../../lsp";

export type ProblemCounts = {
  readonly errors: number;
  readonly warnings: number;
  readonly other: number;
};

type Taken = { readonly version: DocVersion; readonly doc: Text; readonly since: ChangeDesc };

type Answers = {
  readonly taken: readonly Taken[];
  readonly answered: ReadonlyMap<string, DocVersion>;
  readonly owners: ReadonlyMap<Diagnostic, string>;
};

type Answer = {
  readonly server: string;
  readonly version: DocVersion;
  readonly owners: ReadonlyMap<Diagnostic, string>;
};

const KEPT_VERSIONS = 32;

const took = StateEffect.define<{ readonly version: DocVersion; readonly doc: Text }>();
const answered = StateEffect.define<Answer>();

function stillAnswerable(
  taken: readonly Taken[],
  answers: ReadonlyMap<string, DocVersion>,
): Taken[] {
  const floor = answers.size === 0 ? 0 : Math.min(...answers.values());
  return taken.filter(({ version }) => version >= floor).slice(-KEPT_VERSIONS);
}

function updateAnswers(value: Answers, effect: StateEffect<unknown>): Answers {
  if (effect.is(took)) {
    const { version, doc } = effect.value;
    const taken = [...value.taken, { version, doc, since: ChangeSet.empty(doc.length) }];
    return { ...value, taken: stillAnswerable(taken, value.answered) };
  }
  if (effect.is(answered)) {
    const { server, version, owners } = effect.value;
    const answers = new Map(value.answered).set(server, version);
    return { taken: stillAnswerable(value.taken, answers), answered: answers, owners };
  }
  return value;
}

export const problemsField = StateField.define<Answers>({
  create: () => ({ taken: [], answered: new Map(), owners: new Map() }),
  update(value, tr) {
    const mapped = tr.docChanged
      ? {
          ...value,
          taken: value.taken.map((taken) => ({
            ...taken,
            since: taken.since.composeDesc(tr.changes.desc),
          })),
        }
      : value;
    return tr.effects.reduce(updateAnswers, mapped);
  },
});

export function tookSpec(state: EditorState, version: DocVersion): TransactionSpec {
  return { effects: took.of({ version, doc: state.doc }) };
}

function offsetIn(doc: Text, { line, character }: LinePosition): number {
  if (line >= doc.lines) {
    return doc.length;
  }
  const { from, length } = doc.line(Math.max(line, 0) + 1);
  return from + Math.min(Math.max(character, 0), length);
}

function diagnosticOf(taken: Taken, server: string, problem: ServerProblem): Diagnostic | null {
  const start = offsetIn(taken.doc, problem.from);
  const end = Math.max(start, offsetIn(taken.doc, problem.to));
  const from = taken.since.mapPos(start, 1);
  const to = start === end ? from : taken.since.mapPos(end, -1);
  if (start < end && to <= from) {
    return null;
  }
  const { severity, message, code } = problem;
  return { from, to, severity, message, source: code === null ? server : `${server} ${code}` };
}

function shownAlready(state: EditorState, owners: ReadonlyMap<Diagnostic, string>): boolean {
  const shown: Diagnostic[] = [];
  forEachDiagnostic(state, (diagnostic, from, to) => {
    shown.push({ ...diagnostic, from, to });
  });
  const [before, after] = [shown, [...owners.keys()]].map((diagnostics) =>
    diagnostics
      .map(({ from, to, severity, message, source }) =>
        JSON.stringify([from, to, severity, message, source ?? null]),
      )
      .sort()
      .join("\n"),
  );
  return before === after;
}

export function problemsSpec(
  state: EditorState,
  answer: { server: string; version: DocVersion; problems: readonly ServerProblem[] },
): TransactionSpec | null {
  const { server, version, problems } = answer;
  const answers = state.field(problemsField);
  const taken = answers.taken.find((candidate) => candidate.version === version);
  if (taken === undefined) {
    return null;
  }
  const owners = new Map<Diagnostic, string>();
  forEachDiagnostic(state, (diagnostic, from, to) => {
    const owner = answers.owners.get(diagnostic);
    if (owner !== undefined && owner !== server) {
      owners.set({ ...diagnostic, from, to }, owner);
    }
  });
  for (const problem of problems) {
    const diagnostic = diagnosticOf(taken, server, problem);
    if (diagnostic !== null) {
      owners.set(diagnostic, server);
    }
  }
  if (shownAlready(state, owners)) {
    return { effects: answered.of({ server, version, owners: answers.owners }) };
  }
  const effects: StateEffect<unknown>[] = [answered.of({ server, version, owners })];
  return { effects: effects.concat(setDiagnostics(state, [...owners.keys()]).effects ?? []) };
}

export function problemCounts(state: EditorState): ProblemCounts {
  let errors = 0;
  let warnings = 0;
  let other = 0;
  forEachDiagnostic(state, ({ severity }) => {
    switch (severity) {
      case "error":
        errors += 1;
        break;
      case "warning":
        warnings += 1;
        break;
      case "info":
      case "hint":
        other += 1;
        break;
      default: {
        const _exhaustive: never = severity;
        return _exhaustive;
      }
    }
  });
  return { errors, warnings, other };
}

export function linted(transactions: readonly Transaction[]): boolean {
  return transactions.some((tr) => tr.effects.some((effect) => effect.is(setDiagnosticsEffect)));
}
