import monorepo from "../rules/presets/monorepo.js";
import react from "../rules/presets/react.js";
import recommended from "../rules/presets/recommended.js";
import type {
  PresetInput,
  ResolvedConfig,
  ShipCleanConfig,
  ShipCleanPreset,
} from "../rules/types.js";
import { defaultConfig } from "./defaults.js";

const builtInPresets = new Map<string, ShipCleanPreset>([
  ["ship-clean/recommended", recommended],
  ["ship-clean/presets/recommended", recommended],
  ["recommended", recommended],
  ["ship-clean/react", react],
  ["ship-clean/presets/react", react],
  ["react", react],
  ["ship-clean/monorepo", monorepo],
  ["ship-clean/presets/monorepo", monorepo],
  ["monorepo", monorepo],
]);

const normalizeArray = <T>(input: T | T[] | undefined): T[] => {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
};

const isPreset = (input: PresetInput): input is ShipCleanPreset =>
  typeof input === "object" && "name" in input;

const mergeConfig = (
  base: ResolvedConfig,
  next: ShipCleanConfig | ShipCleanPreset,
): ResolvedConfig => ({
  agent: {
    ...base.agent,
    ...(next.agent ?? {}),
  },
  duplicates: {
    ...base.duplicates,
    ...(next.duplicates ?? {}),
  },
  exclude: [...base.exclude, ...(next.exclude ?? [])],
  graph: {
    ...base.graph,
    ...(next.graph ?? {}),
  },
  include: next.include ? [...base.include, ...next.include] : base.include,
  lint: {
    ...base.lint,
    ...(next.lint ?? {}),
  },
  package: {
    ...base.package,
    ...(next.package ?? {}),
  },
  presets: isPreset(next) ? [...base.presets, next.name] : base.presets,
  rules: [...base.rules, ...(next.rules ?? [])],
  typescript: {
    ...base.typescript,
    ...(next.typescript ?? {}),
  },
});

const resolvePreset = async (
  preset: PresetInput | string,
): Promise<ShipCleanConfig | ShipCleanPreset> => {
  if (typeof preset !== "string") {
    return preset;
  }

  const builtIn = builtInPresets.get(preset);
  if (builtIn) {
    return builtIn;
  }

  const loaded = (await import(preset)) as { default?: ShipCleanConfig | ShipCleanPreset };
  if (!loaded.default) {
    throw new Error(`Preset "${preset}" did not export a default config.`);
  }
  return loaded.default;
};

export const resolveConfig = async (config: ShipCleanConfig): Promise<ResolvedConfig> => {
  let resolved: ResolvedConfig = {
    ...defaultConfig,
    agent: { ...defaultConfig.agent },
    duplicates: {
      ...defaultConfig.duplicates,
      exclude: [...defaultConfig.duplicates.exclude],
      files: [...defaultConfig.duplicates.files],
    },
    exclude: [...defaultConfig.exclude],
    graph: { ...defaultConfig.graph, entrypoints: [...defaultConfig.graph.entrypoints] },
    include: [...defaultConfig.include],
    lint: { ...defaultConfig.lint },
    package: { ...defaultConfig.package, forbidden: [...defaultConfig.package.forbidden] },
    presets: [],
    rules: [...defaultConfig.rules],
    typescript: { ...defaultConfig.typescript },
  };

  for (const presetInput of normalizeArray(config.extends)) {
    const preset = await resolvePreset(presetInput);
    resolved = mergeConfig(resolved, preset);
  }

  return mergeConfig(resolved, config);
};
