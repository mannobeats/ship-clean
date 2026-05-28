import { defineConfig } from "tsup";

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: {
      cli: "src/cli.ts",
      index: "src/index.ts",
      "rules/presets/recommended": "src/rules/presets/recommended.ts",
      "rules/presets/react": "src/rules/presets/react.ts",
      "rules/presets/monorepo": "src/rules/presets/monorepo.ts",
    },
    format: ["esm"],
    platform: "node",
    shims: false,
    splitting: false,
    target: "node20",
  },
]);
