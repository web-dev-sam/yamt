# MrLinksStateR1Boundary

Agent output (`agent://MrLinksStateR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksStateR1Boundary.md), collected 2026-11-04T02:22:36.151Z.

{
  "verdict": "pass",
  "checked": [
    "#2314 closed: the Linked* types and toLinksReply now live only in ipc/linksDomain.ts and are gone from descriptionDomain.ts. index.ts, MergeRequestSource.ts, tauriMergeRequests.ts and the fixture all import from linksDomain.",
    "#2315 closed: there is one toWebPage (mergeRequestDomain.ts:96, https only), used by linksDomain. The new edge linksDomain→mergeRequestDomain makes no cycle: mergeRequestDomain imports only bindings, domain and validate.",
    "https-only is safe: project.rs web_origin is None unless https, and links/target.rs target_of requires the server's origin. So every links line and parent page Rust sends is https, and no real reply is refused.",
    "#2316 closed: useRowDiscussions and useRowLinks both delegate to the one useAskedRow (mergeRequestActions.ts:85) next to Rows/setRow/claimRow. The copied computed+watch is gone from both files.",
    "#2317 closed: ListState has one rowsReplaced, which mergeRequests.ts:196 builds from both queues and loadList/ended call. ListState narrows to Pick<DiscussionQueue,'listed'>; the slice State owns both queues.",
    "Below the RV8 bar, for MrLinksDocs: AGENTS.md:25 says the links pages go through 'domain.ts toWebPage', but toWebPage is in mergeRequestDomain.ts. tree.md and state.md do not yet name linksDomain.ts or useAskedRow."
  ],
  "findings": []
}
