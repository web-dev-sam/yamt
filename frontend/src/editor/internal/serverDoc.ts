import { setDiagnosticsEffect } from "@codemirror/lint";
import type { EditorState, Transaction } from "@codemirror/state";

import type {
  DocVersion,
  LanguageServers,
  OpenDocument,
  ResultDocument,
  ServerProblem,
} from "../../lsp";
import { formatResult, type FormatOutcome, type ResultPane } from "./format";
import type { Pane } from "./geometry";
import { paneText } from "./pane";
import { problemCounts, problemsSpec, tookSpec, type ProblemCounts } from "./problems";

type Servers = Pick<LanguageServers, "open">;

export type PaneUpdate = {
  readonly docChanged: boolean;
  readonly state: EditorState;
  readonly transactions: readonly Transaction[];
};

export class ServerDoc implements ResultDocument {
  readonly path: string;
  readonly #pane: () => ResultPane;
  readonly #open: OpenDocument;
  #counts: ProblemCounts;
  #listener: ((counts: ProblemCounts) => void) | null = null;
  #formatting: Promise<FormatOutcome> | null = null;
  #closed = false;

  constructor(servers: Servers, path: string, pane: () => ResultPane) {
    this.path = path;
    this.#pane = pane;
    this.#counts = problemCounts(pane().state);
    this.#open = servers.open(this);
  }

  take(version: DocVersion): string {
    const pane = this.#pane();
    const { state } = pane;
    pane.dispatch(tookSpec(state, version));
    return paneText(state);
  }

  showProblems(server: string, version: DocVersion, problems: readonly ServerProblem[]): void {
    const pane = this.#pane();
    const spec = problemsSpec(pane.state, { server, version, problems });
    if (spec !== null) {
      pane.dispatch(spec);
    }
  }

  updated(update: PaneUpdate): void {
    if (update.docChanged) {
      this.#open.changed();
    }
    const linted = update.transactions.some((tr) =>
      tr.effects.some((effect) => effect.is(setDiagnosticsEffect)),
    );
    if (!update.docChanged && !linted) {
      return;
    }
    const counts = problemCounts(update.state);
    const { errors, warnings, other } = this.#counts;
    if (counts.errors !== errors || counts.warnings !== warnings || counts.other !== other) {
      this.#counts = counts;
      this.#listener?.(counts);
    }
  }

  onProblemsChange(listener: (counts: ProblemCounts) => void): void {
    this.#listener = listener;
  }

  format(): Promise<FormatOutcome> {
    this.#formatting ??= formatResult(this.#open, this.#pane, () => this.#closed).finally(() => {
      this.#formatting = null;
    });
    return this.#formatting;
  }

  close(): void {
    this.#closed = true;
    this.#listener = null;
    this.#open.close();
  }
}

export function openResult(
  servers: Servers | null,
  { path, readOnly }: { readonly path: string; readonly readOnly: boolean },
  panes: () => Readonly<Record<Pane, ResultPane>>,
): ServerDoc | null {
  return servers === null || readOnly ? null : new ServerDoc(servers, path, () => panes().center);
}
