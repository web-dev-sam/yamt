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
- [TS2] Variants are discriminated unions with a `kind` field; no optional-field bags.
  Chunk status is `"pending" | "applied-local" | "applied-remote" | "applied-both" | "dismissed"`,
  never `{ applied?: boolean; side?: Side }`.
- [TS3] Every `switch` over a union ends in `default: { const _exhaustive: never = x; return _exhaustive; }`
  or has no default and is covered by tsgolint `switch-exhaustiveness-check` (enabled; both forms pass).
- [TS4] No `as`, no `!`, no `any`. The only exception is `ipc/fixture.ts`, after valibot parsing.
  Prefer `satisfies` to keep literal types. Detector: oxlint `consistent-type-assertions`,
  `no-non-null-assertion`, `no-explicit-any` with a file override for `fixture.ts`.
- [TS5] External data is parsed once at the boundary: fixture JSON → valibot schema →
  domain type. Tauri IPC payloads are generated from Rust and trusted (decision 19).
- [TS6] Derive before declaring: `Pick`/`Omit`/`ReturnType`/`Parameters`/`typeof` over a
  parallel interface. The generated `bindings.ts` is the authority for DTO shapes.
- [TS7] Object parameters for functions with ≥ 3 arguments, except per-frame paths
  (`connectors/`, `editor/internal/scrollSync.ts`, `strips.ts`) where positional is allowed.

## Modules and files (Rust-typical, vision 1)

- [TS8] `index.ts` is the module's `lib.rs`: the only file other modules may import. Submodules
  are `<name>.ts`; private ones live in `internal/`. Detector: oxlint `no-restricted-imports`.
- [TS9] Tests next to code as `<name>.test.ts`. Types live with the module that owns them.
  No `types/`, `utils/`, `helpers/`, `common/`, `lib/` directories. Detector: review.
- [TS10] Top-level functions are `function` declarations; arrow functions only as arguments
  or in-expression. Detector: oxlint `func-style: declaration`.
- [TS11] One exported thing per file unless they are a type and its single constructor.
  Files ≤ 300 lines; functions ≤ 40 lines.

## Runtime hygiene

- [TS12] No `console.*` outside `ipc/log.ts`. Use `log.debug/info/warn/error(event, fields)`
  with a dotted event name (`scroll.drift`, `apply.chunk`). Detector: oxlint `no-console`.
- [TS13] No floating promises; IPC calls are awaited or explicitly `void`-ed with a reason
  (`log` is the only fire-and-forget). Detector: tsgolint `no-floating-promises`.
- [TS14] No magic numbers; `const LINE_HEIGHT_PX = …` next to its only user. Detector:
  oxlint `no-magic-numbers` (0, 1, -1 ignored).
- [TS15] Mutable module state is forbidden except the store singleton in `ui/store.ts` and the
  controller instance held by `useMergeController`. Everything else is a parameter or a return.

## Strictness (tsconfig, do not loosen)

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`. `vue-tsc --noEmit`
is the type gate; oxlint runs with `typeAware: true`.
