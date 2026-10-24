import {
  RangeSetBuilder,
  type EditorState,
  type Extension,
  type RangeSet,
} from "@codemirror/state";
import { EditorView, GutterMarker, lineNumberMarkers, lineNumbers } from "@codemirror/view";
import messageSquarePlusIcon from "~icons/lucide/message-square-plus?raw";

import { shownColumn, type Column, type Difference, type ThreadLine } from "../../ipc";
import { anchorAt } from "./threadAnchor";
import { threadField, type LineCount } from "./threadField";
import type { ShownThread } from "./threadRows";

export type NumberPress =
  | { readonly kind: "start"; readonly line: ThreadLine }
  | { readonly kind: "toggle"; readonly keys: readonly string[] };

const COUNT_CLASS = "cm-thread-count";

function lineInShownColumn(line: ThreadLine): number {
  switch (line.kind) {
    case "removed":
    case "unchangedOnLeft":
      return line.left;
    case "added":
    case "unchangedOnRight":
      return line.right;
    default: {
      const _exhaustive: never = line;
      return _exhaustive;
    }
  }
}

export function lineCounts(threads: readonly ShownThread[], column: Column): LineCount[] {
  const counts = new Map<number, string[]>();
  for (const thread of threads) {
    if (thread.shown === "draft" || shownColumn(thread.line) !== column) {
      continue;
    }
    const line = lineInShownColumn(thread.line);
    counts.set(line, [...(counts.get(line) ?? []), thread.key]);
  }
  return [...counts].map(([line, keys]) => ({ line, keys })).sort((a, b) => a.line - b.line);
}

export function numberPress(press: {
  readonly differences: readonly Difference[];
  readonly column: Column;
  readonly line: number;
  readonly onBadge: boolean;
  readonly counts: readonly LineCount[];
}): NumberPress {
  const count = press.onBadge ? press.counts.find(({ line }) => line === press.line) : undefined;
  return count === undefined
    ? { kind: "start", line: anchorAt(press.differences, press.column, press.line) }
    : { kind: "toggle", keys: count.keys };
}

class CountMarker extends GutterMarker {
  readonly number: number;
  readonly count: number;

  constructor(number: number, count: number) {
    super();
    this.number = number;
    this.count = count;
  }

  override eq(other: CountMarker): boolean {
    return other.number === this.number && other.count === this.count;
  }

  override toDOM(): Node {
    const number = document.createElement("span");
    number.textContent = String(this.number);
    const badge = document.createElement("span");
    badge.className = COUNT_CLASS;
    badge.textContent = String(this.count);
    number.append(badge);
    return number;
  }
}

function countMarkers(state: EditorState): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  const { doc } = state;
  for (const { line, keys } of state.field(threadField)?.counts ?? []) {
    if (line < doc.lines) {
      const from = doc.line(line + 1).from;
      builder.add(from, from, new CountMarker(line + 1, keys.length));
    }
  }
  return builder.finish();
}

// An SVG image is parsed as XML, so its root needs the SVG namespace (MDN "Namespaces crash course");
// the icon's raw markup is written for inline HTML and has none.
const iconImage = messageSquarePlusIcon.replace(
  "<svg ",
  `<svg xmlns="http://www.w3.org/2000/svg" `,
);

const iconTheme = EditorView.theme({
  "&": { "--thread-icon": `url("data:image/svg+xml,${encodeURIComponent(iconImage)}")` },
});

export function threadNumbers(
  pressed: (view: EditorView, line: number, onBadge: boolean) => void,
): Extension {
  return [
    lineNumbers({
      domEventHandlers: {
        mousedown(view, block, event) {
          const { target } = event;
          if (
            !(target instanceof Element) ||
            !(event instanceof MouseEvent) ||
            event.button !== 0
          ) {
            return false;
          }
          if (target.closest(".cm-gutterElement") === null) {
            return false;
          }
          const line = view.state.doc.lineAt(block.from).number - 1;
          pressed(view, line, target.closest(`.${COUNT_CLASS}`) !== null);
          return true;
        },
      },
    }),
    lineNumberMarkers.compute([threadField], countMarkers),
    EditorView.editorAttributes.of({ class: "cm-thread-lines" }),
    iconTheme,
  ];
}
