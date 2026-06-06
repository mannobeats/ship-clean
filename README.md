# Ship Clean

One install, one command, one quality gate for AI-assisted TypeScript teams.

Ship Clean turns project rules into an executable verification loop. It is designed for humans and AI agents working in the same codebase: agents can write code, run `ship-clean check --json`, fix structured findings, and rerun until the project is clean.

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

Run without installing:

```bash
pnpm dlx ship-clean check
```

Install in a project:

```bash
pnpm add -D ship-clean
```

Then initialize project wiring:

```bash
pnpm exec ship-clean init
pnpm exec ship-clean check
```

## Commands

```bash
ship-clean check
ship-clean check --json
ship-clean check --cwd ../another-project
ship-clean fix
ship-clean init
ship-clean init --yes --project next --strictness agent-safe
ship-clean doctor
ship-clean explain boundary
ship-clean list
ship-clean index
ship-clean sync
ship-clean watch
ship-clean studio
ship-clean search AuthService
ship-clean context "How does authentication create a session?"
ship-clean impact src/auth/session.ts
ship-clean affected src/auth/session.ts
```

`ship-clean init` is interactive and uses a polished terminal flow for project type,
strictness, owned quality systems, and agent setup. Use `--yes` for CI, test fixtures,
or AI-agent setup where prompts are not appropriate.

Init treats Ship Clean as the source of truth and wires the project around it:

- `shipclean.config.ts` for the executable quality contract
- `.vscode/settings.json` for format-on-save and code actions
- `AGENTS.md` so AI agents run the Ship Clean quality loop
- `package.json` scripts for `ship-clean:check`, `ship-clean:fix`, and `ship-clean:doctor`

## Configuration

Create `shipclean.config.ts`:

```ts
export default {
  extends: ["ship-clean/recommended", "ship-clean/react"],
  lint: {
    enabled: true,
    engine: "biome",
    preset: "strict",
    format: true,
    organizeImports: true,
  },
  typescript: {
    enabled: true,
  },
  graph: {
    enabled: true,
    entrypoints: ["src/main.tsx"],
    cycles: "error",
    unusedFiles: "warn",
    unusedExports: "warn",
  },
  package: {
    enabled: true,
    missingDependencies: "error",
    unusedDependencies: "warn",
    forbidden: ["moment"],
  },
  duplicates: {
    enabled: true,
    minLines: 8,
    severity: "warn",
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
} satisfies import("ship-clean").ShipCleanConfig;
```

Native tool configs are adapter internals. For example, when the Biome adapter is
selected, Ship Clean writes `.ship-clean/biome.generated.json` during `check` and
`fix`, then passes it to Biome with `--config-path`. Projects keep one quality
contract: `shipclean.config.*`.

## Code Intelligence

Ship Clean includes a local code-intelligence index for agents. It builds a compact
symbol/import graph so agents can ask focused questions without repeatedly reading
and grepping the whole repository:

```bash
ship-clean index
ship-clean sync
ship-clean watch
ship-clean studio
ship-clean search createSession
ship-clean context "How does session creation work?"
ship-clean impact src/auth/session.ts
ship-clean affected src/auth/session.ts
```

`ship-clean sync` refreshes the project brain on demand, `ship-clean watch` keeps
it current while code changes, and `ship-clean studio` opens a local web UI for
the same data: file graph, symbol search, impact radius, and agent context.

The durable target is `.ship-clean/intelligence.sqlite` with an FTS-ready schema
for files, symbols, and imports. SQLite is the required storage backend so local
CLI commands, watch mode, and Studio always read from the same source of truth.
Commands that need an index will build it automatically if it is missing.

If your package manager blocks native build scripts, `ship-clean doctor` will
warn when the SQLite binding is unavailable. With pnpm, run
`pnpm approve-builds`, approve `better-sqlite3`, then run `pnpm install`.

## Presets

Ship Clean supports first-party, team, and future marketplace presets:

```ts
import mannobeats from "@mannobeats/ship-clean-preset";

export default {
  extends: ["ship-clean/recommended", "ship-clean/react", mannobeats],
} satisfies import("ship-clean").ShipCleanConfig;
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

Use `--cwd` to test against another local project without publishing:

```bash
pnpm ship-clean check --cwd ../veedeyo
```

Run the CLI directly in development mode while you are shaping the experience:

```bash
pnpm dev init --cwd /tmp/ship-clean-demo
pnpm dev init --cwd /tmp/ship-clean-demo --yes --project next --strictness agent-safe --force
pnpm dev doctor --cwd test/fixtures/health-project
pnpm dev list --cwd test/fixtures/health-project
pnpm dev check --cwd test/fixtures/dirty-project
pnpm dev sync --cwd .
pnpm dev studio --cwd .
```

After a build, test the bundled binary exactly as a consuming project will use it:

```bash
pnpm build
node dist/cli.js check --cwd test/fixtures/dirty-project
```

## Current Status

This repository contains the foundation release: typed config, native policy rules, graph boundary checks, adapter hooks, terminal/JSON output, dogfood config, fixture tests, and local code intelligence.

## Publishing

The public package is configured for npm:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
npm publish --tag alpha
```

For the stable channel:

```bash
npm publish
```
