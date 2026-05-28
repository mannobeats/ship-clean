import type { InitSelection } from "../commands/init-config.js";

const commandBlock = `## Ship Clean Quality Loop

- Run \`ship-clean check\` before handing work back.
- Run \`ship-clean check --json\` when you need machine-readable findings.
- Run \`ship-clean fix\` for safe formatter and linter fixes.
- Run \`ship-clean doctor\` after setup changes.
- Do not ignore Ship Clean findings. Fix the cause, then rerun the check.
`;

export const renderAgentRules = (selection: InitSelection): string => {
  const strictness =
    selection.strictness === "agent-safe"
      ? "Agent-safe mode: treat warnings as future errors and keep the repo clean after every edit."
      : `Strictness: ${selection.strictness}.`;

  return `# Agent Instructions

This project uses Ship Clean as the source of truth for code quality. Markdown guidance helps you start in the right direction, but the executable contract is \`shipclean.config.ts\`.

${commandBlock}

## Active Quality Systems

- Lint/format: ${selection.lint.enabled ? `${selection.lint.engine}/${selection.lint.preset}` : "off"}
- TypeScript: ${selection.typescript.enabled ? selection.typescript.mode : "off"}
- Graph health: ${selection.graph.enabled ? "on" : "off"}
- Package health: ${selection.package.enabled ? "on" : "off"}
- Duplicate code: ${selection.duplicates.enabled ? `${selection.duplicates.severity}, min ${selection.duplicates.minLines} lines` : "off"}
- ${strictness}

## Coding Rules

- Prefer direct imports over barrel files unless the Ship Clean config allows one.
- Keep architecture boundaries explicit. Do not import across layers just because a path resolves.
- Remove unused files, exports, dependencies, and generated dead code before finishing.
- Avoid duplicate implementation blocks. Extract shared behavior when duplication becomes structural.
- Add tests or paired files when the Ship Clean config requires them.
- Keep package choices small, intentional, and aligned with the dependency policy.

When Ship Clean reports a finding, use the rule name, expected value, actual value, and repair action from the output as the next edit target.
`;
};
