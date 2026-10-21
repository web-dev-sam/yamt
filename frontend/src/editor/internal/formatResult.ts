export type FormatResult =
  | { readonly kind: "formatted"; readonly text: string }
  | { readonly kind: "unchanged" }
  | { readonly kind: "failed"; readonly message: string; readonly line: number };

const INDENT = "  ";

export const SPACE: Readonly<Record<string, true>> = {
  " ": true,
  "\t": true,
  "\n": true,
  "\r": true,
};

export class FormatFailure extends Error {
  readonly at: number;

  constructor(message: string, at: number) {
    super(message);
    this.at = at;
  }
}

export class Layout {
  readonly #pieces: (string | number)[] = [];

  text(piece: string): void {
    this.#pieces.push(piece);
  }

  lineAt(depth: number): void {
    this.#pieces.push(depth);
  }

  toString(): string {
    return this.#pieces
      .map((piece) => (typeof piece === "number" ? `\n${INDENT.repeat(piece)}` : piece))
      .join("");
  }
}

export function formatWith(input: string, lay: (layout: Layout) => void): FormatResult {
  const end = textEnd(input);
  if (end === 0) {
    return { kind: "unchanged" };
  }
  const layout = new Layout();
  try {
    lay(layout);
  } catch (error) {
    if (error instanceof FormatFailure) {
      return { kind: "failed", message: error.message, line: lineOf(input, error.at) };
    }
    throw error;
  }
  const text = layout.toString() + (input.includes("\n", end) ? "\n" : "");
  return text === input ? { kind: "unchanged" } : { kind: "formatted", text };
}

function textEnd(input: string): number {
  let end = input.length;
  while (end > 0 && SPACE[input.charAt(end - 1)] === true) {
    end -= 1;
  }
  return end;
}

function lineOf(input: string, at: number): number {
  let line = 1;
  for (
    let found = input.indexOf("\n");
    found !== -1 && found < at;
    found = input.indexOf("\n", found + 1)
  ) {
    line += 1;
  }
  return line;
}
