import { isAbsolute, relative } from "node:path";
import type { ProjectContext } from "../core/project-context.js";
import type { EngineResult, Finding } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { runPackageBin } from "./run-command.js";

interface OxlintDiagnostic {
  code?: string;
  filename?: string;
  labels?: Array<{
    span?: {
      column?: number;
      line?: number;
    };
  }>;
  message?: string;
  severity?: string;
}

interface OxlintJsonOutput {
  diagnostics?: OxlintDiagnostic[];
}

const severityFromOxlint = (severity: string | undefined): Finding["severity"] => {
  if (severity === "error") {
    return "error";
  }
  if (severity === "warning") {
    return "warn";
  }
  return "info";
};

const normalizePath = (cwd: string, file: string | null): string | null => {
  if (!file) {
    return null;
  }
  return isAbsolute(file) ? relative(cwd, file) : file;
};

const parseOxlintJson = (stdout: string, cwd: string): Finding[] | null => {
  if (!stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as OxlintJsonOutput;
    if (!Array.isArray(parsed.diagnostics)) {
      return null;
    }

    return parsed.diagnostics.map((diagnostic) => {
      const file = normalizePath(cwd, diagnostic.filename ?? null);
      const firstSpan = diagnostic.labels?.[0]?.span;
      const line = firstSpan?.line;
      const column = firstSpan?.column;
      const rule = diagnostic.code ?? "oxlint";
      const findingLine = typeof line === "number" && line > 0 ? line : undefined;
      const finding: Finding = {
        actions: [
          {
            command: "ship-clean fix",
            confidence: "medium",
            description: "Run Ship Clean fix or inspect Oxlint output.",
            kind: "run-command",
            title: "Run safe fixes",
          },
        ],
        engine: "oxlint",
        file,
        id: createFindingId({
          file,
          ...(findingLine ? { line: findingLine } : {}),
          rule,
          source: "oxlint",
        }),
        message: diagnostic.message ?? "Oxlint reported a diagnostic.",
        rule,
        severity: severityFromOxlint(diagnostic.severity),
        source: "oxlint",
      };

      if (findingLine) {
        finding.line = findingLine;
      }
      if (typeof column === "number" && column > 0) {
        finding.column = column;
      }

      return finding;
    });
  } catch {
    return null;
  }
};

export const runOxlintCheck = async (context: ProjectContext): Promise<EngineResult> => {
  const started = performance.now();
  const result = runPackageBin("oxlint", "oxlint", [".", "--format", "json"], {
    cwd: context.cwd,
  });
  const findings = parseOxlintJson(result.stdout, context.cwd);

  if (result.exitCode === 0) {
    return {
      durationMs: performance.now() - started,
      engine: "oxlint",
      findings: findings ?? [],
      status: findings && findings.length > 0 ? "fail" : "pass",
    };
  }

  const fallbackFinding: Finding = {
    actions: [
      {
        command: "ship-clean fix",
        confidence: "medium",
        description: "Run Ship Clean fix or inspect Oxlint output.",
        kind: "run-command",
        title: "Run safe fixes",
      },
    ],
    engine: "oxlint",
    file: null,
    id: createFindingId({ file: null, rule: "oxlint", source: "oxlint" }),
    message: (result.stdout || result.stderr).trim() || "Oxlint check failed.",
    rule: "oxlint",
    severity: "error",
    source: "oxlint",
  };

  return {
    durationMs: performance.now() - started,
    engine: "oxlint",
    findings: findings ?? [fallbackFinding],
    status: "fail",
  };
};

export const runOxlintFix = (cwd: string, unsafe = false): number =>
  runPackageBin("oxlint", "oxlint", [unsafe ? "--fix-dangerously" : "--fix", "."], { cwd })
    .exitCode;
