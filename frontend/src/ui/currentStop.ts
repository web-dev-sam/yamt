export type Stop = { dropped: boolean };

export async function landed<T>(stop: Readonly<Stop>, call: () => Promise<T>): Promise<T | null> {
  const reply = await call();
  return stop.dropped ? null : reply;
}
