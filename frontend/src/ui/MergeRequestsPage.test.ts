import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h, shallowRef, type ShallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  createFixtureCompareSource,
  isDiscussionId,
  isMergeRequestIid,
  log,
  type DiscussionId,
  type MergeRequestIid,
} from "../ipc";
import { createMergeRequests, type MergeRequests } from "./mergeRequests";
import { registerMergeRequests } from "./mergeRequestsStore";
import MergeRequestsView from "./MergeRequestsView.vue";
import type { Screen } from "./screen";

vi.mock("./tooltip", () => ({
  vTooltip: {
    getSSRProps: ({ value }: { value: string | null }) => ({ "data-tooltip": value }),
  },
}));
/** The page's filter menu, held by the test: SSR renders no opener to point at. */
const menu = vi.hoisted(() => {
  const openFor: { value: string | null } = { value: null };
  return { openFor, dismissed: 0 };
});
vi.mock("./useHoverMenu", () => ({
  useHoverMenu: () => ({
    openFor: menu.openFor,
    above: false,
    pointerEntered: () => undefined,
    pointerLeft: () => undefined,
    openerClicked: async () => undefined,
    menuKey: () => undefined,
    dismiss: async () => {
      menu.dismissed += 1;
      menu.openFor.value = null;
    },
    close: async () => {
      menu.openFor.value = null;
    },
  }),
}));

const PAUSE_MS = 400;
const THREADS = 637;

class FakeKeyboardEvent extends Event {
  readonly key: string;

  constructor(key: string) {
    super("keydown", { cancelable: true });
    this.key = key;
  }
}

let screen: ShallowRef<Screen>;
let slice: MergeRequests;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.useFakeTimers();
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  menu.openFor.value = null;
  menu.dismissed = 0;
  screen = shallowRef<Screen>({ kind: "files" });
  slice = createMergeRequests({
    source: createFixtureCompareSource(log, "?mr=list", {}),
    screen,
    report: () => undefined,
    discussionDetails: () => "lazy",
  });
  registerMergeRequests(slice);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function d(serial: number): DiscussionId {
  const id = String(serial).padStart(40, "0");
  if (!isDiscussionId(id)) {
    throw new Error(`${id} is not a discussion id`);
  }
  return id;
}

/** The page's window `keydown` listener, taken from its registration: Vue's SSR runs `useEventListener`'s
 *  immediate watch once and stops it before the render ends (runtime-core `doWatch`, `isInSSRComponentSetup`),
 *  so a dispatch on the window would reach nothing. The page registers before any child. */
async function pageKeys(asking: boolean): Promise<(event: Event) => void> {
  const added = vi.spyOn(window, "addEventListener");
  slice.show();
  await vi.advanceTimersByTimeAsync(0);
  await renderToString(createSSRApp({ render: () => h(MergeRequestsView, { asking }) }));
  const listener = added.mock.calls.find(([type]) => type === "keydown")?.[1];
  if (typeof listener !== "function") {
    throw new Error("the page listens to no keydown");
  }
  return listener;
}

/** An Escape reaching the page's listener; `taken`: a box or a field took it first. */
function escape(keys: (event: Event) => void, taken = false): FakeKeyboardEvent {
  const event = new FakeKeyboardEvent("Escape");
  if (taken) {
    event.preventDefault();
  }
  keys(event);
  return event;
}

test("escape_never_leaves_the_page", async () => {
  const keys = await pageKeys(false);
  const onBack = escape(keys);
  const onBody = escape(keys);
  const closingBox = escape(keys, true);
  const afterBox = escape(keys);
  await slice.refresh();
  slice.showThread(iid(THREADS), d(1));
  await vi.advanceTimersByTimeAsync(PAUSE_MS);
  slice.closeThread();
  const afterThread = escape(keys);

  expect(
    [onBack, onBody, closingBox, afterBox, afterThread].map((event) => event.defaultPrevented),
  ).toEqual([false, false, true, false, false]);
  expect([screen.value.kind, menu.dismissed]).toEqual(["mergeRequests", 0]);
});

test("escape_still_closes_an_open_filter_menu", async () => {
  const keys = await pageKeys(false);
  menu.openFor.value = "assignee";
  const closing = escape(keys);
  expect([closing.defaultPrevented, menu.dismissed, menu.openFor.value]).toEqual([true, 1, null]);
  const after = escape(keys);
  expect([after.defaultPrevented, menu.dismissed]).toEqual([false, 1]);

  menu.openFor.value = "review";
  const taken = escape(keys, true);
  expect([taken.defaultPrevented, menu.dismissed, menu.openFor.value]).toEqual([true, 1, "review"]);
  const other = new FakeKeyboardEvent("Enter");
  keys(other);
  expect([other.defaultPrevented, menu.dismissed, screen.value.kind]).toEqual([
    false,
    1,
    "mergeRequests",
  ]);
});

test("escape_with_a_question_open_is_the_questions", async () => {
  const keys = await pageKeys(true);
  menu.openFor.value = "label";
  const pressed = escape(keys);
  expect([pressed.defaultPrevented, menu.dismissed, menu.openFor.value]).toEqual([
    false,
    0,
    "label",
  ]);
});
