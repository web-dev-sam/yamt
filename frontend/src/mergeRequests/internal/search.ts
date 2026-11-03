export type SearchedRequest = { readonly iid: number; readonly title: string };

function namedNumbers(text: string): ReadonlySet<number> {
  const words = text.match(/[\p{L}\d]+/gu) ?? [];
  const numbers = words.filter((word) => /^\d+$/.test(word));
  return new Set(numbers.map((digits) => Number(digits)));
}

export function searched<R extends SearchedRequest>(
  rows: readonly R[],
  text: string,
): readonly R[] {
  const wanted = text.trim().toLowerCase();
  if (wanted === "") {
    return rows;
  }
  const numbers = namedNumbers(wanted);
  return rows.filter((row) => numbers.has(row.iid) || row.title.toLowerCase().includes(wanted));
}
