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
