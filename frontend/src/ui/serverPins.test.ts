import type { StorageLike } from "@vueuse/core";
import { expect, test } from "vitest";
import { shallowRef } from "vue";

import { serverKey } from "../lsp";
import { createServerPins, type ServerPins } from "./serverPins";

const KEY = "yamt.servers.pinned";
const ROOT = "/repo";
const OTHER_ROOT = "/elsewhere";
const OXLINT = serverKey("oxlint (frontend)");
const TYPESCRIPT = serverKey("TypeScript (frontend)");

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  readonly items: Map<string, string>;
} {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

function pinned(pins: ServerPins): string[] {
  return [...pins.pinnedServers.value];
}

function stored(storage: { readonly items: Map<string, string> }): unknown {
  const raw = storage.items.get(KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
}

test("nothing is pinned at first; a toggle pins, a second one unpins", () => {
  const storage = memoryStorage();
  const pins = createServerPins(shallowRef(ROOT), storage);
  expect(pinned(pins)).toEqual([]);
  expect(storage.items.get(KEY)).toBeUndefined();

  pins.togglePin(OXLINT);
  pins.togglePin(TYPESCRIPT);
  expect(pinned(pins)).toEqual([OXLINT, TYPESCRIPT]);
  expect(stored(storage)).toEqual({ [ROOT]: [OXLINT, TYPESCRIPT] });

  pins.togglePin(OXLINT);
  expect(pinned(pins)).toEqual([TYPESCRIPT]);
  expect(stored(storage)).toEqual({ [ROOT]: [TYPESCRIPT] });
});

test("pins are per repository; the other repositories' entries stay as written", () => {
  const others = { [OTHER_ROOT]: [OXLINT], "/odd": "not a list" };
  const storage = memoryStorage({ [KEY]: JSON.stringify(others) });
  const root = shallowRef<string | null>(ROOT);
  const pins = createServerPins(root, storage);
  expect(pinned(pins)).toEqual([]);

  pins.togglePin(TYPESCRIPT);
  expect(stored(storage)).toEqual({ ...others, [ROOT]: [TYPESCRIPT] });

  root.value = OTHER_ROOT;
  expect(pinned(pins)).toEqual([OXLINT]);
});

test("a repository left with no pins is removed", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [OTHER_ROOT]: [OXLINT] }) });
  const pins = createServerPins(shallowRef(ROOT), storage);

  pins.togglePin(OXLINT);
  pins.togglePin(OXLINT);

  expect(stored(storage)).toEqual({ [OTHER_ROOT]: [OXLINT] });
});

test("with no repository root nothing is pinned and a toggle does nothing", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [ROOT]: [OXLINT] }) });
  const pins = createServerPins(shallowRef(null), storage);

  pins.togglePin(TYPESCRIPT);

  expect(pinned(pins)).toEqual([]);
  expect(stored(storage)).toEqual({ [ROOT]: [OXLINT] });
});

test.each([
  ["not JSON", "{"],
  ["a list", JSON.stringify([OXLINT])],
  ["null", "null"],
  ["a text", JSON.stringify("oxlint")],
  ["keys that are not a list", JSON.stringify({ [ROOT]: OXLINT })],
  ["a list with a number", JSON.stringify({ [ROOT]: [OXLINT, 1] })],
])("storage holding %s reads as no pins, and a toggle starts afresh", (_kind, raw) => {
  const storage = memoryStorage({ [KEY]: raw });
  const pins = createServerPins(shallowRef(ROOT), storage);
  expect(pinned(pins)).toEqual([]);

  pins.togglePin(OXLINT);

  expect(pinned(pins)).toEqual([OXLINT]);
});
