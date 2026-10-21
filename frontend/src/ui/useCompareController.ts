import {
  onScopeDispose,
  shallowRef,
  toRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import {
  CompareController,
  type ColumnFormat,
  type ColumnText,
  type CompareEvents,
  type Direction,
  type FormatReport,
  type Preferences,
} from "../editor";
import type { Column, Comparison, TabId, TabLanguage, TabTexts } from "../ipc";
import { useCompareStore, type ColumnFormatFailure, type CompareStore } from "./compareStore";

export { FORMAT_LANGUAGES, languageNames } from "../editor";

type Host<T> = Readonly<ShallowRef<T | null>>;

type CompareHostRefs = {
  readonly left: Host<HTMLDivElement>;
  readonly right: Host<HTMLDivElement>;
  readonly strip: Host<SVGSVGElement>;
};

type CompareControllerOptions = {
  readonly preferences: MaybeRefOrGetter<Preferences>;
  readonly language: MaybeRefOrGetter<TabLanguage>;
};

export type CompareHandle = {
  readonly formatLanguage: Readonly<ShallowRef<string | null>>;
  format(): void;
  moveToChange(direction: Direction): void;
  historyKey(event: KeyboardEvent): boolean;
};

type Live = {
  readonly tab: TabId;
  readonly store: CompareStore;
  readonly formatLanguage: ShallowRef<string | null>;
  controller: CompareController | null;
  untrack: (() => void) | null;
};

const COLUMNS = ["left", "right"] as const satisfies readonly Column[];

export function formatFailures(report: FormatReport, language: string): ColumnFormatFailure[] {
  return COLUMNS.flatMap((column) => {
    const outcome: ColumnFormat = report[column];
    return outcome.kind === "failed"
      ? [{ column, language, message: outcome.message, line: outcome.line }]
      : [];
  });
}

export async function sendSettled(
  columns: readonly ColumnText[],
  save: (column: ColumnText) => Promise<Comparison | null>,
  show: (comparison: Comparison) => void,
): Promise<void> {
  await Promise.all(
    columns.map(async (column) => {
      const comparison = await save(column);
      if (comparison !== null) {
        show(comparison);
      }
    }),
  );
}

function eventsOf(live: Live): CompareEvents {
  const { tab, store } = live;
  return {
    settled: (columns) => {
      void sendSettled(
        columns,
        (column) => store.saveColumn(tab, column),
        (comparison) => live.controller?.showComparison(comparison),
      );
    },
    detected: (name) => {
      store.setDetected(tab, name);
      live.formatLanguage.value = live.controller?.formatLanguage() ?? null;
    },
    refused: (column) => {
      store.refused(tab, column);
    },
  };
}

function buildOnce(
  live: Live,
  texts: Readonly<ShallowRef<TabTexts | null>>,
  hosts: CompareHostRefs,
  { preferences, language }: CompareControllerOptions,
): void {
  watch(
    [texts, hosts.left, hosts.right, hosts.strip],
    ([loaded, left, right, strip]) => {
      if (live.controller !== null || loaded === null) {
        return;
      }
      if (left === null || right === null || strip === null) {
        return;
      }
      const options = {
        preferences: toValue(preferences),
        language: toValue(language),
        columnLimit: live.store.columnLimit.value,
      };
      const built = new CompareController(loaded, { left, right, strip }, options, eventsOf(live));
      live.controller = built;
      live.formatLanguage.value = built.formatLanguage();
      live.untrack = live.store.track(live.tab, {
        unsent: () => built.settleNow(),
        holdsText: () => built.holdsText(),
      });
    },
    { flush: "post" },
  );
}

function follow(live: Live, { preferences, language }: CompareControllerOptions): void {
  watch(toRef(preferences), (next) => {
    live.controller?.setPreferences(next);
  });
  watch(toRef(language), (next) => {
    live.controller?.setLanguage(next);
    live.formatLanguage.value = live.controller?.formatLanguage() ?? null;
  });
}

function format(live: Live): void {
  const { controller } = live;
  const language = controller?.formatLanguage() ?? null;
  if (controller === null || language === null) {
    return;
  }
  live.store.reportFormat(live.tab, formatFailures(controller.format(), language));
}

export function useCompareController(
  tab: TabId,
  hosts: CompareHostRefs,
  options: CompareControllerOptions,
): CompareHandle {
  const store = useCompareStore();
  const texts = shallowRef<TabTexts | null>(null);
  const formatLanguage = shallowRef<string | null>(null);
  const live: Live = { tab, store, formatLanguage, controller: null, untrack: null };

  buildOnce(live, texts, hosts, options);
  follow(live, options);
  void store.loadTab(tab).then((loaded) => {
    texts.value = loaded;
  });

  onScopeDispose(() => {
    live.untrack?.();
    live.controller?.destroy();
    live.controller = null;
  });

  return {
    formatLanguage,
    format: () => {
      format(live);
    },
    moveToChange: (direction) => live.controller?.moveToChange(direction),
    historyKey: (event) => live.controller?.historyKey(event) ?? false,
  };
}
