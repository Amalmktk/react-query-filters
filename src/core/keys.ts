import type { QueryKeyOptions } from "./types.js";

export interface ResolvedKeys {
  search: string;
  sort: string;
  page: string;
  pageSize: string;
  /** Whether a (full, possibly prefixed) URL param belongs to this instance. */
  owns: (param: string) => boolean;
  /** Strips the prefix from an owned param. */
  toLocal: (param: string) => string;
  /** Adds the prefix to a local key. */
  toParam: (key: string) => string;
}

/** Resolves the prefix and param-name options into the local names for the reserved keys and prefix helpers. */
export function resolveKeys(options: QueryKeyOptions = {}): ResolvedKeys {
  const { prefix, paramNames = {} } = options;
  const head = prefix ? `${prefix}.` : "";

  return {
    search: paramNames.search ?? "search",
    sort: paramNames.sort ?? "sort",
    page: paramNames.page ?? "page",
    pageSize: paramNames.pageSize ?? "pageSize",
    owns: (param) => param.startsWith(head),
    toLocal: (param) => param.slice(head.length),
    toParam: (key) => `${head}${key}`,
  };
}

/** Returns only the params this instance owns, as a normalized query string. */
export function pickOwnParams(search: string, options: QueryKeyOptions = {}): string {
  const { owns } = resolveKeys(options);
  const own = new URLSearchParams();

  for (const [key, value] of new URLSearchParams(search)) {
    if (owns(key)) own.append(key, value);
  }

  return own.toString();
}

/**
 * Replaces the params this instance owns in `current` with `own`, keeping
 * everything else (another namespace's params, analytics params, etc).
 * Without a prefix the instance owns every param, so this returns `own`.
 */
export function mergeOwnParams(
  current: string,
  own: string,
  options: QueryKeyOptions = {},
): string {
  if (!options.prefix) return own;

  const { owns } = resolveKeys(options);
  const merged = new URLSearchParams();

  for (const [key, value] of new URLSearchParams(current)) {
    if (!owns(key)) merged.append(key, value);
  }

  for (const [key, value] of new URLSearchParams(own)) {
    merged.append(key, value);
  }

  return merged.toString();
}

/** Escapes commas (and the escape character) inside an array item so the item survives the comma-joined encoding. */
export function encodeArrayItem(item: string): string {
  return item.replace(/%/g, "%25").replace(/,/g, "%2C");
}

export function decodeArrayItem(item: string): string {
  return item.replace(/%2C/gi, ",").replace(/%25/g, "%");
}
