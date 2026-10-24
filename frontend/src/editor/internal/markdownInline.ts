type Styled = "emphasis" | "strong" | "strike";

export type Inline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "break" }
  | { readonly kind: Styled; readonly children: readonly Inline[] }
  | { readonly kind: "link"; readonly children: readonly Inline[]; readonly address: string };

type Step = { readonly inlines: readonly Inline[]; readonly end: number };

type Target = { readonly address: string; readonly end: number };

type Delimiter = "*" | "_" | "~";

const PUNCTUATION = /^[!-/:-@[-`{-~]$/;
const SPACE = /^\s$/;
const WORD = /^[\p{L}\p{N}]$/u;
const AUTOLINK = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>@]+)>/;
const STRIKE_RUN = 2;
const STRONG_RUN = 2;
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

function codeSpanEnd(source: string, at: number): number | null {
  const run = runLength(source, at, "`");
  let from = at + run;
  for (;;) {
    const next = source.indexOf("`", from);
    if (next < 0) {
      return null;
    }
    const closing = runLength(source, next, "`");
    if (closing === run) {
      return next + closing;
    }
    from = next + closing;
  }
}

function codeSpan(source: string, at: number): Step {
  const run = runLength(source, at, "`");
  const end = codeSpanEnd(source, at);
  if (end === null) {
    return text("`".repeat(run), at + run);
  }
  const inner = source.slice(at + run, end - run).replaceAll("\n", " ");
  const padded = inner.startsWith(" ") && inner.endsWith(" ") && inner.trim() !== "";
  return { inlines: [{ kind: "code", text: padded ? inner.slice(1, -1) : inner }], end };
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

function canOpen(source: string, at: number, run: number, char: Delimiter): boolean {
  const next = source.charAt(at + run);
  const before = source.charAt(at - 1);
  return next !== "" && !SPACE.test(next) && (char !== "_" || !WORD.test(before));
}

function canClose(source: string, at: number, run: number, char: Delimiter): boolean {
  const before = source.charAt(at - 1);
  const after = source.charAt(at + run);
  return before !== "" && !SPACE.test(before) && (char !== "_" || !WORD.test(after));
}

function widthOf(run: number, char: Delimiter): number {
  return char === "~" ? STRIKE_RUN : Math.min(run, STRONG_RUN);
}

function skipped(source: string, at: number): number | null {
  const char = source[at];
  if (char === "\\") {
    return at + ESCAPE_WIDTH;
  }
  if (char === "`") {
    return codeSpanEnd(source, at) ?? at + runLength(source, at, "`");
  }
  return null;
}

function closer(source: string, from: number, char: Delimiter, width: number): number | null {
  let at = from;
  while (at < source.length) {
    const past = skipped(source, at);
    if (past !== null) {
      at = past;
      continue;
    }
    if (source[at] !== char) {
      at += 1;
      continue;
    }
    const run = runLength(source, at, char);
    if (canClose(source, at, run, char) && run >= width) {
      return at;
    }
    if (!canOpen(source, at, run, char)) {
      at += run;
      continue;
    }
    const inner = widthOf(run, char);
    const nested = closer(source, at + inner, char, inner);
    if (nested === null) {
      return null;
    }
    at = nested + inner;
  }
  return null;
}

function styledKind(char: Delimiter, width: number): Styled {
  if (char === "~") {
    return "strike";
  }
  return width === STRONG_RUN ? "strong" : "emphasis";
}

function delimited(source: string, at: number, char: Delimiter): Step {
  const run = runLength(source, at, char);
  if ((char === "~" && run !== STRIKE_RUN) || !canOpen(source, at, run, char)) {
    return text(char.repeat(run), at + run);
  }
  const width = widthOf(run, char);
  const end = closer(source, at + width, char, width);
  if (end === null) {
    return text(char, at + 1);
  }
  const children = parseInline(source.slice(at + width, end));
  return { inlines: [{ kind: styledKind(char, width), children }], end: end + width };
}

function bracketEnd(source: string, at: number): number | null {
  let depth = 0;
  let index = at;
  while (index < source.length) {
    const past = skipped(source, index);
    if (past !== null) {
      index = past;
      continue;
    }
    const char = source[index];
    depth += char === "[" ? 1 : char === "]" ? -1 : 0;
    if (depth === 0) {
      return index;
    }
    index += 1;
  }
  return null;
}

function destination(source: string, open: number): Target | null {
  if (source[open] !== "(") {
    return null;
  }
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    depth += char === "(" ? 1 : char === ")" ? -1 : 0;
    if (depth === 0) {
      const inner = source.slice(open + 1, index).trim();
      const address = inner.startsWith("<") ? inner.slice(1, inner.indexOf(">")) : inner;
      return { address: address.split(/\s+/)[0] ?? "", end: index + 1 };
    }
  }
  return null;
}

function link(source: string, at: number): Step | null {
  const close = bracketEnd(source, at);
  const target = close === null ? null : destination(source, close + 1);
  if (close === null || target === null) {
    return null;
  }
  const children = parseInline(source.slice(at + 1, close));
  return { inlines: [{ kind: "link", children, address: target.address }], end: target.end };
}

function image(source: string, at: number): Step | null {
  const close = source[at + 1] === "[" ? bracketEnd(source, at + 1) : null;
  const target = close === null ? null : destination(source, close + 1);
  if (close === null || target === null) {
    return null;
  }
  return text(`${source.slice(at + "![".length, close)} (${target.address})`, target.end);
}

function autolink(source: string, at: number): Step | null {
  const match = AUTOLINK.exec(source.slice(at));
  return match === null ? null : text(match[1] ?? "", at + match[0].length);
}

function stepAt(source: string, at: number): Step | null {
  const char = source.charAt(at);
  switch (char) {
    case "\\":
      return escape(source, at);
    case "`":
      return codeSpan(source, at);
    case " ":
      return spaces(source, at);
    case "!":
      return image(source, at);
    case "[":
      return link(source, at);
    case "<":
      return autolink(source, at);
    case "*":
    case "_":
    case "~":
      return delimited(source, at, char);
    default:
      return null;
  }
}

function append(inlines: Inline[], next: Inline): void {
  const last = inlines.at(-1);
  if (last?.kind === "text" && next.kind === "text") {
    inlines[inlines.length - 1] = { kind: "text", text: last.text + next.text };
  } else {
    inlines.push(next);
  }
}

export function parseInline(source: string): Inline[] {
  const inlines: Inline[] = [];
  let at = 0;
  while (at < source.length) {
    const step = stepAt(source, at);
    if (step === null) {
      append(inlines, { kind: "text", text: source.charAt(at) });
      at += 1;
      continue;
    }
    for (const inline of step.inlines) {
      append(inlines, inline);
    }
    at = step.end;
  }
  return inlines;
}
