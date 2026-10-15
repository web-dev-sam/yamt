import { language } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { hoverTooltip, type EditorView, type Tooltip } from "@codemirror/view";
import { highlightCode } from "@lezer/highlight";

import { paletteHighlight } from "./pane";
import { barPlace, shownRemoval, type ShownRemoval } from "./removalText";
import { REMOVAL_BAR_CLASS, removalAt } from "./words";

function codeBlock(view: EditorView, shown: ShownRemoval): HTMLElement {
  const block = document.createElement("pre");
  block.className = `removal-tooltip removal-tooltip-${shown.kind}`;
  const pane = getComputedStyle(view.contentDOM);
  block.style.fontFamily = pane.fontFamily;
  block.style.fontSize = pane.fontSize;
  block.style.lineHeight = pane.lineHeight;
  block.style.fontVariantLigatures = pane.fontVariantLigatures;
  if (shown.kind === "code") {
    block.style.color = pane.color;
  }
  block.style.setProperty("tab-size", String(view.state.tabSize));
  const grammar = view.state.facet(language);
  if (shown.kind === "whitespace" || grammar === null) {
    block.textContent = shown.text;
    return block;
  }
  highlightCode(
    shown.text,
    grammar.parser.parse(shown.text),
    paletteHighlight,
    (text, classes) => {
      if (classes === "") {
        block.append(text);
        return;
      }
      const span = document.createElement("span");
      span.className = classes;
      span.textContent = text;
      block.append(span);
    },
    () => block.append("\n"),
  );
  return block;
}

function hoveredRemoval(view: EditorView): Tooltip | null {
  // CodeMirror asks with the bar's position also when the pointer rests on a character next to it
  // (@codemirror/view HoverPlugin.startHover: posAtCoords within one character width).
  const bar = view.contentDOM.querySelector(`.${REMOVAL_BAR_CLASS}:hover`);
  if (bar === null) {
    return null;
  }
  const pos = view.posAtDOM(bar);
  const text = removalAt(view.state, pos);
  if (text === null) {
    return null;
  }
  const shown = shownRemoval(text, barPlace(view.state.doc.lineAt(pos), pos));
  return { pos, create: () => ({ dom: codeBlock(view, shown) }) };
}

export function removalTooltip(): Extension {
  return hoverTooltip(hoveredRemoval, {
    hideOn: (tr, tooltip) => removalAt(tr.state, tooltip.pos) === null,
  });
}
