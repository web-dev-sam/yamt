---
name: ts-conventions
description: TypeScript rules for yamt's frontend — strictness, brands for line spaces, exhaustiveness, no casts, structured logging, file layout — on top of cursor/plugins typescript-best-practices (MIT, in references/). Autoloaded into web-impl.
---

# TypeScript conventions

Base: `references/typescript-best-practices.md` (rule table) and
`references/typescript-patterns.md` (examples). House rules below override where they differ.

## Types (vision 4)

- [TS1] Line numbers are branded: `BaseLine`, `LocalLine`, `RemoteLine` (created only in
  `ipc/domain.ts`), `DocPos` (created only in `editor/`). `LineRange<L> = { start: L; len: number }`.
  A function taking a line takes the branded type. Violation: `function lineTop(line: number)`.
- [TS2] Variants are discriminated unions with a `kind` field (`ChunkAction = { kind: "apply" | "ignore"; side; chunks }`, `editor/internal/apply.ts`);
  no optional-field bags. A fact held per side is a `Readonly<Record<Side, …>>` of a closed union:
  chunk status is `Readonly<Record<Side, "pending" | "applied" | "ignored">>` (plan §2 #33), never
  `{ applied?: boolean; side?: Side }`.
- [TS3] Every `switch` over a union ends in `default: { const _exhaustive: never = x; return _exhaustive; }`
  or has no default and is covered by tsgolint `switch-exhaustiveness-check` (enabled; both forms pass).
- [TS4] No `as`, no `!`, no `any`. The only exception is `ipc/fixture.ts`, after valibot parsing.
  Prefer `satisfies` to keep literal types. Detector: oxlint `consistent-type-assertions`,
  `no-non-null-assertion`, `no-explicit-any` with a file override for `fixture.ts`.
- [TS5] External data is parsed once at the boundary: fixture JSON → valibot schema →
  domain type. Tauri IPC payloads are generated from Rust and trusted (decision 19).
- [TS6] Derive before declaring: `Pick`/`Omit`/`ReturnType`/`Parameters`/`typeof` over a
  parallel interface. The generated `bindings.ts` is the authority for DTO shapes.
- [TS7] A function with ≥ 3 parameters takes an object parameter when two of them have types that
  can be swapped without a type error (two `number`s, two `string`s, two `Side`s). Positional is
  fine when every parameter has its own type (`isSideOpen(chunk, status, side)`,
  `mapSpans(spans, changes, doc, applied)`), and in the per-frame paths (`connectors/`,
  `scrollSync.ts`, `strips.ts`, `gap.ts`). Violation: `lineSpan(doc, from: number, to: number)`.

## Modules and files (Rust-typical, vision 1)

- [TS8] `index.ts` is the module's `lib.rs`: the only file other modules may import. Submodules
  are `<name>.ts`; private ones live in `internal/`. Detector: oxlint `no-restricted-imports`.
- [TS9] Tests next to code as `<name>.test.ts`. Types live with the module that owns them.
  No `types/`, `utils/`, `helpers/`, `common/`, `lib/` directories. Detector: review.
- [TS10] Top-level functions are `function` declarations; arrow functions only as arguments
  or in-expression. Detector: oxlint `func-style: declaration`.
- [TS11] One concept per file: a type with its constructors and predicates (`status.ts`:
  `ChunkStatus`, `isSideOpen`, `statusAfterApply`, `summarize`), or one module-private vocabulary
  (`geometry.ts`: `Pane`, `PaneViews`, `ChunkRow`, `rangeSpan`). Not "one export". A file that mixes
  two concepts is split. Violation: `tone.ts` exporting `Side` and `sideChanged` next to `Tone` (#152).
  Functions ≤ 40 lines, non-test files ≤ 300; test files have no line cap. Detector: oxlint
  `max-lines-per-function`, `max-lines`.
- [TS16] No export without an importer. Detector: `pnpm unused` (knip).
- [TS17] A table whose keys are known when the code is written is a `Readonly<Record<K, V>>`
  literal (membership: `Record<string, true>`); `Map`/`Set` only for keys computed at runtime.

## Runtime hygiene

- [TS12] No `console.*` outside `ipc/log.ts`. Use `log.debug/info/warn/error(event, fields)`
  with a dotted event name (`scroll.drift`, `apply.chunk`). Detector: oxlint `no-console`.
- [TS13] No floating promises; IPC calls are awaited or explicitly `void`-ed with a reason
  (`log` is the only fire-and-forget). Detector: tsgolint `no-floating-promises`.
- [TS14] No magic numbers; `const LINE_HEIGHT_PX = …` next to its only user. Detector:
  oxlint `no-magic-numbers` (0, 1, -1 ignored).
- [TS15] Mutable module state is forbidden except: the store singleton in `ui/store.ts`; the
  controller instance held by `useMergeController`; and parse-once caches of constant build-time
  inputs, read through one function and copied per use (`strips.ts` `parsedIcons`: Lucide markup →
  parsed `<svg>`, `cloneNode` per button). Everything else is a parameter or a return.

## Strictness (tsconfig, do not loosen)

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`. `vue-tsc --noEmit`
is the type gate; oxlint runs with `typeAware: true`.
