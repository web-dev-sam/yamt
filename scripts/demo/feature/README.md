# Taskboard

A small kanban board for the web team: columns with work-in-progress limits, cards with labels,
people, due times and reminders, and an activity feed.

## Develop

```sh
pnpm install
pnpm dev
```

`pnpm dev` proxies `/api` to the staging server (`https://staging.taskboard.example/api`); sign in
there once in the same browser.

## Check

```sh
pnpm typecheck
pnpm lint
pnpm format --check
```

Keyboard shortcuts are listed in [docs/shortcuts.md](docs/shortcuts.md).
