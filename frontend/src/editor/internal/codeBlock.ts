import type { HighlightStyle, LanguageSupport } from "@codemirror/language";
import { highlightCode } from "@lezer/highlight";

import { log } from "../../ipc";
import { languageNamed } from "./language";
import { fontHighlight, paletteHighlight } from "./syntax";

const HIGHLIGHTERS: readonly HighlightStyle[] = [paletteHighlight, fontHighlight];
const STYLES_CLASS = "markdown-highlight-styles";

// `StyleModule.mount` lives in style-mod, which pnpm keeps private to @codemirror/view (not in
// package.json); the modules' own `getRules()` in one `<style>` give the panes' class rules.
function mountStyles(document: Document): void {
  if (document.head.querySelector(`style.${STYLES_CLASS}`) !== null) {
    return;
  }
  const style = document.createElement("style");
  style.className = STYLES_CLASS;
  style.textContent = HIGHLIGHTERS.map((highlighter) => highlighter.module?.getRules() ?? "").join(
    "\n",
  );
  document.head.append(style);
}

function highlighted(document: Document, code: string, support: LanguageSupport): Node[] {
  const nodes: Node[] = [];
  highlightCode(
    code,
    support.language.parser.parse(code),
    HIGHLIGHTERS,
    (text, classes) => {
      if (classes === "") {
        nodes.push(document.createTextNode(text));
        return;
      }
      const span = document.createElement("span");
      span.className = classes;
      span.textContent = text;
      nodes.push(span);
    },
    () => nodes.push(document.createTextNode("\n")),
  );
  return nodes;
}

export async function paintCode(
  element: HTMLElement,
  info: string,
  code: string,
  live: () => boolean,
): Promise<void> {
  const description = info === "" ? null : languageNamed(info);
  if (description === null) {
    return;
  }
  let support: LanguageSupport;
  try {
    support = await description.load();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.warn("markdown.language_failed", { language: description.name, reason });
    return;
  }
  if (!live()) {
    return;
  }
  mountStyles(element.ownerDocument);
  element.replaceChildren(...highlighted(element.ownerDocument, code, support));
}
