export const OPAQUE_HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/;

type Definition = { readonly name: string; readonly value: string; readonly line: number };
type ContrastViolation = {
  readonly rule: "ansi-contrast";
  readonly file: string;
  readonly line: number;
  readonly match: string;
};

const ANSI_TOKEN = /^--color-ansi-/;
const PANEL_TOKEN = "--color-panel";
const MINIMUM_CONTRAST = 4.5;
const TENTHS = 10;
const HEX_RADIX = 16;
const CHANNEL_MAX = 255;
const SRGB = { knee: 0.04045, slope: 12.92, offset: 0.055, gamma: 2.4 };
const WEIGHTS = { red: 0.2126, green: 0.7152, blue: 0.0722 };
const FLARE = 0.05;

function linear(pair: string): number {
  const channel = Number.parseInt(pair, HEX_RADIX) / CHANNEL_MAX;
  if (channel <= SRGB.knee) return channel / SRGB.slope;
  return ((channel + SRGB.offset) / (1 + SRGB.offset)) ** SRGB.gamma;
}

function luminance(hex: string): number | undefined {
  const channels = OPAQUE_HEX.exec(hex)?.slice(1).map(linear);
  if (channels === undefined) return undefined;
  const [red = 0, green = 0, blue = 0] = channels;
  return WEIGHTS.red * red + WEIGHTS.green * green + WEIGHTS.blue * blue;
}

function contrastRatio(first: string, second: string): number | undefined {
  const [one, other] = [luminance(first), luminance(second)];
  if (one === undefined || other === undefined) return undefined;
  return (Math.max(one, other) + FLARE) / (Math.min(one, other) + FLARE);
}

export function ansiContrastFindings(block: {
  readonly file: string;
  readonly definitions: readonly Definition[];
}): ContrastViolation[] {
  const panel = block.definitions.find(({ name }) => name === PANEL_TOKEN)?.value ?? "";
  return block.definitions
    .filter(({ name }) => ANSI_TOKEN.test(name))
    .flatMap(({ name, value, line }): ContrastViolation[] => {
      const ratio = contrastRatio(value, panel);
      if (ratio === undefined || ratio >= MINIMUM_CONTRAST) return [];
      const shown = (Math.floor(ratio * TENTHS) / TENTHS).toFixed(1);
      return [
        { rule: "ansi-contrast", file: block.file, line, match: `${name}: ${value} ${shown}:1` },
      ];
    });
}
