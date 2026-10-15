import type { Line } from "@codemirror/state";

export type BarPlace = "lineStart" | "lineEnd" | "emptyLine" | "inside";

export type ShownRemoval = { readonly kind: "code" | "whitespace"; readonly text: string };

const WHITESPACE_MARKS: Readonly<Record<string, string>> = { " ": "·", "\t": "→", "\n": "↵" };
const ONLY_WHITESPACE = /^[ \t\n]+$/;
const WHITESPACE = /[ \t\n]/g;

export function barPlace(line: Pick<Line, "from" | "to">, pos: number): BarPlace {
  if (line.from === line.to) {
    return "emptyLine";
  }
  if (pos === line.from) {
    return "lineStart";
  }
  return pos === line.to ? "lineEnd" : "inside";
}

function withoutJoin(text: string, place: BarPlace): string {
  const endsLine = place === "lineEnd" || place === "emptyLine";
  if (endsLine && text.startsWith("\n")) {
    return text.slice(1);
  }
  const startsLine = place === "lineStart" || place === "emptyLine";
  return startsLine && text.endsWith("\n") ? text.slice(0, -1) : text;
}

export function shownRemoval(text: string, place: BarPlace): ShownRemoval {
  if (ONLY_WHITESPACE.test(text)) {
    return {
      kind: "whitespace",
      text: text.replaceAll(WHITESPACE, (char) => WHITESPACE_MARKS[char] ?? char),
    };
  }
  return { kind: "code", text: withoutJoin(text, place) };
}
