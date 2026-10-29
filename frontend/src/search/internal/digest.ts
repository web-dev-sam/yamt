// cyrb53 by bryc (public domain): https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
const SEED_1 = 0xdeadbeef;
const SEED_2 = 0x41c6ce57;
const MULTIPLIER_1 = 2654435761;
const MULTIPLIER_2 = 1597334677;
const MIX_1 = 2246822507;
const MIX_2 = 3266489909;
const SHIFT_1 = 16;
const SHIFT_2 = 13;
const LOW_21_BITS = 0x1fffff;
const UINT32_RANGE = 0x100000000;

export function digestOf(text: string): number {
  let h1 = SEED_1;
  let h2 = SEED_2;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, MULTIPLIER_1);
    h2 = Math.imul(h2 ^ code, MULTIPLIER_2);
  }
  h1 = Math.imul(h1 ^ (h1 >>> SHIFT_1), MIX_1);
  h1 ^= Math.imul(h2 ^ (h2 >>> SHIFT_2), MIX_2);
  h2 = Math.imul(h2 ^ (h2 >>> SHIFT_1), MIX_1);
  h2 ^= Math.imul(h1 ^ (h1 >>> SHIFT_2), MIX_2);
  return UINT32_RANGE * (h2 & LOW_21_BITS) + (h1 >>> 0);
}
