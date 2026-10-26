import { keyLabel, type OperationKind, type OperationView } from "../ipc";
import type { ServerSpec } from "../lsp";
import type { Clash } from "./keymapEdit";
import { ACTION_NAMES } from "./keyText";
import { abortMessage, abortTitle, continueAction } from "./operationText";
import { projectLabel, serverLabel } from "./serverText";
import type { MergeSummary } from "./useMergeController";

export type Question =
  | { readonly kind: "unprocessed"; readonly summary: MergeSummary }
  | { readonly kind: "exit"; readonly files: readonly string[] }
  | { readonly kind: "abort"; readonly operation: OperationView }
  | {
      readonly kind: "continueUnsaved";
      readonly operation: OperationKind;
      readonly files: readonly string[];
    }
  | { readonly kind: "rewords" }
  | ({ readonly kind: "clash" } & Clash)
  | {
      readonly kind: "servers";
      readonly found: readonly ServerSpec[];
      readonly added: readonly ServerSpec[];
    }
  | { readonly kind: "closeTab"; readonly name: string }
  | {
      readonly kind: "keepAiChanges";
      readonly folder: string;
      readonly files: readonly string[];
      readonly headMoved: boolean;
      readonly refs: readonly string[];
    }
  | { readonly kind: "keepUnreadableCheckout"; readonly folder: string; readonly message: string };

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

export function finishMustAsk({ conflicts, changes }: MergeSummary): boolean {
  return conflicts > 0 || changes > 0;
}

export function exitMustAsk(unsaved: readonly string[]): boolean {
  return unsaved.length > 0;
}

export function endsWithStop(question: Question): boolean {
  switch (question.kind) {
    case "unprocessed":
    case "abort":
    case "continueUnsaved":
    case "rewords":
      return true;
    case "exit":
    case "clash":
    case "servers":
    case "closeTab":
    case "keepAiChanges":
    case "keepUnreadableCheckout":
      return false;
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}

function unprocessedText({ conflicts, changes }: MergeSummary): QuestionText {
  const parts = [
    ...(conflicts > 0 ? [`${conflicts} unresolved conflict${conflicts === 1 ? "" : "s"}`] : []),
    ...(changes > 0 ? [`${changes} unprocessed change${changes === 1 ? "" : "s"}`] : []),
  ];
  const verb = conflicts + changes === 1 ? "remains" : "remain";
  return {
    title: "Unprocessed Changes",
    message: `${parts.join(" and ")} still ${verb}. The file will be saved exactly as shown in the Result pane.`,
    list: { kind: "none" },
    note: null,
    confirm: "Save Current Result",
    cancel: "Back to Resolving",
  };
}

function abortText(operation: OperationView): QuestionText {
  const title = abortTitle(operation);
  return {
    title,
    message: abortMessage(operation),
    list: { kind: "none" },
    note: null,
    confirm: title,
    cancel: "Cancel",
  };
}

function continueUnsavedText(operation: OperationKind, files: readonly string[]): QuestionText {
  const { verb, object } = continueAction(operation);
  return {
    title: "Unsaved Changes",
    message: `These files have changes that are not saved to disk. ${verb} ${object} without saving them?`,
    list: { kind: "files", files },
    note: null,
    confirm: `${verb} Without Saving`,
    cancel: "Cancel",
  };
}

const REWORDS_TEXT: QuestionText = {
  title: "Commit Messages",
  message:
    "This step or a later one rewords or squashes a commit. yamt cannot open an editor, so that message stays as git prepares it.",
  list: { kind: "none" },
  note: null,
  confirm: "Continue rebase",
  cancel: "Cancel",
};

function closeTabText(name: string): QuestionText {
  return {
    title: "Close Tab",
    message: `Close ${name}? Its text is lost.`,
    list: { kind: "none" },
    note: null,
    confirm: "Yes",
    cancel: "No",
  };
}

const KEEP_TITLE = "Keep the AI's changes?";
const KEEP = "Keep Changes";
const DISCARD = "Discard Changes";
const STASH = "stash";

function leftRefs(refs: readonly string[]): string[] {
  const branches = refs.filter((ref) => ref !== STASH);
  const left = [
    ...(branches.length === 0
      ? []
      : [`the branch${branches.length === 1 ? "" : "es"} ${branches.join(", ")}`]),
    ...(refs.includes(STASH) ? ["a stash"] : []),
  ];
  return left.length === 0 ? [] : [`left ${left.join(" and ")}`];
}

function keepAiChangesText(
  question: Extract<Question, { readonly kind: "keepAiChanges" }>,
): QuestionText {
  const { folder, files, headMoved, refs } = question;
  const changed = files.length > 0;
  const done = [...(headMoved ? ["made commits"] : []), ...leftRefs(refs)];
  return {
    title: KEEP_TITLE,
    message: changed
      ? `The AI changed these files in its checkout at ${folder}:`
      : `The AI left work in its checkout at ${folder}.`,
    list: { kind: "files", files },
    note: done.length === 0 ? null : `It ${changed ? "also " : ""}${done.join(" and ")} there.`,
    confirm: KEEP,
    cancel: DISCARD,
  };
}

function keepUnreadableText(folder: string, message: string): QuestionText {
  return {
    title: KEEP_TITLE,
    message: `Git cannot read the AI's checkout at ${folder}, so yamt cannot tell what the AI changed there: ${message.trim()}`,
    list: { kind: "none" },
    note: "Discard Changes removes the checkout.",
    confirm: KEEP,
    cancel: DISCARD,
  };
}

function exitText(files: readonly string[]): QuestionText {
  return {
    title: "Unsaved Changes",
    message: "These files have changes that are not saved to disk. Exit without saving them?",
    list: { kind: "files", files },
    note: null,
    confirm: "Exit Without Saving",
    cancel: "Cancel",
  };
}

export function questionText(question: Question, platform: string): QuestionText {
  switch (question.kind) {
    case "unprocessed":
      return unprocessedText(question.summary);
    case "exit":
      return exitText(question.files);
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
      return abortText(question.operation);
    case "continueUnsaved":
      return continueUnsavedText(question.operation, question.files);
    case "rewords":
      return REWORDS_TEXT;
    case "closeTab":
      return closeTabText(question.name);
    case "keepAiChanges":
      return keepAiChangesText(question);
    case "keepUnreadableCheckout":
      return keepUnreadableText(question.folder, question.message);
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}
