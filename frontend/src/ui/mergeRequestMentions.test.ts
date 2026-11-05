import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type * as Vue from "vue";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { createFixtureCompareSource, log, type Person } from "../ipc";
import { useMentions, type MentionField } from "./mergeRequestMentions";
import type { PeopleSearcher } from "./mergeRequestPeople";
import { createMergeRequests, type PeopleSearch } from "./mergeRequests";
import { registerMergeRequests } from "./mergeRequestsStore";
import type { Screen } from "./screen";

const caret = vi.hoisted(() => {
  const at: number[] = [];
  return { box: { left: 4, top: 0, bottom: 20 }, at };
});
vi.mock("./textareaCaret", () => ({
  caretBox: (_field: unknown, index: number) => {
    caret.at.push(index);
    return caret.box;
  },
  visibleRoom: () => ROOM,
}));
vi.mock("vue", async (importOriginal) => ({
  ...(await importOriginal<typeof Vue>()),
  useId: () => "mentions",
}));

const ROOM = { left: 0, top: 0, right: 800, bottom: 600 };
const FIELD_RECT = { left: 10, top: 100, right: 410, bottom: 160 };
const SAM: Person = { username: "sam", name: "Sam Weller", picture: null };
const ANNA: Person = { username: "anna", name: "Anna Berg", picture: null };
const BEN: Person = { username: "ben", name: "Ben Okafor", picture: null };
const ERIK: Person = { username: "erik", name: "Erik Lund", picture: null };
const FAILED = {
  kind: "failed",
  text: "zz",
  cause: { kind: "WorkerStopped" },
} as const satisfies PeopleSearch;

class FakeField extends EventTarget {
  value = "";
  selectionStart = 0;
  selectionEnd = 0;
  focused = 0;
  focus(): void {
    this.focused += 1;
  }
  setSelectionRange(from: number, to: number): void {
    this.selectionStart = from;
    this.selectionEnd = to;
  }
  getBoundingClientRect(): typeof FIELD_RECT {
    return FIELD_RECT;
  }
}

class FakeKeyboardEvent extends Event {
  readonly key: string;
  readonly ctrlKey = false;
  readonly metaKey = false;
  readonly altKey = false;
  readonly shiftKey = false;
  readonly isComposing = false;
  constructor(key: string) {
    super("keydown", { cancelable: true, bubbles: true });
    this.key = key;
  }
}

let scope: EffectScope;
let searched: ShallowRef<PeopleSearch>;
let calls: string[];
let fake: FakeField;
let field: ShallowRef<HTMLTextAreaElement | null>;
let written: string[];

beforeEach(() => {
  vi.stubGlobal("HTMLTextAreaElement", FakeField);
  vi.stubGlobal("KeyboardEvent", FakeKeyboardEvent);
  written = [];
  vi.stubGlobal("document", {
    execCommand: (command: string, ui: boolean, text: string) => {
      written.push(`${command} ${String(ui)} ${text}`);
      return true;
    },
  });
  caret.at.length = 0;
  calls = [];
  searched = shallowRef<PeopleSearch>({ kind: "empty" });
  const mentionSearch: PeopleSearcher = {
    state: searched,
    search: (typed) => {
      calls.push(`search ${typed}`);
    },
    end: () => {
      calls.push("end");
    },
  };
  const slice = createMergeRequests({
    source: createFixtureCompareSource(log, "?mr=list", {}),
    screen: shallowRef<Screen>({ kind: "files" }),
    report: () => undefined,
    discussionDetails: () => "lazy",
  });
  registerMergeRequests({ ...slice, mentionSearch });
  fake = new FakeField();
  field = shallowRef(textarea(fake));
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function textarea(element: FakeField): HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) {
    return element;
  }
  throw new Error("HTMLTextAreaElement is not the stub");
}

function keyEvent(key: string): KeyboardEvent {
  const event = new FakeKeyboardEvent(key);
  if (event instanceof KeyboardEvent) {
    return event;
  }
  throw new Error("KeyboardEvent is not the stub");
}

function mentions(): MentionField {
  const made = scope.run(() => useMentions(field, () => [SAM, ANNA, BEN]));
  if (made === undefined) {
    throw new Error("scope stopped");
  }
  return made;
}

function type(text: string, caretAt = text.length, kind = "input"): void {
  fake.value = text;
  fake.selectionStart = caretAt;
  fake.selectionEnd = caretAt;
  fake.dispatchEvent(new Event(kind));
}

function shown(made: MentionField): readonly string[] | null {
  return made.list.value === null ? null : made.list.value.lines.map((line) => line.username);
}

test("typing_a_word_opens_its_list_and_searches_once", async () => {
  const made = mentions();
  expect(shown(made)).toBeNull();
  expect(made.fieldAria.value).toEqual({
    "aria-autocomplete": "list",
    "aria-controls": undefined,
    "aria-activedescendant": undefined,
  });
  type("hi @an");
  type("hi @an", 6, "keyup");
  type("hi @an", 6, "click");
  expect(calls).toEqual(["search an"]);
  expect(shown(made)).toEqual(["anna"]);
  expect(made.listId).toBe("mentions");
  expect(made.fieldAria.value).toEqual({
    "aria-autocomplete": "list",
    "aria-controls": "mentions",
    "aria-activedescendant": "mentions-0",
  });
  expect(made.anchor.value).toBeNull();
  await nextTick();
  expect(made.anchor.value).toEqual({ caret: caret.box, field: FIELD_RECT, room: ROOM });
  expect(caret.at).toEqual([3, 3, 3]);
});

test("the_search_answer_joins_the_list_and_a_failure_shows_its_note", () => {
  const made = mentions();
  type("@ik");
  searched.value = { kind: "found", text: "ik", people: [ERIK] };
  expect(shown(made)).toEqual(["erik"]);
  type("@zz");
  searched.value = FAILED;
  expect(made.list.value).toEqual({
    lines: [],
    note: "Could not search people: yamt's worker stopped; try again.",
  });
  expect(made.fieldAria.value).toEqual({
    "aria-autocomplete": "list",
    "aria-controls": "mentions",
    "aria-activedescendant": undefined,
  });
  expect(made.keydown(keyEvent("Enter"))).toBe(false);
});

test("the_arrows_move_the_highlight_and_enter_writes_the_pick", () => {
  const made = mentions();
  type("@");
  expect(shown(made)).toEqual(["sam", "anna", "ben"]);
  const down = keyEvent("ArrowDown");
  expect(made.keydown(down)).toBe(true);
  expect(down.defaultPrevented).toBe(true);
  expect(down.cancelBubble).toBe(true);
  expect(made.highlight.value).toBe(1);
  expect(made.fieldAria.value["aria-activedescendant"]).toBe("mentions-1");
  expect(made.keydown(keyEvent("ArrowUp"))).toBe(true);
  expect(made.keydown(keyEvent("ArrowUp"))).toBe(true);
  expect(made.highlight.value).toBe(2);
  expect(made.keydown(keyEvent("Enter"))).toBe(true);
  expect(fake.focused).toBe(1);
  expect([fake.selectionStart, fake.selectionEnd]).toEqual([0, 1]);
  expect(written).toEqual(["insertText false @ben "]);
  const letter = keyEvent("a");
  expect(made.keydown(letter)).toBe(false);
  expect(letter.defaultPrevented).toBe(false);
});

test("the_highlight_resets_when_the_people_change_or_the_list_closes", async () => {
  const made = mentions();
  type("@");
  await nextTick();
  made.keydown(keyEvent("ArrowDown"));
  type("@", 1, "keyup");
  await nextTick();
  expect(made.highlight.value).toBe(1);
  type("@a");
  await nextTick();
  expect(made.highlight.value).toBe(0);
  made.keydown(keyEvent("ArrowDown"));
  made.keydown(keyEvent("Escape"));
  await nextTick();
  expect(made.highlight.value).toBe(0);
});

test("a_pick_writes_only_an_existing_line_of_an_open_word", () => {
  const made = mentions();
  made.pick(0);
  type("@an");
  made.pick(1);
  expect(written).toEqual([]);
  made.pick(0);
  expect(written).toEqual(["insertText false @anna "]);
  field.value = null;
  made.pick(0);
  expect(written).toEqual(["insertText false @anna "]);
});

test("escape_closes_the_list_and_keeps_its_word_closed", () => {
  const made = mentions();
  expect(made.keydown(keyEvent("Escape"))).toBe(false);
  type("@an");
  expect(made.keydown(keyEvent("Escape"))).toBe(true);
  expect(shown(made)).toBeNull();
  type("@ann");
  expect(shown(made)).toBeNull();
  expect(calls).toEqual(["search an", "end"]);
});

test("a_send_closes_the_list_until_the_field_shows_another_text", async () => {
  const made = mentions();
  type("@an");
  made.close();
  expect(shown(made)).toBeNull();
  type("@an", 3, "keyup");
  expect(shown(made)).toBeNull();
  await nextTick();
  expect(made.anchor.value).toBeNull();
  type("@");
  expect(shown(made)).toEqual(["sam", "anna", "ben"]);
  expect(calls).toEqual(["search an", "end", "search "]);
  field.value = null;
  made.close();
  expect(shown(made)).toEqual(["sam", "anna", "ben"]);
});

test("blur_closes_and_focus_reads_a_task_later", () => {
  vi.useFakeTimers();
  const made = mentions();
  type("@an");
  fake.dispatchEvent(new Event("blur"));
  expect(shown(made)).toBeNull();
  fake.dispatchEvent(new Event("focus"));
  expect(shown(made)).toBeNull();
  vi.advanceTimersByTime(0);
  expect(shown(made)).toEqual(["anna"]);
});

test("a_composition_closes_the_list_until_it_ends", () => {
  const made = mentions();
  type("@an");
  fake.dispatchEvent(new Event("compositionstart"));
  expect(shown(made)).toBeNull();
  type("@anb");
  expect(shown(made)).toBeNull();
  type("@an", 3, "compositionend");
  expect(shown(made)).toEqual(["anna"]);
});

test("a_scroll_measures_the_open_word_again", async () => {
  const made = mentions();
  type("@an");
  await nextTick();
  caret.box = { left: 4, top: -20, bottom: 0 };
  fake.dispatchEvent(new Event("scroll"));
  expect(made.anchor.value?.caret).toEqual({ left: 4, top: -20, bottom: 0 });
  caret.box = { left: 4, top: 0, bottom: 20 };
});
