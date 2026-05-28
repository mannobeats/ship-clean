import { definePreset } from "../../config/define-config.js";

export default definePreset({
  name: "ship-clean/recommended",
  rules: [
    {
      type: "file-pattern",
      name: "no-source-barrels",
      files: ["src/**/index.{ts,tsx,js,jsx}"],
      exclude: ["src/index.{ts,tsx,js,jsx}"],
      expect: "absent",
      severity: "warn",
      message: "Avoid source barrel files; import directly from the owning module.",
    },
    {
      type: "grep",
      name: "no-debugger",
      files: ["src/**/*.{ts,tsx,js,jsx}"],
      expect: "absent",
      pattern: "\\bdebugger\\b",
      severity: "error",
      message: "Remove debugger statements before shipping.",
    },
  ],
});
