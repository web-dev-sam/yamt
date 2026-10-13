export type JsonRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function recordOf(value: unknown, what: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`${what}: expected an object, got ${JSON.stringify(value)}`);
  }
  return value;
}

export function stringField(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`field "${key}": expected a string, got ${JSON.stringify(value)}`);
  }
  return value;
}

export function numberField(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`field "${key}": expected a number, got ${JSON.stringify(value)}`);
  }
  return value;
}

export function booleanField(record: JsonRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`field "${key}": expected true or false, got ${JSON.stringify(value)}`);
  }
  return value;
}
