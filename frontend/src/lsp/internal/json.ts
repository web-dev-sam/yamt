function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
    );
  }
  return Object.is(a, b);
}

export function sectionOf(value: unknown, section: string): unknown {
  if (section === "") {
    return value;
  }
  let found = value;
  for (const key of section.split(".")) {
    if (!isObject(found) || !Object.hasOwn(found, key)) {
      return null;
    }
    found = found[key];
  }
  return found;
}
