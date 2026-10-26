export function isNonNegativeInteger(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

export function invalid(field: string, value: number): Error {
  return new Error(`${field} must be a non-negative safe integer, got ${value}`);
}

export function branded<T extends number>(
  value: number,
  isBrand: (n: number) => n is T,
  field: string,
): T {
  if (!isBrand(value)) {
    throw invalid(field, value);
  }
  return value;
}
