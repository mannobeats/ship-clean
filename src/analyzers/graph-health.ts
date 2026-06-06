import type { ProjectContext } from "../core/project-context.js";
import type { Finding, Severity } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { findByGlob } from "../utils/glob.js";
import { buildImportGraph, type ImportEdge } from "./graph.js";
import { scanModule } from "./imports.js";

const severityFromSetting = (
  setting: "error" | "warn" | "off",
): Exclude<Severity, "info"> | null => (setting === "off" ? null : setting);

const graphFinding = (input: {
  actual?: string;
  expected?: string;
  file: string | null;
  line?: number;
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
        title: "Fix graph health issue",
      },
    ],
    engine: "graph",
    file: input.file,
    id: createFindingId({
      file: input.file,
      ...(input.line ? { line: input.line } : {}),
      rule: input.rule,
      source: "graph",
    }),
    message: input.message,
    rule: input.rule,
    severity: input.severity,
    source: "graph",
  };

  if (input.actual !== undefined) {
    finding.actual = input.actual;
  }
  if (input.expected !== undefined) {
    finding.expected = input.expected;
  }
  if (input.line !== undefined) {
    finding.line = input.line;
  }

  return finding;
};

const adjacencyFromEdges = (edges: ImportEdge[]): Map<string, string[]> => {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.to) {
      continue;
    }
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  }
  return adjacency;
};

const findCycles = (files: string[], adjacency: Map<string, string[]>): string[][] => {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (file: string): void => {
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      if (start >= 0) {
        cycles.push([...stack.slice(start), file]);
      }
      return;
    }
    if (visited.has(file)) {
      return;
    }

    visiting.add(file);
    stack.push(file);
    for (const next of adjacency.get(file) ?? []) {
      visit(next);
    }
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  };

  for (const file of files) {
    visit(file);
  }

  const seen = new Set<string>();
  return cycles.filter((cycle) => {
    const key = [...new Set(cycle)].sort().join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const reachableFrom = (entrypoints: string[], adjacency: Map<string, string[]>): Set<string> => {
  const reachable = new Set<string>();
  const visit = (file: string): void => {
    if (reachable.has(file)) {
      return;
    }
    reachable.add(file);
    for (const next of adjacency.get(file) ?? []) {
      visit(next);
    }
  };

  for (const entrypoint of entrypoints) {
    visit(entrypoint);
  }

  return reachable;
};

const nextEntrypointGlobs = [
  "app/**/{page,layout,loading,error,not-found,template,default,route,global-error,forbidden,unauthorized}.{ts,tsx,js,jsx}",
  "app/global-not-found.{ts,tsx,js,jsx}",
  "app/**/{opengraph-image,twitter-image,icon,apple-icon,manifest,sitemap,robots}.{ts,tsx,js,jsx}",
  "pages/**/*.{ts,tsx,js,jsx}",
  "src/app/**/{page,layout,loading,error,not-found,template,default,route,global-error,forbidden,unauthorized}.{ts,tsx,js,jsx}",
  "src/app/global-not-found.{ts,tsx,js,jsx}",
  "src/app/**/{opengraph-image,twitter-image,icon,apple-icon,manifest,sitemap,robots}.{ts,tsx,js,jsx}",
  "src/pages/**/*.{ts,tsx,js,jsx}",
  "{middleware,proxy,instrumentation,instrumentation-client}.{ts,js}",
  "src/{middleware,proxy,instrumentation,instrumentation-client}.{ts,js}",
  "next.config.{ts,js,mjs,cjs}",
  "postcss.config.{ts,js,mjs,cjs}",
  "src/mdx-components.{ts,tsx,js,jsx}",
  "mdx-components.{ts,tsx,js,jsx}",
];

const hasDependency = (context: ProjectContext, name: string): boolean =>
  Boolean(
    context.packageJson?.dependencies?.[name] ??
      context.packageJson?.devDependencies?.[name] ??
      context.packageJson?.peerDependencies?.[name],
  );

const uniqueFiles = (files: string[]): string[] => [...new Set(files)];

const resolveEntrypoints = async (context: ProjectContext): Promise<string[]> => {
  if (context.config.graph.entrypoints.length > 0) {
    return findByGlob(context.config.graph.entrypoints, {
      cwd: context.cwd,
      exclude: context.config.exclude,
    });
  }

  const conventionEntrypoints = context.files.filter((file) =>
    /(^|\/)(main|index|cli|server|app|page)\.(ts|tsx|js|jsx)$/u.test(file),
  );

  if (!hasDependency(context, "next")) {
    return conventionEntrypoints;
  }

  const nextEntrypoints = await findByGlob(nextEntrypointGlobs, {
    cwd: context.cwd,
    exclude: context.config.exclude,
  });
  return uniqueFiles([...conventionEntrypoints, ...nextEntrypoints]);
};

export const runGraphHealth = async (context: ProjectContext): Promise<Finding[]> => {
  if (!context.config.graph.enabled) {
    return [];
  }

  const findings: Finding[] = [];
  const edges = await buildImportGraph(context.cwd, context.files);
  const adjacency = adjacencyFromEdges(edges);

  const cycleSeverity = severityFromSetting(context.config.graph.cycles);
  if (cycleSeverity) {
    for (const cycle of findCycles(context.files, adjacency)) {
      const file = cycle[0] ?? null;
      findings.push(
        graphFinding({
          actual: cycle.join(" -> "),
          expected: "acyclic import graph",
          file,
          message: "Circular dependency detected.",
          rule: "graph/no-cycles",
          severity: cycleSeverity,
        }),
      );
    }
  }

  const unusedFileSeverity = severityFromSetting(context.config.graph.unusedFiles);
  const entrypoints = await resolveEntrypoints(context);
  if (unusedFileSeverity && entrypoints.length > 0) {
    const reachable = reachableFrom(entrypoints, adjacency);
    for (const file of context.files) {
      if (!reachable.has(file)) {
        findings.push(
          graphFinding({
            actual: "file is not reachable from configured entrypoints",
            expected: `reachable from ${entrypoints.join(", ")}`,
            file,
            message: "Unused or unreachable source file detected.",
            rule: "graph/no-unused-files",
            severity: unusedFileSeverity,
          }),
        );
      }
    }
  }

  const unusedExportSeverity = severityFromSetting(context.config.graph.unusedExports);
  if (unusedExportSeverity) {
    const importedTargets = new Set(
      edges.map((edge) => edge.to).filter((file): file is string => Boolean(file)),
    );
    for (const file of context.files) {
      if (entrypoints.includes(file) || importedTargets.has(file)) {
        continue;
      }
      const scan = await scanModule(context.cwd, file);
      for (const exported of scan.exports) {
        findings.push(
          graphFinding({
            actual: exported.name,
            expected: "export is imported or file is an entrypoint",
            file,
            line: exported.line,
            message: "Export appears unused because its module is unreachable.",
            rule: "graph/no-unused-exports",
            severity: unusedExportSeverity,
          }),
        );
      }
    }
  }

  return findings;
};
