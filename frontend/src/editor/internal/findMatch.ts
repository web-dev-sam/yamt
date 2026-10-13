import { getSearchQuery, type SearchQuery } from "@codemirror/search";
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

type Match = { readonly from: number; readonly to: number };
export type FindDirection = "next" | "previous";

export function matches(state: EditorState, query: SearchQuery): Match[] {
  const found: Match[] = [];
  if (!query.valid) {
    return found;
  }
  const cursor = query.getCursor(state);
  for (let next = cursor.next(); next.done !== true; next = cursor.next()) {
    found.push({ from: next.value.from, to: next.value.to });
  }
  return found;
}

export function findLabel(state: EditorState, query: SearchQuery): string {
  if (query.search === "") {
    return "";
  }
  const found = matches(state, query);
  if (found.length === 0) {
    return "No results";
  }
  const { from, to } = state.selection.main;
  const current = found.findIndex((match) => match.from === from && match.to === to);
  if (current >= 0) {
    return `${current + 1} of ${found.length}`;
  }
  return found.length === 1 ? "1 result" : `${found.length} results`;
}

export function labelOutdated(before: EditorState, after: EditorState): boolean {
  return (
    before.doc !== after.doc ||
    !before.selection.eq(after.selection) ||
    !getSearchQuery(before).eq(getSearchQuery(after))
  );
}

export function matchFrom(found: readonly Match[], pos: number): Match | undefined {
  return found.find((match) => match.from >= pos) ?? found[0];
}

export function stepMatch(
  state: EditorState,
  { query, direction }: { readonly query: SearchQuery; readonly direction: FindDirection },
): TransactionSpec | null {
  const found = matches(state, query);
  const { from, to } = state.selection.main;
  const match =
    direction === "next"
      ? matchFrom(found, to)
      : (found.findLast((candidate) => candidate.to <= from) ?? found.at(-1));
  return match === undefined ? null : selectMatch(match);
}

export function selectMatch({ from, to }: Match): TransactionSpec {
  const selection = EditorSelection.single(from, to);
  return {
    selection,
    effects: EditorView.scrollIntoView(selection.main, { y: "center" }),
    userEvent: "select.search",
  };
}
