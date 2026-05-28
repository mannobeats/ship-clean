import { basename, dirname, join } from "node:path";

import { buildImportGraph } from "../../analyzers/graph.js";
import { scanModule } from "../../analyzers/imports.js";
import { collectDependencyNames } from "../../analyzers/package-json.js";
import type { ProjectContext } from "../../core/project-context.js";
import type { Finding } from "../../core/result.js";
import { createFindingId } from "../../core/result.js";
import { readTextFile } from "../../utils/fs.js";
import { findByGlob } from "../../utils/glob.js";
import { filterByGlobs, matchAnyGlob } from "../../utils/match.js";
import { toPosixPath } from "../../utils/paths.js";
import type {
  BoundaryRule,
  ExportCheckRule,
  FilePatternRule,
  GrepRule,
  ImportCheckRule,
  MaxDependenciesRule,
  MaxLinesRule,
  NamingRule,
  PackageDependencyRule,
  PairedFileRule,
  ShipCleanRule,
  StructureRule,
} from "../types.js";

const activeSeverity = (rule: ShipCleanRule): "error" | "warn" | null => {
  if (rule.severity === "off") {
    return null;
  }
  return rule.severity ?? "error";
};

const action = (title: string, description: string): Finding["actions"][number] => ({
  confidence: "medium",
  description,
  kind: "manual",
  title,
});

const createRuleFinding = (
  rule: ShipCleanRule,
  context: {
    actual?: string;
    expected?: string;
    file: string | null;
    line?: number;
    message?: string;
    source?: Finding["source"];
  },
): Finding | null => {
  const severity = activeSeverity(rule);
  if (!severity) {
    return null;
  }

  const finding: Finding = {
    actions: [action("Fix project policy violation", rule.message)],
    engine: rule.type === "boundary" ? "graph" : rule.type === "dependency" ? "package" : "policy",
    file: context.file,
    id: createFindingId({
      file: context.file,
      ...(context.line ? { line: context.line } : {}),
      rule: rule.name,
      source: context.source ?? "ship-clean",
    }),
    message: context.message ?? rule.message,
    rule: rule.name,
    severity,
    source:
      context.source ??
      (rule.type === "boundary" ? "graph" : rule.type === "dependency" ? "package" : "ship-clean"),
  };

  if (context.actual !== undefined) {
    finding.actual = context.actual;
  }
  if (context.expected !== undefined) {
    finding.expected = context.expected;
  }
  if (context.line !== undefined) {
    finding.line = context.line;
  }

  return finding;
};

const pushFinding = (findings: Finding[], finding: Finding | null): void => {
  if (finding) {
    findings.push(finding);
  }
};

const scopedFiles = (
  rule: { exclude?: string[]; files: string[] },
  context: ProjectContext,
): string[] =>
  filterByGlobs(context.files, rule.files, [...context.config.exclude, ...(rule.exclude ?? [])]);

const evaluateExportCheck = async (
  rule: ExportCheckRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const file of scopedFiles(rule, context)) {
    const scan = await scanModule(context.cwd, file);
    const hasDefault = scan.exports.some((item) => item.type === "default");
    const namedExports = new Set(
      scan.exports.filter((item) => item.type === "named").map((item) => item.name),
    );
    const hasNamed = rule.names
      ? rule.names.every((name) => namedExports.has(name))
      : namedExports.size > 0;

    if (rule.expect === "default" && !hasDefault) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: "no default export",
          expected: "default export",
          file,
        }),
      );
    }

    if (rule.expect === "named" && !hasNamed) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: [...namedExports].join(", ") || "no named exports",
          expected: rule.names?.join(", ") ?? "at least one named export",
          file,
        }),
      );
    }

    if (rule.expect === "none" && scan.exports.length > 0) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: scan.exports.map((item) => item.name).join(", "),
          expected: "no exports",
          file,
        }),
      );
    }
  }

  return findings;
};

const evaluateImportCheck = async (
  rule: ImportCheckRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const pattern = new RegExp(rule.pattern, "u");

  for (const file of scopedFiles(rule, context)) {
    const scan = await scanModule(context.cwd, file);
    const matches = scan.imports.filter((item) => pattern.test(item.source));

    if (rule.expect === "absent") {
      for (const match of matches) {
        pushFinding(
          findings,
          createRuleFinding(rule, {
            actual: match.source,
            expected: "no matching import",
            file,
            line: match.line,
          }),
        );
      }
    }

    if (rule.expect === "present" && matches.length === 0) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: "no matching import",
          expected: rule.pattern,
          file,
        }),
      );
    }
  }

  return findings;
};

const evaluateNaming = (rule: NamingRule, context: ProjectContext): Finding[] => {
  const pattern = new RegExp(rule.pattern, "u");
  const findings: Finding[] = [];

  for (const file of scopedFiles(rule, context)) {
    const target = rule.target === "relative" ? file : basename(file);
    if (!pattern.test(target)) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: target,
          expected: rule.pattern,
          file,
        }),
      );
    }
  }

  return findings;
};

const evaluateGrep = async (rule: GrepRule, context: ProjectContext): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const pattern = new RegExp(rule.pattern, rule.multiline ? "mu" : "u");

  for (const file of scopedFiles(rule, context)) {
    const content = await readTextFile(join(context.cwd, file));
    const match = pattern.exec(content);

    if (rule.expect === "absent" && match) {
      const line = content.slice(0, match.index).split("\n").length;
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: match[0],
          expected: "pattern absent",
          file,
          line,
        }),
      );
    }

    if (rule.expect === "present" && !match) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: "pattern absent",
          expected: rule.pattern,
          file,
        }),
      );
    }
  }

  return findings;
};

const evaluateFilePattern = async (
  rule: FilePatternRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const matches = await findByGlob(rule.files, {
    cwd: context.cwd,
    exclude: [...context.config.exclude, ...(rule.exclude ?? [])],
  });

  if (rule.expect === "absent") {
    for (const file of matches) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: "file exists",
          expected: "file absent",
          file,
        }),
      );
    }
  }

  if (rule.expect === "present" && matches.length === 0) {
    pushFinding(
      findings,
      createRuleFinding(rule, {
        actual: "no files matched",
        expected: rule.files.join(", "),
        file: null,
      }),
    );
  }

  return findings;
};

const interpolatePairedPath = (template: string, file: string): string => {
  const extension = file.includes(".") ? `.${file.split(".").pop() ?? ""}` : "";
  const name = basename(file, extension);
  return toPosixPath(
    template
      .replaceAll("{dir}", dirname(file))
      .replaceAll("{name}", name)
      .replaceAll("{basename}", basename(file))
      .replaceAll("{ext}", extension),
  );
};

const evaluatePairedFile = (rule: PairedFileRule, context: ProjectContext): Finding[] => {
  const findings: Finding[] = [];
  const allFiles = new Set(context.files);

  for (const file of scopedFiles(rule, context)) {
    const required = interpolatePairedPath(rule.require, file);
    if (!allFiles.has(required)) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: "missing paired file",
          expected: required,
          file,
        }),
      );
    }
  }

  return findings;
};

const evaluateStructure = async (
  rule: StructureRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const directories = await findByGlob(rule.directories, {
    cwd: context.cwd,
    exclude: [...context.config.exclude, ...(rule.exclude ?? [])],
    onlyDirectories: true,
  });
  const allFiles = new Set(
    await findByGlob(["**/*"], { cwd: context.cwd, exclude: context.config.exclude }),
  );

  for (const directory of directories) {
    for (const required of rule.required) {
      const requiredPath = toPosixPath(join(directory, required));
      if (!allFiles.has(requiredPath)) {
        pushFinding(
          findings,
          createRuleFinding(rule, {
            actual: "missing file",
            expected: requiredPath,
            file: requiredPath,
          }),
        );
      }
    }
  }

  return findings;
};

const evaluateBoundary = async (
  rule: BoundaryRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const edges = await buildImportGraph(context.cwd, context.files);

  for (const edge of edges) {
    if (rule.allowTypeOnly && edge.isTypeOnly) {
      continue;
    }
    if (!edge.to) {
      continue;
    }
    if (matchAnyGlob(edge.from, rule.from) && matchAnyGlob(edge.to, rule.to)) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: `${edge.from} imports ${edge.to}`,
          expected: "no forbidden boundary import",
          file: edge.from,
          line: edge.line,
          source: "graph",
        }),
      );
    }
  }

  return findings;
};

const evaluateMaxLines = async (
  rule: MaxLinesRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const file of scopedFiles(rule, context)) {
    const lineCount = (await readTextFile(join(context.cwd, file))).split("\n").length;
    if (lineCount > rule.max) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: `${lineCount} lines`,
          expected: `at most ${rule.max} lines`,
          file,
          line: rule.max + 1,
        }),
      );
    }
  }

  return findings;
};

const evaluateMaxDependencies = async (
  rule: MaxDependenciesRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const file of scopedFiles(rule, context)) {
    const scan = await scanModule(context.cwd, file);
    if (scan.imports.length > rule.max) {
      pushFinding(
        findings,
        createRuleFinding(rule, {
          actual: `${scan.imports.length} imports`,
          expected: `at most ${rule.max} imports`,
          file,
        }),
      );
    }
  }

  return findings;
};

const evaluateDependency = (rule: PackageDependencyRule, context: ProjectContext): Finding[] => {
  const field = rule.dependencyType;
  const dependencyNames = field
    ? new Set(Object.keys(context.packageJson?.[field] ?? {}))
    : collectDependencyNames(context.packageJson);
  const hasDependency = dependencyNames.has(rule.package);
  const shouldFind = rule.expect === "present";
  const findings: Finding[] = [];

  if (shouldFind !== hasDependency) {
    pushFinding(
      findings,
      createRuleFinding(rule, {
        actual: hasDependency ? "dependency present" : "dependency absent",
        expected: `${rule.package} ${rule.expect}`,
        file: context.packageJson ? "package.json" : null,
        source: "package",
      }),
    );
  }

  return findings;
};

export const evaluateNativeRule = async (
  rule: ShipCleanRule,
  context: ProjectContext,
): Promise<Finding[]> => {
  switch (rule.type) {
    case "export-check":
      return evaluateExportCheck(rule, context);
    case "import-check":
      return evaluateImportCheck(rule, context);
    case "naming":
      return evaluateNaming(rule, context);
    case "grep":
      return evaluateGrep(rule, context);
    case "file-pattern":
      return evaluateFilePattern(rule, context);
    case "paired-file":
      return evaluatePairedFile(rule, context);
    case "structure":
      return evaluateStructure(rule, context);
    case "boundary":
      return evaluateBoundary(rule, context);
    case "max-lines":
      return evaluateMaxLines(rule, context);
    case "max-dependencies":
      return evaluateMaxDependencies(rule, context);
    case "dependency":
      return evaluateDependency(rule, context);
  }
};
