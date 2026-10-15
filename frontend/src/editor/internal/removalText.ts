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
  const startsLine = place === "lineStart" || place === "emptyLine";
  if (startsLine && text.endsWith("\n")) {
    return text.slice(0, -1);
  }
  const endsLine = place === "lineEnd" || place === "emptyLine";
  return endsLine && text.startsWith("\n") ? text.slice(1) : text;
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
