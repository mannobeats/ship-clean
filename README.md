# Ship Clean

One install, one command, one quality gate for AI-assisted software teams.

Ship Clean is an internal-first TypeScript CLI that turns project rules into an executable verification loop. It is designed for humans and AI agents working in the same codebase: agents can write code, run `ship-clean check --json`, fix structured findings, and rerun until the project is clean.

## Why

Markdown instructions are useful, but agents forget them. Ship Clean makes those rules executable:

- formatting and lint orchestration
- TypeScript health
- project-specific conventions
- architecture boundaries
- file and folder structure
- paired files such as tests or stories
- package dependency policy
- agent-readable JSON findings and repair actions

## Install

Internal development:

```bash
pnpm add -D ship-clean
```

Private Git dependency:

```json
{
  "devDependencies": {
    "ship-clean": "git+ssh://git@github.com/your-org/ship-clean.git"
  }
}
```

## Commands

```bash
ship-clean check
ship-clean check --json
ship-clean check --cwd ../another-project
ship-clean fix
ship-clean init
ship-clean doctor
ship-clean explain boundary
ship-clean list
```

## Configuration

Create `shipclean.config.ts`:

```ts
import { defineConfig } from "ship-clean";

export default defineConfig({
  extends: ["ship-clean/recommended", "ship-clean/react"],
  engines: {
    biome: true,
    typescript: true,
    graph: true,
    package: true,
    policy: true,
  },
  rules: [
    {
      type: "boundary",
      name: "worker-no-dashboard",
      from: ["apps/worker/**"],
      to: ["apps/dashboard/**"],
      severity: "error",
      message: "Worker code must not import dashboard code.",
    },
    {
      type: "paired-file",
      name: "components-have-tests",
      files: ["src/components/**/*.tsx"],
      require: "{dir}/{name}.test.tsx",
      severity: "warn",
      message: "Components should have colocated tests.",
    },
  ],
});
```

## Presets

Ship Clean supports first-party, team, and future marketplace presets:

```ts
import mannobeats from "@mannobeats/ship-clean-preset";

export default defineConfig({
  extends: ["ship-clean/recommended", "ship-clean/react", mannobeats],
});
```

Resolution order is intentional:

```txt
Official presets -> Team presets -> Marketplace presets -> Local project rules
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm dogfood
```

Use `--cwd` to test against real private projects without publishing:

```bash
pnpm ship-clean check --cwd ../veedeyo
```

## Current Status

This repository contains the foundation release: typed config, native policy rules, graph boundary checks, adapter hooks, terminal/JSON output, dogfood config, and fixture tests. The long-term product direction is to become the single quality-control platform for AI-assisted development.
