# Contributing

Thank you for helping make Ship Clean better.

## Local Setup

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## Quality Gate

Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node dist/cli.js check --cwd .
```

## Design Principles

- Keep first-run setup simple.
- Prefer structured findings over raw command output.
- Make public package installs work without hidden peer dependency setup.
- Treat AI agents and humans as equal users of the same quality contract.
- Keep fixes safe by default; require explicit flags for unsafe rewrites.

## Issues

For bugs, include:

- operating system
- Node.js version
- package manager and version
- Ship Clean version
- command output
- a minimal fixture or reproduction repository when possible
