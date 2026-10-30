import type { Leftover, MergeView, OperationKind, OperationView } from "../ipc";
import type { ServerSpec } from "../lsp";
import type { Clash } from "./keymapEdit";
import type { MergeSummary } from "./useMergeController";

export type Question =
  | { readonly kind: "unprocessed"; readonly summary: MergeSummary }
  | { readonly kind: "exit"; readonly files: readonly string[] }
  | {
      readonly kind: "abort";
      readonly operation: OperationView;
      readonly mergeRequest: MergeView | null;
    }
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
      readonly refs: { readonly branches: readonly string[]; readonly stash: boolean };
    }
  | { readonly kind: "keepUnreadableCheckout"; readonly folder: string; readonly message: string }
  | { readonly kind: "deleteNote" }
  | { readonly kind: "push"; readonly branch: string }
  | { readonly kind: "pushFailed"; readonly branch: string; readonly message: string }
  | {
      readonly kind: "abortLeftovers";
      readonly mergeRequest: MergeView;
      readonly leftovers: readonly Leftover[];
    };

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
    case "deleteNote":
    case "push":
    case "pushFailed":
    case "abortLeftovers":
      return false;
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}
