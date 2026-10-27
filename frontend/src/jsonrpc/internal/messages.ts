import * as v from "valibot";

const JSON_RPC = "2.0";

const ID = v.union([v.number(), v.string()]);

const PARAMS = v.optional(v.unknown());

export type Incoming =
  | {
      readonly kind: "request";
      readonly id: number | string;
      readonly method: string;
      readonly params: unknown;
    }
  | { readonly kind: "notification"; readonly method: string; readonly params: unknown }
  | { readonly kind: "result"; readonly id: number | string; readonly value: unknown }
  | {
      readonly kind: "error";
      readonly id: number | string | null;
      readonly code: number;
      readonly message: string;
      readonly data: unknown;
    };

const INCOMING: v.GenericSchema<unknown, Incoming> = v.union([
  v.pipe(
    v.object({ id: ID, method: v.string(), params: PARAMS }),
    v.transform(({ id, method, params }) => ({ kind: "request", id, method, params }) as const),
  ),
  v.pipe(
    v.object({ method: v.string(), params: PARAMS }),
    v.transform(({ method, params }) => ({ kind: "notification", method, params }) as const),
  ),
  v.pipe(
    v.object({
      id: v.nullable(ID),
      error: v.object({ code: v.number(), message: v.string(), data: v.optional(v.unknown()) }),
    }),
    v.transform(
      ({ id, error }) =>
        ({
          kind: "error",
          id,
          code: error.code,
          message: error.message,
          data: error.data,
        }) as const,
    ),
  ),
  v.pipe(
    v.looseObject({ id: ID, result: v.unknown() }),
    v.check((input) => Object.hasOwn(input, "result"), "a response without result or error"),
    v.transform(({ id, result }) => ({ kind: "result", id, value: result }) as const),
  ),
]);

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

function parseJson(text: string): Parsed<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

export function parseIncoming(text: string): Parsed<Incoming> {
  const json = parseJson(text);
  return json.ok ? parseWith(INCOMING, json.value) : { ok: false, reason: json.reason };
}

export function parseWith<I, T>(schema: v.GenericSchema<I, T>, value: unknown): Parsed<T> {
  const parsed = v.safeParse(schema, value);
  return parsed.success
    ? { ok: true, value: parsed.output }
    : { ok: false, reason: v.summarize(parsed.issues) };
}

export function requestText(id: number, method: string, params: unknown): string {
  return JSON.stringify({ jsonrpc: JSON_RPC, id, method, params });
}

export function notificationText(method: string, params: unknown): string {
  return JSON.stringify({ jsonrpc: JSON_RPC, method, params });
}

export function resultText(id: number | string, result: unknown): string {
  return JSON.stringify({ jsonrpc: JSON_RPC, id, result });
}

export function errorText(id: number | string, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: JSON_RPC, id, error: { code, message } });
}
