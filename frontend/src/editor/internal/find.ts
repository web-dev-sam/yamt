import "../theme.css";
import {
  closeSearchPanel,
  getSearchQuery,
  openSearchPanel,
  search,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  runScopeHandlers,
  type Panel,
  type ViewUpdate,
} from "@codemirror/view";
import arrowDownIcon from "~icons/lucide/arrow-down?raw";
import arrowUpIcon from "~icons/lucide/arrow-up?raw";
import searchIcon from "~icons/lucide/search?raw";
import xIcon from "~icons/lucide/x?raw";

type Match = { readonly from: number; readonly to: number };
type Direction = "next" | "previous";

function matches(state: EditorState, query: SearchQuery): Match[] {
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

function matchFrom(found: readonly Match[], pos: number): Match | undefined {
  return found.find((match) => match.from >= pos) ?? found[0];
}

export function stepMatch(
  state: EditorState,
  { query, direction }: { readonly query: SearchQuery; readonly direction: Direction },
): TransactionSpec | null {
  const found = matches(state, query);
  const { from, to } = state.selection.main;
  const match =
    direction === "next"
      ? matchFrom(found, to)
      : (found.findLast((candidate) => candidate.to <= from) ?? found.at(-1));
  return match === undefined ? null : selectMatch(match);
}

function selectMatch({ from, to }: Match): TransactionSpec {
  const selection = EditorSelection.single(from, to);
  return {
    selection,
    effects: EditorView.scrollIntoView(selection.main, { y: "center" }),
    userEvent: "select.search",
  };
}

function step(view: EditorView, direction: Direction): boolean {
  const spec = stepMatch(view.state, { query: getSearchQuery(view.state), direction });
  if (spec !== null) {
    view.dispatch(spec);
  }
  return true;
}

function findNext(view: EditorView): boolean {
  return step(view, "next");
}

function findPrevious(view: EditorView): boolean {
  return step(view, "previous");
}

function openFind(view: EditorView): boolean {
  const before = getSearchQuery(view.state);
  const { doc, selection } = view.state;
  const multiLine = doc.lineAt(selection.main.from).number !== doc.lineAt(selection.main.to).number;
  openSearchPanel(view);
  if (multiLine) {
    view.dispatch({ effects: setSearchQuery.of(before) });
  }
  return true;
}

function closeFind(view: EditorView): boolean {
  if (!closeSearchPanel(view)) {
    return false;
  }
  view.focus();
  return true;
}

function iconButton({
  icon,
  title,
  run,
}: {
  readonly icon: string;
  readonly title: string;
  readonly run: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "find-button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = icon;
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", run);
  return button;
}

class FindPanel implements Panel {
  readonly dom = document.createElement("div");
  readonly top = true;
  readonly #view: EditorView;
  readonly #field = document.createElement("input");
  readonly #count = document.createElement("span");

  constructor(view: EditorView) {
    this.#view = view;
    this.dom.className = "find-bar";
    const icon = document.createElement("span");
    icon.className = "find-icon";
    icon.innerHTML = searchIcon;
    this.#field.className = "find-field";
    this.#field.type = "text";
    this.#field.placeholder = "Find";
    this.#field.spellcheck = false;
    // Mod-f on an open bar refocuses the element carrying this attribute
    // (@codemirror/search openSearchPanel → getSearchInput).
    this.#field.setAttribute("main-field", "true");
    this.#field.setAttribute("aria-label", "Find");
    this.#field.value = getSearchQuery(view.state).search;
    this.#field.addEventListener("input", this.#typed);
    this.#field.addEventListener("keydown", this.#key);
    this.#count.className = "find-count";
    this.#count.setAttribute("aria-live", "polite");
    this.#count.textContent = findLabel(view.state, getSearchQuery(view.state));
    this.dom.append(
      icon,
      this.#field,
      this.#count,
      iconButton({
        icon: arrowUpIcon,
        title: "Previous Occurrence (Shift+Enter)",
        run: () => findPrevious(view),
      }),
      iconButton({
        icon: arrowDownIcon,
        title: "Next Occurrence (Enter)",
        run: () => findNext(view),
      }),
      iconButton({ icon: xIcon, title: "Close (Escape)", run: () => closeFind(view) }),
    );
  }

  mount(): void {
    this.#field.focus();
    this.#field.select();
  }

  update(update: ViewUpdate): void {
    const query = getSearchQuery(update.state);
    if (!query.eq(getSearchQuery(update.startState)) && query.search !== this.#field.value) {
      this.#field.value = query.search;
    }
    if (labelOutdated(update.startState, update.state)) {
      this.#count.textContent = findLabel(update.state, query);
    }
  }

  readonly #typed = (): void => {
    const view = this.#view;
    const query = new SearchQuery({ search: this.#field.value, literal: true });
    const match = matchFrom(matches(view.state, query), view.state.selection.main.from);
    view.dispatch(match === undefined ? {} : selectMatch(match), {
      effects: setSearchQuery.of(query),
    });
  };

  readonly #key = (event: KeyboardEvent): void => {
    if (runScopeHandlers(this.#view, event, "search-panel")) {
      event.preventDefault();
    } else if (event.key === "Enter") {
      event.preventDefault();
      step(this.#view, event.shiftKey ? "previous" : "next");
    }
  };
}

export const find = [
  search({ literal: true, createPanel: (view) => new FindPanel(view) }),
  keymap.of([
    { key: "Mod-f", run: openFind, scope: "editor search-panel", preventDefault: true },
    {
      key: "F3",
      run: findNext,
      shift: findPrevious,
      scope: "editor search-panel",
      preventDefault: true,
    },
    { key: "Escape", run: closeFind, scope: "editor search-panel" },
  ]),
];
