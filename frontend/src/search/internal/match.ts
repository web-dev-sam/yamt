export type Query = { readonly text: string; readonly matchCase: boolean };

export class Matcher {
  readonly pattern: RegExp;

  constructor(pattern: RegExp) {
    this.pattern = pattern;
  }
}

export type LineHit = {
  readonly line: number;
  readonly from: number;
  readonly to: number;
  readonly lineText: string;
};

const SYNTAX_CHARACTERS = /[\^$\\.*+?()[\]{}|/]/g;

export function matcherOf(query: Query): Matcher | null {
  if (query.text === "") {
    return null;
  }
  const escaped = query.text.replace(SYNTAX_CHARACTERS, "\\$&");
  return new Matcher(new RegExp(escaped, query.matchCase ? "gu" : "giu"));
}

export function paneHits(
  text: string,
  matcher: Matcher,
  limit: number,
): { readonly hits: readonly LineHit[]; readonly cut: boolean } {
  const hits: LineHit[] = [];
  let line = -1;
  let lineStart = 0;
  let lineEnd = -1;
  let lineText = "";
  for (const match of text.matchAll(matcher.pattern)) {
    if (lineEnd < match.index) {
      do {
        line += 1;
        lineStart = lineEnd + 1;
        const lineBreak = text.indexOf("\n", lineStart);
        lineEnd = lineBreak === -1 ? text.length : lineBreak;
      } while (lineEnd < match.index);
      const whole = text.slice(lineStart, lineEnd);
      lineText = whole.endsWith("\r") ? whole.slice(0, -1) : whole;
    }
    const from = match.index - lineStart;
    const to = from + match[0].length;
    if (to > lineText.length) {
      continue;
    }
    if (hits.length === limit) {
      return { hits, cut: true };
    }
    hits.push({ line, from, to, lineText });
  }
  return { hits, cut: false };
}
