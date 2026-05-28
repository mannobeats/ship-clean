import type { InitSelection } from "../commands/init-config.js";

export const renderVscodeSettings = (selection: InitSelection): string => {
  const formatter = selection.lint.engine === "biome" ? "biomejs.biome" : "oxc.oxc-vscode";
  const fixAction = selection.lint.engine === "biome" ? "source.fixAll.biome" : "source.fixAll.oxc";
  const organizeImportsAction =
    selection.lint.engine === "biome" ? "source.organizeImports.biome" : "source.organizeImports";

  const settings = {
    "editor.defaultFormatter": formatter,
    "editor.formatOnPaste": true,
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      [fixAction]: "explicit",
      [organizeImportsAction]: "explicit",
    },
    "js/ts.tsdk.path": "node_modules/typescript/lib",
    "js/ts.tsdk.promptToUseWorkspaceVersion": true,
    "[javascript]": {
      "editor.defaultFormatter": formatter,
    },
    "[javascriptreact]": {
      "editor.defaultFormatter": formatter,
    },
    "[json]": {
      "editor.defaultFormatter": formatter,
    },
    "[jsonc]": {
      "editor.defaultFormatter": formatter,
    },
    "[typescript]": {
      "editor.defaultFormatter": formatter,
    },
    "[typescriptreact]": {
      "editor.defaultFormatter": formatter,
    },
  };

  return `${JSON.stringify(settings, null, 2)}\n`;
};
