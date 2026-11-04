import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";

import {
  createFixtureCompareSource,
  log,
  type MergeRequestSource,
  type SourceResult,
} from "../ipc";
import { createMergeRequests } from "./mergeRequests";
import { registerMergeRequests } from "./mergeRequestsStore";
import MergeRequestsView from "./MergeRequestsView.vue";
import type { Screen } from "./screen";

vi.mock("./tooltip", () => ({
  vTooltip: {
    getSSRProps: ({ value }: { value: string | null }) => ({ "data-tooltip": value }),
  },
}));

const DISABLED = /^<button [^>]*\sdisabled[\s>]/u;

beforeEach(() => {
  const document = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { document }));
  vi.useFakeTimers();
  vi.spyOn(log, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function refreshButton(): Promise<string> {
  const html = await renderToString(
    createSSRApp({ render: () => h(MergeRequestsView, { asking: false }) }),
  );
  return /<button [^>]*data-refreshes-list[^]*?<\/button>/u.exec(html)?.[0] ?? "no Refresh button";
}

test("refresh_shows_loading_at_the_press_while_the_ask_is_held", async () => {
  const fixture = createFixtureCompareSource(log, "?mr=empty", {});
  const asks: ((result: SourceResult<null>) => void)[] = [];
  let lists = 0;
  const source: MergeRequestSource = {
    ...fixture,
    askGitLabAgain: () =>
      new Promise((resolve) => {
        asks.push(resolve);
      }),
    listMergeRequests: (onPage, onChecked) => {
      lists += 1;
      return fixture.listMergeRequests(onPage, onChecked);
    },
  };
  const slice = createMergeRequests({
    source,
    screen: shallowRef<Screen>({ kind: "files" }),
    report: () => undefined,
    discussionDetails: () => "lazy",
  });
  registerMergeRequests(slice);
  slice.show();
  await vi.advanceTimersByTimeAsync(0);
  const idle = await refreshButton();
  expect(idle).not.toMatch(DISABLED);
  expect(idle).not.toContain("animate-spin");

  const refreshing = slice.refresh();
  const pressed = await refreshButton();
  expect(pressed).toMatch(DISABLED);
  expect(pressed).toContain("animate-spin");
  await vi.advanceTimersByTimeAsync(0);
  expect(await refreshButton()).toContain("animate-spin");
  expect(lists).toBe(1);

  asks[0]?.({ ok: true, value: null });
  await refreshing;
  expect(lists).toBe(2);
  expect(await refreshButton()).not.toContain("animate-spin");
});
