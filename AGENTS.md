# AGENTS.md

This file provides guidance to Codex when working on the Ship Clean codebase.

## Project Overview

Ship Clean is an internal-first TypeScript CLI for AI-assisted software teams. It is intended to become one install and one quality gate for clean, safe, maintainable code:

```bash
ship-clean check
ship-clean fix
ship-clean doctor
ship-clean explain <rule>
```

The product goal is broader than a convention checker. Ship Clean should eventually replace a scattered stack of formatting, linting, type health, graph analysis, unused-code detection, dependency checks, project policy checks, and agent instruction compliance.

Read `BLUEPRINT.md` for the full product design, architecture, dependency plan, and implementation roadmap.

## Commands

```bash
pnpm install              # install dependencies
pnpm dev                  # run CLI in dev mode
pnpm build                # bundle with tsup
pnpm test                 # run tests with vitest
pnpm typecheck            # tsc --noEmit
pnpm lint                 # run the repo linter/formatter check
pnpm lint:fix             # apply safe formatting/lint fixes
```

Ship Clean commands must support `--cwd` so the tool can be dogfooded against real private projects during development:

```bash
pnpm ship-clean check --cwd .
pnpm ship-clean check --cwd ../veedeyo
pnpm ship-clean fix --cwd ../veedeyo
```

## Architecture

```txt
src/
├── cli.ts
├── commands/            # check, fix, init, doctor, explain, list, agents
├── config/              # defineConfig, loading, schema, defaults, preset resolution
├── core/                # project context, runner, cache, engine/result contracts
├── adapters/            # biome, oxlint/oxfmt, typescript, future external engines
├── analyzers/           # files, imports, exports, AST, graph, package.json, agent docs
├── rules/               # native rule engine, built-ins, presets
├── output/              # terminal, json, sarif, markdown, compact
└── utils/               # fs, git, glob, package manager, paths
```

## Key Conventions

- **ESM throughout.** `"type": "module"` in `package.json`, `.js` extensions in TypeScript imports.
- **TypeScript strict mode.** No `any`, no implicit returns, no unused variables.
- **No default exports** except `src/cli.ts` if needed for the bin entry. Everything else uses named exports.
- **Discriminated rule types.** Prefer `type: "boundary"` style rule configs over loose `options: Record<string, unknown>`.
- **Stable JSON output.** The result schema is load-bearing for agents. Add fields, never remove or rename them.
- **Intentional config only.** This is pre-release; do not add backward-compatibility branches unless explicitly requested.
- **Adapters hide external tools.** Biome, Oxlint, TypeScript, and future engines must normalize into Ship Clean findings.
- **Safe writes.** Any command that writes files must respect `--cwd`, refuse path traversal, and avoid writing outside the target project.
- **Latest dependency plan.** Check `BLUEPRINT.md` Section 12 before adding dependencies. Use exact versions for the internal build unless intentionally changed.

## Testing

```bash
pnpm test                 # all tests
pnpm test -- --watch      # watch mode
pnpm test -- rules/       # focused rule tests
```

Test structure:

- `test/rules/*.test.ts` for native rule tests
- `test/adapters/*.test.ts` for external engine normalization
- `test/fixtures/` for clean and dirty sample projects
- `test/integration/` for end-to-end CLI tests
- `test/output/` for JSON/terminal/SARIF/markdown snapshots

Every rule must cover pass cases, fail cases, edge cases, and repair action content. Every adapter must test how external output becomes Ship Clean's unified result schema.

## Implementation Priority

Build the **Foundation Release**, not a disposable MVP:

1. Project scaffold
2. CLI commands: `check`, `fix`, `init`, `doctor`, `explain`, `list`
3. `--cwd` support everywhere
4. TypeScript config loading and discriminated Zod schemas
5. Unified result schema
6. Engine runner and adapter interface
7. Biome and TypeScript adapters
8. Native policy rules and import/export scanner
9. Native graph skeleton and boundary rule
10. Terminal + JSON output
11. Fixture-based test suite
12. Dogfood `shipclean.config.ts`

## Build & Ship

```bash
pnpm build
node dist/cli.mjs check --cwd .
node dist/cli.mjs check --cwd ../some-private-project
```

Internal install paths should work before public release:

```json
{
  "devDependencies": {
    "ship-clean": "file:../templates-and-tooling/ship-clean"
  }
}
```

Later, publish privately as `@your-org/ship-clean`, then open source when the foundation is strong.
