---
name: vue-conventions
description: House rules for Vue 3 in yamt's ui/ layer — script-setup section order, template refs, typed macros, vueuse-first, store singleton, Tailwind, the single editor seam — with vuejs-ai vue-best-practices and create-adaptable-composable (MIT) in references/. Autoloaded into web-impl.
---

# Vue conventions

Base: `references/vue-best-practices.md` (+ `references/vue-best-practices/*.md`, read the
`reactivity`, `sfc`, `component-data-flow`, `composables` ones before writing a component)
and `references/create-adaptable-composable.md`. House rules win on conflict.

## Component file shape

- [VU1] `<script setup lang="ts">` → `<template>` → `<style>`. A `<style>` block only for
  what Tailwind v4 cannot express. Detector: `vue/block-order`.
- [VU2] Script section order: imports → types → macros → state → computed → watch → lifecycle
  → functions. Detector: `scripts/check-sfc-order.ts` + `check-sfc-order.test.ts`.
- [VU3] Top-level functions are `function` declarations (hoisted). Detector: oxlint `func-style`.
- [VU4] `useTemplateRef<HTMLDivElement>("left")` for DOM hosts; never `ref<HTMLElement | null>(null)`.
- [VU5] Props and emits are type-based: `defineProps<{ files: FileEntry[] }>()`,
  `defineEmits<{ select: [path: string] }>()`. Detector: `vue/define-props-declaration`,
  `vue/define-emits-declaration`, `vue/require-typed-ref`.
- [VU6] Templates are declarative: no inline arrow handlers with logic, no ternaries beyond
  one level; derive in `computed`. Detector: `vue/*` recommended + review.

## Data flow

- [VU7] Props down, events up. `v-model` only for a true two-way contract (none expected in v0).
- [VU8] No `provide`/`inject` anywhere in v0 (there is no layout component). If one ever
  appears it is only in a layout-only component and uses an `InjectionKey<T>`.
- [VU9] The store is a module singleton: `createAppStore(source)` once in `main.ts`,
  `useAppStore()` in components. No Pinia. Actions live in `store.ts`, never in components.
- [VU10] Vue state never holds an `EditorView`, a document position, or document text
  (`skill://project-map` state table). The controller instance is a non-reactive `let`
  inside `useMergeController`, not a `ref`.
- [VU11] `useMergeController(data: MaybeRefOrGetter<FileMergeData | null>, hosts, { readOnly,
  preferences, collapsed })` is the **only** place `ui/` imports from `editor/`. It is an adaptable
  composable: `toRef(data)` and `readOnly` in a `watch` create/destroy the controller; `preferences` and
  `collapsed` reach a live controller through their own watches; `summary` is a `shallowRef` fed by
  `onSummaryChange`.

## Library use

- [VU12] `@vueuse/core` before any hand-rolled listener, observer, debounce, or media query —
  in `ui/` only (`editor/` is framework-free). Violation: `window.addEventListener("resize", …)` in a component.
- [VU13] Composables (`use*.ts`) accept `MaybeRefOrGetter` for read inputs, `MaybeRef` for
  writable ones, never for callbacks; normalise with `toValue`/`toRef` inside effects.
- [VU14] Tailwind v4 classes in templates, sorted by `oxfmt` (`sortTailwindcss`). The palette is
  the `@theme` block in `src/style.css` (stock colours reset, plan §2 row 24). The CodeMirror theme
  reads its `--color-*` variables; decoration classes (`.chunk-inserted`, …) live once in
  `editor/theme.css` as plain `var(--color-chunk-*)`. Detector: `scripts/palette.test.ts` (VU17).

## Splitting

- [VU15] Split by responsibility, not by section count (overrides the vendored "3+ sections
  ⇒ split" trigger). v0 set: `App`, `FileList`, `MergeToolbar`, `MergeView`, `WarningBanner`. A sixth
  component needs a one-line reason in `deviations_from_brief`. Detector:
  `vue/multi-word-component-names` (`App` exempt).
- [VU16] `App.vue` is a composition surface: layout + `useAppStore()` wiring, no feature logic.
