import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import type { Command } from "./args";
import {
  COLLECT_SCRIPT,
  NAMED_SELECTOR,
  isNamed,
  nameOf,
  parseCandidates,
  pickByCss,
  pickByName,
  roleOf,
  type Candidate,
  type Query,
} from "./find";
import { chordActions, textActions, xdotoolChord } from "./keys";
import {
  parsePlacement,
  REVEAL_SCRIPT,
  screenPoint,
  scrollDelta,
  viewportPoint,
  type Placement,
} from "./placement";
import { run } from "./processes";
import { appSession, displayEnv, fromRoot } from "./session";
import type { SessionState } from "./state";
import { displayShot } from "./video";
import { execute, inSession, perform } from "./webdriver";

type Of<K extends Command["kind"]> = Extract<Command, { kind: K }>;
type Output = Readonly<Record<string, unknown>>;

const SCROLL_SETTLE_MS = 2000;
const SCROLL_POLL_MS = 100;

async function candidates(state: SessionState, selector: string): Promise<Candidate[]> {
  return parseCandidates(await execute(state, COLLECT_SCRIPT, [selector]));
}

async function reveal(state: SessionState, candidate: Candidate): Promise<Placement> {
  return parsePlacement(await execute(state, REVEAL_SCRIPT, [candidate.element]));
}

export async function click(state: SessionState, command: Of<"click">): Promise<Output> {
  const chosen = pickByName(await candidates(state, NAMED_SELECTOR), command.query);
  const placement = await reveal(state, chosen);
  const target = { role: roleOf(chosen), name: nameOf(chosen) };
  if (command.x11) {
    const point = screenPoint(placement);
    const env = displayEnv(appSession(state, "click --x11").display);
    await run(
      "xdotool",
      ["mousemove", "--sync", String(point.x), String(point.y), "click", "1"],
      env,
    );
    return { clicked: target, screen: point };
  }
  const point = viewportPoint(placement);
  await perform(state, [
    {
      type: "pointer",
      id: "mouse",
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", duration: 0, origin: "viewport", ...point },
        { type: "pointerDown", button: 0 },
        { type: "pointerUp", button: 0 },
      ],
    },
  ]);
  return { clicked: target, viewport: point };
}

export async function press(state: SessionState, command: Of<"press">): Promise<Output> {
  if (command.x11) {
    const env = displayEnv(appSession(state, "press --x11").display);
    await run("xdotool", ["key", "--clearmodifiers", ...command.chords.map(xdotoolChord)], env);
  } else {
    const actions = command.chords.flatMap(chordActions);
    await perform(state, [{ type: "key", id: "keyboard", actions }]);
  }
  return { pressed: command.chords, via: command.x11 ? "xdotool" : "webdriver" };
}

export async function typeText(state: SessionState, command: Of<"type">): Promise<Output> {
  if (command.x11) {
    const env = displayEnv(appSession(state, "type --x11").display);
    await run("xdotool", ["type", "--", command.text], env);
  } else {
    await perform(state, [{ type: "key", id: "keyboard", actions: textActions(command.text) }]);
  }
  return { typed: command.text };
}

async function scrollTarget(state: SessionState, query: Query): Promise<Candidate> {
  const named = await candidates(state, NAMED_SELECTOR);
  if (named.some((candidate) => isNamed(candidate, query))) {
    return pickByName(named, query);
  }
  let matches: Candidate[];
  try {
    matches = await candidates(state, query.name);
  } catch {
    throw new Error(`no element named "${query.name}", and it is not a CSS selector`);
  }
  return pickByCss(matches, query);
}

async function settledScrollTop(state: SessionState, candidate: Candidate): Promise<number> {
  let previous = Number.NaN;
  for (let waited = 0; waited < SCROLL_SETTLE_MS; waited += SCROLL_POLL_MS) {
    await sleep(SCROLL_POLL_MS);
    const { scrollTop } = await reveal(state, candidate);
    if (scrollTop === previous) {
      return scrollTop;
    }
    previous = scrollTop;
  }
  return previous;
}

export async function scroll(state: SessionState, command: Of<"scroll">): Promise<Output> {
  const chosen = await scrollTarget(state, command.query);
  const before = await reveal(state, chosen);
  const deltaY = Math.round(scrollDelta(command.to, before));
  if (deltaY !== 0) {
    const at = viewportPoint(before);
    const scrollAction = {
      type: "scroll",
      origin: "viewport",
      ...at,
      deltaX: 0,
      deltaY,
      duration: 0,
    };
    await perform(state, [{ type: "wheel", id: "wheel", actions: [scrollAction] }]);
  }
  return {
    scrolled: { role: roleOf(chosen), name: nameOf(chosen) },
    deltaY,
    scrollTop: await settledScrollTop(state, chosen),
  };
}

export async function read(state: SessionState, command: Of<"read">): Promise<Output> {
  return { value: await execute(state, `return (${command.expression});`, []) };
}

export async function shot(state: SessionState, command: Of<"shot">): Promise<Output> {
  const file = fromRoot(command.file);
  if (command.display) {
    await displayShot(appSession(state, "shot --display"), file);
    return { file, source: "display" };
  }
  const png = await inSession(state, "GET", "/screenshot");
  if (typeof png !== "string") {
    throw new Error("the screenshot reply is not base64 text");
  }
  writeFileSync(file, Buffer.from(png, "base64"));
  return { file, source: "page" };
}
