export type BasicColour =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white";
type BrightColour =
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";
export type AnsiColour = BasicColour | BrightColour;

type Rgb = { readonly red: number; readonly green: number; readonly blue: number };

export const BASIC_COLOURS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
] as const satisfies readonly BasicColour[];

export const BRIGHT_OF: Readonly<Record<BasicColour, BrightColour>> = {
  black: "brightBlack",
  red: "brightRed",
  green: "brightGreen",
  yellow: "brightYellow",
  blue: "brightBlue",
  magenta: "brightMagenta",
  cyan: "brightCyan",
  white: "brightWhite",
};

const SIXTEEN: readonly AnsiColour[] = [
  ...BASIC_COLOURS,
  ...BASIC_COLOURS.map((colour) => BRIGHT_OF[colour]),
];

const XTERM_RGB: Readonly<Record<AnsiColour, Rgb>> = {
  black: { red: 0, green: 0, blue: 0 },
  red: { red: 205, green: 0, blue: 0 },
  green: { red: 0, green: 205, blue: 0 },
  yellow: { red: 205, green: 205, blue: 0 },
  blue: { red: 0, green: 0, blue: 238 },
  magenta: { red: 205, green: 0, blue: 205 },
  cyan: { red: 0, green: 205, blue: 205 },
  white: { red: 229, green: 229, blue: 229 },
  brightBlack: { red: 127, green: 127, blue: 127 },
  brightRed: { red: 255, green: 0, blue: 0 },
  brightGreen: { red: 0, green: 255, blue: 0 },
  brightYellow: { red: 255, green: 255, blue: 0 },
  brightBlue: { red: 92, green: 92, blue: 255 },
  brightMagenta: { red: 255, green: 0, blue: 255 },
  brightCyan: { red: 0, green: 255, blue: 255 },
  brightWhite: { red: 255, green: 255, blue: 255 },
};

const CUBE_FIRST = 16;
const CUBE_SIDE = 6;
const CUBE_LEVEL = { base: 55, step: 40 };
const GRAYS_FIRST = 232;
const GRAY_LEVEL = { base: 8, step: 10 };
const LAST_INDEX = 255;

function cubeLevel(step: number): number {
  return step === 0 ? 0 : CUBE_LEVEL.base + CUBE_LEVEL.step * step;
}

function xtermRgb(index: number): Rgb {
  if (index >= GRAYS_FIRST) {
    const level = GRAY_LEVEL.base + GRAY_LEVEL.step * (index - GRAYS_FIRST);
    return { red: level, green: level, blue: level };
  }
  const cube = index - CUBE_FIRST;
  return {
    red: cubeLevel(Math.floor(cube / (CUBE_SIDE * CUBE_SIDE))),
    green: cubeLevel(Math.floor(cube / CUBE_SIDE) % CUBE_SIDE),
    blue: cubeLevel(cube % CUBE_SIDE),
  };
}

function distance(left: Rgb, right: Rgb): number {
  const red = left.red - right.red;
  const green = left.green - right.green;
  const blue = left.blue - right.blue;
  return red * red + green * green + blue * blue;
}

function nearest(rgb: Rgb): AnsiColour {
  let best: AnsiColour = "black";
  for (const colour of SIXTEEN) {
    if (distance(rgb, XTERM_RGB[colour]) < distance(rgb, XTERM_RGB[best])) {
      best = colour;
    }
  }
  return best;
}

/** A 256-colour index as one of the 16: 0–7 the basic, 8–15 the bright ones; 16–231 (xterm's cube, levels 0, 95, 135,
 *  175, 215, 255) and 232–255 (grays 8 + 10·k) the nearest of the 16 by squared RGB distance on xterm's default
 *  palette, a tie to the lower index; anything else `null`. The triples are numbers that classify, never a colour
 *  painted (palette fence, design §1.8). */
export function basicColour(index: number): AnsiColour | null {
  if (!Number.isInteger(index) || index < 0 || index > LAST_INDEX) {
    return null;
  }
  return SIXTEEN[index] ?? nearest(xtermRgb(index));
}
