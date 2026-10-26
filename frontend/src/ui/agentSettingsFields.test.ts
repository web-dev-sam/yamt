import { expect, test } from "vitest";

import { DEFAULT_FIRST_MESSAGE } from "../agent";
import type { AgentSettings } from "../ipc";
import {
  commandField,
  firstMessageField,
  PLACEHOLDER_NAMES,
  unknownPlaceholderLines,
  YOLO_NOTE,
} from "./agentSettingsFields";

const DEFAULTS: AgentSettings = { command: null, firstMessage: null };
const OWN: AgentSettings = { command: ["/opt/omp", "acp"], firstMessage: "Hi {{ MESSAGE }}" };

test("the command field shows the default words until the file names its own", () => {
  expect(commandField(DEFAULTS, "").shown).toBe("omp acp");
  expect(commandField(OWN, "").shown).toBe("/opt/omp acp");
});

test("Use stores the typed words split on spaces and keeps the first message", () => {
  expect(commandField(DEFAULTS, "  bunx  omp acp ").use).toEqual({
    command: ["bunx", "omp", "acp"],
    firstMessage: null,
  });
  expect(commandField(OWN, "omp").use).toEqual({
    command: ["omp"],
    firstMessage: OWN.firstMessage,
  });
});

test("Use of the default's words stores null, so a later default still reaches the user", () => {
  expect(commandField(OWN, "omp  acp").use).toEqual({ ...OWN, command: null });
});

test("Use is off for the words in use and for no words", () => {
  expect(commandField(DEFAULTS, "omp acp").use).toBeNull();
  expect(commandField(OWN, "/opt/omp acp").use).toBeNull();
  expect(commandField(OWN, "   ").use).toBeNull();
});

test("Default stores null and is off while the default is in use", () => {
  expect(commandField(OWN, "x").reset).toEqual({ ...OWN, command: null });
  expect(commandField(DEFAULTS, "x").reset).toBeNull();
  expect(firstMessageField(OWN, "x").reset).toEqual({ ...OWN, firstMessage: null });
  expect(firstMessageField(DEFAULTS, "x").reset).toBeNull();
});

test("the first message field shows the default text, stores typed text as typed and the default as null", () => {
  expect(firstMessageField(DEFAULTS, "").shown).toBe(DEFAULT_FIRST_MESSAGE);
  expect(firstMessageField(OWN, "").shown).toBe("Hi {{ MESSAGE }}");
  expect(firstMessageField(DEFAULTS, " Look at {{ MESSAGE }}\n").use).toEqual({
    command: null,
    firstMessage: " Look at {{ MESSAGE }}\n",
  });
  expect(firstMessageField(OWN, DEFAULT_FIRST_MESSAGE).use).toEqual({ ...OWN, firstMessage: null });
  expect(firstMessageField(OWN, "Hi {{ MESSAGE }}").use).toBeNull();
  expect(firstMessageField(DEFAULTS, DEFAULT_FIRST_MESSAGE).use).toBeNull();
});

test("each unknown placeholder is named once as typed; known ones are not", () => {
  expect(unknownPlaceholderLines("{{ FOO }} {{MESSAGE}} {{BAR}} {{ FOO }}")).toEqual([
    "{{ FOO }} is not a placeholder; it is sent as typed.",
    "{{BAR}} is not a placeholder; it is sent as typed.",
  ]);
  expect(unknownPlaceholderLines(DEFAULT_FIRST_MESSAGE)).toEqual([]);
});

test("the five placeholders are listed as they are written", () => {
  expect(PLACEHOLDER_NAMES).toEqual([
    "{{ RELATIVE_FILE_PATH_WITH_LINE }}",
    "{{ MESSAGE }}",
    "{{ RANGE }}",
    "{{ OLD_COMMIT }}",
    "{{ NEW_COMMIT }}",
  ]);
});

test("the yolo note says what yamt allows and that omp's yolo mode asks nothing", () => {
  expect(YOLO_NOTE).toBe(
    "yamt allows the AI's commands, and its deletes and moves only inside its checkout. With omp's approval mode set to yolo, omp asks yamt nothing about deletes and moves, so they are allowed anywhere.",
  );
});
