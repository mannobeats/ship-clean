import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadConfig } from "c12";

import { renderConfig } from "../commands/init-config.js";
import type { ResolvedConfig, ShipCleanConfig } from "../rules/types.js";
import { readJsonFile } from "../utils/fs.js";
import { resolveConfig } from "./resolve.js";
import { configSchema } from "./schema.js";

export interface LoadShipCleanConfigOptions {
  configPath?: string | undefined;
  cwd: string;
}

const resolveConfigModule = (module: unknown): unknown => {
  if (
    module &&
    typeof module === "object" &&
    "default" in module &&
    module.default &&
    typeof module.default === "object" &&
    "default" in module.default
  ) {
    return module.default.default;
  }

  if (module && typeof module === "object" && "default" in module) {
    return module.default;
  }

  return module;
};

export const loadShipCleanConfig = async (
  options: LoadShipCleanConfigOptions,
): Promise<ResolvedConfig> => {
  const explicitJsonPath = options.configPath?.endsWith(".json") ? options.configPath : undefined;
  const defaultJsonPath = join(options.cwd, "shipclean.config.json");
  const jsonPath = explicitJsonPath ?? (existsSync(defaultJsonPath) ? defaultJsonPath : undefined);

  if (jsonPath) {
    const rawJsonConfig = await readJsonFile<ShipCleanConfig>(jsonPath);
    const parsedJson = configSchema.safeParse(rawJsonConfig ?? {});
    if (!parsedJson.success) {
      throw new Error(`Invalid Ship Clean config:\n${parsedJson.error.message}`);
    }
    return resolveConfig(parsedJson.data as ShipCleanConfig);
  }

  const result = await loadConfig<ShipCleanConfig>({
    ...(options.configPath ? { configFile: options.configPath } : {}),
    cwd: options.cwd,
    extend: false,
    import: (id) => import(id),
    name: "shipclean",
    packageJson: true,
    resolveModule: resolveConfigModule,
  });

  const rawConfig = result.config ?? {};
  const parsed = configSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(`Invalid Ship Clean config:\n${parsed.error.message}`);
  }

  return resolveConfig(parsed.data as ShipCleanConfig);
};

export const createStarterConfig = (): string =>
  renderConfig({
    agent: {
      enabled: true,
      sync: true,
    },
    duplicates: {
      enabled: true,
      minLines: 8,
      severity: "warn",
    },
    graph: {
      cycles: "error",
      enabled: true,
      entrypoints: [],
      unusedExports: "warn",
      unusedFiles: "warn",
    },
    lint: {
      enabled: true,
      engine: "biome",
      format: true,
      organizeImports: true,
      preset: "strict",
    },
    package: {
      enabled: true,
      forbidden: ["moment"],
      missingDependencies: "error",
      unusedDependencies: "warn",
    },
    presets: ["ship-clean/recommended"],
    projectType: "react",
    strictness: "strict",
    typescript: {
      enabled: true,
      mode: "project",
    },
  });

export const defaultConfigPath = (cwd: string): string => join(cwd, "shipclean.config.ts");
