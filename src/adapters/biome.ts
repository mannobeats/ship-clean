import { isAbsolute, relative, resolve } from "node:path";
import type { ProjectContext } from "../core/project-context.js";
import type { EngineResult, Finding } from "../core/result.js";
import { createFindingId } from "../core/result.js";
import { renderBiomeConfig } from "../integrations/biome-config.js";
import type { ResolvedConfig } from "../rules/types.js";
import { writeProjectFile } from "../utils/fs.js";
import { findByGlob } from "../utils/glob.js";
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

const GENERATED_BIOME_CONFIG = ".ship-clean/biome.generated.json";

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

const materializeBiomeConfig = async (
  cwd: string,
  config: Pick<ResolvedConfig, "lint">,
): Promise<string> => {
  await writeProjectFile(cwd, GENERATED_BIOME_CONFIG, renderBiomeConfig(config));
  return resolve(cwd, GENERATED_BIOME_CONFIG);
};

const targetArgs = (files: string[]): string[] => (files.length > 0 ? files : ["."]);

export const runBiomeCheck = async (context: ProjectContext): Promise<EngineResult> => {
  const started = performance.now();
  const configPath = await materializeBiomeConfig(context.cwd, context.config);
  const result = runPackageBin(
    "@biomejs/biome",
    "biome",
    [
      "check",
      "--reporter=json",
      "--no-errors-on-unmatched",
      "--config-path",
      configPath,
      ...targetArgs(context.files),
    ],
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

export const runBiomeFix = async (cwd: string, config: ResolvedConfig): Promise<number> => {
  const configPath = await materializeBiomeConfig(cwd, config);
  const files = await findByGlob(config.include, {
    cwd,
    exclude: config.exclude,
  });
  return runPackageBin(
    "@biomejs/biome",
    "biome",
    [
      "check",
      "--write",
      "--no-errors-on-unmatched",
      "--config-path",
      configPath,
      ...targetArgs(files),
    ],
    {
      cwd,
    },
  ).exitCode;
};
