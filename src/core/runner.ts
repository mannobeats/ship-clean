import { runBiomeCheck } from "../adapters/biome.js";
import { runOxlintCheck } from "../adapters/oxlint.js";
import { runTypeScriptCheck } from "../adapters/typescript.js";
import { runDuplicateDetection } from "../analyzers/duplicates.js";
import { runGraphHealth } from "../analyzers/graph-health.js";
import { runPackageHealth } from "../analyzers/package-health.js";
import { loadShipCleanConfig } from "../config/loader.js";
import { evaluateConfiguredRules } from "../rules/registry.js";
import { createProjectContext } from "./project-context.js";
import type { CheckResult, EngineResult } from "./result.js";
import { summarizeFindings } from "./result.js";

export interface CheckOptions {
  configPath?: string | undefined;
  cwd?: string | undefined;
}

export const checkProject = async (options: CheckOptions = {}): Promise<CheckResult> => {
  const started = performance.now();
  const config = await loadShipCleanConfig({
    ...(options.configPath ? { configPath: options.configPath } : {}),
    cwd: options.cwd ? options.cwd : process.cwd(),
  });
  const context = await createProjectContext(options.cwd, config);
  const engines: EngineResult[] = [];

  if (config.rules.length > 0) {
    const engineStarted = performance.now();
    const findings = await evaluateConfiguredRules(context);
    engines.push({
      durationMs: performance.now() - engineStarted,
      engine: "policy",
      findings,
      status: findings.some((finding) => finding.severity === "error")
        ? "fail"
        : findings.length > 0
          ? "warn"
          : "pass",
    });
  }

  if (config.graph.enabled) {
    const engineStarted = performance.now();
    const findings = await runGraphHealth(context);
    engines.push({
      durationMs: performance.now() - engineStarted,
      engine: "graph",
      findings,
      status: findings.some((finding) => finding.severity === "error")
        ? "fail"
        : findings.length > 0
          ? "warn"
          : "pass",
    });
  }

  if (config.package.enabled) {
    const engineStarted = performance.now();
    const findings = await runPackageHealth(context);
    engines.push({
      durationMs: performance.now() - engineStarted,
      engine: "package",
      findings,
      status: findings.some((finding) => finding.severity === "error")
        ? "fail"
        : findings.length > 0
          ? "warn"
          : "pass",
    });
  }

  if (config.duplicates.enabled) {
    const engineStarted = performance.now();
    const findings = await runDuplicateDetection(context);
    engines.push({
      durationMs: performance.now() - engineStarted,
      engine: "duplicates",
      findings,
      status: findings.some((finding) => finding.severity === "error")
        ? "fail"
        : findings.length > 0
          ? "warn"
          : "pass",
    });
  }

  if (config.lint.enabled && config.lint.engine === "biome") {
    engines.push(await runBiomeCheck(context));
  }

  if (config.lint.enabled && config.lint.engine === "oxlint") {
    engines.push(await runOxlintCheck(context));
  }

  if (config.typescript.enabled && config.typescript.mode !== "off") {
    engines.push(await runTypeScriptCheck(context));
  }

  const findings = engines.flatMap((engine) => engine.findings);

  return {
    cwd: context.cwd,
    durationMs: performance.now() - started,
    engines,
    findings,
    summary: summarizeFindings(context.files.length, findings),
    tool: "ship-clean",
    version: 1,
  };
};
