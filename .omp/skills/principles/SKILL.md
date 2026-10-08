---
name: principles
description: The four engineering lenses every yamt implementer and reviewer applies — type-system discipline, minimize reader load, foundational thinking, redesign from first principles. Condensed from cursor/plugins pstack (MIT); full text in references/.
---

# Principles

Four lenses. Apply them in this order when designing; a reviewer cites them by name.

## 1. Type-system discipline (`references/principle-type-system-discipline.md`)

The type checker is a proof assistant. A case the types let you ignore becomes a runtime
failure the compiler could have stopped.

- Illegal states unrepresentable: sum types (Rust enums with payloads, TS discriminated
  unions), never a bag of optional fields. If a comment could explain "when this combination
  is valid", the type is too loose.
- Build types constructively: non-empty = head + rest; a range = start + len. Choose the shape
  that cannot build the illegal value.
- Brand semantic primitives: `BaseLine` ≠ `LocalLine` ≠ `DocPos` even though all are numbers.
- External data is untyped until parsed — once, at the boundary, into a named domain type.
  Inside, trust the types. (yamt exception, decision 19: Tauri payloads are generated from our
  own Rust and trusted; fixture JSON is parsed.)
- Never lie to the compiler: no `as`, no `unwrap`, no `!`. If it cannot prove the fact, prove it.
- Exhaustive matching is the compiler's job: `switch` with `never` default / tsgolint rule;
  Rust `match` with no wildcard arm on domain enums.
- Strengthen a type only where partiality appears, then stop. Prefer total functions.

## 2. Minimize reader load (`references/principle-minimize-reader-load.md`)

Two axes: **layers to trace** between question and answer, **state to hold** in the head.

- Collapse one-caller wrappers, adapters with one implementation, speculative indirection.
- Adjacent layers must change the abstraction; a pass-through layer is pure cost.
- Prefer pure functions → locals → fields → module state → globals. Derive, don't sync.
- Name the invariant at the boundary once, not in every consumer.
- Test: can a new reader answer "where does X come from?" and "what can change X?" in 30 s?

## 3. Foundational thinking (`references/principle-foundational-thinking.md`)

- Data structures first. Get the shape right; logic becomes obvious.
- DRY the structure, not every line. Three similar statements beat a premature abstraction.
- Scaffold before features when every later phase benefits (CI, lints, test infra, shared types).
- Subtraction before scaffolding: delete dead code first.
- Each increment lands one coherent abstraction, not a capability smeared across callers.

## 4. Redesign from first principles (`references/principle-redesign-from-first-principles.md`)

When a requirement changes an existing design, do not bolt it on. Ask "what would we build
if this had been a requirement from day one?", then deliver that incrementally and propagate
through every reference (types, docs, tests, decision record).

## How they resolve against each other

Type discipline (1) can add layers; reader load (2) removes them. The tie-breaker is yamt
vision 1: readable by a Rust beginner. A brand or a sum type that removes a runtime check is
worth its line; a generic that serves one caller is not.
