type Styled = "emphasis" | "strong" | "strike";

export type Inline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "break" }
  | { readonly kind: Styled; readonly children: readonly Inline[] }
  | { readonly kind: "link"; readonly children: readonly Inline[]; readonly address: string };

export type Delimiter = "*" | "_" | "~";

type Mark = { readonly kind: Styled };

export type Run = {
  readonly kind: "run";
  readonly char: Delimiter;
  readonly length: number;
  readonly canOpen: boolean;
  readonly canClose: boolean;
  readonly closes: Mark[];
  readonly opens: Mark[];
};

export type Bracket = { readonly kind: "bracket"; readonly image: boolean; linked: boolean };

export type Piece =
  | { readonly kind: "inline"; readonly inline: Inline }
  | Run
  | Bracket
  | {
      readonly kind: "linkEnd";
      readonly open: Bracket;
      readonly address: string;
      readonly raw: string;
    };

type Opener = { readonly run: Run; left: number };

type Level = { readonly barrier: number; readonly bottoms: Map<string, number> };

type Frame = { readonly opener: Mark | Bracket; readonly children: Inline[] };

export const MAX_NESTING = 16;
export const STRIKE_RUN = 2;
export const IMAGE_OPEN = "![";

const STRONG_RUN = 2;
const RULE_OF_THREE = 3;
const WIDTH: Readonly<Record<Styled, number>> = {
  emphasis: 1,
  strong: STRONG_RUN,
  strike: STRIKE_RUN,
};

function pairs(opener: Run, closer: Run): boolean {
  const either = opener.canClose || closer.canOpen;
  const sum = opener.length + closer.length;
  const thirds = opener.length % RULE_OF_THREE === 0 && closer.length % RULE_OF_THREE === 0;
  return opener.char === closer.char && !(either && sum % RULE_OF_THREE === 0 && !thirds);
}

function styledKind(char: Delimiter, available: number): Styled {
  if (char === "~") {
    return "strike";
  }
  return available >= STRONG_RUN ? "strong" : "emphasis";
}

class Emphasis {
  readonly #stack: Opener[] = [];
  readonly #root: Level = { barrier: 0, bottoms: new Map() };
  readonly #links: Level[] = [];

  enterLink(): void {
    this.#links.push({ barrier: this.#stack.length, bottoms: new Map() });
  }

  leaveLink(): void {
    this.#truncate(this.#links.pop()?.barrier ?? 0);
  }

  add(run: Run): void {
    let left = run.length;
    let found = run.canClose ? this.#opener(run) : null;
    let opener = found === null ? undefined : this.#stack[found];
    while (found !== null && opener !== undefined) {
      const kind = styledKind(run.char, Math.min(opener.left, left));
      const mark: Mark = { kind };
      opener.run.opens.push(mark);
      run.closes.push(mark);
      opener.left -= WIDTH[kind];
      left -= WIDTH[kind];
      this.#truncate(opener.left > 0 ? found + 1 : found);
      found = left > 0 ? this.#opener(run) : null;
      opener = found === null ? undefined : this.#stack[found];
    }
    if (left > 0 && run.canOpen) {
      this.#stack.push({ run, left });
    }
  }

  // CommonMark's process_emphasis: openers_bottom per closer type, so a failed search is never
  // repeated (spec.commonmark.org/0.31.2, "Phase 2: inline structure").
  #opener(closer: Run): number | null {
    const level = this.#links.at(-1) ?? this.#root;
    const key = `${closer.char}${String(closer.canOpen)}${closer.length % RULE_OF_THREE}`;
    const lowest = Math.max(level.barrier, level.bottoms.get(key) ?? 0);
    for (let index = this.#stack.length - 1; index >= lowest; index -= 1) {
      const opener = this.#stack[index];
      if (opener !== undefined && pairs(opener.run, closer)) {
        return index;
      }
    }
    level.bottoms.set(key, this.#stack.length);
    return null;
  }

  #truncate(length: number): void {
    this.#stack.length = Math.min(this.#stack.length, length);
    const { bottoms } = this.#links.at(-1) ?? this.#root;
    for (const [key, bottom] of bottoms) {
      bottoms.set(key, Math.min(bottom, length));
    }
  }
}

function matchEmphasis(pieces: readonly Piece[]): void {
  const emphasis = new Emphasis();
  for (const piece of pieces) {
    if (piece.kind === "run") {
      emphasis.add(piece);
    } else if (piece.kind === "bracket" && piece.linked) {
      emphasis.enterLink();
    } else if (piece.kind === "linkEnd") {
      emphasis.leaveLink();
    }
  }
}

class Tree {
  readonly root: Inline[] = [];
  readonly #frames: Frame[] = [];
  readonly #literal = new Set<Mark | Bracket>();

  add(inline: Inline): void {
    const inlines = this.#frames.at(-1)?.children ?? this.root;
    const last = inlines.at(-1);
    if (last?.kind === "text" && inline.kind === "text") {
      inlines[inlines.length - 1] = { kind: "text", text: last.text + inline.text };
    } else {
      inlines.push(inline);
    }
  }

  open(opener: Mark | Bracket, literal: string): void {
    if (this.#frames.length < MAX_NESTING) {
      this.#frames.push({ opener, children: [] });
      return;
    }
    this.#literal.add(opener);
    this.add({ kind: "text", text: literal });
  }

  close(opener: Mark | Bracket, literal: string, node: (children: Inline[]) => Inline): void {
    const frame = this.#literal.has(opener) ? undefined : this.#frames.pop();
    this.add(frame === undefined ? { kind: "text", text: literal } : node(frame.children));
  }
}

function addRun(tree: Tree, run: Run): void {
  for (const mark of run.closes) {
    const { kind } = mark;
    tree.close(mark, run.char.repeat(WIDTH[kind]), (children) => ({ kind, children }));
  }
  const used = [...run.closes, ...run.opens].reduce((sum, { kind }) => sum + WIDTH[kind], 0);
  if (run.length > used) {
    tree.add({ kind: "text", text: run.char.repeat(run.length - used) });
  }
  for (const mark of [...run.opens].reverse()) {
    tree.open(mark, run.char.repeat(WIDTH[mark.kind]));
  }
}

export function inlineTree(pieces: readonly Piece[]): Inline[] {
  matchEmphasis(pieces);
  const tree = new Tree();
  for (const piece of pieces) {
    switch (piece.kind) {
      case "inline":
        tree.add(piece.inline);
        break;
      case "run":
        addRun(tree, piece);
        break;
      case "bracket":
        if (piece.linked) {
          tree.open(piece, "[");
        } else {
          tree.add({ kind: "text", text: piece.image ? IMAGE_OPEN : "[" });
        }
        break;
      case "linkEnd": {
        const { address } = piece;
        tree.close(piece.open, piece.raw, (children) => ({ kind: "link", children, address }));
        break;
      }
      default: {
        const _exhaustive: never = piece;
        return _exhaustive;
      }
    }
  }
  return tree.root;
}
