import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";

import { COLUMN_RESIZING_CLASS, useColumnDrag, type ColumnDrag } from "./useColumnDrag";

type PointerFields = { button?: number; buttons?: number; pointerId?: number; clientX?: number };

class FakeMouseEvent extends Event {
  readonly button: number;
  readonly buttons: number;
  readonly clientX: number;
  constructor(type: string, fields: PointerFields = {}) {
    super(type, { cancelable: true });
    this.button = fields.button ?? 0;
    this.buttons = fields.buttons ?? 0;
    this.clientX = fields.clientX ?? 0;
  }
}

class FakePointerEvent extends FakeMouseEvent {
  readonly pointerId: number;
  constructor(type: string, fields: PointerFields = {}) {
    super(type, fields);
    this.pointerId = fields.pointerId ?? 1;
  }
}

class FakeElement extends EventTarget {
  readonly captured: number[] = [];
  setPointerCapture(pointerId: number): void {
    this.captured.push(pointerId);
  }
}

type Rig = {
  readonly target: FakeElement;
  readonly classes: Set<string>;
  readonly moves: number[];
  readonly presses: Event[];
  readonly accepted: Event[];
  readonly resets: { count: number };
  readonly dots: { readonly value: string };
  accepting: boolean;
  dragging: boolean;
};

let scope: EffectScope;

beforeEach(() => {
  vi.stubGlobal("MouseEvent", FakeMouseEvent);
  vi.stubGlobal("PointerEvent", FakePointerEvent);
  vi.stubGlobal("Element", FakeElement);
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
});

function rig(): Rig {
  const target = new FakeElement();
  const classes = new Set<string>();
  const moves: number[] = [];
  const presses: Event[] = [];
  const accepted: Event[] = [];
  const resets = { count: 0 };
  const drag: ColumnDrag = {
    moveBy: (dx) => {
      moves.push(dx);
    },
  };
  const state = { accepting: true, dragging: true };
  const root = {
    classList: {
      add: (name: string) => {
        classes.add(name);
      },
      remove: (name: string) => {
        classes.delete(name);
      },
    },
  };
  const column = scope.run(() =>
    useColumnDrag(
      {
        accepts: (event) => {
          accepted.push(event);
          return state.accepting;
        },
        press: (event) => {
          presses.push(event);
          return state.dragging ? drag : null;
        },
        reset: () => {
          resets.count += 1;
        },
      },
      root,
    ),
  );
  if (column === undefined) {
    throw new Error("no scope");
  }
  for (const [type, listener] of Object.entries(column.listeners)) {
    target.addEventListener(type, listener);
  }
  return Object.assign(state, {
    target,
    classes,
    moves,
    presses,
    accepted,
    resets,
    dots: column.dots,
  });
}

function send(target: EventTarget, event: Event): Event {
  target.dispatchEvent(event);
  return event;
}

function pointer(type: string, fields: PointerFields = {}): FakePointerEvent {
  return new FakePointerEvent(type, fields);
}

test("an accepted main-button press cancels it, captures, marks the window and drags", () => {
  const r = rig();

  const down = send(r.target, pointer("pointerdown", { pointerId: 7, clientX: 50 }));

  expect(down.defaultPrevented).toBe(true);
  expect(r.accepted).toEqual([down]);
  expect(r.presses).toEqual([down]);
  expect(r.target.captured).toEqual([7]);
  expect([...r.classes]).toEqual([COLUMN_RESIZING_CLASS]);
  expect(r.dots.value).toBe("drag");
});

test("the window's class is the one row 6 styles", () => {
  expect(COLUMN_RESIZING_CLASS).toBe("col-resizing");
});

test("an accepted main-button mousedown is cancelled, so the keyboard stays", () => {
  const r = rig();

  expect(send(r.target, new FakeMouseEvent("mousedown")).defaultPrevented).toBe(true);
});

test("each move gets dx from the press", () => {
  const r = rig();
  send(r.target, pointer("pointerdown", { clientX: 50 }));

  send(r.target, pointer("pointermove", { clientX: 80 }));
  send(r.target, pointer("pointermove", { clientX: 20 }));

  expect(r.moves).toEqual([30, -30]);
});

test.each(["pointerup", "pointercancel", "lostpointercapture"])(
  "%s ends the drag and clears the window's class",
  (type) => {
    const r = rig();
    send(r.target, pointer("pointerdown", { pointerId: 3, clientX: 10 }));

    send(r.target, pointer(type, { pointerId: 3 }));
    send(r.target, pointer("pointermove", { pointerId: 3, clientX: 40 }));

    expect(r.classes.size).toBe(0);
    expect(r.dots.value).toBe("hover");
    expect(r.moves).toEqual([]);
  },
);

test("disposing the scope mid-drag clears the window's class", () => {
  const r = rig();
  send(r.target, pointer("pointerdown"));

  scope.stop();

  expect(r.classes.size).toBe(0);
  expect(r.dots.value).toBe("rest");
});

test("a second pointer's press, moves and release are ignored", () => {
  const r = rig();
  send(r.target, pointer("pointerdown", { pointerId: 1, clientX: 10 }));

  const second = send(r.target, pointer("pointerdown", { pointerId: 2, clientX: 90 }));
  send(r.target, pointer("pointermove", { pointerId: 2, clientX: 200 }));
  send(r.target, pointer("pointerup", { pointerId: 2 }));
  send(r.target, pointer("pointermove", { pointerId: 1, clientX: 15 }));

  expect(second.defaultPrevented).toBe(false);
  expect(r.presses).toHaveLength(1);
  expect(r.target.captured).toEqual([1]);
  expect(r.moves).toEqual([5]);
  expect(r.dots.value).toBe("drag");
});

test("moves without a press do nothing", () => {
  const r = rig();

  send(r.target, pointer("pointermove", { clientX: 40 }));
  send(r.target, pointer("pointerup"));

  expect(r.moves).toEqual([]);
  expect(r.dots.value).toBe("rest");
});

test("a rejected target does nothing and cancels nothing", () => {
  const r = rig();
  r.accepting = false;

  const down = send(r.target, pointer("pointerdown"));
  const mouse = send(r.target, new FakeMouseEvent("mousedown"));
  send(r.target, pointer("pointermove", { clientX: 40 }));

  expect(down.defaultPrevented).toBe(false);
  expect(mouse.defaultPrevented).toBe(false);
  expect(r.presses).toEqual([]);
  expect(r.target.captured).toEqual([]);
  expect(r.classes.size).toBe(0);
  expect(r.moves).toEqual([]);
  expect(r.dots.value).toBe("rest");
});

test.each([1, 2])("button %i does nothing and cancels nothing", (button) => {
  const r = rig();

  const down = send(r.target, pointer("pointerdown", { button }));
  const mouse = send(r.target, new FakeMouseEvent("mousedown", { button }));

  expect(down.defaultPrevented).toBe(false);
  expect(mouse.defaultPrevented).toBe(false);
  expect(r.presses).toEqual([]);
  expect(r.classes.size).toBe(0);
  expect(r.dots.value).toBe("rest");
});

test("a press that gives no drag does not capture or mark the window", () => {
  const r = rig();
  r.dragging = false;

  send(r.target, pointer("pointerdown"));
  send(r.target, pointer("pointermove", { clientX: 40 }));

  expect(r.presses).toHaveLength(1);
  expect(r.target.captured).toEqual([]);
  expect(r.classes.size).toBe(0);
  expect(r.dots.value).toBe("rest");
  expect(r.moves).toEqual([]);
});

function clickWith(r: Rig, accepting: boolean): void {
  r.accepting = accepting;
  send(r.target, pointer("pointerdown"));
  send(r.target, pointer("pointerup"));
}

test("a double-click resets only when both of its presses were accepted", () => {
  const r = rig();

  send(r.target, new FakeMouseEvent("dblclick"));
  expect(r.resets.count).toBe(0);

  clickWith(r, false);
  clickWith(r, true);
  send(r.target, new FakeMouseEvent("dblclick"));
  expect(r.resets.count).toBe(0);

  clickWith(r, true);
  clickWith(r, false);
  send(r.target, new FakeMouseEvent("dblclick"));
  expect(r.resets.count).toBe(0);

  clickWith(r, true);
  clickWith(r, true);
  send(r.target, new FakeMouseEvent("dblclick"));
  expect(r.resets.count).toBe(1);
});

test("a press with another button counts as a rejected one for the double-click", () => {
  const r = rig();

  send(r.target, pointer("pointerdown", { button: 2 }));
  clickWith(r, true);
  send(r.target, new FakeMouseEvent("dblclick"));

  expect(r.resets.count).toBe(0);
});

test("hover: an accepted target brightens, a rejected one rests, leaving rests", () => {
  const r = rig();

  send(r.target, pointer("pointerover"));
  expect(r.dots.value).toBe("hover");

  r.accepting = false;
  send(r.target, pointer("pointerover"));
  expect(r.dots.value).toBe("rest");

  r.accepting = true;
  send(r.target, pointer("pointerover"));
  send(r.target, pointer("pointerleave"));
  expect(r.dots.value).toBe("rest");
});

test("hover with a button held rests, even over an accepted target", () => {
  const r = rig();
  send(r.target, pointer("pointerover"));

  send(r.target, pointer("pointerover", { buttons: 1 }));

  expect(r.dots.value).toBe("rest");
});

test("hovering and leaving during a drag keep the drag's dots", () => {
  const r = rig();
  send(r.target, pointer("pointerdown"));

  r.accepting = false;
  send(r.target, pointer("pointerover"));
  send(r.target, pointer("pointerleave"));

  expect(r.dots.value).toBe("drag");
});
