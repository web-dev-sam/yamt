import { shallowRef, type ShallowRef } from "vue";

import {
  log,
  type AddedServer,
  type FileEntry,
  type RepositoryAnswer,
  type ServerHost,
} from "../ipc";
import { addedSpecs, detect, type LanguageServers, type ServerSpec } from "../lsp";
import type { Asking } from "./asking";
import { unexpected } from "./problem";
import type { Question } from "./question";
import type { SettingsActions, SettingsInUse } from "./settings";

type SetupTarget = Pick<SettingsActions, "setServerAnswer" | "setAddedServers"> & {
  readonly host: ServerHost | null;
  readonly servers: Pick<LanguageServers, "setSpecs">;
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
  readonly asking: Pick<Asking, "question" | "ask" | "answer">;
};

type Setup = SetupTarget & {
  readonly root: ShallowRef<string | null>;
  readonly found: ShallowRef<readonly ServerSpec[]>;
  started: boolean;
  dismissals: number;
  latestLook: number;
};

export type ServerSetup = {
  readonly serverRoot: Readonly<ShallowRef<string | null>>;
  readonly foundServers: Readonly<ShallowRef<readonly ServerSpec[]>>;
  setUpServers(): Promise<void>;
  findServers(): Promise<void>;
  answerServers(answer: RepositoryAnswer): Promise<void>;
  addServer(server: AddedServer): Promise<void>;
  removeServer(index: number): Promise<void>;
  dismissQuestion(): void;
};

export function parseAddedServer(command: string, fileTypes: string): AddedServer | null {
  const words = command.split(" ").filter((word) => word !== "");
  const types = fileTypes
    .split(/[\s,]+/)
    .map((type) => type.replace(/^\.+/, "").toLowerCase())
    .filter((type) => type !== "");
  return words.length === 0 || types.length === 0 ? null : { command: words, fileTypes: types };
}

async function look(setup: Setup, host: ServerHost): Promise<boolean> {
  setup.latestLook += 1;
  const ticket = setup.latestLook;
  const paths = setup.files.value.map((file) => file.path);
  try {
    const { root } = await host.context();
    if (root === null) {
      return false;
    }
    const found = await detect(paths, host, root);
    if (ticket !== setup.latestLook) {
      return false;
    }
    setup.root.value = root;
    setup.found.value = found;
    return true;
  } catch (error) {
    log.warn("servers.detect_failed", { ...unexpected(error) });
    return false;
  }
}

function addedOf(setup: Setup): readonly ServerSpec[] {
  const taken = setup.found.value.map((spec) => spec.name);
  return addedSpecs(setup.settings.value.languageServers.added, taken);
}

function storedAnswer(setup: Setup): RepositoryAnswer | null {
  const root = setup.root.value;
  return root === null ? null : (setup.settings.value.languageServers.repositories[root] ?? null);
}

function apply(setup: Setup, answer: RepositoryAnswer | null): void {
  const specs = [...setup.found.value, ...addedOf(setup)];
  setup.servers.setSpecs(specs, { startOnOpen: answer === "start" });
}

async function ask(setup: Setup): Promise<RepositoryAnswer | null> {
  if (setup.asking.question.value !== null) {
    return null;
  }
  const dismissals = setup.dismissals;
  const question: Question = { kind: "servers", found: setup.found.value, added: addedOf(setup) };
  const yes = await setup.asking.ask(question);
  if (setup.dismissals !== dismissals) {
    return null;
  }
  return yes ? "start" : "dontStart";
}

async function setUp(setup: Setup): Promise<void> {
  if (setup.host === null || !(await look(setup, setup.host))) {
    return;
  }
  if (setup.found.value.length + addedOf(setup).length > 0) {
    const stored = storedAnswer(setup);
    const answer = stored ?? (await ask(setup));
    if (stored === null && answer !== null) {
      await setup.setServerAnswer(answer);
    }
    apply(setup, answer);
  }
  setup.started = true;
}

async function findAgain(setup: Setup): Promise<void> {
  if (setup.host !== null && setup.started && (await look(setup, setup.host))) {
    apply(setup, storedAnswer(setup));
  }
}

async function answer(setup: Setup, given: RepositoryAnswer): Promise<void> {
  await setup.setServerAnswer(given);
  if (setup.root.value === null) {
    return;
  }
  if (given === "dontStart") {
    // Removed specs are halted, not stopped by the user, so a later Start answer starts their
    // successors on open (`LanguageServers.#create` in lsp/index.ts carries only `userStopped`).
    setup.servers.setSpecs([], { startOnOpen: false });
  }
  apply(setup, given);
}

async function changeAdded(setup: Setup, added: readonly AddedServer[]): Promise<void> {
  await setup.setAddedServers(added);
  if (setup.root.value !== null) {
    apply(setup, storedAnswer(setup));
  }
}

export function createServerSetup(target: SetupTarget): ServerSetup {
  const setup: Setup = {
    ...target,
    root: shallowRef<string | null>(null),
    found: shallowRef<readonly ServerSpec[]>([]),
    started: false,
    dismissals: 0,
    latestLook: 0,
  };
  function added(): readonly AddedServer[] {
    return setup.settings.value.languageServers.added;
  }
  return {
    serverRoot: setup.root,
    foundServers: setup.found,
    setUpServers: () => setUp(setup),
    findServers: () => findAgain(setup),
    answerServers: (given) => answer(setup, given),
    addServer: (server) => changeAdded(setup, [...added(), server]),
    removeServer: (index) =>
      changeAdded(
        setup,
        added().filter((_, at) => at !== index),
      ),
    dismissQuestion: () => {
      setup.dismissals += 1;
      setup.asking.answer(false);
    },
  };
}
