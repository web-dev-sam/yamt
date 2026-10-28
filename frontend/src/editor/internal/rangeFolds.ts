import type { EditorState, Extension } from "@codemirror/state";

import type { Column } from "../../ipc";
import { columnFoldExtension, columnSteps, renewSpec, stepSpec } from "./columnFolds";
import type { ColumnViews } from "./compareViews";
import { Folding } from "./folding";
import { displayed, type Fold } from "./foldRuns";
import { hiddenLevels } from "./foldSteps";
import type { WaveRow } from "./geometry";
import { ChainPhases, type WaveChain } from "./wavePhase";

type RangeHosts = Readonly<Record<Column, HTMLElement>> & { readonly strip: Element };
type WaveView = {
  readonly state: EditorState;
  lineBlockAt(pos: number): { readonly top: number };
};

function waveTops(view: WaveView, column: Column): (number | null)[] {
  const { runs, hiding } = columnSteps(view.state, column);
  return hiddenLevels(runs, hiding).map((fold) => {
    const hidden = displayed(fold, column);
    return hidden === null ? null : view.lineBlockAt(hidden.from).top;
  });
}

export function columnWaves(views: Readonly<Record<Column, WaveView>>): WaveRow<Column>[] {
  const right = waveTops(views.right, "right");
  return waveTops(views.left, "left").map((left, run) => ({ left, right: right[run] ?? null }));
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
