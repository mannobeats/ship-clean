export type IntelligenceSymbolKind =
  | "class"
  | "constant"
  | "function"
  | "interface"
  | "method"
  | "type";

export interface IntelligenceSymbol {
  endLine: number;
  exported: boolean;
  file: string;
  id: string;
  kind: IntelligenceSymbolKind;
  name: string;
  signature: string;
  startLine: number;
}

export interface IntelligenceFile {
  imports: Array<{
    line: number;
    source: string;
    target: string | null;
  }>;
  lineCount: number;
  path: string;
  symbols: IntelligenceSymbol[];
}

export interface IntelligenceIndex {
  createdAt: string;
  files: IntelligenceFile[];
  schemaVersion: 1;
  stats: {
    edgeCount: number;
    fileCount: number;
    symbolCount: number;
  };
}

export interface IntelligenceSearchResult {
  score: number;
  symbol: IntelligenceSymbol;
}

export interface ImpactResult {
  dependents: string[];
  dependencies: string[];
  file: string;
  symbols: IntelligenceSymbol[];
}
