/** A held item stays at its index in `previous`, taking its `next` version; the others fill the rest in `next`'s
 *  order; a held item missing from `next` is dropped. */
export function keptInPlace<T, K>(
  previous: readonly T[],
  next: readonly T[],
  held: ReadonlySet<K>,
  keyOf: (item: T) => K,
): readonly T[] {
  const nextOf = new Map(next.map((item) => [keyOf(item), item]));
  const kept = previous.flatMap((item, at) => {
    const key = keyOf(item);
    const now = held.has(key) ? nextOf.get(key) : undefined;
    return now === undefined ? [] : [{ key, item: now, at }];
  });
  const keptKeys = new Set(kept.map(({ key }) => key));
  const order = next.filter((item) => !keptKeys.has(keyOf(item)));
  for (const { item, at } of kept) {
    order.splice(at, 0, item);
  }
  return order;
}
