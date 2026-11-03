import { onScopeDispose, watch, type ShallowRef } from "vue";

import { MarkdownView } from "../editor";

type Host = Readonly<ShallowRef<HTMLElement | null>>;

export function useMarkdown(host: Host, text: () => string): void {
  useView(host, text, (view, value) => {
    view.show(value);
  });
}

export function useMarkdownCode(
  host: Host,
  code: () => { readonly language: string | null; readonly text: string },
): void {
  useView(host, code, (view, { language, text }) => {
    view.showCode(language, text);
  });
}

function useView<T>(
  host: Host,
  source: () => T,
  render: (view: MarkdownView, value: T) => void,
): void {
  let view: MarkdownView | null = null;

  watch(
    host,
    (element) => {
      view?.destroy();
      view = element === null ? null : new MarkdownView(element);
      if (view !== null) render(view, source());
    },
    { immediate: true, flush: "post" },
  );
  watch(source, (next) => {
    if (view !== null) render(view, next);
  });

  onScopeDispose(() => {
    view?.destroy();
    view = null;
  });
}
