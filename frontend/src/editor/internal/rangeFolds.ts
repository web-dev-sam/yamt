import type { EditorState, Extension } from "@codemirror/state";

import type { Column } from "../../ipc";
import { columnFoldExtension, hiddenIn, renewSpec, stepSpec } from "./columnFolds";
import type { ColumnViews } from "./compareViews";
import { Folding } from "./folding";
import { waveStartsIn, type Fold } from "./foldRuns";
import { waveTops, type WaveRow } from "./geometry";
import { ChainPhases, type WaveChain } from "./wavePhase";

type RangeHosts = Readonly<Record<Column, HTMLElement>> & { readonly strip: Element };
type WaveView = {
  readonly state: EditorState;
  lineBlockAt(pos: number): { readonly top: number };
};

function columnTops(view: WaveView, column: Column): (number | null)[] {
  const starts = waveStartsIn(hiddenIn(view.state, column), column);
  return waveTops(starts, (pos) => view.lineBlockAt(pos).top);
}

export function columnWaves(views: Readonly<Record<Column, WaveView>>): WaveRow<Column>[] {
  const right = columnTops(views.right, "right");
  return columnTops(views.left, "left").map((left, run) => ({ left, right: right[run] ?? null }));
}

export class RangeFolds {
  readonly hovered = (): number | null => this.#folding.hovered();
  readonly #views: () => ColumnViews;
  readonly #folding: Folding;
  readonly #phases: ChainPhases<Column>;

  constructor(hosts: RangeHosts, views: () => ColumnViews) {
    this.#views = views;
    this.#folding = new Folding([hosts.left, hosts.right, hosts.strip], (run) => {
      const { left } = views();
      left.dispatch(stepSpec(left.state, run));
    });
    const chain: WaveChain<Column> = {
      first: "left",
      next: [{ strip: hosts.strip, pane: "right" }],
    };
    this.#phases = new ChainPhases(chain, hosts, views);
  }

  column(column: Column): Extension {
    return columnFoldExtension(column, { views: this.#views, hovered: this.hovered });
  }

  renew(runs: readonly Fold<Column>[], collapsed: boolean): void {
    const { left } = this.#views();
    left.dispatch(renewSpec(left.state, runs, collapsed), { effects: left.scrollSnapshot() });
  }

  destroy(): void {
    this.#folding.destroy();
    this.#phases.destroy();
  }
}
