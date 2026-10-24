import { languageNamed, loadedSupport } from "./language";
import type { CodeBlock } from "./markdownBlocks";
import { CODE_HIGHLIGHTERS, highlightedNodes } from "./syntax";

const STYLES_CLASS = "markdown-highlight-styles";

// `StyleModule.mount` lives in style-mod, which pnpm keeps private to @codemirror/view (not in
// package.json); the modules' own `getRules()` in one `<style>` give the panes' class rules.
function mountStyles(document: Document): void {
  if (document.head.querySelector(`style.${STYLES_CLASS}`) !== null) {
    return;
  }
  const style = document.createElement("style");
  style.className = STYLES_CLASS;
  style.textContent = CODE_HIGHLIGHTERS.map(
    (highlighter) => highlighter.module?.getRules() ?? "",
  ).join("\n");
  document.head.append(style);
}

export async function paintCode(
  element: HTMLElement,
  { info, code }: CodeBlock,
  live: () => boolean,
): Promise<void> {
  const description = info === "" ? null : languageNamed(info);
  if (description === null) {
    return;
  }
  const support = await loadedSupport(description, { place: "markdown" });
  if (support === null || !live()) {
    return;
  }
  mountStyles(element.ownerDocument);
  element.replaceChildren(
    ...highlightedNodes(element.ownerDocument, code, support.language.parser),
  );
}
