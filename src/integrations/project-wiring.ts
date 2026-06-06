import type { InitSelection } from "../commands/init-config.js";
import { writeProjectFile } from "../utils/fs.js";
import { renderAgentRules } from "./agent-rules.js";
import { renderVscodeSettings } from "./editor-config.js";
import { upsertShipCleanScripts } from "./package-json.js";

export interface ProjectWiringResult {
  files: string[];
  packageScriptsUpdated: boolean;
}

export const syncProjectWiring = async (
  cwd: string,
  selection: InitSelection,
): Promise<ProjectWiringResult> => {
  const files: string[] = [];

  await writeProjectFile(cwd, ".vscode/settings.json", renderVscodeSettings(selection));
  files.push(".vscode/settings.json");

  if (selection.agent.enabled && selection.agent.sync) {
    await writeProjectFile(cwd, "AGENTS.md", renderAgentRules(selection));
    files.push("AGENTS.md");
  }

  const packageScriptsUpdated = await upsertShipCleanScripts(cwd);

  return {
    files,
    packageScriptsUpdated,
  };
};
