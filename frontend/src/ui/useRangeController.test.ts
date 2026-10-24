import { expect, test } from "vitest";
import { effectScope, nextTick, shallowRef, type ShallowRef } from "vue";

import type { Preferences, RangeTexts } from "../editor";
import type { RangeFile } from "../ipc";
import { preferencesOf, startSettings } from "./settings";
import { followRange, shownHosts, type RangeHandle, type ShownRange } from "./useRangeController";

type Built = { readonly texts: RangeTexts; readonly hosts: string; readonly theme: string };

type Run = {
  readonly handle: RangeHandle;
  readonly built: Built[];
  readonly calls: string[];
  readonly hosts: ShallowRef<string | null>;
  readonly preferences: ShallowRef<Preferences>;
  readonly answer: (file: RangeFile | null) => Promise<void>;
  readonly stop: () => void;
};

const DARK = preferencesOf(startSettings("dark"));
const LIGHT = preferencesOf(startSettings("light"));
const TEXTS: RangeFile = {
  kind: "texts",
  left: "a\n",
  right: "b\n",
  differences: [],
  mode: { kind: "changed", old: "file", new: "executable" },
};

function run(firstHosts: string | null): Run {
  const built: Built[] = [];
  const calls: string[] = [];
  const hosts = shallowRef<string | null>(firstHosts);
  const preferences = shallowRef(DARK);
  const answers: ((file: RangeFile | null) => void)[] = [];
  const loaded = new Promise<RangeFile | null>((resolve) => {
    answers.push(resolve);
  });
  const scope = effectScope();
  const shown: ShownRange = {
    setPreferences: (next) => calls.push(`preferences ${next.theme}`),
    moveToChange: (direction) => calls.push(`move ${direction}`),
    destroy: () => calls.push("destroy"),
  };
  const handle = scope.run(() =>
    followRange({
      path: "src/board.ts",
      load: () => loaded,
      hosts: () => hosts.value,
      preferences,
      build: (texts, at, chosen) => {
        built.push({ texts, hosts: at, theme: chosen.theme });
        return shown;
      },
    }),
  );
  if (handle === undefined) {
    throw new Error("the scope did not run");
  }
  return {
    handle,
    built,
    calls,
    hosts,
    preferences,
    answer: async (file) => {
      for (const answer of answers) {
        answer(file);
      }
      await loaded;
      await nextTick();
    },
    stop: () => {
      scope.stop();
    },
  };
}

test("a texts reply builds one controller on the hosts with the path, both texts and the preferences", async () => {
  const live = run("hosts");
  expect(live.handle.content.value).toEqual({ kind: "loading" });

  await live.answer(TEXTS);

  expect(live.handle.content.value).toEqual({
    kind: "columns",
    note: "Mode changed: file → executable file",
  });
  expect(live.built).toEqual([
    {
      texts: { path: "src/board.ts", left: "a\n", right: "b\n", differences: [] },
      hosts: "hosts",
      theme: "dark",
    },
  ]);
});

test("the controller waits for its hosts, then follows preferences and arrows, and is destroyed with the view", async () => {
  const live = run(null);
  live.handle.moveToChange("down");
  await live.answer(TEXTS);
  expect(live.built).toEqual([]);

  live.hosts.value = "mounted";
  await nextTick();
  expect(live.built.map(({ hosts }) => hosts)).toEqual(["mounted"]);

  live.hosts.value = "again";
  await nextTick();
  expect(live.built).toHaveLength(1);

  live.preferences.value = LIGHT;
  await nextTick();
  live.handle.moveToChange("up");
  live.stop();
  live.handle.moveToChange("down");

  expect(live.calls).toEqual(["preferences light", "move up", "destroy"]);
});

test.each<RangeFile>([
  { kind: "binary" },
  { kind: "tooLarge", limit: 8_388_608 },
  { kind: "notUtf8", sides: "both" },
  { kind: "modeOnly", old: "file", new: "executable" },
  { kind: "kindChanged", old: "file", new: "link" },
  { kind: "submodule", old: null, new: "abc" },
])("a $kind reply builds no controller and shows its sentence", async (file) => {
  const live = run("hosts");

  await live.answer(file);

  expect(live.built).toEqual([]);
  expect(live.handle.content.value.kind).toBe("sentence");
});

test("the binary sentence is the one rangeText words", async () => {
  const live = run("hosts");

  await live.answer({ kind: "binary" });

  expect(live.handle.content.value).toEqual({ kind: "sentence", text: "Binary file: not shown." });
});

test("a reply arriving after unmount is dropped: nothing built, nothing shown", async () => {
  const live = run("hosts");
  live.stop();

  await live.answer(TEXTS);

  expect(live.built).toEqual([]);
  expect(live.handle.content.value).toEqual({ kind: "loading" });
  expect(live.calls).toEqual([]);
});

test("a failed load builds nothing and stays loading", async () => {
  const live = run("hosts");

  await live.answer(null);

  expect(live.built).toEqual([]);
  expect(live.handle.content.value).toEqual({ kind: "loading" });
});

test("preferences changed before the controller exists reach it at build, not through a missing controller", async () => {
  const live = run(null);
  live.preferences.value = LIGHT;
  await nextTick();

  await live.answer(TEXTS);
  live.hosts.value = "mounted";
  await nextTick();

  expect(live.built.map(({ theme }) => theme)).toEqual(["light"]);
  expect(live.calls).toEqual([]);
});

test.each(["left", "right", "strip"] as const)(
  "no hosts while the %s ref is still null (catches a column built on a half-mounted view)",
  (missing) => {
    const refs = {
      left: shallowRef<string | null>("left host"),
      right: shallowRef<string | null>("right host"),
      strip: shallowRef<number | null>(0),
    };
    expect(shownHosts(refs)).toEqual({ left: "left host", right: "right host", strip: 0 });

    refs[missing].value = null;

    expect(shownHosts(refs)).toBeNull();
  },
);
