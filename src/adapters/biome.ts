import { isAbsolute, relative } from "node:path";
import type { ProjectContext } from "../core/project-context.js";
import type { EngineResult, Finding } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { runPackageBin } from "./run-command.js";

interface BiomeDiagnostic {
  category?: string;
  location?: {
    path?: string;
    start?: {
      column?: number;
      line?: number;
    };
  };
  message?: string;
  severity?: string;
}

interface BiomeJsonOutput {
  diagnostics?: BiomeDiagnostic[];
}

const severityFromBiome = (severity: string | undefined): Finding["severity"] => {
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

const parseBiomeJson = (stdout: string, cwd: string): Finding[] | null => {
  if (!stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as BiomeJsonOutput;
    if (!Array.isArray(parsed.diagnostics)) {
      return null;
    }

    return parsed.diagnostics.map((diagnostic) => {
      const file = normalizePath(cwd, diagnostic.location?.path ?? null);
      const line = diagnostic.location?.start?.line;
      const column = diagnostic.location?.start?.column;
      const rule = diagnostic.category ?? "biome";
      const findingLine = typeof line === "number" && line > 0 ? line : undefined;
      const finding: Finding = {
        actions: [
          {
            command: "ship-clean fix",
            confidence: "medium",
            description: "Run Ship Clean fix to apply safe formatter/linter fixes.",
            kind: "run-command",
            title: "Run safe fixes",
          },
        ],
        engine: "biome",
        file,
        id: createFindingId({
          file,
          ...(findingLine ? { line: findingLine } : {}),
          rule,
          source: "biome",
        }),
        message: diagnostic.message ?? "Biome reported a diagnostic.",
        rule,
        severity: severityFromBiome(diagnostic.severity),
        source: "biome",
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

const commandFinding = (message: string, severity: "error" | "warn" = "error"): Finding => ({
  actions: [
    {
      command: "ship-clean fix",
      confidence: "medium",
      description: "Run Ship Clean fix to apply safe formatter/linter fixes.",
      kind: "run-command",
      title: "Run safe fixes",
    },
  ],
  engine: "biome",
  file: null,
  id: createFindingId({ file: null, rule: "biome", source: "biome" }),
  message,
  rule: "biome",
  severity,
  source: "biome",
});

export const runBiomeCheck = async (context: ProjectContext): Promise<EngineResult> => {
  const started = performance.now();
  const result = runPackageBin(
    "@biomejs/biome",
    "biome",
    ["check", "--reporter=json", "--no-errors-on-unmatched", "."],
    {
      cwd: context.cwd,
    },
  );
  const findings = parseBiomeJson(result.stdout, context.cwd);

  if (result.exitCode === 0) {
    return {
      durationMs: performance.now() - started,
      engine: "biome",
      findings: findings ?? [],
      status: findings && findings.length > 0 ? "fail" : "pass",
    };
  }

  return {
    durationMs: performance.now() - started,
    engine: "biome",
    findings: findings ?? [
      commandFinding((result.stdout || result.stderr).trim() || "Biome check failed."),
    ],
    status: "fail",
  };
};

export const runBiomeFix = (cwd: string): number =>
  runPackageBin("@biomejs/biome", "biome", ["check", "--write", "--no-errors-on-unmatched", "."], {
    cwd,
  }).exitCode;
