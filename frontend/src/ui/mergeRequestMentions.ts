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
import { wrappedIndex } from "./menuKeys";
import {
  highlightAfter,
  MENTION_CLOSED,
  mentionKey,
  mentionList,
  mentionOptionId,
  mentionPick,
  mentionStep,
  type FieldText,
  type MentionAnchor,
  type MentionEvent,
  type MentionList,
  type MentionState,
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

type State = {
  readonly field: Readonly<ShallowRef<HTMLTextAreaElement | null>>;
  readonly search: PeopleSearcher;
  readonly mention: ShallowRef<MentionState>;
  readonly highlight: ShallowRef<number>;
  readonly anchor: ShallowRef<MentionAnchor | null>;
};

function measure(state: State): void {
  const element = state.field.value;
  const open = state.mention.value.word;
  state.anchor.value =
    element === null || open === null
      ? null
      : {
          caret: caretBox(element, open.start),
          field: element.getBoundingClientRect(),
          room: visibleRoom(element),
        };
}

function dispatch(state: State, event: MentionEvent): void {
  const { state: next, call } = mentionStep(state.mention.value, event);
  state.mention.value = next;
  if (call.kind === "search") {
    state.search.search(call.typed);
  } else if (call.kind === "end") {
    state.search.end();
  }
  void nextTick(() => {
    measure(state);
  });
}

function dispatchField(state: State, eventOf: (field: FieldText) => MentionEvent): void {
  const element = state.field.value;
  if (element !== null) {
    const { value: text, selectionStart, selectionEnd } = element;
    dispatch(state, eventOf({ text, selectionStart, selectionEnd }));
  }
}

function pick(state: State, list: MentionList | null, index: number): void {
  const element = state.field.value;
  const edit = mentionPick(state.mention.value.word, list, index);
  if (element === null || edit === null) {
    return;
  }
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
      dispatch(state, { kind: "escape" });
      break;
  }
  return true;
}

function listen(state: State): void {
  const { field } = state;
  useEventListener(field, ["input", "click", "keyup"], () => {
    dispatchField(state, (text) => ({ kind: "read", field: text }));
  });
  // WebKitGTK 2.54 reports selectionStart 0 during a textarea's focus event and its microtasks when the focus comes
  // back (shown again after Preview, or `focus()` after a blur); the caret is back by the next task (measured in the
  // mr-mentions-list smoke).
  useEventListener(field, "focus", () => {
    setTimeout(() => {
      dispatchField(state, (text) => ({ kind: "read", field: text }));
    });
  });
  useEventListener(field, ["compositionstart", "compositionend"], (event: CompositionEvent) => {
    const composing = event.type === "compositionstart";
    dispatchField(state, (text) => ({ kind: "compose", composing, field: text }));
  });
  useEventListener(field, "blur", () => {
    dispatch(state, { kind: "blur" });
  });
  useEventListener(field, "scroll", () => {
    measure(state);
  });
}

function shownList(
  state: State,
  known: MaybeRefOrGetter<readonly Person[]>,
): ComputedRef<MentionList | null> {
  const list = computed(() => {
    const open = state.mention.value.word;
    return open === null
      ? null
      : mentionList({
          known: toValue(known),
          typed: open.typed,
          search: state.search.state.value,
          platform: navigator.platform,
        });
  });
  watch(list, (after, before) => {
    state.highlight.value =
      after === null || before === null
        ? 0
        : highlightAfter(before.lines, after.lines, state.highlight.value);
  });
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
    mention: shallowRef(MENTION_CLOSED),
    highlight: shallowRef(0),
    anchor: shallowRef(null),
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
      dispatchField(state, (text) => ({ kind: "close", field: text }));
    },
  };
}
