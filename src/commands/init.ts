import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  select,
  spinner,
} from "@clack/prompts";
import pc from "picocolors";
import { syncProjectWiring } from "../integrations/project-wiring.js";
import { pathExists, writeProjectFile } from "../utils/fs.js";
import { resolveCwd } from "../utils/paths.js";
import { type InitSelection, renderConfig, selectionFromFlags } from "./init-config.js";

export interface InitCommandOptions {
  cwd?: string | undefined;
  force?: boolean;
  nonInteractive?: boolean;
  projectType?: InitSelection["projectType"];
  strictness?: InitSelection["strictness"];
}

const cancelInit = (): never => {
  cancel("Setup cancelled.");
  throw new Error("Setup cancelled.");
};

const resolveInteractiveSelection = async (): Promise<InitSelection> => {
  intro(pc.bold("ship-clean init"));

  const projectType = await select<InitSelection["projectType"]>({
    message: "What kind of project is this?",
    options: [
      { label: "React app", value: "react" },
      { label: "Next.js app", value: "next" },
      { label: "Node API", value: "node-api" },
      { label: "Monorepo", value: "monorepo" },
      { label: "Library / package", value: "library" },
    ],
  });
  if (isCancel(projectType)) {
    cancelInit();
  }
  const selectedProjectType = projectType as InitSelection["projectType"];

  const strictness = await select<InitSelection["strictness"]>({
    message: "How strict should the quality gate be?",
    options: [
      { label: "Strict", value: "strict", hint: "Recommended for internal projects" },
      { label: "Agent-safe", value: "agent-safe", hint: "Failures for more autonomous work" },
      { label: "Recommended", value: "recommended", hint: "Balanced defaults" },
    ],
  });
  if (isCancel(strictness)) {
    cancelInit();
  }
  const selectedStrictness = strictness as InitSelection["strictness"];

  const systems = await multiselect<string>({
    initialValues: ["lint", "typescript", "graph", "package", "duplicates"],
    message: "Which quality systems should Ship Clean own?",
    options: [
      { label: "Lint + format", value: "lint", hint: "Biome adapter" },
      { label: "TypeScript", value: "typescript", hint: "tsc --noEmit" },
      { label: "Graph health", value: "graph", hint: "cycles, unused files, unused exports" },
      { label: "Package health", value: "package", hint: "missing, unused, forbidden deps" },
      { label: "Duplicate code", value: "duplicates", hint: "normalized block detection" },
    ],
    required: false,
  });
  if (isCancel(systems)) {
    cancelInit();
  }
  const selectedSystems = systems as string[];

  const syncAgents = await confirm({
    initialValue: true,
    message: "Prepare this project for AI-agent quality loops?",
  });
  if (isCancel(syncAgents)) {
    cancelInit();
  }
  const shouldSyncAgents = Boolean(syncAgents);

  const selection = selectionFromFlags({
    duplicates: selectedSystems.includes("duplicates"),
    graph: selectedSystems.includes("graph"),
    lint: selectedSystems.includes("lint"),
    package: selectedSystems.includes("package"),
    projectType: selectedProjectType,
    strictness: selectedStrictness,
    typescript: selectedSystems.includes("typescript"),
  });
  selection.agent.sync = shouldSyncAgents;
  selection.agent.enabled = shouldSyncAgents;

  note(
    [
      `Project: ${selectedProjectType}`,
      `Strictness: ${selectedStrictness}`,
      `Systems: ${selectedSystems.length > 0 ? selectedSystems.join(", ") : "none"}`,
    ].join("\n"),
    "Configuration preview",
  );

  return selection;
};

export const runInitCommand = async (options: InitCommandOptions): Promise<number> => {
  const cwd = resolveCwd(options.cwd);
  const target = "shipclean.config.ts";
  if (!options.force && (await pathExists(`${cwd}/${target}`))) {
    throw new Error(`${target} already exists. Use --force to overwrite it.`);
  }

  const selection = options.nonInteractive
    ? selectionFromFlags({
        ...(options.projectType ? { projectType: options.projectType } : {}),
        ...(options.strictness ? { strictness: options.strictness } : {}),
      })
    : await resolveInteractiveSelection();

  const s = spinner();
  s.start("Writing Ship Clean configuration...");
  await writeProjectFile(cwd, target, renderConfig(selection));
  const wiring = await syncProjectWiring(cwd, selection);
  s.stop(`Created ${target} and synced ${wiring.files.length} support files`);

  note(
    [
      target,
      ...wiring.files,
      ...(wiring.packageScriptsUpdated ? ["package.json scripts"] : []),
    ].join("\n"),
    "Project wiring",
  );

  outro("Ship Clean is ready. Run ship-clean check to start the quality loop.");
  return 0;
};
