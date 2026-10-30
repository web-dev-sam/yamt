export function summaryText(shown: number, loaded: number, cut: boolean): string {
  const counted = `${shown} of ${loaded} ${loaded === 1 ? "merge request" : "merge requests"}`;
  return cut ? `${counted} (the newest ${loaded}; GitLab has more)` : counted;
}
