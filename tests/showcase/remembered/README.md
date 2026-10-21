# remembered

A file git rerere filled in (plan §2 #90): `main` added a `backlog` column, `feature` a `doing` column and a new
`title`. `remembered.ts` is the resolution rerere replayed; `git-output.ts` is what git's merge wrote before it,
made with `git merge-file -p --diff3 -L HEAD -L base -L feature local.ts base.ts remote.ts`. `yamt-cli fixture`
turns the case into the remembered view: `remembered.ts` as the Result, one conflict per block of `git-output.ts`.
Regenerate `git-output.ts` after changing a side: `just fixtures` fails while a block of it is not found unchanged
in the sides.
