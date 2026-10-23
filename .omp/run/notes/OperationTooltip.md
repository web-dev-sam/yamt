# OperationTooltip (3.I-tooltip, round 1)

Brief `docs/slices/briefs/3.I-operation-tooltip.md`; plan §2 #100. Base `4f0537c`.

## Summary

`OperationLabel.vue`: no `title`; `mouseenter` opens, `mouseleave` closes, a watch on the tag's bounding width closes it
when the list hides (`v-show`). The tooltip is a `fixed z-500` sibling of the tag inside the file list's `<aside>` (no
Teleport: a teleported box stayed visible on the first check after Ctrl+B, the close waiting for the ResizeObserver).
Text `line.tooltip`, `pre-wrap`, `w-max` up to 480 px; `aria-hidden`; the description is a `hidden` span
(`aria-describedby="operation-tooltip"`). Placement: pure `tooltipBox` in `ui/operationTooltip.ts` (left on the tag's
word, bottom 4 px above the tag, width and height capped by the window); 5 node tests.

## Evidence (WebKit fixture, dark and light)

Rebase: no tooltip before; one pointer move, next call → visible, transition 0s, animation none; text = the tooltip;
rect left 17 = text left, bottom 925.02 = tag top 929.02 − 4; no ancestor stacking context; topmost element over the
pane = the tooltip; no `title` up to `<html>`; computedlabel = the line; description text = the tooltip. Pointer off →
gone; Ctrl+B → gone; Ctrl+B again → closed; move → open. Merge: one line, width 246.67 = text + padding + border.
1400×150: top 0, cut, first line kept. Screenshots `/tmp/yamt-op-tooltip/{rebase-dark,rebase-light,short-150}.png`.
`pnpm -C frontend typecheck/test (1952)/lint/unused/fmt:check` exit 0.

## Deviations (accepted)

- Map line for `operationTooltip.ts`: applied by the orchestrator.
- No Teleport, no `useMenuPlacement` reuse (it shifts the box left; #100 fixes the left edge and narrows the box).
- z-index 500 (CodeMirror's tooltip layer; the minimap is 400).
- `FileList.vue` unchanged.

## Open risks

- Minimap overlap proven by z order only (the tooltip never reaches the Result pane at tested sizes).
- Right-edge narrowing proven by unit tests only.
- A hide and show inside one frame would keep it open (not reachable by a key pair).
