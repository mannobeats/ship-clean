import { resolveRelativeImport, scanModule } from "./imports.js";

export interface ImportEdge {
  from: string;
  isTypeOnly: boolean;
  line: number;
  source: string;
  to: string | null;
}

export const buildImportGraph = async (cwd: string, files: string[]): Promise<ImportEdge[]> => {
  const edges: ImportEdge[] = [];

  for (const file of files) {
    const scan = await scanModule(cwd, file);
    for (const item of scan.imports) {
      edges.push({
        from: file,
        isTypeOnly: item.isTypeOnly,
        line: item.line,
        source: item.source,
        to: resolveRelativeImport(file, item.source, files),
      });
    }
  }

  return edges;
};
