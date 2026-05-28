import { join } from "node:path";

import { readJsonFile, writeProjectFile } from "../utils/fs.js";

interface PackageJson {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export const upsertShipCleanScripts = async (cwd: string): Promise<boolean> => {
  const packagePath = join(cwd, "package.json");
  const packageJson = await readJsonFile<PackageJson>(packagePath);
  if (!packageJson) {
    return false;
  }

  const scripts = {
    ...(packageJson.scripts ?? {}),
  };

  scripts["ship-clean:check"] = "ship-clean check";
  scripts["ship-clean:fix"] = "ship-clean fix";
  scripts["ship-clean:doctor"] = "ship-clean doctor";
  scripts.check ??= "ship-clean check";
  scripts.fix ??= "ship-clean fix";

  await writeProjectFile(
    cwd,
    "package.json",
    `${JSON.stringify(
      {
        ...packageJson,
        scripts,
      },
      null,
      2,
    )}\n`,
  );
  return true;
};
