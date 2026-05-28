import { defineConfig } from "./src/config/define-config.js";

export default defineConfig({
  extends: ["ship-clean/recommended"],
  engines: {
    biome: false,
    graph: true,
    package: true,
    policy: true,
    typescript: true,
  },
  include: ["src/**/*.{ts,tsx}", "test/**/*.ts"],
  exclude: ["src/rules/presets/**", "src/output/index.ts"],
  rules: [
    {
      type: "grep",
      name: "no-explicit-any",
      files: ["src/**/*.ts"],
      expect: "absent",
      pattern: "\\bany\\b",
      severity: "error",
      message: "Ship Clean source should avoid explicit any.",
    },
    {
      type: "file-pattern",
      name: "no-source-default-exports",
      files: ["src/**/*.ts"],
      exclude: ["src/cli.ts"],
      expect: "present",
      severity: "off",
      message: "Placeholder for future default-export policy.",
    },
  ],
});
