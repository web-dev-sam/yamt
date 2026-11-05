export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};
/** Pixels relative to the field's border box, after its scroll: the caret's left, its line's top and bottom. */
export type CaretBox = { readonly left: number; readonly top: number; readonly bottom: number };

const COPIED: Readonly<Record<string, true>> = {
  direction: true,
  "padding-top": true,
  "padding-right": true,
  "padding-bottom": true,
  "padding-left": true,
  "line-height": true,
  "letter-spacing": true,
  "word-spacing": true,
  "tab-size": true,
  "text-indent": true,
  "text-transform": true,
  "text-align": true,
};

// CSS 2.1 §10.8.1: half of a line box's leading sits above the glyphs' inline box, half below.
const HALF_LEADING = 0.5;

function pixels(value: string | undefined): number {
  return Number.parseFloat(value ?? "0");
}

/** The mirror's inline style for a field with `computed` style and `clientWidth` (design §2.5 step 2). */
export function mirrorStyle(
  computed: Readonly<Record<string, string>>,
  clientWidth: number,
): Readonly<Record<string, string>> {
  const copied = Object.entries(computed).filter(
    ([name]) => COPIED[name] === true || name.startsWith("font"),
  );
  const content =
    clientWidth - pixels(computed["padding-left"]) - pixels(computed["padding-right"]);
  return {
    ...Object.fromEntries(copied),
    "box-sizing": "content-box",
    "white-space": "pre-wrap",
    "overflow-wrap": "break-word",
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    width: `${content}px`,
  };
}

/** Where `index`'s caret is drawn in `field` (mirror-div measure, design §2.5). */
export function caretBox(field: HTMLTextAreaElement, index: number): CaretBox {
  const style = getComputedStyle(field);
  const computed = Object.fromEntries(
    Array.from(style, (name) => [name, style.getPropertyValue(name)] as const),
  );
  const mirror = document.createElement("div");
  for (const [name, value] of Object.entries(mirrorStyle(computed, field.clientWidth))) {
    mirror.style.setProperty(name, value);
  }
  const caret = document.createElement("span");
  const rest = field.value.slice(index);
  caret.textContent = rest === "" ? "." : rest;
  mirror.append(field.value.slice(0, index), caret);
  document.body.append(mirror);
  const origin = mirror.getBoundingClientRect();
  const glyph = caret.getClientRects()[0] ?? caret.getBoundingClientRect();
  mirror.remove();
  const glyphHeight = glyph.bottom - glyph.top;
  const lineHeight = pixels(style.lineHeight);
  const line = Number.isNaN(lineHeight) ? glyphHeight : lineHeight;
  const leading = (line - glyphHeight) * HALF_LEADING;
  const top = glyph.top - leading - origin.top + pixels(style.borderTopWidth) - field.scrollTop;
  return {
    left: glyph.left - origin.left + pixels(style.borderLeftWidth) - field.scrollLeft,
    top,
    bottom: top + line,
  };
}

/** The viewport intersected with every ancestor of `element` whose overflow is not `visible` (viewport pixels). */
export function visibleRoom(element: HTMLElement): Rect {
  let room: Rect = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let at = element.parentElement; at !== null; at = at.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(at);
    if (overflowX !== "visible" || overflowY !== "visible") {
      const box = at.getBoundingClientRect();
      room = {
        left: Math.max(room.left, box.left),
        top: Math.max(room.top, box.top),
        right: Math.min(room.right, box.right),
        bottom: Math.min(room.bottom, box.bottom),
      };
    }
  }
  return room;
}
