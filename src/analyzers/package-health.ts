import type { ProjectContext } from "../core/project-context.js";
import type { Finding, Severity } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { buildImportGraph } from "./graph.js";
import { collectDependencyNames } from "./package-json.js";

const severityFromSetting = (
  setting: "error" | "warn" | "off",
): Exclude<Severity, "info"> | null => (setting === "off" ? null : setting);

const packageNameFromImport = (source: string): string | null => {
  if (source.startsWith(".") || source.startsWith("node:")) {
    return null;
  }
  if (
    /\.(css|scss|sass|less|pcss|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif)$/iu.test(source)
  ) {
    return null;
  }
  const parts = source.split("/");
  if (source.startsWith("@")) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : source;
  }
  return parts[0] ?? null;
};

const dependencyAppearsInScripts = (name: string, scripts: Record<string, string>): boolean => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`(^|[^\\w@/.-])${escaped}($|[^\\w@/.-])`, "u");
  return Object.values(scripts).some((script) => pattern.test(script));
};

const isAllowedUnusedDependency = (context: ProjectContext, name: string): boolean => {
  if (name.startsWith("@types/")) {
    return true;
  }
  if (context.config.package.allowedUnusedDependencies.includes(name)) {
    return true;
  }
  return dependencyAppearsInScripts(name, context.packageJson?.scripts ?? {});
};

const packageFinding = (input: {
  actual?: string;
  expected?: string;
  message: string;
  rule: string;
  severity: Exclude<Severity, "info">;
}): Finding => {
  const finding: Finding = {
    actions: [
      {
        confidence: "medium",
        description: input.message,
        kind: "manual",
        title: "Fix package health issue",
      },
    ],
    engine: "package",
    file: "package.json",
    id: createFindingId({ file: "package.json", rule: input.rule, source: "package" }),
    message: input.message,
    rule: input.rule,
    severity: input.severity,
    source: "package",
  };

  if (input.actual !== undefined) {
    finding.actual = input.actual;
  }
  if (input.expected !== undefined) {
    finding.expected = input.expected;
  }

  return finding;
};

export const runPackageHealth = async (context: ProjectContext): Promise<Finding[]> => {
  if (!context.config.package.enabled || !context.packageJson) {
    return [];
  }

  const findings: Finding[] = [];
  const declared = collectDependencyNames(context.packageJson);
  const edges = await buildImportGraph(context.cwd, context.files);
  const imported = new Set(
    edges
      .filter((edge) => !edge.to)
      .map((edge) => packageNameFromImport(edge.source))
      .filter((name): name is string => Boolean(name)),
  );

  const missingSeverity = severityFromSetting(context.config.package.missingDependencies);
  if (missingSeverity) {
    for (const name of imported) {
      if (!declared.has(name)) {
        findings.push(
          packageFinding({
            actual: `${name} imported but not declared`,
            expected: "imported packages are declared in package.json",
            message: `Declare "${name}" in package.json or remove the import.`,
            rule: "package/no-missing-dependencies",
            severity: missingSeverity,
          }),
        );
      }
    }
  }

  const unusedSeverity = severityFromSetting(context.config.package.unusedDependencies);
  if (unusedSeverity) {
    for (const name of declared) {
      if (
        !imported.has(name) &&
        !context.config.package.forbidden.includes(name) &&
        !isAllowedUnusedDependency(context, name)
      ) {
        findings.push(
          packageFinding({
            actual: `${name} declared but not imported`,
            expected: "declared dependencies are used by source files",
            message: `Remove unused dependency "${name}" or add it to an allowlist later.`,
            rule: "package/no-unused-dependencies",
            severity: unusedSeverity,
          }),
        );
      }
    }
  }

  const forbidden = new Set(context.config.package.forbidden);
  for (const name of declared) {
    if (forbidden.has(name)) {
      findings.push(
        packageFinding({
          actual: `${name} is declared`,
          expected: "forbidden package absent",
          message: `Forbidden dependency "${name}" is present.`,
          rule: "package/forbidden-dependencies",
          severity: "error",
        }),
      );
    }
  }

  return findings;
};
