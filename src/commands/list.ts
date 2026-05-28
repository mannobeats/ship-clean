import { intro, note, outro } from "@clack/prompts";
import pc from "picocolors";

import { loadShipCleanConfig } from "../config/loader.js";
import { resolveCwd } from "../utils/paths.js";

export interface ListCommandOptions {
  cwd?: string | undefined;
}

export const runListCommand = async (options: ListCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const config = await loadShipCleanConfig({ cwd });

  intro(pc.bold("ship-clean list"));
  note(
    [
      `lint: ${config.lint.enabled ? `${config.lint.engine}/${config.lint.preset}` : "off"}`,
      `typescript: ${config.typescript.enabled ? config.typescript.mode : "off"}`,
      `graph: ${config.graph.enabled ? `on, cycles=${config.graph.cycles}, unusedFiles=${config.graph.unusedFiles}` : "off"}`,
      `package: ${config.package.enabled ? `on, missing=${config.package.missingDependencies}, unused=${config.package.unusedDependencies}` : "off"}`,
      `duplicates: ${config.duplicates.enabled ? `on, minLines=${config.duplicates.minLines}, severity=${config.duplicates.severity}` : "off"}`,
      `agent: ${config.agent.enabled ? "on" : "off"}`,
    ].join("\n"),
    "Quality systems",
  );

  note(
    config.rules.length > 0
      ? config.rules.map((rule) => `${rule.name} ${pc.dim(`(${rule.type})`)}`).join("\n")
      : "No project-specific rules configured.",
    "Project rules",
  );

  outro(`${config.presets.length} presets, ${config.rules.length} rules.`);

  return 0;
};
