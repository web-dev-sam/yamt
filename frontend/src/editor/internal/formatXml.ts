import { FormatFailure, type FormatResult, formatWith, type Layout, SPACE } from "./formatResult";

type Element = {
  readonly name: string;
  readonly from: number;
  readonly preserve: boolean;
  children: boolean;
  text: boolean;
  endEvent: number;
  end: number;
};

type XmlEvent =
  | { readonly kind: "open"; readonly from: number; readonly to: number; readonly element: Element }
  | { readonly kind: "close" | "node"; readonly from: number; readonly to: number };

const NAME = /[A-Za-z_:\u0080-\uFFFF][\w.\-:\u0080-\uFFFF]*/y;
const PRESERVE = /[ \t\r\n]xml:space[ \t\r\n]*=[ \t\r\n]*(["'])preserve\1/;
const DOCTYPE = "<!DOCTYPE";
const END_TAG = "</";
const SELF_CLOSE = "/>";
const CDATA = "<![CDATA[";
const DELIMITED = [
  { opener: "<!--", closer: "-->", unterminated: "Unterminated comment" },
  { opener: CDATA, closer: "]]>", unterminated: "Unterminated CDATA section" },
  { opener: "<?", closer: "?>", unterminated: "Unterminated processing instruction" },
] as const;

export function formatXml(text: string): FormatResult {
  return formatWith(text, (layout) => {
    layXml(text, new XmlScan(text).run(), layout);
  });
}

function layXml(text: string, events: readonly XmlEvent[], layout: Layout): void {
  let depth = 0;
  let index = 0;
  for (let event = events[0]; event !== undefined; event = events[index]) {
    if (event.kind === "close") {
      depth -= 1;
    }
    if (index > 0) {
      layout.lineAt(depth);
    }
    const element = event.kind === "open" ? event.element : null;
    if (element !== null && (element.preserve || !element.children || element.text)) {
      layout.text(text.slice(event.from, element.end));
      index = element.endEvent + 1;
      continue;
    }
    layout.text(text.slice(event.from, event.to));
    if (event.kind === "open") {
      depth += 1;
    }
    index += 1;
  }
}

class XmlScan {
  readonly #text: string;
  readonly #events: XmlEvent[] = [];
  readonly #open: Element[] = [];
  #rooted = false;
  #at = 0;

  constructor(text: string) {
    this.#text = text;
  }

  run(): readonly XmlEvent[] {
    for (;;) {
      const next = this.#text.indexOf("<", this.#at);
      this.#textUpTo(next === -1 ? this.#text.length : next);
      if (next === -1) {
        break;
      }
      this.#markup();
    }
    const unclosed = this.#open.at(-1);
    if (unclosed !== undefined) {
      throw new FormatFailure(`Element <${unclosed.name}> is not closed`, unclosed.from);
    }
    if (!this.#rooted) {
      throw new FormatFailure("Expected a root element", this.#text.length);
    }
    return this.#events;
  }

  #textUpTo(end: number): void {
    let at = this.#at;
    while (at < end && SPACE[this.#text.charAt(at)] === true) {
      at += 1;
    }
    if (at < end) {
      this.#holdText(at);
    }
    this.#at = end;
  }

  #holdText(at: number): void {
    const parent = this.#open.at(-1);
    if (parent === undefined) {
      throw new FormatFailure("Text outside the root element", at);
    }
    parent.text = true;
  }

  #markup(): void {
    const at = this.#at;
    const delimited = DELIMITED.find(({ opener }) => this.#text.startsWith(opener, at));
    if (delimited !== undefined) {
      if (delimited.opener === CDATA && this.#open.length === 0) {
        this.#holdText(at);
      }
      const closed = this.#text.indexOf(delimited.closer, at + delimited.opener.length);
      if (closed === -1) {
        throw new FormatFailure(delimited.unterminated, at);
      }
      this.#node(closed + delimited.closer.length);
    } else if (this.#text.startsWith(DOCTYPE, at)) {
      this.#node(this.#doctypeEnd());
    } else if (this.#text.startsWith(END_TAG, at)) {
      this.#endTag();
    } else {
      this.#startTag();
    }
  }

  #node(to: number): void {
    this.#events.push({ kind: "node", from: this.#at, to });
    this.#at = to;
  }

  #doctypeEnd(): number {
    let subset = false;
    for (let at = this.#at + DOCTYPE.length; at < this.#text.length; at += 1) {
      const char = this.#text.charAt(at);
      if (char === '"' || char === "'") {
        at = this.#text.indexOf(char, at + 1);
      } else if (subset && this.#text.startsWith("<!--", at)) {
        at = this.#text.indexOf("-->", at);
      } else if (char === "[" || char === "]") {
        subset = char === "[";
      } else if (char === ">" && !subset) {
        return at + 1;
      }
      if (at === -1) {
        break;
      }
    }
    throw new FormatFailure("Unterminated DOCTYPE", this.#at);
  }

  #startTag(): void {
    const from = this.#at;
    const name = this.#nameAt(from + 1);
    if (name === null) {
      throw new FormatFailure(
        "'<' starts no tag, comment, CDATA section, processing instruction or DOCTYPE",
        from,
      );
    }
    const to = this.#tagEnd(name);
    const parent = this.#open.at(-1);
    if (parent !== undefined) {
      parent.children = true;
    } else if (this.#rooted) {
      throw new FormatFailure(`A second root element <${name}>`, from);
    }
    this.#rooted = true;
    this.#at = to;
    if (this.#text.startsWith(SELF_CLOSE, to - SELF_CLOSE.length)) {
      this.#events.push({ kind: "node", from, to });
      return;
    }
    const tag = this.#text.slice(from, to);
    const element = {
      name,
      from,
      preserve: PRESERVE.test(tag),
      children: false,
      text: false,
      endEvent: -1,
      end: -1,
    };
    this.#events.push({ kind: "open", from, to, element });
    this.#open.push(element);
  }

  #tagEnd(name: string): number {
    for (let at = this.#at + 1 + name.length; at < this.#text.length; at += 1) {
      const char = this.#text.charAt(at);
      if (char === ">") {
        return at + 1;
      }
      if (char === "<") {
        break;
      }
      if (char === '"' || char === "'") {
        at = this.#text.indexOf(char, at + 1);
        if (at === -1) {
          break;
        }
      }
    }
    throw new FormatFailure(`Unterminated tag <${name}>`, this.#at);
  }

  #endTag(): void {
    const from = this.#at;
    const name = this.#nameAt(from + END_TAG.length);
    if (name === null) {
      throw new FormatFailure("Expected a name after '</'", from);
    }
    let to = from + END_TAG.length + name.length;
    while (SPACE[this.#text.charAt(to)] === true) {
      to += 1;
    }
    if (this.#text.charAt(to) !== ">") {
      throw new FormatFailure(`Unterminated end tag </${name}>`, from);
    }
    const element = this.#open.pop();
    if (element === undefined) {
      throw new FormatFailure(`End tag </${name}> has no start tag`, from);
    }
    if (element.name !== name) {
      throw new FormatFailure(`End tag </${name}> does not match <${element.name}>`, from);
    }
    element.endEvent = this.#events.length;
    element.end = to + 1;
    this.#events.push({ kind: "close", from, to: to + 1 });
    this.#at = to + 1;
  }

  #nameAt(at: number): string | null {
    NAME.lastIndex = at;
    return NAME.exec(this.#text)?.[0] ?? null;
  }
}
