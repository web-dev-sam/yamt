import { afterEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { useMarkdown } from "./useMarkdown";

const editor = vi.hoisted(() => {
  const state = { built: 0, calls: new Array<string>() };
  class MarkdownView {
    readonly #id: number;
    constructor(_host: unknown) {
      state.built += 1;
      this.#id = state.built;
      state.calls.push(`build ${this.#id}`);
    }
    show(text: string): void {
      state.calls.push(`show ${this.#id} ${text}`);
    }
    destroy(): void {
      state.calls.push(`destroy ${this.#id}`);
    }
  }
  return { state, MarkdownView };
});

vi.mock("../editor", () => ({ MarkdownView: editor.MarkdownView }));

afterEach(() => {
  editor.state.built = 0;
  editor.state.calls = [];
});

function element(): HTMLElement {
  return Object.create(null);
}

function mount(host: ShallowRef<HTMLElement | null>, text: ShallowRef<string>): EffectScope {
  const scope = effectScope();
  scope.run(() => {
    useMarkdown(host, () => text.value);
  });
  return scope;
}

test("a null host builds nothing, even when the text changes", async () => {
  const text = shallowRef("# Hi");
  const scope = mount(shallowRef(null), text);
  await nextTick();
  text.value = "# Hi there";
  await nextTick();

  expect(editor.state.calls).toEqual([]);
  scope.stop();
  expect(editor.state.calls).toEqual([]);
});

test("a set host shows the text, a text change shows again, and stopping the scope destroys", async () => {
  const text = shallowRef("a");
  const scope = mount(shallowRef(element()), text);
  await nextTick();
  text.value = "ab";
  await nextTick();
  scope.stop();

  expect(editor.state.calls).toEqual(["build 1", "show 1 a", "show 1 ab", "destroy 1"]);
});

test("a host swap destroys the old view and shows the text in a new one; a null host only destroys", async () => {
  const host = shallowRef<HTMLElement | null>(element());
  const text = shallowRef("a");
  const scope = mount(host, text);
  await nextTick();
  host.value = element();
  await nextTick();
  host.value = null;
  await nextTick();
  text.value = "b";
  await nextTick();
  scope.stop();

  expect(editor.state.calls).toEqual([
    "build 1",
    "show 1 a",
    "destroy 1",
    "build 2",
    "show 2 a",
    "destroy 2",
  ]);
});
