import { keyLabel } from "../ipc";
import type { Clash } from "./keymapEdit";
import { ACTION_NAMES } from "./keyText";
import type { MergeSummary } from "./useMergeController";

export type Question =
  | { readonly kind: "unprocessed"; readonly summary: MergeSummary }
  | { readonly kind: "exit"; readonly files: readonly string[] }
  | ({ readonly kind: "clash" } & Clash);

export type QuestionText = {
  readonly title: string;
  readonly message: string;
  readonly files: readonly string[];
  readonly confirm: string;
  readonly cancel: string;
};

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
        files: [],
        confirm: "Save Current Result",
        cancel: "Back to Resolving",
      };
    case "exit":
      return {
        title: "Cancel File Merge",
        message: "Are you sure you want to exit without applying changes?",
        files: question.files,
        confirm: "Exit",
        cancel: "Cancel",
      };
    case "clash":
      return {
        title: "Key Already in Use",
        message: `${keyLabel(question.key, platform)} is already used by ${ACTION_NAMES[question.owner]}. Move it to ${ACTION_NAMES[question.action]}?`,
        files: [],
        confirm: "Move",
        cancel: "Cancel",
      };
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}
