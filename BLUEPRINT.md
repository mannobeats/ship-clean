# Ship Clean — Product Blueprint

> One install, one command, one quality gate for AI-assisted software teams.

**Status:** Internal-first product design document
**Author:** mannobeats
**Last updated:** 2026-05-27

---

## 1. Product Vision

Ship Clean is an all-in-one TypeScript CLI that helps humans and AI agents ship clean, safe, maintainable code. It replaces a scattered quality stack with one private tool that can later become open source.

The goal is not to build a small convention checker. The goal is to build a **project quality operating system**:

```bash
ship-clean check
ship-clean fix
ship-clean doctor
ship-clean explain <rule>
```

When an AI agent writes code, Ship Clean becomes the verification loop. The agent does not merely read `AGENTS.md` or `CLAUDE.md` and hope it remembers the rules. It runs Ship Clean, receives structured findings, fixes them, and proves the repo is clean.

## 2. Problem

AI coding agents are fast, but they are not naturally consistent. Project rules live in Markdown files, code review comments, hidden team habits, and the maintainer's head:

- "No barrel files."
- "Relative ESM imports need `.js` extensions."
- "Pages must default export."
- "API responses must use `{ data }` or `{ error }`."
- "Workers must not import dashboard code."
- "Unused files and exports should not survive."
- "Dependencies must stay intentional."
- "Generated code must not leak into hand-written code paths."

Existing tools solve parts of this:

- Biome formats and lints.
- Oxlint catches fast correctness and style issues.
- TypeScript checks types.
- Fallow/Knip-style tools find unused code.
- dependency-cruiser-style tools catch graph and boundary problems.
- Semgrep/ast-grep-style tools catch structural patterns.

Ship Clean should unify those quality concerns under one CLI, one config, one report, and one agent-readable repair model.

## 3. Core Product Promise

Users install Ship Clean once:

```bash
pnpm add -D ship-clean
```

Then they run:

```bash
pnpm ship-clean check
pnpm ship-clean fix
```

They should not need to separately install Biome, Oxlint, Knip, Fallow, dependency-cruiser, or a pile of rule packages. Ship Clean owns the product surface and uses proven engines internally where that is the best engineering choice.

## 4. Design Principles

1. **All-in-one, not scattered.** Ship Clean is the single command for formatting, linting, type health, project conventions, dependency graph health, unused code, package consistency, and agent compliance.

2. **Agent-first output.** Every finding must include enough structured data for an AI agent to fix it: source, rule, severity, location, message, expected/actual context, and repair actions.

3. **Private-first, open-source-ready.** The first users are internal projects. The architecture, package boundaries, test suite, docs, and dependency choices should still be professional enough to publish later.

4. **Leverage proven engines.** We do not reimplement excellent tools just to prove a point. We bundle or adapter-wrap strong engines, normalize their output, and build native Ship Clean engines for the gaps.

5. **Own the experience.** Underlying tools are implementation details. Users should think in terms of `ship-clean check`, `ship-clean fix`, and `shipclean.config.ts`.

5a. **Source-of-truth config, generated adapters.** Ship Clean owns the quality contract. Native files such as `biome.jsonc`, editor settings, hooks, and agent instructions are generated adapter files that keep the rest of the ecosystem aligned.

6. **Build a permanent foundation.** This project does not use a disposable MVP mindset. Early releases can be narrow, but the architecture must support the full v1 product.

7. **Typed configuration.** Users define policy in `shipclean.config.ts` with TypeScript autocomplete and precise discriminated rule types.

8. **Safe by default.** `fix` only applies safe, deterministic fixes unless the user opts into unsafe fixes.

## 5. High-Level Architecture

```txt
ship-clean
├── CLI layer
│   ├── init
│   ├── check
│   ├── fix
│   ├── doctor
│   ├── explain
│   ├── list
│   └── agents sync
├── Core engine
│   ├── config loading
│   ├── project context
│   ├── file discovery
│   ├── engine runner
│   ├── result normalization
│   ├── cache
│   └── output formatting
├── Native Ship Clean engines
│   ├── policy/convention engine
│   ├── import/export scanner
│   ├── module graph engine
│   ├── unused code engine
│   ├── dependency/package engine
│   ├── structure engine
│   └── agent instruction engine
├── Tool adapters
│   ├── Biome adapter
│   ├── Oxlint/Oxfmt adapter
│   ├── TypeScript adapter
│   └── future structural-search adapters
└── Experience layer
    ├── internal install workflow
    ├── private package support
    ├── CI integration
    ├── git hooks
    ├── editor config
    └── AI agent instruction generation
```

## 6. Directory Structure

```txt
src/
├── cli.ts
├── commands/
│   ├── check.ts
│   ├── fix.ts
│   ├── init.ts
│   ├── doctor.ts
│   ├── explain.ts
│   ├── list.ts
│   └── agents.ts
├── config/
│   ├── define-config.ts
│   ├── loader.ts
│   ├── resolve.ts
│   ├── schema.ts
│   └── defaults.ts
├── core/
│   ├── project-context.ts
│   ├── runner.ts
│   ├── cache.ts
│   ├── engine.ts
│   └── result.ts
├── adapters/
│   ├── biome.ts
│   ├── oxlint.ts
│   ├── oxfmt.ts
│   └── typescript.ts
├── analyzers/
│   ├── files.ts
│   ├── imports.ts
│   ├── exports.ts
│   ├── ast.ts
│   ├── graph.ts
│   ├── package-json.ts
│   └── agent-docs.ts
├── rules/
│   ├── types.ts
│   ├── registry.ts
│   ├── built-in/
│   └── presets/
├── output/
│   ├── terminal.ts
│   ├── json.ts
│   ├── sarif.ts
│   ├── markdown.ts
│   └── compact.ts
└── utils/
    ├── fs.ts
    ├── git.ts
    ├── glob.ts
    ├── package-manager.ts
    └── paths.ts
```

## 7. Core Commands

```bash
ship-clean check                 Run the full quality gate
ship-clean check --json          Agent-readable JSON output
ship-clean check --sarif         SARIF output for code scanning
ship-clean check --changed-since HEAD
ship-clean check --cwd ../app    Run against another local project

ship-clean fix                   Apply safe fixes
ship-clean fix --unsafe          Apply explicitly unsafe/high-blast-radius fixes
ship-clean fix --cwd ../app

ship-clean init                  Create config and install project wiring
ship-clean init --preset react
ship-clean init --internal       Internal/private defaults

ship-clean doctor                Verify installation, config, engines, hooks, and agent files
ship-clean explain <rule>        Explain a rule with examples and repair guidance
ship-clean list --rules          List active rules
ship-clean list --engines        List enabled engines
ship-clean agents sync           Write/update AGENTS.md, CLAUDE.md, Cursor rules, etc.
ship-clean index                 Build the local code-intelligence graph
ship-clean search <symbol>       Search symbols without grepping/reading files
ship-clean context <task>        Return compact agent-ready code context
ship-clean impact <file>         Show imports, dependents, and symbols for a file
ship-clean affected <files...>   Find files affected by changed files
```

Current foundation behavior: `ship-clean init` writes `shipclean.config.ts`,
materializes `biome.jsonc` for the selected lint preset, writes
`.vscode/settings.json`, writes `AGENTS.md` when agent sync is enabled, and
adds package scripts. This borrows the best setup ergonomics from preset-driven
tools while keeping Ship Clean as the source of truth.

The code-intelligence layer is inspired by CodeGraph's proven agent workflow:
build a local semantic index once, then let agents query symbols, related files,
impact, and compact source snippets instead of spending tokens on broad
grep/read exploration. The first Ship Clean foundation stores a TypeScript/JS
symbol/import graph at `.ship-clean/intelligence.json`; the architecture can
later move the same command surface to SQLite/FTS and MCP.

## 8. Config Model

Ship Clean uses a TypeScript config:

```ts
import { defineConfig } from "ship-clean";

export default defineConfig({
  extends: ["ship-clean/presets/recommended"],
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
    entrypoints: ["apps/dashboard/src/main.tsx"],
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
  include: ["src/**/*.{ts,tsx,js,jsx}", "apps/*/src/**/*.{ts,tsx}"],
  exclude: ["**/dist/**", "**/generated/**"],
  rules: [
    {
      type: "export-check",
      name: "pages-default-export",
      files: ["apps/dashboard/src/pages/**/*.tsx"],
      expect: "default",
      severity: "error",
      message: "Page components must export default for lazy loading.",
    },
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
      message: "Components should have a colocated test.",
    },
  ],
});
```

Rules should use discriminated unions (`type: "boundary"`, `type: "grep"`, `type: "paired-file"`) instead of one loose `RuleDefinition` shape. That keeps validation, autocomplete, and agent edits reliable.

## 9. Unified Result Schema

The JSON schema is load-bearing. Agents will depend on it, so changes must be backward compatible.

```ts
type FindingSource =
  | "ship-clean"
  | "biome"
  | "oxlint"
  | "typescript"
  | "graph"
  | "duplicates"
  | "package"
  | "agent";

interface CheckResult {
  version: 1;
  tool: "ship-clean";
  cwd: string;
  durationMs: number;
  engines: EngineResult[];
  summary: {
    filesScanned: number;
    findings: number;
    errors: number;
    warnings: number;
    fixed: number;
  };
  findings: Finding[];
}

interface Finding {
  id: string;
  source: FindingSource;
  rule: string;
  severity: "error" | "warn" | "info";
  file: string | null;
  line?: number;
  column?: number;
  message: string;
  expected?: string;
  actual?: string;
  docsUrl?: string;
  actions: FixAction[];
}

type FixAction =
  | {
      kind: "edit";
      title: string;
      description: string;
      confidence: "high" | "medium" | "low";
      file: string;
    }
  | {
      kind: "delete-file" | "rename-file" | "create-file" | "run-command" | "manual";
      title: string;
      description: string;
      confidence: "high" | "medium" | "low";
    };
```

## 10. Engines

### 10.1 Bundled Adapter Engines

Ship Clean can depend on and invoke these tools internally:

- **Biome** for formatting, import organization, baseline linting, JSON/CSS support, and safe fixes.
- **Oxlint/Oxfmt** for fast JS/TS linting and formatting alternatives as the Oxc ecosystem matures.
- **TypeScript** for `tsconfig` discovery and type checking.

These adapters must normalize external output into Ship Clean findings.

### 10.2 Native Ship Clean Engines

Ship Clean owns these areas directly:

- project-specific policy rules
- import/export scanning
- architecture boundaries
- dependency graph
- circular dependencies
- unused files
- unused exports
- unused dependencies
- package/workspace consistency
- file/directory structure
- paired files
- generated file exclusions
- agent instruction sync and compliance

Native analyzers should reuse fast libraries (`es-module-lexer`, `oxc-parser`) where possible.

## 11. Built-In Rule Families

```txt
policy/export-check        Require/forbid default or named exports
policy/import-check        Require/forbid import sources or specifiers
policy/grep                Regex content checks for simple text policies
policy/naming              File and directory naming rules
policy/file-pattern        Require/forbid matching files
policy/paired-file         Require tests/stories/docs next to source files
policy/structure           Require files within directories

graph/boundary             Forbid imports across architectural boundaries
graph/no-cycles            Detect circular dependencies
graph/no-orphans           Detect unreachable source files
graph/no-unused-exports    Detect unused exports
graph/max-fanout           Limit imports per module

package/no-unused-deps     Detect dependencies not imported by source
package/no-missing-deps    Detect imports missing from package.json
package/forbidden-deps     Forbid packages by name/pattern
package/workspace-policy   Enforce internal package boundaries

agent/instructions-present Ensure AGENTS.md/CLAUDE.md exist
agent/instructions-current Ensure generated agent instructions are current
agent/rule-linked          Ensure project policy maps to agent docs
```

## 12. Dependency Plan

Versions below were checked from npm on 2026-05-27 with `npm view <package> version`. Use exact versions in the first internal build for repeatability, then let Renovate/Dependabot propose upgrades.

### Runtime Dependencies

| Package | Version | Purpose |
| --- | ---: | --- |
| `@biomejs/biome` | `2.4.16` | Bundled formatter/linter engine |
| `oxlint` | `1.67.0` | Fast JS/TS lint engine |
| `typescript` | `6.0.3` | Type checking and tsconfig/project analysis |
| `citty` | `0.2.2` | Lightweight TypeScript CLI framework |
| `c12` | `4.0.0-beta.5` | TypeScript/JS/JSON config loading |
| `zod` | `4.4.3` | Config and result schema validation |
| `tinyglobby` | `0.2.16` | Fast file discovery |
| `es-module-lexer` | `2.1.0` | Fast import/export scanning |
| `oxc-parser` | `0.133.0` | Full AST parsing when needed |
| `@clack/prompts` | `1.4.0` | Interactive `init` prompts |
| `picocolors` | `1.1.1` | Terminal colors |
| `jsonc-parser` | `3.3.1` | JSONC config parsing/updating |
| `yaml` | `2.9.0` | Workspace and hook config parsing |
| `cross-spawn` | `7.0.6` | Reliable child process execution |
| `nypm` | `0.6.6` | Package manager detection and install commands |

### Development Dependencies

| Package | Version | Purpose |
| --- | ---: | --- |
| `tsup` | `8.5.1` | ESM bundle and declarations |
| `vitest` | `4.1.7` | Unit/integration tests |
| `fast-check` | `4.8.0` | Property tests for path/rule edge cases |

### Dependency Policy

- Ship Clean users install one package. Runtime engines should be direct dependencies of Ship Clean unless there is a strong reason to make one optional.
- Keep external tools behind adapters. No external tool schema should leak into Ship Clean's public JSON contract.
- Prefer exact versions for the internal private package.
- Revisit `c12` before public release because the current latest tag is beta. If that remains true near publication, either pin it deliberately or use a stable config loader.
- Do not add heavy UI/runtime dependencies. This is a CLI, not an interactive React app.

## 13. Internal Development And Testing

Ship Clean must support testing against itself and against real private projects before publication.

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm ship-clean check --cwd .
pnpm ship-clean check --cwd ../veedeyo
pnpm ship-clean fix --cwd ../veedeyo
```

Fixture projects should live under:

```txt
test/fixtures/
├── clean-react-app/
├── dirty-react-app/
├── dirty-monorepo/
├── api-response-violations/
├── boundary-violations/
├── unused-code/
└── package-policy/
```

Test coverage must include:

- unit tests per native rule
- adapter normalization tests
- integration tests invoking the CLI
- JSON schema snapshot tests
- fixture-based dirty/clean project tests
- path traversal and symlink safety tests
- `--cwd` tests
- `fix` dry-run and safe-fix tests

## 14. Private Installation Strategy

During internal development:

```json
{
  "devDependencies": {
    "ship-clean": "file:../templates-and-tooling/ship-clean"
  }
}
```

For team use before open source:

```json
{
  "devDependencies": {
    "ship-clean": "git+ssh://git@github.com/your-org/ship-clean.git"
  }
}
```

Preferred internal package path:

```bash
pnpm add -D @your-org/ship-clean
```

Ship Clean should be easy to publish privately to GitHub Packages, npm private packages, or a private registry.

## 15. Implementation Roadmap

This is not a disposable MVP. The first build is the **Foundation Release**: a production-shaped internal tool with the full architecture in place.

### Foundation Release

- Project scaffold
- CLI commands: `check`, `fix`, `init`, `doctor`, `explain`, `list`
- `--cwd` support everywhere
- TypeScript config loading
- Discriminated Zod schemas
- Unified result schema
- Terminal and JSON output
- Engine runner and adapter interface
- Biome adapter
- TypeScript adapter
- Native policy engine
- Native import/export scanner
- Native graph skeleton
- Built-in rules: export-check, import-check, naming, file-pattern, paired-file, boundary
- Dogfood `shipclean.config.ts`
- Fixture-based test suite

### Quality Stack Replacement

- Oxlint/Oxfmt adapter
- Circular dependency detection
- Unused files
- Unused exports
- Unused dependencies
- Missing dependencies
- Workspace/package boundary rules
- SARIF and markdown output
- CI examples
- Git hook setup
- Agent file generation/sync

### Next-Level Agent Loop

- Safe autofix actions
- `fix --dry-run`
- `fix --unsafe`
- Repair action confidence
- Agent-oriented `check --json`
- `ship-clean agents sync`
- Rule docs generation
- `ship-clean learn` prototype that proposes rules from repo patterns and agent docs

## 16. Success Criteria

Ship Clean is successful when:

1. A developer installs one private package and can replace several quality commands with `ship-clean check`.
2. An AI agent can run `ship-clean check --json`, fix findings, and rerun until clean.
3. Internal projects can use `--cwd` for local dogfooding before private package rollout.
4. The output schema remains stable and useful for agents.
5. The tool catches project-specific conventions that generic linters miss.
6. The graph/package engines replace the need for separate unused-code and dependency-health tools in the internal stack.
7. The foundation is clean enough to open source later without a rewrite.
