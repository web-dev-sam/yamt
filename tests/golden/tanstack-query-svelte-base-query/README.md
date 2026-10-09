# tanstack-query-svelte-base-query

- Project: TanStack/query (MIT, https://github.com/TanStack/query/blob/e61c7849b1f4dd5bd7909dc2204e7c152c1b9479/LICENSE)
- Merge commit: e61c7849b1f4dd5bd7909dc2204e7c152c1b9479 (https://github.com/TanStack/query/commit/e61c7849b1f4dd5bd7909dc2204e7c152c1b9479) — parents: ours 2505f38712b42f65ffa43da4038fd2f25cd699f8, theirs 9404df4c4cd3c8db2b4628a64d94c1ad1639609f; merge base 85ce6db9a8f53210403ffbeb8b59deb1df102098 (file absent there: add/add)
- File: packages/svelte-query/src/createBaseQuery.ts
- Lines (base/local/remote): 0/74/76
- Why this case: An add/add file (absent at the merge base, so `base.ts` is empty) whose two versions differ in 4 small places.

## Compare in PhpStorm

    scripts/golden-repo.sh tanstack-query-svelte-base-query /tmp/yamt-golden/tanstack-query-svelte-base-query
    # then open /tmp/yamt-golden/tanstack-query-svelte-base-query in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/tanstack-query-svelte-base-query/local.ts tests/golden/tanstack-query-svelte-base-query/remote.ts tests/golden/tanstack-query-svelte-base-query/base.ts /tmp/yamt-tanstack-query-svelte-base-query-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/tanstack-query-svelte-base-query/base.ts tests/golden/tanstack-query-svelte-base-query/local.ts tests/golden/tanstack-query-svelte-base-query/remote.ts
