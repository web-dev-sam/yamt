import "../theme.css";
import {
  closeSearchPanel,
  getSearchQuery,
  openSearchPanel,
  search,
  SearchQuery,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";
import {
  Compartment,
  Facet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type TransactionSpec,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  runScopeHandlers,
  type Command,
  type KeyBinding,
  type Panel,
  type ViewUpdate,
} from "@codemirror/view";
import arrowDownIcon from "~icons/lucide/arrow-down?raw";
import arrowUpIcon from "~icons/lucide/arrow-up?raw";
import searchIcon from "~icons/lucide/search?raw";
import xIcon from "~icons/lucide/x?raw";

import { keyLabel, type KeyAction, type KeyBindings } from "../../ipc";
import { findLabel, labelOutdated, matches, matchFrom, selectMatch, stepMatch } from "./findMatch";
import type { FindDirection } from "./findMatch";
import { cmKeys } from "./keys";

const FIND_BAR_HEIGHT_PX = 29;
const FIND_BAR_INSET_PX = 16;
const CLOSE = "Close";
const FIND_SCOPE = "editor search-panel";

const findTheme = EditorView.theme({
  ".cm-panels.cm-panels-top": {
    position: "absolute",
    left: "auto",
    right: `${FIND_BAR_INSET_PX}px`,
    maxWidth: `calc(100% - ${FIND_BAR_INSET_PX}px - ${FIND_BAR_INSET_PX}px)`,
    height: `${FIND_BAR_HEIGHT_PX}px`,
    border: "1px solid var(--color-separator)",
    borderTop: "none",
    borderRadius: "0 0 6px 6px",
  },
  "&.find-space .cm-content": { paddingTop: `${FIND_BAR_HEIGHT_PX}px` },
});

export const showFindSpace = StateEffect.define<boolean>();

const findSpace = StateField.define<boolean>({
  create: () => false,
  update: (shown, tr) => tr.effects.findLast((effect) => effect.is(showFindSpace))?.value ?? shown,
  provide: (field) =>
    EditorView.editorAttributes.from(field, (shown) => (shown ? { class: "find-space" } : {})),
});

export type FindSpaceView = {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
};

export function syncFindSpace(panes: readonly FindSpaceView[]): void {
  const shown = panes.some((view) => searchPanelOpen(view.state));
  for (const view of panes) {
    if (view.state.field(findSpace) !== shown) {
      view.dispatch({ effects: showFindSpace.of(shown) });
    }
  }
}

const closeTitle = Facet.define<string, string>({
  combine: (titles) => titles[0] ?? CLOSE,
});

export function closeButtonTitle(keys: KeyBindings, platform: string): string {
  const [first] = keys["close-find"];
  return first === undefined ? CLOSE : `${CLOSE} (${keyLabel(first, platform)})`;
}

function step(view: EditorView, direction: FindDirection): boolean {
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
  readonly #close: HTMLButtonElement;

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
    this.#close = iconButton({
      icon: xIcon,
      title: view.state.facet(closeTitle),
      run: () => closeFind(view),
    });
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
      this.#close,
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
    const title = update.state.facet(closeTitle);
    if (title !== update.startState.facet(closeTitle)) {
      this.#close.title = title;
      this.#close.setAttribute("aria-label", title);
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
  findTheme,
  findSpace,
  search({ literal: true, createPanel: (view) => new FindPanel(view) }),
];

export const findKeysCompartment = new Compartment();

export function findKeys(keys: KeyBindings, platform: string): Extension {
  function bind(action: KeyAction, run: Command, preventDefault: boolean): KeyBinding[] {
    return cmKeys(keys[action], platform).map((key) => ({
      key,
      run,
      scope: FIND_SCOPE,
      preventDefault,
    }));
  }
  return [
    closeTitle.of(closeButtonTitle(keys, platform)),
    keymap.of([
      ...bind("find", openFind, true),
      ...bind("find-next", findNext, true),
      ...bind("find-previous", findPrevious, true),
      ...bind("close-find", closeFind, false),
    ]),
  ];
}
