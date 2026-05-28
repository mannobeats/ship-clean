import type {
  ImpactResult,
  IntelligenceIndex,
  IntelligenceSearchResult,
  IntelligenceSymbol,
} from "./types.js";

const normalize = (value: string): string => value.toLowerCase();

const scoreSymbol = (symbol: IntelligenceSymbol, query: string): number => {
  const q = normalize(query);
  const name = normalize(symbol.name);
  const signature = normalize(symbol.signature);
  const file = normalize(symbol.file);
  let score = 0;

  if (name === q) {
    score += 100;
  } else if (name.startsWith(q)) {
    score += 70;
  } else if (name.includes(q)) {
    score += 50;
  }

  for (const term of q.split(/\s+/u).filter(Boolean)) {
    if (name.includes(term)) {
      score += 20;
    }
    if (signature.includes(term)) {
      score += 10;
    }
    if (file.includes(term)) {
      score += 8;
    }
  }

  if (symbol.exported) {
    score += 5;
  }

  return score;
};

export const searchIntelligence = (
  index: IntelligenceIndex,
  query: string,
  limit = 10,
): IntelligenceSearchResult[] =>
  index.files
    .flatMap((file) => file.symbols)
    .map((symbol) => ({ score: scoreSymbol(symbol, query), symbol }))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.symbol.file.localeCompare(right.symbol.file),
    )
    .slice(0, limit);

const dependenciesOf = (index: IntelligenceIndex, filePath: string): string[] =>
  [
    ...new Set(
      index.files
        .find((file) => file.path === filePath)
        ?.imports.map((item) => item.target)
        .filter((target): target is string => Boolean(target)) ?? [],
    ),
  ].sort();

const dependentsOf = (index: IntelligenceIndex, filePath: string): string[] =>
  index.files
    .filter((file) => file.imports.some((item) => item.target === filePath))
    .map((file) => file.path)
    .sort();

export const impactForFile = (index: IntelligenceIndex, filePath: string): ImpactResult => ({
  dependencies: dependenciesOf(index, filePath),
  dependents: dependentsOf(index, filePath),
  file: filePath,
  symbols: index.files.find((file) => file.path === filePath)?.symbols ?? [],
});

export const affectedFiles = (index: IntelligenceIndex, filePaths: string[]): string[] => {
  const queue = [...filePaths];
  const affected = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || affected.has(current)) {
      continue;
    }
    affected.add(current);
    for (const dependent of dependentsOf(index, current)) {
      queue.push(dependent);
    }
  }

  return [...affected].sort();
};

export const relatedFilesForQuery = (
  index: IntelligenceIndex,
  query: string,
  limit = 6,
): string[] =>
  [...new Set(searchIntelligence(index, query, limit).map((result) => result.symbol.file))].slice(
    0,
    limit,
  );
