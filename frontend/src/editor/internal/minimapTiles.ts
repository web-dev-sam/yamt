type Stale = "none" | "all" | { readonly from: number };

export function staleTiles(facts: {
  readonly docChanged: boolean;
  readonly foldsChanged: boolean;
  readonly themeChanged: boolean;
  readonly languageChanged: boolean;
  readonly treeBefore: number;
  readonly treeAfter: number;
}): Stale {
  const { docChanged, foldsChanged, themeChanged, languageChanged, treeBefore, treeAfter } = facts;
  if (docChanged || foldsChanged || themeChanged || languageChanged) {
    return "all";
  }
  return treeAfter > treeBefore ? { from: treeBefore } : "none";
}
