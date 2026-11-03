import { onScopeDispose, watch, type ShallowRef } from "vue";

import { MarkdownView } from "../editor";

export function useMarkdown(
  host: Readonly<ShallowRef<HTMLElement | null>>,
  text: () => string,
): void {
  let view: MarkdownView | null = null;

  watch(
    host,
    (element) => {
      view?.destroy();
      view = element === null ? null : new MarkdownView(element);
      view?.show(text());
    },
    { immediate: true, flush: "post" },
  );
  watch(text, (next) => {
    view?.show(next);
  });

  onScopeDispose(() => {
    view?.destroy();
    view = null;
  });
}

export function useMarkdownCode(
  host: Readonly<ShallowRef<HTMLElement | null>>,
  code: () => { readonly language: string | null; readonly text: string },
): void {
  let view: MarkdownView | null = null;

  watch(
    host,
    (element) => {
      view?.destroy();
      view = element === null ? null : new MarkdownView(element);
      const { language, text } = code();
      view?.showCode(language, text);
    },
    { immediate: true, flush: "post" },
  );
  watch(code, ({ language, text }) => {
    view?.showCode(language, text);
  });

  onScopeDispose(() => {
    view?.destroy();
    view = null;
  });
}
