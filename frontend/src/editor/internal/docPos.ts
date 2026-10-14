export type DocPos = number & { readonly __brand: "DocPos" };

function isDocPos(n: number): n is DocPos {
  return Number.isSafeInteger(n) && n >= 0;
}

export function toDocPos(n: number): DocPos {
  if (!isDocPos(n)) {
    throw new Error(`${n} is not a document position`);
  }
  return n;
}
