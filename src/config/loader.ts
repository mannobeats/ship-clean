import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadConfig } from "c12";

import type { ResolvedConfig, ShipCleanConfig } from "../rules/types.js";
import { readJsonFile } from "../utils/fs.js";
import { resolveConfig } from "./resolve.js";
import { configSchema } from "./schema.js";

export interface LoadShipCleanConfigOptions {
  configPath?: string | undefined;
  cwd: string;
}

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
    name: "shipclean",
    packageJson: true,
  });

  const rawConfig = result.config ?? {};
  const parsed = configSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(`Invalid Ship Clean config:\n${parsed.error.message}`);
  }

  return resolveConfig(parsed.data as ShipCleanConfig);
};

export const createStarterConfig = (): string => `import { defineConfig } from "ship-clean";

export default defineConfig({
  extends: ["ship-clean/recommended"],
  lint: {
    enabled: true,
    engine: "biome",
    preset: "recommended",
    format: true,
    organizeImports: true,
  },
  typescript: {
    enabled: true,
  },
  graph: {
    enabled: true,
    cycles: "error",
    unusedFiles: "warn",
    unusedExports: "warn",
  },
  package: {
    enabled: true,
    missingDependencies: "error",
    unusedDependencies: "warn",
  },
  duplicates: {
    enabled: true,
    minLines: 8,
    severity: "warn",
  },
  rules: [
    {
      type: "file-pattern",
      name: "no-barrels",
      files: ["src/**/index.ts"],
      exclude: ["src/index.ts"],
      expect: "absent",
      severity: "warn",
      message: "Avoid barrel files; import directly from source modules.",
    },
  ],
});
`;

export const defaultConfigPath = (cwd: string): string => join(cwd, "shipclean.config.ts");
