import { expect, test } from "vitest";

import type { Person } from "../ipc";
import {
  highlightAfter,
  MENTION_CLOSED,
  mentionKey,
  mentionList,
  mentionOptionId,
  mentionPlace,
  mentionPick,
  mentionRead,
  mentionStep,
  type FieldText,
  type MentionAnchor,
  type MentionCall,
  type MentionEvent,
  type MentionInput,
  type MentionLine,
  type MentionList,
  type MentionState,
} from "./mergeRequestMentionLines";
import type { PeopleSearch } from "./mergeRequests";
import { peopleSearchText } from "./mergeRequestsText";

const PLATFORM = "Linux x86_64";
const SAM: Person = { username: "sam", name: "Sam Weller", picture: null };
const ANNA: Person = { username: "anna", name: "Anna Berg", picture: "yamt-picture://anna" };
const BEN: Person = { username: "ben", name: "Ben Okafor", picture: null };
const DANA: Person = { username: "dana", name: "", picture: null };
const ERIK: Person = { username: "erik", name: "Erik Lund", picture: null };
const RANA: Person = { username: "rana", name: "Rana Ali", picture: null };

const EMPTY: PeopleSearch = { kind: "empty" };
const KEYS = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false };

function input(change: Partial<MentionInput>): MentionInput {
  return { known: [SAM, ANNA, BEN], typed: "", search: EMPTY, platform: PLATFORM, ...change };
}

function usernames(list: MentionList | null): readonly string[] | null {
  return list === null ? null : list.lines.map((line) => line.username);
}

function line(person: Person): MentionLine {
  return { username: person.username, picture: person, label: person.name };
}

function key(name: string, change: Partial<typeof KEYS> = {}): Parameters<typeof mentionKey>[0] {
  return { key: name, ...KEYS, ...change };
}

const OPEN: MentionList = { lines: [line(SAM), line(ANNA)], note: null };
const NOTE_ONLY: MentionList = { lines: [], note: "glab is missing" };

test("known_people_show_at_once_and_search_results_follow", () => {
  const bare = mentionList(input({}));
  expect(bare).toEqual({ lines: [line(SAM), line(ANNA), line(BEN)], note: null });
  expect(bare?.lines[1]?.picture).toBe(ANNA);

  expect(usernames(mentionList(input({ typed: "an" })))).toEqual(["anna"]);
  const found: PeopleSearch = { kind: "found", text: "an", people: [ERIK, RANA, ANNA] };
  expect(usernames(mentionList(input({ typed: "an", search: found })))).toEqual(["anna", "rana"]);
  const searching: PeopleSearch = { kind: "searching", text: "an", people: [RANA] };
  expect(usernames(mentionList(input({ typed: "an", search: searching })))).toEqual([
    "anna",
    "rana",
  ]);

  expect(mentionList(input({ known: [DANA], typed: "da" }))?.lines).toEqual([
    { username: "dana", picture: DANA, label: "dana" },
  ]);
});

test("a_refused_or_failed_search_keeps_the_known_people_with_the_people_box_words", () => {
  const refused = {
    kind: "refused",
    text: "an",
    reply: { kind: "glabMissing" },
  } as const satisfies PeopleSearch;
  expect(mentionList(input({ typed: "an", search: refused }))).toEqual({
    lines: [line(ANNA)],
    note: peopleSearchText(refused, PLATFORM),
  });
  const failed = {
    kind: "failed",
    text: "an",
    cause: { kind: "WorkerStopped" },
  } as const satisfies PeopleSearch;
  expect(mentionList(input({ typed: "an", search: failed }))).toEqual({
    lines: [line(ANNA)],
    note: "Could not search people: yamt's worker stopped; try again.",
  });
  expect(mentionList(input({ typed: "zz", search: failed }))).toEqual({
    lines: [],
    note: "Could not search people: yamt's worker stopped; try again.",
  });
});

test("nothing_to_show_closes_the_list", () => {
  expect(mentionList(input({ typed: "zz" }))).toBeNull();
  expect(mentionList(input({ known: [] }))).toBeNull();
  const searching: PeopleSearch = { kind: "searching", text: "zz", people: [] };
  expect(mentionList(input({ typed: "zz", search: searching }))).toBeNull();
  const nobody: PeopleSearch = { kind: "found", text: "zz", people: [] };
  expect(mentionList(input({ typed: "zz", search: nobody }))).toBeNull();
});

test("a_composition_never_opens_the_list", () => {
  const read = { text: "@an", selectionStart: 3, selectionEnd: 3 };
  expect(mentionRead({ ...read, composing: true }, null)).toBeNull();
  expect(mentionRead({ ...read, composing: false }, null)).toEqual({
    start: 0,
    end: 3,
    typed: "an",
  });
  expect(mentionKey(key("Enter", { isComposing: true }), OPEN)).toBeNull();
});

test("a_selection_opens_no_list", () => {
  expect(
    mentionRead({ text: "@anna", selectionStart: 1, selectionEnd: 3, composing: false }, null),
  ).toBeNull();
});

test("a_dismissed_word_stays_closed_until_another_word_starts", () => {
  const text = "hi @an @be";
  expect(mentionRead({ text, selectionStart: 6, selectionEnd: 6, composing: false }, 3)).toBeNull();
  expect(mentionRead({ text, selectionStart: 5, selectionEnd: 5, composing: false }, 3)).toBeNull();
  expect(mentionRead({ text, selectionStart: 10, selectionEnd: 10, composing: false }, 3)).toEqual({
    start: 7,
    end: 10,
    typed: "be",
  });
  expect(mentionRead({ text, selectionStart: 6, selectionEnd: 6, composing: false }, 7)).toEqual({
    start: 3,
    end: 6,
    typed: "an",
  });
  expect(mentionRead({ text, selectionStart: 2, selectionEnd: 2, composing: false }, 3)).toBeNull();
});

function field(text: string, caret = text.length): FieldText {
  return { text, selectionStart: caret, selectionEnd: caret };
}

function callName(call: MentionCall): string {
  return call.kind === "search" ? `search ${call.typed}` : call.kind;
}

function steps(
  events: readonly MentionEvent[],
  from: MentionState = MENTION_CLOSED,
): { readonly state: MentionState; readonly calls: readonly string[] } {
  let state = from;
  const calls: string[] = [];
  for (const event of events) {
    const step = mentionStep(state, event);
    state = step.state;
    calls.push(callName(step.call));
  }
  return { state, calls };
}

test("a_send_forgets_its_dismissal_once_the_field_shows_another_text", () => {
  const sent = steps([
    { kind: "read", field: field("@an") },
    { kind: "close", field: field("@an") },
    { kind: "read", field: field("@an") },
  ]);
  expect(sent.calls).toEqual(["search an", "end", "none"]);
  expect(sent.state).toEqual({
    word: null,
    dismissed: { kind: "close", start: 0, text: "@an" },
    composing: false,
  });
  const next = steps([{ kind: "read", field: field("@") }], sent.state);
  expect(next.calls).toEqual(["search "]);
  expect(next.state).toEqual({
    word: { start: 0, end: 1, typed: "" },
    dismissed: null,
    composing: false,
  });
  expect(steps([{ kind: "read", field: field("@ann") }], sent.state).calls).toEqual(["search ann"]);
  expect(steps([{ kind: "read", field: field("@an", 0) }], sent.state).state.dismissed).toBeNull();
});

test("escape_keeps_its_word_closed_while_typing_in_it", () => {
  const escaped = steps([
    { kind: "read", field: field("hi @an @be", 6) },
    { kind: "escape" },
    { kind: "read", field: field("hi @ann @be", 7) },
  ]);
  expect(escaped.calls).toEqual(["search an", "end", "none"]);
  expect(escaped.state).toEqual({
    word: null,
    dismissed: { kind: "escape", start: 3 },
    composing: false,
  });
  expect(
    steps(
      [
        { kind: "read", field: field("hi @ann @be") },
        { kind: "read", field: field("hi @ann @be", 7) },
      ],
      escaped.state,
    ).calls,
  ).toEqual(["search be", "search ann"]);
  expect(mentionStep(MENTION_CLOSED, { kind: "escape" })).toEqual({
    state: MENTION_CLOSED,
    call: { kind: "none" },
  });
});

test("a_close_outside_a_word_dismisses_nothing", () => {
  expect(steps([{ kind: "close", field: field("hello") }]).state).toEqual(MENTION_CLOSED);
  const composing = steps([
    { kind: "compose", composing: true, field: field("@an") },
    { kind: "close", field: field("@an") },
  ]).state;
  expect(composing).toEqual({ word: null, dismissed: null, composing: true });
});

test("the_search_is_asked_once_per_open_word", () => {
  expect(
    steps([
      { kind: "read", field: field("@an @an", 3) },
      { kind: "read", field: field("@an @an", 3) },
      { kind: "read", field: field("@an @an", 3) },
      { kind: "read", field: field("@an @an", 2) },
      { kind: "read", field: field("@an @an", 3) },
      { kind: "read", field: field("@an @an", 7) },
    ]).calls,
  ).toEqual(["search an", "none", "none", "search a", "search an", "search an"]);
});

test("a_closing_word_ends_the_search_once", () => {
  expect(
    steps([
      { kind: "read", field: field("@an") },
      { kind: "read", field: field("@an x") },
      { kind: "read", field: field("@an x") },
      { kind: "read", field: field("@an") },
      { kind: "blur" },
      { kind: "blur" },
    ]).calls,
  ).toEqual(["search an", "end", "none", "search an", "end", "none"]);
});

test("a_composition_closes_the_word_and_its_end_reads_again", () => {
  const composed = steps([
    { kind: "read", field: field("@an") },
    { kind: "compose", composing: true, field: field("@an") },
    { kind: "read", field: field("@anb") },
  ]);
  expect(composed.calls).toEqual(["search an", "end", "none"]);
  expect(composed.state).toEqual({ word: null, dismissed: null, composing: true });
  const ended = steps(
    [
      { kind: "compose", composing: false, field: field("@anb") },
      { kind: "read", field: field("@anbc") },
    ],
    composed.state,
  );
  expect(ended.calls).toEqual(["search anb", "search anbc"]);
  expect(ended.state.composing).toBe(false);
});

test("a_pick_writes_an_existing_line_over_the_open_word", () => {
  const word = { start: 3, end: 6, typed: "an" };
  expect(mentionPick(word, OPEN, 1)).toEqual({ from: 3, to: 6, insert: "@anna " });
  expect(mentionPick(word, OPEN, 2)).toBeNull();
  expect(mentionPick(word, null, 0)).toBeNull();
  expect(mentionPick(null, OPEN, 0)).toBeNull();
});

test("an_open_list_takes_escape_enter_tab_and_arrows_only", () => {
  expect(mentionKey(key("Escape"), OPEN)).toEqual({ kind: "close" });
  expect(mentionKey(key("ArrowDown"), OPEN)).toEqual({ kind: "step", step: 1 });
  expect(mentionKey(key("ArrowUp"), OPEN)).toEqual({ kind: "step", step: -1 });
  expect(mentionKey(key("Enter"), OPEN)).toEqual({ kind: "pick" });
  expect(mentionKey(key("Tab"), OPEN)).toEqual({ kind: "pick" });
  expect(mentionKey(key("a"), OPEN)).toBeNull();
  expect(mentionKey(key("Home"), OPEN)).toBeNull();

  expect(mentionKey(key("Enter", { ctrlKey: true }), OPEN)).toBeNull();
  expect(mentionKey(key("Enter", { metaKey: true }), OPEN)).toBeNull();
  expect(mentionKey(key("Enter", { shiftKey: true }), OPEN)).toBeNull();
  expect(mentionKey(key("Tab", { shiftKey: true }), OPEN)).toBeNull();
  expect(mentionKey(key("ArrowDown", { altKey: true }), OPEN)).toBeNull();
  expect(mentionKey(key("Escape", { isComposing: true }), OPEN)).toBeNull();

  expect(mentionKey(key("Enter"), NOTE_ONLY)).toBeNull();
  expect(mentionKey(key("Tab"), NOTE_ONLY)).toBeNull();
  expect(mentionKey(key("ArrowDown"), NOTE_ONLY)).toBeNull();
  expect(mentionKey(key("Escape"), NOTE_ONLY)).toEqual({ kind: "close" });

  expect(mentionKey(key("Escape"), null)).toBeNull();
  expect(mentionKey(key("Enter"), null)).toBeNull();
});

test("the_highlight_stays_while_the_people_stay_and_resets_otherwise", () => {
  const two = [line(SAM), line(ANNA)];
  expect(highlightAfter(two, [line(SAM), line(ANNA)], 1)).toBe(1);
  expect(highlightAfter(two, [line(SAM), line(BEN)], 1)).toBe(0);
  expect(highlightAfter(two, [line(SAM)], 1)).toBe(0);
  expect(highlightAfter(two, [...two, line(BEN)], 1)).toBe(0);
  expect(highlightAfter([], two, 1)).toBe(0);
  const ab = { ...SAM, username: "ab" };
  const c = { ...SAM, username: "c" };
  const a = { ...SAM, username: "a" };
  const bc = { ...SAM, username: "bc" };
  expect(highlightAfter([line(ab), line(c)], [line(a), line(bc)], 1)).toBe(0);
  expect(mentionOptionId("v-3", 2)).toBe("v-3-2");
});

const CARET = { left: 40, top: 20, bottom: 40 };
const FIELD = { left: 100, top: 500, right: 400, bottom: 600 };

function anchor(room: Partial<MentionAnchor["room"]>): MentionAnchor {
  return {
    caret: CARET,
    field: FIELD,
    room: { left: 0, top: 0, right: 1000, bottom: 1000, ...room },
  };
}

test("the_list_sits_below_the_caret_when_it_fits", () => {
  expect(mentionPlace(anchor({}), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: 40,
    maxHeight: 460,
  });
  expect(mentionPlace(anchor({ bottom: 840 }), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: 40,
    maxHeight: 300,
  });
});

test("the_list_flips_above_when_there_is_no_room_below", () => {
  expect(mentionPlace(anchor({ bottom: 839 }), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: -280,
    maxHeight: 520,
  });
  expect(mentionPlace(anchor({ top: 220, bottom: 600 }), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: -280,
    maxHeight: 300,
  });
});

test("the_list_takes_the_larger_side_and_scrolls_when_neither_fits", () => {
  expect(mentionPlace(anchor({ top: 300, bottom: 700 }), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: -200,
    maxHeight: 220,
  });
  expect(mentionPlace(anchor({ top: 400, bottom: 800 }), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: 40,
    maxHeight: 260,
  });
  expect(mentionPlace(anchor({ top: 360, bottom: 700 }), { width: 200, height: 300 })).toEqual({
    left: 40,
    top: 40,
    maxHeight: 160,
  });
});

test("the_list_moves_left_to_stay_inside_the_room", () => {
  expect(mentionPlace(anchor({ right: 340 }), { width: 200, height: 100 }).left).toBe(40);
  expect(mentionPlace(anchor({ right: 300 }), { width: 200, height: 100 }).left).toBe(0);
  expect(mentionPlace(anchor({ left: 90, right: 280 }), { width: 200, height: 100 }).left).toBe(
    -10,
  );
  expect(mentionPlace(anchor({ left: 120, right: 250 }), { width: 200, height: 100 }).left).toBe(
    20,
  );
});
