import { shallowRef, type ShallowRef } from "vue";

import {
  log,
  type AddedServer,
  type FileEntry,
  type RepositoryAnswer,
  type ServerHost,
} from "../ipc";
import { addedSpecs, detect, type LanguageServers, type ServerSpec } from "../lsp";
import type { Asking, Reply } from "./asking";
import { unexpected } from "./problem";
import type { SettingsActions, SettingsInUse } from "./settings";

type SetupTarget = Pick<SettingsActions, "loadSettings" | "setServerAnswer" | "setAddedServers"> & {
  readonly host: ServerHost | null;
  readonly servers: Pick<LanguageServers, "setSpecs" | "haltAll">;
  readonly files: Readonly<ShallowRef<readonly FileEntry[]>>;
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
  readonly asking: Pick<Asking, "ask">;
  loadFiles(): Promise<void>;
  refreshFiles(): Promise<void>;
};

type Setup = SetupTarget & {
  readonly root: ShallowRef<string | null>;
  readonly found: ShallowRef<readonly ServerSpec[]>;
  started: boolean;
  latestLook: number;
};

export type ServerSetup = {
  readonly serverRoot: Readonly<ShallowRef<string | null>>;
  readonly foundServers: Readonly<ShallowRef<readonly ServerSpec[]>>;
  startUp(): Promise<void>;
  refocus(): Promise<void>;
  answerServers(answer: RepositoryAnswer): Promise<void>;
  addServer(server: AddedServer): Promise<void>;
  removeServer(index: number): Promise<void>;
};

type AddedServerFields = { readonly command: string; readonly fileTypes: string };

const STORED_REPLIES: Readonly<Record<Reply, RepositoryAnswer | null>> = {
  yes: "start",
  no: "dontStart",
  dismissed: null,
};

export function parseAddedServer(command: string, fileTypes: string): AddedServer | null {
  const words = command.split(" ").filter((word) => word !== "");
  const types = fileTypes
    .split(/[\s,]+/)
    .map((type) => type.replace(/^\.+/, "").toLowerCase())
    .filter((type) => type !== "");
  const valid = words.length > 0 && types.length > 0 && !types.some((type) => type.includes("."));
  return valid ? { command: words, fileTypes: types } : null;
}

export function addedServerFields(server: {
  readonly command: readonly string[];
  readonly fileTypes: readonly string[];
}): AddedServerFields {
  return { command: server.command.join(" "), fileTypes: server.fileTypes.join(", ") };
}

async function look(setup: Setup, host: ServerHost): Promise<string | null> {
  setup.latestLook += 1;
  const ticket = setup.latestLook;
  const paths = setup.files.value.map((file) => file.path);
  try {
    const { root } = await host.context();
    if (root === null) {
      return null;
    }
    const found = await detect(paths, host, root);
    if (ticket !== setup.latestLook) {
      return null;
    }
    setup.root.value = root;
    setup.found.value = found;
    return root;
  } catch (error) {
    log.warn("servers.detect_failed", { ...unexpected(error) });
    return null;
  }
}

function addedOf(setup: Setup, root: string): readonly ServerSpec[] {
  const taken = setup.found.value.map((spec) => spec.name);
  return addedSpecs(setup.settings.value.languageServers.added, taken, root);
}

function storedAnswer(setup: Setup, root: string): RepositoryAnswer | null {
  return setup.settings.value.languageServers.repositories[root] ?? null;
}

function apply(setup: Setup, root: string, answer: RepositoryAnswer | null): void {
  const specs = [...setup.found.value, ...addedOf(setup, root)];
  setup.servers.setSpecs(specs, { startOnOpen: answer === "start" });
}

async function setUp(setup: Setup, host: ServerHost): Promise<void> {
  const root = await look(setup, host);
  if (root === null || setup.found.value.length + addedOf(setup, root).length === 0) {
    return;
  }
  if (storedAnswer(setup, root) === null) {
    const reply = await setup.asking.ask({
      kind: "servers",
      found: setup.found.value,
      added: addedOf(setup, root),
    });
    const given = STORED_REPLIES[reply];
    if (given !== null) {
      await setup.setServerAnswer(given);
    }
  }
  apply(setup, root, storedAnswer(setup, root));
}

async function startUp(setup: Setup): Promise<void> {
  await Promise.all([setup.loadFiles(), setup.loadSettings()]);
  if (setup.host !== null) {
    await setUp(setup, setup.host);
  }
  setup.started = true;
}

async function refocus(setup: Setup): Promise<void> {
  await Promise.all([setup.refreshFiles(), setup.loadSettings()]);
  if (setup.host === null || !setup.started) {
    return;
  }
  const root = await look(setup, setup.host);
  if (root !== null) {
    apply(setup, root, storedAnswer(setup, root));
  }
}

async function answer(setup: Setup, given: RepositoryAnswer): Promise<void> {
  const root = setup.root.value;
  const before = root === null ? null : storedAnswer(setup, root);
  await setup.setServerAnswer(given);
  if (root === null) {
    return;
  }
  const now = storedAnswer(setup, root);
  if (before !== "dontStart" && now === "dontStart") {
    setup.servers.haltAll();
  }
  apply(setup, root, now);
}

async function changeAdded(setup: Setup, added: readonly AddedServer[]): Promise<void> {
  await setup.setAddedServers(added);
  const root = setup.root.value;
  if (root !== null) {
    apply(setup, root, storedAnswer(setup, root));
  }
}

export function createServerSetup(target: SetupTarget): ServerSetup {
  const setup: Setup = {
    ...target,
    root: shallowRef<string | null>(null),
    found: shallowRef<readonly ServerSpec[]>([]),
    started: false,
    latestLook: 0,
  };
  function added(): readonly AddedServer[] {
    return setup.settings.value.languageServers.added;
  }
  return {
    serverRoot: setup.root,
    foundServers: setup.found,
    startUp: () => startUp(setup),
    refocus: () => refocus(setup),
    answerServers: (given) => answer(setup, given),
    addServer: (server) => changeAdded(setup, [...added(), server]),
    removeServer: (index) =>
      changeAdded(
        setup,
        added().filter((_, at) => at !== index),
      ),
  };
}
