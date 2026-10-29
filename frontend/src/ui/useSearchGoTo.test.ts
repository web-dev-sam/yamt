import { expect, test } from "vitest";
import { effectScope, nextTick, shallowRef, watch, type ShallowRef } from "vue";

import type { GoToRequest } from "./searching";
import { useSearchGoTo } from "./useSearchGoTo";

type Pane = "left" | "right";

const HIT = { line: 2, from: 1, to: 4 };

type GoToView = {
  readonly goTo: ShallowRef<GoToRequest<Pane> | null>;
  readonly shown: ShallowRef<boolean>;
  readonly path: ShallowRef<string>;
  readonly calls: string[];
  readonly stop: () => void;
};

function hitRequest(id: number, path: string): GoToRequest<Pane> {
  return { id, path, pane: "right", match: HIT };
}

function goToView(start: {
  request: GoToRequest<Pane> | null;
  shown: boolean;
  path: string;
}): GoToView {
  const goTo = shallowRef(start.request);
  const shown = shallowRef(start.shown);
  const path = shallowRef(start.path);
  const calls: string[] = [];
  const scope = effectScope();
  scope.run(() => {
    useSearchGoTo<Pane>(
      {
        goTo,
        took: (id) => {
          calls.push(`took ${id}`);
          if (goTo.value?.id === id) {
            goTo.value = null;
          }
        },
      },
      shown,
      () => path.value,
      (target) => {
        calls.push(`goTo ${target.pane} ${JSON.stringify(target.match)}`);
      },
    );
  });
  return { goTo, shown, path, calls, stop: () => scope.stop() };
}

test("useSearchGoTo: a request for the shown view's file at its start goes there and is taken", async () => {
  const view = goToView({ request: hitRequest(1, "a.ts"), shown: true, path: "a.ts" });
  await nextTick();

  expect(view.calls).toEqual([`goTo right ${JSON.stringify(HIT)}`, "took 1"]);
  expect(view.goTo.value).toBeNull();
});

test("useSearchGoTo: a hidden view waits for its show; another file's view and no request do nothing", async () => {
  const hidden = goToView({ request: hitRequest(1, "a.ts"), shown: false, path: "a.ts" });
  const other = goToView({ request: hitRequest(1, "a.ts"), shown: true, path: "b.ts" });
  const none = goToView({ request: null, shown: true, path: "a.ts" });
  await nextTick();
  expect([hidden.calls, other.calls, none.calls]).toEqual([[], [], []]);

  hidden.shown.value = true;
  await nextTick();
  expect(hidden.calls).toEqual([`goTo right ${JSON.stringify(HIT)}`, "took 1"]);
});

test("useSearchGoTo: a later request, or the view's path becoming the request's, goes there; a keyboard-only one passes no match", async () => {
  const view = goToView({ request: null, shown: true, path: "a.ts" });
  view.goTo.value = { id: 2, path: "a.ts", pane: "left", match: null };
  await nextTick();
  expect(view.calls).toEqual(["goTo left null", "took 2"]);

  const renamed = goToView({ request: hitRequest(3, "b.ts"), shown: true, path: "a.ts" });
  renamed.path.value = "b.ts";
  await nextTick();
  expect(renamed.calls).toEqual([`goTo right ${JSON.stringify(HIT)}`, "took 3"]);
});

test("useSearchGoTo: a view whose scope ended takes nothing", async () => {
  const view = goToView({ request: null, shown: true, path: "a.ts" });
  view.stop();
  view.goTo.value = hitRequest(4, "a.ts");
  await nextTick();

  expect(view.calls).toEqual([]);
});

test("useSearchGoTo acts after the render: a watcher on the page's render that was set up first sees the request before it is taken", async () => {
  const goTo = shallowRef<GoToRequest<Pane> | null>(null);
  const calls: string[] = [];
  const scope = effectScope();
  scope.run(() => {
    watch(
      goTo,
      (request) => {
        calls.push(`rendered ${request?.id ?? "none"}`);
      },
      { flush: "post" },
    );
    useSearchGoTo<Pane>(
      {
        goTo,
        took: () => {
          goTo.value = null;
        },
      },
      true,
      "a.ts",
      (target) => {
        calls.push(`goTo ${target.pane}`);
      },
    );
  });

  goTo.value = hitRequest(5, "a.ts");
  await nextTick();
  await nextTick();
  scope.stop();

  expect(calls).toEqual(["rendered 5", "goTo right", "rendered none"]);
});
