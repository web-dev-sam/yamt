export type FormatResult =
  | { readonly kind: "formatted"; readonly text: string }
  | { readonly kind: "unchanged" }
  | { readonly kind: "failed"; readonly message: string; readonly line: number };

const INDENT = "  ";
const MAX_FORMATTED_CHARS = 64_000_000;
const BOM = "\uFEFF";

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
  #length = 0;
  #tooLongAt: number | null = null;

  text(piece: string): void {
    this.#pieces.push(piece);
    this.#length += piece.length;
  }

  lineAt(depth: number, at: number): void {
    this.#pieces.push(depth);
    this.#length += 1 + INDENT.length * depth;
    if (this.#length > MAX_FORMATTED_CHARS) {
      this.#tooLongAt ??= at;
    }
  }

  build(): string {
    if (this.#tooLongAt !== null) {
      throw new FormatFailure("The formatted text is too long", this.#tooLongAt);
    }
    return this.#pieces
      .map((piece) => (typeof piece === "number" ? `\n${INDENT.repeat(piece)}` : piece))
      .join("");
  }
}

export function formatWith(
  input: string,
  lay: (text: string, layout: Layout) => void,
): FormatResult {
  const bom = input.startsWith(BOM) ? BOM : "";
  const body = input.slice(bom.length);
  const end = textEnd(body);
  if (end === 0) {
    return { kind: "unchanged" };
  }
  const layout = new Layout();
  layout.text(bom);
  try {
    lay(body, layout);
    const text = layout.build() + (body.includes("\n", end) ? "\n" : "");
    return text === input ? { kind: "unchanged" } : { kind: "formatted", text };
  } catch (error) {
    if (error instanceof FormatFailure) {
      return { kind: "failed", message: error.message, line: lineOf(body, error.at) };
    }
    throw error;
  }
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
