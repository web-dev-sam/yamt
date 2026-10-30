import type { MergeView, OperationKind, OperationView, ProgressView, SideName } from "../ipc";
import { returnPlaceText } from "./leftoverText";

type OperationLine = { readonly text: string; readonly tooltip: string };

type ContinueVerb = "Continue" | "Commit";

type ContinueAction = {
  readonly verb: ContinueVerb;
  readonly object: string;
  readonly label: string;
};

const NAMES: Readonly<Record<OperationKind, string>> = {
  Merge: "merge",
  SquashMerge: "squash merge",
  Rebase: "rebase",
  CherryPick: "cherry-pick",
  Revert: "revert",
  Am: "patch application",
};

const TITLES: Readonly<Record<OperationKind, string>> = {
  Merge: "Merge",
  SquashMerge: "Squash Merge",
  Rebase: "Rebase",
  CherryPick: "Cherry-Pick",
  Revert: "Revert",
  Am: "Patch Application",
};

const TAGS: Readonly<Record<OperationKind, string>> = {
  Merge: "MERGE",
  SquashMerge: "SQUASH MERGE",
  Rebase: "REBASE",
  CherryPick: "CHERRY-PICK",
  Revert: "REVERT",
  Am: "PATCHES",
};

type StepKind = Exclude<OperationKind, "Merge" | "SquashMerge">;

const DONE_STEPS: Readonly<Record<StepKind, readonly [string, string]>> = {
  Rebase: ["commit already replayed is", "commits already replayed are"],
  CherryPick: ["commit already picked is", "commits already picked are"],
  Revert: ["commit already reverted is", "commits already reverted are"],
  Am: ["patch already applied is", "patches already applied are"],
};

const MERGE_VERBS: Readonly<Record<"Merge" | "SquashMerge", string>> = {
  Merge: "Merging",
  SquashMerge: "Squash-merging",
};

export const SAVING_TEXT = "Saving…";

export const CONTINUING_TEXT =
  "Continuing… (if nothing happens, git may be asking for something in the terminal that started yamt)";

export function operationName(kind: OperationKind): string {
  return NAMES[kind];
}

export function operationTag(kind: OperationKind): string {
  return TAGS[kind];
}

function named(name: SideName | null): string | null {
  if (name === null) {
    return null;
  }
  switch (name.kind) {
    case "Branch":
      return name.name;
    case "Commit":
    case "Revert":
      return name.subject === "" ? name.short_id : `${name.short_id} ${name.subject}`;
    case "Patch":
      return name.subject;
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

function messageOf(name: SideName | null): readonly string[] {
  return name === null || name.kind === "Branch" ? [] : [name.message.trim()];
}

function counted(progress: ProgressView | null): string {
  return progress === null || progress.total === 1
    ? ""
    : ` · ${progress.step} of ${progress.total}`;
}

function joined(parts: readonly (string | null)[]): string {
  return parts.filter((part) => part !== null && part !== "").join(" ");
}

function after(word: string, name: SideName | null): string | null {
  const text = named(name);
  return text === null ? null : `${word} ${text}`;
}

function patchLine(subject: string, progress: ProgressView | null): string {
  const count =
    progress === null || progress.total === 1 ? "" : ` ${progress.step} of ${progress.total}`;
  return subject === "" ? `Applying patch${count}` : `Applying patch${count}: ${subject}`;
}

function lineText(operation: OperationView): string {
  switch (operation.kind) {
    case "Merge":
    case "SquashMerge":
      return joined([
        MERGE_VERBS[operation.kind],
        named(operation.merging),
        after("into", operation.into),
      ]);
    case "Rebase": {
      const branch = operation.branch ?? "detached HEAD";
      return (
        joined(["Rebasing", branch, after("onto", operation.onto)]) + counted(operation.progress)
      );
    }
    case "CherryPick":
      return joined(["Cherry-picking", named(operation.picking)]) + counted(operation.progress);
    case "Revert":
      return joined(["Reverting", named(operation.reverting)]) + counted(operation.progress);
    case "Am":
      return patchLine(operation.subject, operation.progress);
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}

function messages(operation: OperationView): readonly string[] {
  switch (operation.kind) {
    case "Merge":
    case "SquashMerge":
      return messageOf(operation.merging);
    case "Rebase":
      return messageOf(operation.replaying);
    case "CherryPick":
      return messageOf(operation.picking);
    case "Revert":
      return messageOf(operation.reverting);
    case "Am":
      return [operation.message.trim()];
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}

export function operationLine(operation: OperationView): OperationLine {
  const text = lineText(operation);
  const tooltip = [text, ...messages(operation)].filter((part) => part !== "").join("\n\n");
  return { text, tooltip };
}

export function abortLabel(operation: OperationView): string {
  return `Abort ${NAMES[operation.kind]}`;
}

function action(verb: ContinueVerb, kind: OperationKind, labelObject: string): ContinueAction {
  return { verb, object: `the ${NAMES[kind]}`, label: `${verb} ${labelObject}` };
}

export function continueAction(kind: OperationKind): ContinueAction {
  switch (kind) {
    case "Merge":
    case "SquashMerge":
      return action("Commit", kind, "merge");
    case "Am":
      return action("Continue", kind, "applying patches");
    case "Rebase":
    case "CherryPick":
    case "Revert":
      return action("Continue", kind, NAMES[kind]);
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function continueLabel(operation: OperationView): string {
  return continueAction(operation.kind).label;
}

export function filesLeftText(count: number): string {
  return count === 1 ? "1 file is not resolved yet" : `${count} files are not resolved yet`;
}

export function allResolvedText(operation: OperationView | null): string {
  if (operation === null) {
    return "All files are resolved. Close the window to finish the merge.";
  }
  const { verb, label } = continueAction(operation.kind);
  return verb === "Commit"
    ? `All files are resolved. ${label} to commit it.`
    : `All files are resolved. ${label} to let git go on.`;
}

export function abortTitle(operation: OperationView): string {
  return `Abort ${TITLES[operation.kind]}`;
}

function stepsSentence(kind: StepKind, progress: ProgressView | null): string {
  const done = progress === null ? 0 : progress.step - 1;
  if (done === 0) {
    return "";
  }
  const [one, many] = DONE_STEPS[kind];
  return done === 1 ? ` The 1 ${one} undone too.` : ` The ${done} ${many} undone too.`;
}

function doneSentence(operation: OperationView): string {
  switch (operation.kind) {
    case "Merge":
    case "SquashMerge":
      return "";
    case "Rebase":
    case "CherryPick":
    case "Revert":
    case "Am":
      return stepsSentence(operation.kind, operation.progress);
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}

export function abortMessage(operation: OperationView): string {
  const name = NAMES[operation.kind];
  return `Every resolution and every save in this ${name} will be lost, and so will unsaved edits.${doneSentence(operation)} The repository goes back to how it was before the ${name}, and yamt closes.`;
}

export function mergeOfText({ target, branch }: MergeView): string {
  return `merge of ${target} into ${branch}`;
}

export function mergeRequestAbortMessage(view: MergeView): string {
  const merge = `Abort the ${mergeOfText(view)}`;
  const { returnTo } = view;
  return returnTo === null ? `${merge}?` : `${merge} and return to ${returnPlaceText(returnTo)}?`;
}

export function mergeRequestAbortNote({ branch, branchBefore }: MergeView): string | null {
  switch (branchBefore.kind) {
    case "created":
      return `yamt deletes ${branch}, which it created for this merge.`;
    case "movedFrom":
      return `${branch} goes back to ${branchBefore.id}, where it was before.`;
    case "unchanged":
      return null;
    default: {
      const _exhaustive: never = branchBefore;
      return _exhaustive;
    }
  }
}
