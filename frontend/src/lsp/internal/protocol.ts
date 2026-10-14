import * as v from "valibot";

const POSITION = v.object({ line: v.number(), character: v.number() });

const RANGE = v.object({ start: POSITION, end: POSITION });

const DIAGNOSTIC = v.object({
  range: RANGE,
  severity: v.optional(v.number()),
  message: v.string(),
  source: v.optional(v.string()),
  code: v.optional(v.union([v.number(), v.string()])),
});

export type Diagnostic = v.InferOutput<typeof DIAGNOSTIC>;

export const PUBLISH_DIAGNOSTICS = v.object({
  uri: v.string(),
  version: v.optional(v.nullable(v.number())),
  diagnostics: v.array(DIAGNOSTIC),
});

export const DIAGNOSTIC_REPORT = v.variant("kind", [
  v.object({
    kind: v.literal("full"),
    resultId: v.optional(v.string()),
    items: v.array(DIAGNOSTIC),
  }),
  v.object({ kind: v.literal("unchanged"), resultId: v.string() }),
]);

export const INITIALIZE_RESULT = v.object({
  capabilities: v.object({
    diagnosticProvider: v.optional(v.unknown()),
    documentFormattingProvider: v.optional(v.unknown()),
  }),
});

const TEXT_EDIT = v.object({ range: RANGE, newText: v.string() });

export type TextEdit = v.InferOutput<typeof TEXT_EDIT>;

export const TEXT_EDITS = v.nullable(v.array(TEXT_EDIT));

export const MESSAGE_PARAMS = v.object({ type: v.number(), message: v.string() });

export const CONFIGURATION_PARAMS = v.object({
  items: v.array(v.object({ section: v.optional(v.string()) })),
});

export const APPLY_EDIT_PARAMS = v.object({ label: v.optional(v.string()) });
