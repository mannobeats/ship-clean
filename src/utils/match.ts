const escapeRegExp = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");

const expandBraces = (pattern: string): string[] => {
  const match = /\{([^{}]+)\}/u.exec(pattern);
  if (!match?.[1]) {
    return [pattern];
  }
  const before = pattern.slice(0, match.index);
  const after = pattern.slice(match.index + match[0].length);
  return match[1].split(",").flatMap((part) => expandBraces(`${before}${part}${after}`));
};

const globToRegExp = (pattern: string): RegExp => {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      const following = pattern[index + 2];
      if (following === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char ?? "");
  }

  return new RegExp(`^${source}$`, "u");
};

export const matchGlob = (path: string, pattern: string): boolean =>
  expandBraces(pattern).some((expanded) => globToRegExp(expanded).test(path));

export const matchAnyGlob = (path: string, patterns: string[] = []): boolean =>
  patterns.some((pattern) => matchGlob(path, pattern));

export const filterByGlobs = (
  files: string[],
  include: string[],
  exclude: string[] = [],
): string[] => files.filter((file) => matchAnyGlob(file, include) && !matchAnyGlob(file, exclude));
