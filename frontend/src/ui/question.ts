import { keyLabel } from "../ipc";
import type { ServerSpec } from "../lsp";
import type { Clash } from "./keymapEdit";
import { ACTION_NAMES } from "./keyText";
import { projectLabel, serverLabel } from "./serverText";
import type { MergeSummary } from "./useMergeController";

export type Question =
  | { readonly kind: "unprocessed"; readonly summary: MergeSummary }
  | { readonly kind: "exit"; readonly files: readonly string[] }
  | { readonly kind: "abort" }
  | ({ readonly kind: "clash" } & Clash)
  | {
      readonly kind: "servers";
      readonly found: readonly ServerSpec[];
      readonly added: readonly ServerSpec[];
    };

type QuestionList =
  | { readonly kind: "none" }
  | { readonly kind: "files"; readonly files: readonly string[] }
  | { readonly kind: "servers"; readonly lines: readonly string[] };

export type QuestionText = {
  readonly title: string;
  readonly message: string;
  readonly list: QuestionList;
  readonly note: string | null;
  readonly confirm: string;
  readonly cancel: string;
};

const ABORT_TEXT: QuestionText = {
  title: "Abort Merge",
  message:
    "Every resolution and every save in this merge will be lost, and so will unsaved edits. The repository goes back to how it was before the merge, and yamt closes.",
  list: { kind: "none" },
  note: null,
  confirm: "Abort Merge",
  cancel: "Cancel",
};

function serversText(found: readonly ServerSpec[], added: readonly ServerSpec[]): QuestionText {
  const folders = [...new Set(found.map((spec) => spec.project))];
  const foundLines = folders.map((folder) => {
    const names = found.filter((spec) => spec.project === folder).map(serverLabel);
    return `${names.join(", ")} — ${projectLabel(folder)}`;
  });
  const addedLines =
    added.length > 0 ? [`${added.map((spec) => spec.name).join(", ")} — added by you`] : [];
  return {
    title: "Language Servers",
    message: "Start this project's language servers?",
    list: { kind: "servers", lines: [...foundLines, ...addedLines] },
    note: "yamt remembers your answer for this repository. You can change it in Settings.",
    confirm: "Start",
    cancel: "Don't start",
  };
}

export function finishMustAsk(summary: MergeSummary): boolean {
  return summary.conflicts > 0 || summary.changes > 0;
}

export function exitMustAsk(unsaved: readonly string[]): boolean {
  return unsaved.length > 0;
}

function unprocessedSentence({ conflicts, changes }: MergeSummary): string {
  const parts = [
    ...(conflicts > 0 ? [`${conflicts} unresolved conflict${conflicts === 1 ? "" : "s"}`] : []),
    ...(changes > 0 ? [`${changes} unprocessed change${changes === 1 ? "" : "s"}`] : []),
  ];
  const verb = conflicts + changes === 1 ? "remains" : "remain";
  return `${parts.join(" and ")} still ${verb}. The file will be saved exactly as shown in the Result pane.`;
}

export function questionText(question: Question, platform: string): QuestionText {
  switch (question.kind) {
    case "unprocessed":
      return {
        title: "Unprocessed Changes",
        message: unprocessedSentence(question.summary),
        list: { kind: "none" },
        note: null,
        confirm: "Save Current Result",
        cancel: "Back to Resolving",
      };
    case "exit":
      return {
        title: "Unsaved Changes",
        message: "These files have changes that are not saved to disk. Exit without saving them?",
        list: { kind: "files", files: question.files },
        note: null,
        confirm: "Exit Without Saving",
        cancel: "Cancel",
      };
    case "clash":
      return {
        title: "Key Already in Use",
        message: `${keyLabel(question.key, platform)} is already used by ${ACTION_NAMES[question.owner]}. Move it to ${ACTION_NAMES[question.action]}?`,
        list: { kind: "none" },
        note: null,
        confirm: "Move",
        cancel: "Cancel",
      };
    case "servers":
      return serversText(question.found, question.added);
    case "abort":
      return ABORT_TEXT;
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}
