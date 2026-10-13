import { Facet, type EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

import { KEY_ACTIONS, type KeyAction, type KeyBindings } from "../../ipc";
import { cmKeys } from "./keys";
import type { Direction } from "./navigation";
import type { Side } from "./side";

export type SideCommand =
  | { readonly kind: "decide"; readonly decision: "apply" | "ignore" }
  | { readonly kind: "step"; readonly direction: Direction }
  | { readonly kind: "toward"; readonly side: Side };

type SideAction = Extract<
  KeyAction,
  "apply" | "ignore" | "next-change" | "previous-change" | "left-side" | "right-side"
>;

const SIDE_COMMANDS: Readonly<Record<SideAction, SideCommand>> = {
  apply: { kind: "decide", decision: "apply" },
  ignore: { kind: "decide", decision: "ignore" },
  "next-change": { kind: "step", direction: "down" },
  "previous-change": { kind: "step", direction: "up" },
  "left-side": { kind: "toward", side: "local" },
  "right-side": { kind: "toward", side: "remote" },
};

type SideRunner = (command: SideCommand) => void;

export const sideRunner = Facet.define<SideRunner, SideRunner>({
  combine: (runners) => runners[0] ?? (() => undefined),
});

function isSideAction(action: KeyAction): action is SideAction {
  return Object.hasOwn(SIDE_COMMANDS, action);
}

export function sideKeyCommands(
  keys: KeyBindings,
  platform: string,
): { readonly key: string; readonly command: SideCommand }[] {
  return KEY_ACTIONS.filter(isSideAction).flatMap((action) =>
    cmKeys(keys[action], platform).map((key) => ({ key, command: SIDE_COMMANDS[action] })),
  );
}

export function runSideKey(state: EditorState, command: SideCommand): boolean {
  state.facet(sideRunner)(command);
  return true;
}

export function sideKeys(keys: KeyBindings, platform: string): Extension {
  return keymap.of(
    sideKeyCommands(keys, platform).map(({ key, command }) => ({
      key,
      preventDefault: true,
      run: (view) => runSideKey(view.state, command),
    })),
  );
}
