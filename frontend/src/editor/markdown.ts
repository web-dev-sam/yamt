import "./theme.css";
import { paintCode } from "./internal/codeBlock";
import { parseBlocks } from "./internal/markdownBlocks";
import { blockNode, type CodePainter } from "./internal/markdownDom";

type ShownBlock = { readonly source: string | null; readonly node: HTMLElement };

export class MarkdownView {
  readonly #host: HTMLElement;
  readonly #paint: CodePainter;
  #shown: ShownBlock[] = [];
  #destroyed = false;

  constructor(host: HTMLElement) {
    this.#host = host;
    this.#paint = (element, block) => {
      void paintCode(element, block, () => !this.#destroyed && host.contains(element));
    };
  }

  show(text: string): void {
    if (this.#destroyed) {
      return;
    }
    const blocks = parseBlocks(text);
    let kept = 0;
    while (kept < this.#shown.length && this.#shown[kept]?.source === blocks[kept]?.source) {
      kept += 1;
    }
    for (const { node } of this.#shown.splice(kept)) {
      node.remove();
    }
    const document = this.#host.ownerDocument;
    for (const { source, block } of blocks.slice(kept)) {
      const node = blockNode(document, block, this.#paint);
      this.#host.append(node);
      this.#shown.push({ source, node });
    }
  }

  /** Shows one code block in yamt's Markdown look (`pre.markdown-block.markdown-code > code`), replacing whatever the
   *  view showed: the text at once as text, then coloured by the panes' highlighters when `language` names one yamt
   *  knows (`languageNamed`); plain for null, "" or an unknown name. Never reads `text` as markup. */
  showCode(language: string | null, text: string): void {
    if (this.#destroyed) {
      return;
    }
    const node = blockNode(
      this.#host.ownerDocument,
      { kind: "code", info: language ?? "", code: text },
      this.#paint,
    );
    this.#host.replaceChildren(node);
    this.#shown = [{ source: null, node }];
  }

  destroy(): void {
    this.#destroyed = true;
    this.#shown = [];
    this.#host.replaceChildren();
  }
}
