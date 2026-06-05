import { existsSync } from "node:fs";
import { join } from "node:path";

import { intro, log, note, outro } from "@clack/prompts";
import pc from "picocolors";

import { loadShipCleanConfig } from "../config/loader.js";
import { getIntelligenceStorageStatus } from "../intelligence/store.js";
import { resolveCwd } from "../utils/paths.js";

export interface DoctorCommandOptions {
  cwd?: string | undefined;
}

type DoctorCheck = { detail: string; name: string; status: "fail" | "pass" | "warn" };

export const runDoctorCommand = async (options: DoctorCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const hasPackageJson = existsSync(join(cwd, "package.json"));
  const checks: DoctorCheck[] = [
    {
      detail: hasPackageJson
        ? "Project metadata found."
        : "Project metadata is required for package health checks.",
      name: "package.json",
      status: hasPackageJson ? "pass" : "fail",
    },
    {
      detail: "Configuration loads and validates.",
      name: "shipclean config",
      status: "pass",
    },
  ];
  let configSummary = "";

  try {
    const config = await loadShipCleanConfig({ cwd });
    configSummary = [
      `lint: ${config.lint.enabled ? `${config.lint.engine}/${config.lint.preset}` : "off"}`,
      `typescript: ${config.typescript.enabled ? config.typescript.mode : "off"}`,
      `graph: ${config.graph.enabled ? "on" : "off"}`,
      `package: ${config.package.enabled ? "on" : "off"}`,
      `duplicates: ${config.duplicates.enabled ? "on" : "off"}`,
      `rules: ${config.rules.length}`,
    ].join("\n");

    if (config.lint.enabled && config.lint.engine === "biome") {
      checks.push({
        detail: "Ship Clean can materialize Biome rules for editor and CLI consistency.",
        name: "biome.jsonc",
        status: existsSync(join(cwd, "biome.jsonc")) ? "pass" : "warn",
      });
    }

    if (config.agent.enabled && config.agent.sync) {
      checks.push({
        detail: "Agent instructions should point agents back to ship-clean check.",
        name: "AGENTS.md",
        status: existsSync(join(cwd, "AGENTS.md")) ? "pass" : "warn",
      });
    }

    checks.push({
      detail: "Editor format-on-save keeps humans and agents aligned while coding.",
      name: ".vscode/settings.json",
      status: existsSync(join(cwd, ".vscode/settings.json")) ? "pass" : "warn",
    });

    if (config.agent.enabled) {
      try {
        await getIntelligenceStorageStatus(cwd);
        checks.push({
          detail: "SQLite storage is available for code intelligence commands.",
          name: "intelligence storage",
          status: "pass",
        });
      } catch (error) {
        checks.push({
          detail:
            error instanceof Error
              ? error.message
              : "SQLite storage is not available for code intelligence commands.",
          name: "intelligence storage",
          status: "warn",
        });
      }
    }
  } catch (error) {
    checks[1] = {
      detail: error instanceof Error ? error.message : "Configuration failed to load.",
      name: "shipclean config",
      status: "fail",
    };
  }

  intro(pc.bold("ship-clean doctor"));
  for (const check of checks) {
    if (check.status === "pass") {
      log.success(`${check.name} ${pc.dim(check.detail)}`);
    } else if (check.status === "warn") {
      log.warn(`${check.name} ${pc.dim(check.detail)}`);
    } else {
      log.error(`${check.name} ${pc.dim(check.detail)}`);
    }
  }

  if (configSummary) {
    note(configSummary, "Active quality systems");
  }

  const ok = checks.every((check) => check.status !== "fail");
  outro(
    ok ? "Ship Clean is ready." : "Ship Clean needs attention before it can protect this project.",
  );
  return ok ? 0 : 1;
};
