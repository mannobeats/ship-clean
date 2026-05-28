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
  engines: {
    ...base.engines,
    ...(next.engines ?? {}),
  },
  exclude: [...base.exclude, ...(next.exclude ?? [])],
  include: next.include ? [...base.include, ...next.include] : base.include,
  presets: isPreset(next) ? [...base.presets, next.name] : base.presets,
  rules: [...base.rules, ...(next.rules ?? [])],
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
    engines: { ...defaultConfig.engines },
    exclude: [...defaultConfig.exclude],
    include: [...defaultConfig.include],
    presets: [],
    rules: [...defaultConfig.rules],
  };

  for (const presetInput of normalizeArray(config.extends)) {
    const preset = await resolvePreset(presetInput);
    resolved = mergeConfig(resolved, preset);
  }

  return mergeConfig(resolved, config);
};
