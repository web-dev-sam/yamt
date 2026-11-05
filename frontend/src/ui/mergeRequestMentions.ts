import { useEventListener } from "@vueuse/core";
import {
  computed,
  nextTick,
  shallowRef,
  toValue,
  useId,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import type { Person } from "../ipc";
import { mentionEdit, type MentionWord } from "../mergeRequests";
import { wrappedIndex } from "./menuKeys";
import {
  highlightAfter,
  mentionKey,
  mentionList,
  mentionOptionId,
  mentionRead,
  type FieldRead,
  type MentionAnchor,
  type MentionList,
} from "./mergeRequestMentionLines";
import type { PeopleSearcher } from "./mergeRequestPeople";
import { useMergeRequests } from "./mergeRequestsStore";
import { caretBox, visibleRoom } from "./textareaCaret";

export type MentionField = {
  /** null while closed. */
  readonly list: ComputedRef<MentionList | null>;
  readonly highlight: Readonly<ShallowRef<number>>;
  readonly anchor: Readonly<ShallowRef<MentionAnchor | null>>;
  readonly listId: string;
  /** `aria-autocomplete: "list"` always; `aria-controls` and `aria-activedescendant` while open. */
  readonly fieldAria: ComputedRef<Readonly<Record<string, string | undefined>>>;
  /** Call first in the field's keydown: true when the list took the key (already prevented and stopped). */
  keydown(event: KeyboardEvent): boolean;
  pick(index: number): void;
  /** Closes the list and ends the mention search (Preview, a send, Queue). */
  close(): void;
};

/** `word`: the open `@` word (null: closed); `dismissed`: the start of the word Escape or `close` shut. */
type State = {
  readonly field: Readonly<ShallowRef<HTMLTextAreaElement | null>>;
  readonly search: PeopleSearcher;
  readonly word: ShallowRef<MentionWord | null>;
  readonly highlight: ShallowRef<number>;
  readonly anchor: ShallowRef<MentionAnchor | null>;
  composing: boolean;
  dismissed: number | null;
};

function fieldRead(state: State, element: HTMLTextAreaElement): FieldRead {
  const { value: text, selectionStart, selectionEnd } = element;
  return { text, selectionStart, selectionEnd, composing: state.composing };
}

function shut(state: State): void {
  if (state.word.value !== null) {
    state.word.value = null;
    state.search.end();
  }
  state.anchor.value = null;
}

function measure(state: State): void {
  const element = state.field.value;
  const open = state.word.value;
  state.anchor.value =
    element === null || open === null
      ? null
      : {
          caret: caretBox(element, open.start),
          field: element.getBoundingClientRect(),
          room: visibleRoom(element),
        };
}

function read(state: State): void {
  const element = state.field.value;
  if (element === null) {
    return;
  }
  const at = fieldRead(state, element);
  if (mentionRead(at, null)?.start !== state.dismissed) {
    state.dismissed = null;
  }
  const open = mentionRead(at, state.dismissed);
  if (open === null) {
    shut(state);
    return;
  }
  state.word.value = open;
  state.search.search(open.typed);
  void nextTick(() => {
    measure(state);
  });
}

function pick(state: State, list: MentionList | null, index: number): void {
  const element = state.field.value;
  const open = state.word.value;
  const line = list?.lines[index];
  if (element === null || open === null || line === undefined) {
    return;
  }
  const edit = mentionEdit(open, line.username);
  element.focus();
  element.setSelectionRange(edit.from, edit.to);
  document.execCommand("insertText", false, edit.insert);
}

function keydown(state: State, list: MentionList | null, event: KeyboardEvent): boolean {
  const key = mentionKey(event, list);
  if (key === null || list === null) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  switch (key.kind) {
    case "step":
      state.highlight.value = wrappedIndex(list.lines.length, state.highlight.value, key.step);
      break;
    case "pick":
      pick(state, list, state.highlight.value);
      break;
    case "close":
      state.dismissed = state.word.value?.start ?? null;
      shut(state);
      break;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
  return true;
}

function close(state: State): void {
  const element = state.field.value;
  state.dismissed =
    element === null ? null : (mentionRead(fieldRead(state, element), null)?.start ?? null);
  shut(state);
}

function listen(state: State): void {
  const { field } = state;
  useEventListener(field, "input", () => {
    if (!state.composing) {
      read(state);
    }
  });
  useEventListener(field, ["click", "keyup"], () => {
    read(state);
  });
  // WebKitGTK 2.54 reports selectionStart 0 during a textarea's focus event and its microtasks when the focus comes
  // back (shown again after Preview, or `focus()` after a blur); the caret is back by the next task (measured in the
  // mr-mentions-list smoke).
  useEventListener(field, "focus", () => {
    setTimeout(() => {
      read(state);
    });
  });
  useEventListener(field, ["compositionstart", "compositionend"], (event: CompositionEvent) => {
    state.composing = event.type === "compositionstart";
    read(state);
  });
  useEventListener(field, "blur", () => {
    shut(state);
  });
  useEventListener(field, "scroll", () => {
    if (state.word.value !== null) {
      measure(state);
    }
  });
}

function shownList(
  state: State,
  known: MaybeRefOrGetter<readonly Person[]>,
): ComputedRef<MentionList | null> {
  const list = computed(() => {
    const open = state.word.value;
    return open === null
      ? null
      : mentionList({
          known: toValue(known),
          typed: open.typed,
          search: state.search.state.value,
          platform: navigator.platform,
        });
  });
  watch(
    () => list.value?.lines ?? [],
    (after, before) => {
      state.highlight.value = highlightAfter(before, after, state.highlight.value);
    },
  );
  return list;
}

/** The `@` word's list for `field` (request rules 1–7, design §2.5–2.7), searching through `mentionSearch`. */
export function useMentions(
  field: Readonly<ShallowRef<HTMLTextAreaElement | null>>,
  known: MaybeRefOrGetter<readonly Person[]>,
): MentionField {
  const state: State = {
    field,
    search: useMergeRequests().mentionSearch,
    word: shallowRef(null),
    highlight: shallowRef(0),
    anchor: shallowRef(null),
    composing: false,
    dismissed: null,
  };
  const listId = useId();
  const list = shownList(state, known);
  const fieldAria = computed(() => ({
    "aria-autocomplete": "list",
    "aria-controls": list.value === null ? undefined : listId,
    "aria-activedescendant":
      list.value === null || list.value.lines.length === 0
        ? undefined
        : mentionOptionId(listId, state.highlight.value),
  }));
  listen(state);
  return {
    list,
    highlight: state.highlight,
    anchor: state.anchor,
    listId,
    fieldAria,
    keydown: (event) => keydown(state, list.value, event),
    pick: (index) => {
      pick(state, list.value, index);
    },
    close: () => {
      close(state);
    },
  };
}
