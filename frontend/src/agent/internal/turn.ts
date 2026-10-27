export type StepKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "other";

export type StepStatus = "pending" | "running" | "done" | "failed" | "noResult";

/** `path` is relative to the checkout when the file lies inside it. */
export type FileEdit = {
  readonly path: string;
  readonly oldText: string | null;
  readonly newText: string;
};

export type StepOutput =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "edit"; readonly edit: FileEdit }
  | { readonly kind: "refused"; readonly title: string; readonly paths: readonly string[] };

export type Step = {
  readonly id: string;
  readonly kind: StepKind;
  readonly title: string;
  readonly status: StepStatus;
  readonly outputs: readonly StepOutput[];
};

export type TurnEntry =
  | { readonly kind: "thought"; readonly text: string }
  | { readonly kind: "said"; readonly text: string }
  | { readonly kind: "step"; readonly step: Step };

export type TurnView = { readonly entries: readonly TurnEntry[]; readonly answer: string };

export type StepUpdate = {
  readonly id: string;
  readonly title: string | null;
  readonly kind: StepKind | null;
  readonly status: StepStatus | null;
  readonly outputs: readonly StepOutput[] | null;
};

export type TurnUpdate =
  | { readonly kind: "thought"; readonly text: string }
  | { readonly kind: "said"; readonly text: string }
  | { readonly kind: "asked"; readonly text: string }
  | { readonly kind: "step"; readonly step: StepUpdate };

export type Refusal = {
  readonly step: string;
  readonly title: string;
  readonly paths: readonly string[];
};

export const EMPTY_TURN: TurnView = { entries: [], answer: "" };

function withThought(turn: TurnView, text: string): TurnView {
  const last = turn.entries.at(-1);
  if (last?.kind !== "thought") {
    return { ...turn, entries: [...turn.entries, { kind: "thought", text }] };
  }
  const joined: TurnEntry = { kind: "thought", text: last.text + text };
  return { ...turn, entries: [...turn.entries.slice(0, -1), joined] };
}

function changedStep(step: Step | undefined, update: StepUpdate): Step {
  const refused = step?.outputs.filter((output) => output.kind === "refused") ?? [];
  return {
    id: update.id,
    kind: update.kind ?? step?.kind ?? "other",
    title: update.title ?? step?.title ?? "",
    status: update.status ?? step?.status ?? "pending",
    outputs: update.outputs === null ? (step?.outputs ?? []) : [...refused, ...update.outputs],
  };
}

function withStep(turn: TurnView, update: StepUpdate, added: StepOutput | null): TurnView {
  const at = turn.entries.findIndex(
    (entry) => entry.kind === "step" && entry.step.id === update.id,
  );
  const found = turn.entries[at];
  const old = found?.kind === "step" ? found.step : undefined;
  const changed = changedStep(old, update);
  const step = added === null ? changed : { ...changed, outputs: [...changed.outputs, added] };
  if (old !== undefined) {
    return { ...turn, entries: turn.entries.with(at, { kind: "step", step }) };
  }
  const said: TurnEntry[] = turn.answer === "" ? [] : [{ kind: "said", text: turn.answer }];
  return { entries: [...turn.entries, ...said, { kind: "step", step }], answer: "" };
}

export function foldUpdate(turn: TurnView, update: TurnUpdate): TurnView {
  switch (update.kind) {
    case "thought":
      return withThought(turn, update.text);
    case "said":
      return { ...turn, answer: turn.answer + update.text };
    case "asked":
      return turn;
    case "step":
      return withStep(turn, update.step, null);
    default: {
      const _exhaustive: never = update;
      return _exhaustive;
    }
  }
}

export function refuseStep(turn: TurnView, { step, title, paths }: Refusal): TurnView {
  const update: StepUpdate = { id: step, title, kind: null, status: null, outputs: null };
  const known = turn.entries.some((entry) => entry.kind === "step" && entry.step.id === step);
  return withStep(turn, known ? { ...update, title: null } : update, {
    kind: "refused",
    title,
    paths,
  });
}

const UNFINISHED: Readonly<Record<StepStatus, boolean>> = {
  pending: true,
  running: true,
  done: false,
  failed: false,
  noResult: false,
};

export function endTurn(turn: TurnView): TurnView {
  const entries = turn.entries.map((entry): TurnEntry => {
    if (entry.kind !== "step" || !UNFINISHED[entry.step.status]) {
      return entry;
    }
    return { kind: "step", step: { ...entry.step, status: "noResult" } };
  });
  return { ...turn, entries };
}
