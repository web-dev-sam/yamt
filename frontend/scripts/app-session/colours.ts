const HEX_COLOUR = /^#?([0-9a-f]{6})$/i;
const HEX_RADIX = 16;
const BYTES_PER_PIXEL = 3;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const GREEN_OFFSET = 1;
const BLUE_OFFSET = 2;

export type Colour = { readonly hex: string; readonly rgb: number };

export type ColourRow = {
  readonly first: number;
  readonly last: number;
  readonly counts: readonly number[];
};

export function parseColour(text: string): Colour {
  const match = HEX_COLOUR.exec(text);
  if (match?.[1] === undefined) {
    throw new Error(`"${text}" is not a colour; expected 6 hex digits like 26282c`);
  }
  const hex = match[1].toLowerCase();
  return { hex, rgb: Number.parseInt(hex, HEX_RADIX) };
}

export function frameBytes(width: number, height: number): number {
  return width * height * BYTES_PER_PIXEL;
}

/** Fills `frame` from byte `filled` on and returns the new fill; `onFrame` gets the same buffer each time. */
export function feedFrames(
  frame: Uint8Array,
  filled: number,
  chunk: Uint8Array,
  onFrame: (frame: Uint8Array) => void,
): number {
  let fill = filled;
  for (let at = 0; at < chunk.length;) {
    const take = Math.min(frame.length - fill, chunk.length - at);
    frame.set(chunk.subarray(at, at + take), fill);
    fill += take;
    at += take;
    if (fill === frame.length) {
      onFrame(frame);
      fill = 0;
    }
  }
  return fill;
}

export function countColours(frame: Uint8Array, colours: readonly Colour[]): number[] {
  const wanted = colours.map(({ rgb }) => rgb);
  const counts = wanted.map(() => 0);
  for (let at = 0; at + BYTES_PER_PIXEL <= frame.length; at += BYTES_PER_PIXEL) {
    const pixel =
      ((frame[at] ?? 0) << RED_SHIFT) |
      ((frame[at + GREEN_OFFSET] ?? 0) << GREEN_SHIFT) |
      (frame[at + BLUE_OFFSET] ?? 0);
    for (let i = 0; i < wanted.length; i += 1) {
      if (wanted[i] === pixel) {
        counts[i] = (counts[i] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export function collapseRows(perFrame: readonly (readonly number[])[]): ColourRow[] {
  const rows: ColourRow[] = [];
  perFrame.forEach((counts, frame) => {
    const previous = rows.at(-1);
    if (previous !== undefined && previous.counts.every((count, i) => count === counts[i])) {
      rows[rows.length - 1] = { ...previous, last: frame };
    } else {
      rows.push({ first: frame, last: frame, counts });
    }
  });
  return rows;
}

export function framesWithMatch(perFrame: readonly (readonly number[])[], colour: number): number {
  return perFrame.filter((counts) => (counts[colour] ?? 0) > 0).length;
}
