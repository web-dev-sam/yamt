import {
  keyLabel,
  type Leftover,
  type MergeView,
  type OperationKind,
  type OperationView,
} from "../ipc";
import type { ServerSpec } from "../lsp";
import type { Clash } from "./keymapEdit";
import { ACTION_NAMES } from "./keyText";
import { leftoverText } from "./leftoverText";
import {
  abortMessage,
  abortTitle,
  continueAction,
  mergeRequestAbortMessage,
  mergeRequestAbortNote,
} from "./operationText";
import type { Question } from "./question";
import { projectLabel, serverLabel } from "./serverText";
import type { MergeSummary } from "./useMergeController";

type QuestionList =
  | { readonly kind: "none" }
  | { readonly kind: "files"; readonly files: readonly string[] }
  | { readonly kind: "lines"; readonly lines: readonly string[] };

export type QuestionText = {
  readonly title: string;
  readonly message: string;
  readonly list: QuestionList;
  readonly note: string | null;
  readonly confirm: string;
  readonly cancel: string | null;
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
    list: { kind: "lines", lines: [...foundLines, ...addedLines] },
    note: "yamt remembers your answer for this repository. You can change it in Settings.",
    confirm: "Start",
    cancel: "Don't start",
  };
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

function abortText(operation: OperationView, mergeRequest: MergeView | null): QuestionText {
  const title = abortTitle(operation);
  const words =
    mergeRequest === null
      ? { message: abortMessage(operation), note: null }
      : {
          message: mergeRequestAbortMessage(mergeRequest),
          note: mergeRequestAbortNote(mergeRequest),
        };
  return { title, ...words, list: { kind: "none" }, confirm: title, cancel: "Cancel" };
}

function pushText(branch: string): QuestionText {
  return {
    title: "Push to GitLab",
    message: `Push ${branch} to GitLab?`,
    list: { kind: "none" },
    note: `The merge is committed on ${branch}. Keep Local leaves it there; you can push it later.`,
    confirm: "Push",
    cancel: "Keep Local",
  };
}

function pushFailedText(branch: string, message: string): QuestionText {
  return {
    title: "Push Failed",
    message: `git did not push ${branch}: ${message}`,
    list: { kind: "none" },
    note: `The merge commit stays on your ${branch}.`,
    confirm: "Push Again",
    cancel: "Keep Local",
  };
}

function abortLeftoversText(
  { target, branch }: MergeView,
  leftovers: readonly Leftover[],
): QuestionText {
  return {
    title: "Merge Aborted",
    message: `The merge of ${target} into ${branch} is aborted, but yamt did not put everything back:`,
    list: { kind: "lines", lines: leftovers.map(leftoverText) },
    note: null,
    confirm: "Close",
    cancel: null,
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

const DELETE_NOTE_TEXT: QuestionText = {
  title: "Delete Comment",
  message: "Delete this comment?",
  list: { kind: "none" },
  note: null,
  confirm: "Delete",
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

function leftRefs({
  branches,
  stash,
}: Extract<Question, { readonly kind: "keepAiChanges" }>["refs"]): string[] {
  const left = [
    ...(branches.length === 0
      ? []
      : [`the branch${branches.length === 1 ? "" : "es"} ${branches.join(", ")}`]),
    ...(stash ? ["a stash"] : []),
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
    note: `${DISCARD} removes the checkout.`,
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

function clashText(clash: Clash, platform: string): QuestionText {
  return {
    title: "Key Already in Use",
    message: `${keyLabel(clash.key, platform)} is already used by ${ACTION_NAMES[clash.owner]}. Move it to ${ACTION_NAMES[clash.action]}?`,
    list: { kind: "none" },
    note: null,
    confirm: "Move",
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
      return clashText(question, platform);
    case "servers":
      return serversText(question.found, question.added);
    case "abort":
      return abortText(question.operation, question.mergeRequest);
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
    case "deleteNote":
      return DELETE_NOTE_TEXT;
    case "push":
      return pushText(question.branch);
    case "pushFailed":
      return pushFailedText(question.branch, question.message);
    case "abortLeftovers":
      return abortLeftoversText(question.mergeRequest, question.leftovers);
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}
