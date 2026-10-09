# tanstack-query-persist-provider

- Project: TanStack/query (MIT, https://github.com/TanStack/query/blob/a8f04519827200254ca193f380eca2ffe1224027/LICENSE)
- Merge commit: a8f04519827200254ca193f380eca2ffe1224027 (https://github.com/TanStack/query/commit/a8f04519827200254ca193f380eca2ffe1224027) — parents: ours 6582671fb8107a02c8efdf1d7ed2203b08921070, theirs 22b286000c5431655af9d9fea9ef9d5d8ad3ed47; merge base bbcdaa28c2b10a8fbccd76c5ad1d5bbfd786e272
- File: packages/react-query-persist-client/src/PersistQueryClientProvider.tsx
- Lines (base/local/remote): 55/58/56
- Why this case: A TSX conflict where remote deletes 9 lines that local edits, framed by remote-only changes 1 unchanged line above and below it.

## Compare in PhpStorm

    scripts/golden-repo.sh tanstack-query-persist-provider /tmp/yamt-golden/tanstack-query-persist-provider
    # then open /tmp/yamt-golden/tanstack-query-persist-provider in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/tanstack-query-persist-provider/local.tsx tests/golden/tanstack-query-persist-provider/remote.tsx tests/golden/tanstack-query-persist-provider/base.tsx /tmp/yamt-tanstack-query-persist-provider-result.tsx

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/tanstack-query-persist-provider/base.tsx tests/golden/tanstack-query-persist-provider/local.tsx tests/golden/tanstack-query-persist-provider/remote.tsx
