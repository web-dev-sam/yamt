import { FormatFailure, type FormatResult, formatWith, type Layout, SPACE } from "./formatResult";

type Close = "}" | "]";

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const ESCAPE = /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/y;
const LITERALS = ["true", "false", "null"];
const FIRST_PRINTABLE = 0x20;

export function formatJson(text: string): FormatResult {
  return formatWith(text, (layout) => {
    new JsonScan(text, layout).run();
  });
}

class JsonScan {
  readonly #text: string;
  readonly #layout: Layout;
  readonly #open: Close[] = [];
  #at = 0;

  constructor(text: string, layout: Layout) {
    this.#text = text;
    this.#layout = layout;
  }

  run(): void {
    this.#value();
    for (let close = this.#open.at(-1); close !== undefined; close = this.#open.at(-1)) {
      this.#skipSpace();
      const next = this.#text[this.#at];
      if (next === ",") {
        this.#at += 1;
        this.#layout.text(",");
        this.#layout.lineAt(this.#open.length);
        if (close === "}") {
          this.#key();
        }
        this.#value();
      } else if (next === close) {
        this.#at += 1;
        this.#open.pop();
        this.#layout.lineAt(this.#open.length);
        this.#layout.text(close);
      } else {
        this.#fail(`Expected ',' or '${close}'`);
      }
    }
    this.#skipSpace();
    if (this.#at < this.#text.length) {
      this.#fail("Unexpected text after the JSON value");
    }
  }

  #value(): void {
    for (;;) {
      this.#skipSpace();
      const opened = this.#text[this.#at];
      if (opened !== "{" && opened !== "[") {
        this.#scalar();
        return;
      }
      const close = opened === "{" ? "}" : "]";
      this.#at += 1;
      this.#skipSpace();
      if (this.#text[this.#at] === close) {
        this.#at += 1;
        this.#layout.text(opened + close);
        return;
      }
      this.#layout.text(opened);
      this.#open.push(close);
      this.#layout.lineAt(this.#open.length);
      if (close === "}") {
        this.#key();
      }
    }
  }

  #key(): void {
    this.#skipSpace();
    if (this.#text[this.#at] !== '"') {
      this.#fail("Expected a string key");
    }
    this.#string();
    this.#skipSpace();
    if (this.#text[this.#at] !== ":") {
      this.#fail("Expected ':'");
    }
    this.#at += 1;
    this.#layout.text(": ");
  }

  #scalar(): void {
    const first = this.#text[this.#at];
    if (first === '"') {
      this.#string();
      return;
    }
    const literal = LITERALS.find((word) => this.#text.startsWith(word, this.#at));
    if (literal !== undefined) {
      this.#token(literal);
      return;
    }
    NUMBER.lastIndex = this.#at;
    const number = NUMBER.exec(this.#text);
    if (number === null) {
      this.#fail("Expected a value");
    }
    this.#token(number[0]);
  }

  #string(): void {
    const from = this.#at;
    let at = from + 1;
    for (;;) {
      const code = this.#text.charCodeAt(at);
      if (Number.isNaN(code)) {
        this.#fail("Unterminated string", from);
      } else if (code < FIRST_PRINTABLE) {
        this.#fail("Control character in a string", at);
      }
      const char = this.#text.charAt(at);
      if (char === '"') {
        break;
      }
      at = char === "\\" ? this.#escapeEnd(at) : at + 1;
    }
    this.#token(this.#text.slice(from, at + 1));
  }

  #escapeEnd(backslash: number): number {
    ESCAPE.lastIndex = backslash;
    if (ESCAPE.test(this.#text)) {
      return ESCAPE.lastIndex;
    }
    return this.#fail("Invalid escape in a string", backslash);
  }

  #token(token: string): void {
    this.#layout.text(token);
    this.#at += token.length;
  }

  #skipSpace(): void {
    while (SPACE[this.#text.charAt(this.#at)] === true) {
      this.#at += 1;
    }
  }

  #fail(message: string, at = this.#at): never {
    throw new FormatFailure(message, at);
  }
}
