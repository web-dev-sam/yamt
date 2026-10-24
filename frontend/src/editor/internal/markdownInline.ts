import {
  IMAGE_OPEN,
  inlineTree,
  STRIKE_RUN,
  type Bracket,
  type Delimiter,
  type Inline,
  type Piece,
  type Run,
} from "./markdownTree";

type Step = { readonly inlines: readonly Inline[]; readonly end: number };

type Target = { readonly address: string; readonly end: number };

type OpenBracket = { readonly bracket: Bracket; readonly piece: number; readonly at: number };

const PUNCTUATION = /^[!-/:-@[-`{-~]$/;
const SPACE = /^\s$/;
const WORD = /^[\p{L}\p{N}]$/u;
const AUTOLINK = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/;
const ESCAPE_WIDTH = "\\*".length;

function runLength(text: string, at: number, char: string): number {
  let end = at;
  while (text[end] === char) {
    end += 1;
  }
  return end - at;
}

function text(value: string, end: number): Step {
  return { inlines: [{ kind: "text", text: value }], end };
}

class CodeSpans {
  readonly #starts = new Map<number, number[]>();
  readonly #next = new Map<number, number>();

  constructor(source: string) {
    let at = source.indexOf("`");
    while (at >= 0) {
      const run = runLength(source, at, "`");
      const starts = this.#starts.get(run) ?? [];
      starts.push(at);
      this.#starts.set(run, starts);
      at = source.indexOf("`", at + run);
    }
  }

  closing(from: number, run: number): number | null {
    const starts = this.#starts.get(run) ?? [];
    let index = this.#next.get(run) ?? 0;
    while (index < starts.length && (starts[index] ?? from) < from) {
      index += 1;
    }
    this.#next.set(run, index);
    return starts[index] ?? null;
  }
}

function codeSpan(source: string, at: number, spans: CodeSpans): Step {
  const run = runLength(source, at, "`");
  const close = spans.closing(at + run, run);
  if (close === null) {
    return text("`".repeat(run), at + run);
  }
  const inner = source.slice(at + run, close).replaceAll("\n", " ");
  const padded = inner.startsWith(" ") && inner.endsWith(" ") && inner.trim() !== "";
  return {
    inlines: [{ kind: "code", text: padded ? inner.slice(1, -1) : inner }],
    end: close + run,
  };
}

function escape(source: string, at: number): Step {
  const next = source.charAt(at + 1);
  if (next === "\n") {
    return { inlines: [{ kind: "break" }], end: at + ESCAPE_WIDTH };
  }
  return PUNCTUATION.test(next) ? text(next, at + ESCAPE_WIDTH) : text("\\", at + 1);
}

function spaces(source: string, at: number): Step {
  const run = runLength(source, at, " ");
  if (source[at + run] !== "\n") {
    return text(" ".repeat(run), at + run);
  }
  return run > 1 ? { inlines: [{ kind: "break" }], end: at + run + 1 } : text("\n", at + run + 1);
}

function autolink(source: string, at: number): Step {
  const match = AUTOLINK.exec(source.slice(at));
  return match === null ? text("<", at + 1) : text(match[1] ?? "", at + match[0].length);
}

function parenMatches(source: string): Map<number, number> {
  const matches = new Map<number, number>();
  const open: number[] = [];
  for (let at = 0; at < source.length; at += 1) {
    if (source[at] === "(") {
      open.push(at);
    } else if (source[at] === ")") {
      const start = open.pop();
      if (start !== undefined) {
        matches.set(start, at);
      }
    }
  }
  return matches;
}

function destination(
  source: string,
  open: number,
  parens: ReadonlyMap<number, number>,
): Target | null {
  const close = source[open] === "(" ? parens.get(open) : undefined;
  if (close === undefined) {
    return null;
  }
  const inner = source.slice(open + 1, close).trim();
  const address = inner.startsWith("<") ? inner.slice(1, inner.indexOf(">")) : inner;
  return { address: address.split(/\s+/)[0] ?? "", end: close + 1 };
}

function delimiterRun(source: string, at: number, char: Delimiter): Run {
  const length = runLength(source, at, char);
  const before = source.charAt(at - 1);
  const after = source.charAt(at + length);
  return {
    kind: "run",
    char,
    length,
    canOpen: after !== "" && !SPACE.test(after) && (char !== "_" || !WORD.test(before)),
    canClose: before !== "" && !SPACE.test(before) && (char !== "_" || !WORD.test(after)),
    closes: [],
    opens: [],
  };
}

class InlineScan {
  readonly pieces: Piece[] = [];
  readonly #source: string;
  readonly #spans: CodeSpans;
  readonly #parens: ReadonlyMap<number, number>;
  readonly #brackets: OpenBracket[] = [];
  #inactiveBelow = 0;

  constructor(source: string) {
    this.#source = source;
    this.#spans = new CodeSpans(source);
    this.#parens = parenMatches(source);
  }

  step(at: number): number {
    const source = this.#source;
    const char = source.charAt(at);
    switch (char) {
      case "\\":
        return this.#push(escape(source, at));
      case "`":
        return this.#push(codeSpan(source, at, this.#spans));
      case " ":
        return this.#push(spaces(source, at));
      case "<":
        return this.#push(autolink(source, at));
      case "!":
        return source[at + 1] === "[" ? this.#open(at, true) : this.#push(text(char, at + 1));
      case "[":
        return this.#open(at, false);
      case "]":
        return this.#close(at);
      case "*":
      case "_":
      case "~":
        return this.#run(at, char);
      default:
        return this.#push(text(char, at + 1));
    }
  }

  #push({ inlines, end }: Step): number {
    this.pieces.push(...inlines.map((inline): Piece => ({ kind: "inline", inline })));
    return end;
  }

  #run(at: number, char: Delimiter): number {
    const run = delimiterRun(this.#source, at, char);
    if (char === "~" && run.length !== STRIKE_RUN) {
      return this.#push(text(char.repeat(run.length), at + run.length));
    }
    this.pieces.push(run);
    return at + run.length;
  }

  #open(at: number, image: boolean): number {
    const bracket: Bracket = { kind: "bracket", image, linked: false };
    this.#brackets.push({ bracket, piece: this.pieces.length, at });
    this.pieces.push(bracket);
    return at + (image ? IMAGE_OPEN.length : 1);
  }

  #close(at: number): number {
    const open = this.#brackets.pop();
    const depth = this.#brackets.length;
    const active = open !== undefined && (open.bracket.image || depth >= this.#inactiveBelow);
    this.#inactiveBelow = Math.min(this.#inactiveBelow, depth);
    const target = active ? destination(this.#source, at + 1, this.#parens) : null;
    if (open === undefined || target === null) {
      return this.#push(text("]", at + 1));
    }
    if (open.bracket.image) {
      const alt = this.#source.slice(open.at + IMAGE_OPEN.length, at);
      this.pieces.length = open.piece;
      return this.#push(text(`${alt} (${target.address})`, target.end));
    }
    open.bracket.linked = true;
    const raw = this.#source.slice(at, target.end);
    this.pieces.push({ kind: "linkEnd", open: open.bracket, address: target.address, raw });
    this.#inactiveBelow = depth;
    return target.end;
  }
}

export function parseInline(source: string): Inline[] {
  const scan = new InlineScan(source);
  let at = 0;
  while (at < source.length) {
    at = scan.step(at);
  }
  return inlineTree(scan.pieces);
}
