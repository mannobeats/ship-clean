import { definePreset } from "../../config/define-config.js";

export default definePreset({
  name: "ship-clean/react",
  rules: [
    {
      type: "naming",
      name: "react-component-pascal-case",
      files: ["src/components/**/*.{tsx,jsx}"],
      pattern: "^[A-Z][A-Za-z0-9]*\\.(tsx|jsx)$",
      severity: "warn",
      message: "React component files should use PascalCase.",
    },
    {
      type: "grep",
      name: "no-focused-tests",
      files: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
      expect: "absent",
      pattern: "\\b(describe|it|test)\\.only\\(",
      severity: "error",
      message: "Focused tests must not be committed.",
    },
  ],
});
