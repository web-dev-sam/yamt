import type { ServerKey, ServerView } from "../lsp";
import { dotKind, stateLine, type DotKind } from "./serverText";

export type ServerButton = {
  readonly key: ServerKey;
  readonly name: string;
  readonly title: string;
  readonly dot: string;
  readonly pinned: boolean;
};

export const DOT_CLASSES: Readonly<Record<DotKind, string>> = {
  running: "bg-success-signal",
  busy: "bg-fg-muted",
  stopped: "border border-fg-muted",
  problem: "bg-problem-error",
  warning: "bg-problem-warning",
};

export function serverButtons(
  views: readonly ServerView[],
  pinned: ReadonlySet<string>,
): readonly ServerButton[] {
  return views.map((view) => ({
    key: view.key,
    name: view.name,
    title: stateLine(view.state),
    dot: DOT_CLASSES[dotKind(view.state)],
    pinned: pinned.has(view.key),
  }));
}
