import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { ClipboardSelection } from "../ipc";
import { takeLinuxPastes } from "./linuxPaste";

class FakeNode extends EventTarget {
  isConnected = true;
}

class FakeInput extends FakeNode {}

class FakeTextArea extends FakeNode {}

class FakeDataTransfer {
  readonly #data = new Map<string, string>();

  setData(format: string, text: string): void {
    page.written.push([format, text]);
    this.#data.set(format, text);
  }

  getData(format: string): string {
    return this.#data.get(format) ?? "";
  }
}

class FakeClipboardEvent extends Event {
  readonly clipboardData: unknown;

  constructor(type: string, init: EventInit & { clipboardData?: unknown }) {
    super(type, init);
    this.clipboardData = init.clipboardData ?? null;
  }
}

type Heard = {
  readonly type: string;
  readonly listener: (event: unknown) => void;
  options: unknown;
};

type Answer = { resolve: (text: string | null) => void; reject: (error: unknown) => void };

type Focus = { activeElement: FakeNode | null };

const body = new FakeNode();
const editor = new FakeNode();
const line = new FakeNode();

const noFocus: Focus = { activeElement: null };

const page = {
  heard: new Array<Heard>(),
  tasks: new Array<() => void>(),
  written: new Array<[string, string]>(),
  inserted: new Array<unknown[]>(),
  reads: new Array<ClipboardSelection>(),
  answers: new Array<Answer>(),
  document: noFocus,
};

beforeEach(() => {
  page.heard = [];
  page.tasks = [];
  page.written = [];
  page.inserted = [];
  page.reads = [];
  page.answers = [];
  page.document = { activeElement: body };
  vi.stubGlobal("Node", FakeNode);
  vi.stubGlobal("HTMLInputElement", FakeInput);
  vi.stubGlobal("HTMLTextAreaElement", FakeTextArea);
  vi.stubGlobal("ClipboardEvent", FakeClipboardEvent);
  vi.stubGlobal("DataTransfer", FakeDataTransfer);
  vi.stubGlobal("window", {
    document: {
      body,
      get activeElement() {
        return page.document.activeElement;
      },
      execCommand: (...args: unknown[]) => page.inserted.push(args),
    },
    addEventListener: (type: string, listener: (event: unknown) => void, options: unknown) => {
      page.heard.push({ type, listener, options });
    },
    setTimeout: (task: () => void) => page.tasks.push(task),
  });
  takeLinuxPastes(window, (selection) => {
    page.reads.push(selection);
    return new Promise((resolve, reject) => {
      page.answers.push({ resolve, reject });
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function heard(type: string): Heard {
  const found = page.heard.find((entry) => entry.type === type);
  if (found === undefined) {
    throw new Error(`no ${type} listener`);
  }
  return found;
}

function paste(target: FakeNode, isTrusted = true) {
  const event = {
    isTrusted,
    target,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    get clipboardData(): never {
      throw new Error("the paste's own data was read");
    },
  };
  heard("paste").listener(event);
  return event;
}

function release(button: number): void {
  heard("mouseup").listener({ button });
}

async function answer(text: string | null): Promise<void> {
  const last = page.answers.at(-1);
  if (last === undefined) {
    throw new Error("nothing was read");
  }
  last.resolve(text);
  await Promise.resolve();
}

function dispatchedOn(target: FakeNode, handled: boolean): Event[] {
  const events: Event[] = [];
  target.addEventListener("paste", (event) => {
    events.push(event);
    if (handled) {
      event.preventDefault();
    }
  });
  return events;
}

function textOf(event: Event | undefined): string | undefined {
  return event instanceof FakeClipboardEvent && event.clipboardData instanceof FakeDataTransfer
    ? event.clipboardData.getData("text/plain")
    : undefined;
}

test("both listeners are on the window in the capture phase", () => {
  expect(page.heard.map(({ type, options }) => ({ type, options }))).toEqual([
    { type: "mouseup", options: { capture: true, passive: true } },
    { type: "paste", options: { capture: true } },
  ]);
});

test("a trusted paste is cancelled and stopped without its data being read, then the clipboard is read", () => {
  const event = paste(editor);

  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  expect(page.reads).toEqual(["clipboard"]);
});

test("an untrusted paste, the window's own, passes untouched and reads nothing", () => {
  const event = paste(editor, false);

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
  expect(page.reads).toEqual([]);
});

test("a paste in the middle button's release task reads the selection; the next task's reads the clipboard", () => {
  release(1);
  paste(editor);
  for (const task of page.tasks.splice(0)) {
    task();
  }
  paste(editor);

  expect(page.reads).toEqual(["primary", "clipboard"]);
});

test.each([0, 2])("a release of button %i leaves the clipboard", (button) => {
  release(button);
  paste(editor);

  expect(page.reads).toEqual(["clipboard"]);
});

test("the text is pasted again on the still focused target, bubbling and cancelable, as text/plain", async () => {
  page.document.activeElement = editor;
  const events = dispatchedOn(line, true);
  const onEditor = dispatchedOn(editor, false);
  paste(line);
  await answer("one\ntwo\nthree");

  expect(events).toHaveLength(1);
  expect(events[0]).toBeInstanceOf(FakeClipboardEvent);
  expect(events[0]).toMatchObject({ type: "paste", bubbles: true, cancelable: true });
  expect(textOf(events[0])).toBe("one\ntwo\nthree");
  expect(onEditor).toEqual([]);
  expect(page.inserted).toEqual([]);
});

test.each([
  ["an input", new FakeInput()],
  ["a textarea", new FakeTextArea()],
])("%s nobody handled gets the text typed in", async (_name, field) => {
  page.document.activeElement = field;
  const events = dispatchedOn(field, false);
  paste(field);
  await answer("name");

  expect(events).toHaveLength(1);
  expect(page.inserted).toEqual([["insertText", false, "name"]]);
});

test("a field that handled the paste, or an element that is no field, gets nothing typed", async () => {
  const field = new FakeInput();
  page.document.activeElement = field;
  dispatchedOn(field, true);
  paste(field);
  await answer("name");
  page.document.activeElement = editor;
  dispatchedOn(editor, false);
  paste(editor);
  await answer("text");

  expect(page.written).toEqual([
    ["text/plain", "name"],
    ["text/plain", "text"],
  ]);
  expect(page.inserted).toEqual([]);
});

test.each([null, ""])("an answer of %j pastes nothing", async (text) => {
  page.document.activeElement = editor;
  const events = dispatchedOn(editor, false);
  paste(editor);
  await answer(text);

  expect(events).toEqual([]);
  expect(page.written).toEqual([]);
});

test("a target that lost the focus to another element before the answer gets nothing", async () => {
  const field = new FakeInput();
  page.document.activeElement = field;
  const events = dispatchedOn(field, false);
  const onEditor = dispatchedOn(editor, false);
  paste(field);
  page.document.activeElement = editor;
  await answer("late");

  expect(events).toEqual([]);
  expect(onEditor).toEqual([]);
  expect(page.inserted).toEqual([]);
});

test.each([
  ["the body", body],
  ["nothing", null],
])("focus moved to %s before the answer pastes nothing", async (_name, focus) => {
  page.document.activeElement = editor;
  const events = dispatchedOn(line, false);
  const onEditor = dispatchedOn(editor, false);
  paste(line);
  page.document.activeElement = focus;
  await answer("late");

  expect(events).toEqual([]);
  expect(onEditor).toEqual([]);
  expect(page.written).toEqual([]);
});

test("a paste while the body has the focus pastes nothing", async () => {
  const onBody = dispatchedOn(body, false);
  paste(body);
  await answer("text");

  expect(onBody).toEqual([]);
  expect(page.written).toEqual([]);
});

test("a target removed from the page before the answer has the paste go to the still focused editor", async () => {
  const span = new FakeNode();
  page.document.activeElement = editor;
  const onSpan = dispatchedOn(span, false);
  const onEditor = dispatchedOn(editor, true);
  paste(span);
  span.isConnected = false;
  await answer("one\ntwo");

  expect(onSpan).toEqual([]);
  expect(onEditor).toHaveLength(1);
  expect(textOf(onEditor[0])).toBe("one\ntwo");
  expect(page.inserted).toEqual([]);
});

test("a target removed from the page before the answer has the text typed into the still focused field", async () => {
  const field = new FakeTextArea();
  const inner = new FakeNode();
  page.document.activeElement = field;
  const onField = dispatchedOn(field, false);
  paste(inner);
  inner.isConnected = false;
  await answer("name");

  expect(onField).toHaveLength(1);
  expect(textOf(onField[0])).toBe("name");
  expect(page.inserted).toEqual([["insertText", false, "name"]]);
});

test("a failed read pastes nothing", async () => {
  page.document.activeElement = editor;
  const events = dispatchedOn(editor, false);
  paste(editor);
  page.answers.at(-1)?.reject(new Error("command missing"));
  await Promise.resolve();

  expect(events).toEqual([]);
});
