import {
  BASIC_COLOURS,
  BRIGHT_OF,
  basicColour,
  type AnsiColour,
  type BasicColour,
} from "./ansiColours";

type Foreground = { readonly colour: AnsiColour; readonly whenBold: AnsiColour };
export type Pen = {
  readonly foreground: Foreground | null;
  readonly background: AnsiColour | null;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly struck: boolean;
};
type PenChange = (pen: Pen) => Pen;

export const PLAIN_PEN: Pen = {
  foreground: null,
  background: null,
  bold: false,
  italic: false,
  underline: false,
  struck: false,
};

function steady(colour: AnsiColour): Foreground {
  return { colour, whenBold: colour };
}

function digitCodes(
  prefix: string,
  change: (pen: Pen, colour: BasicColour) => Pen,
): Readonly<Record<string, PenChange>> {
  return Object.fromEntries(
    BASIC_COLOURS.map((colour, digit) => [`${prefix}${digit}`, (pen: Pen) => change(pen, colour)]),
  );
}

const SGR_CODES: Readonly<Record<string, PenChange>> = {
  "0": () => PLAIN_PEN,
  "1": (pen) => ({ ...pen, bold: true }),
  "3": (pen) => ({ ...pen, italic: true }),
  "4": (pen) => ({ ...pen, underline: true }),
  "9": (pen) => ({ ...pen, struck: true }),
  "21": (pen) => ({ ...pen, bold: false }),
  "22": (pen) => ({ ...pen, bold: false }),
  "23": (pen) => ({ ...pen, italic: false }),
  "24": (pen) => ({ ...pen, underline: false }),
  "29": (pen) => ({ ...pen, struck: false }),
  "39": (pen) => ({ ...pen, foreground: null }),
  "99": (pen) => ({ ...pen, foreground: null }),
  "49": (pen) => ({ ...pen, background: null }),
  "109": (pen) => ({ ...pen, background: null }),
  ...digitCodes("3", (pen, colour) => ({
    ...pen,
    foreground: { colour, whenBold: BRIGHT_OF[colour] },
  })),
  ...digitCodes("4", (pen, colour) => ({ ...pen, background: colour })),
  ...digitCodes("9", (pen, colour) => ({ ...pen, foreground: steady(BRIGHT_OF[colour]) })),
  ...digitCodes("10", (pen, colour) => ({ ...pen, background: BRIGHT_OF[colour] })),
};

const INDEXED_COLOUR = "5";
const INDEXED_LENGTH = 3;

function indexedColour(parameter: string): AnsiColour | null {
  const index = Number.parseInt(parameter, 10);
  return basicColour(Number.isNaN(index) ? 0 : index);
}

function withIndexed(pen: Pen, code: "38" | "48", colour: AnsiColour | null): Pen {
  if (colour === null) {
    return pen;
  }
  return code === "38" ? { ...pen, foreground: steady(colour) } : { ...pen, background: colour };
}

export function penAfter(pen: Pen, sgr: string): Pen {
  const parameters = sgr.split(";");
  while (parameters.at(-1) === "") {
    parameters.pop();
  }
  let changed = parameters.length === 0 ? PLAIN_PEN : pen;
  let at = 0;
  while (at < parameters.length) {
    const [code = "", selector, index] = parameters.slice(at, at + INDEXED_LENGTH);
    if ((code === "38" || code === "48") && selector === INDEXED_COLOUR && index !== undefined) {
      changed = withIndexed(changed, code, indexedColour(index));
      at += INDEXED_LENGTH;
    } else {
      changed = SGR_CODES[code]?.(changed) ?? changed;
      at += 1;
    }
  }
  return changed;
}
