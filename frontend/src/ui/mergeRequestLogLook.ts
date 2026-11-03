import type { AnsiColour, LogStyle } from "../mergeRequests";

const FOREGROUNDS: Readonly<Record<AnsiColour, string>> = {
  black: "text-ansi-black",
  red: "text-ansi-red",
  green: "text-ansi-green",
  yellow: "text-ansi-yellow",
  blue: "text-ansi-blue",
  magenta: "text-ansi-magenta",
  cyan: "text-ansi-cyan",
  white: "text-ansi-white",
  brightBlack: "text-ansi-bright-black",
  brightRed: "text-ansi-bright-red",
  brightGreen: "text-ansi-bright-green",
  brightYellow: "text-ansi-bright-yellow",
  brightBlue: "text-ansi-bright-blue",
  brightMagenta: "text-ansi-bright-magenta",
  brightCyan: "text-ansi-bright-cyan",
  brightWhite: "text-ansi-bright-white",
};

const BACKGROUNDS: Readonly<Record<AnsiColour, string>> = {
  black: "bg-ansi-black",
  red: "bg-ansi-red",
  green: "bg-ansi-green",
  yellow: "bg-ansi-yellow",
  blue: "bg-ansi-blue",
  magenta: "bg-ansi-magenta",
  cyan: "bg-ansi-cyan",
  white: "bg-ansi-white",
  brightBlack: "bg-ansi-bright-black",
  brightRed: "bg-ansi-bright-red",
  brightGreen: "bg-ansi-bright-green",
  brightYellow: "bg-ansi-bright-yellow",
  brightBlue: "bg-ansi-bright-blue",
  brightMagenta: "bg-ansi-bright-magenta",
  brightCyan: "bg-ansi-bright-cyan",
  brightWhite: "bg-ansi-bright-white",
};

function linesClass(underline: boolean, struck: boolean): string {
  if (underline && struck) {
    return "[text-decoration-line:underline_line-through]";
  }
  if (underline) {
    return "underline";
  }
  return struck ? "line-through" : "";
}

/** The classes of a run: full class names from static tables (Tailwind sees them), "" for the plain style. */
export function runClasses(style: LogStyle): string {
  return [
    style.foreground === null ? "" : FOREGROUNDS[style.foreground],
    style.background === null ? "" : BACKGROUNDS[style.background],
    style.bold ? "font-bold" : "",
    style.italic ? "italic" : "",
    linesClass(style.underline, style.struck),
  ]
    .filter((name) => name !== "")
    .join(" ");
}
