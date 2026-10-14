export type DocVersion = number & { readonly __brand: "DocVersion" };

export function isDocVersion(n: number): n is DocVersion {
  return Number.isSafeInteger(n) && n > 0;
}

export function nextVersion(previous: DocVersion | null): DocVersion {
  const next = (previous ?? 0) + 1;
  if (!isDocVersion(next)) {
    throw new RangeError(`document version ${next} is not a safe integer`);
  }
  return next;
}
