export type CiStatusName =
  | "passed"
  | "failed"
  | "running"
  | "pending"
  | "canceled"
  | "skipped"
  | "manual";

export type CiBoxView<J> =
  | { readonly kind: "jobs"; readonly jobs: readonly J[]; readonly more: boolean }
  | { readonly kind: "status"; readonly text: string };

const STATUS_TEXTS: Readonly<Record<CiStatusName, string>> = {
  passed: "Pipeline passed",
  failed: "Pipeline failed",
  running: "Pipeline running",
  pending: "Pipeline pending",
  canceled: "Pipeline canceled",
  skipped: "Pipeline skipped",
  manual: "Pipeline waiting for a manual job",
};

export function ciStatusText(status: CiStatusName): string {
  return STATUS_TEXTS[status];
}

export function ciBox<J extends { readonly allowFailure: boolean }>(
  status: CiStatusName,
  jobs: readonly J[],
  more: boolean,
): CiBoxView<J> {
  if (jobs.length === 0) {
    return { kind: "status", text: ciStatusText(status) };
  }
  return {
    kind: "jobs",
    jobs: [...jobs.filter((job) => !job.allowFailure), ...jobs.filter((job) => job.allowFailure)],
    more,
  };
}
