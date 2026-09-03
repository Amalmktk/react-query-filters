import type { FilterValue, QueryState, SortDirection, SortState } from "./types.js";

const RESERVED_KEYS = new Set(["search", "sort", "page", "pageSize"]);

export interface ParseOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function parseQueryState(
  input: string | URLSearchParams,
  options: ParseOptions = {},
): QueryState {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const { defaultPage = 1, defaultPageSize = 20 } = options;

  const filters: Record<string, FilterValue> = {};
  for (const key of params.keys()) {
    if (RESERVED_KEYS.has(key)) continue;
    const raw = params.get(key);
    if (raw === null) continue;
    filters[key] = raw.includes(",") ? raw.split(",") : raw;
  }

  return {
    search: params.get("search") ?? "",
    filters,
    sort: parseSort(params.get("sort")),
    pagination: {
      page: parsePositiveInt(params.get("page"), defaultPage),
      pageSize: parsePositiveInt(params.get("pageSize"), defaultPageSize),
    },
  };
}

function parseSort(raw: string | null): SortState | null {
  if (!raw) return null;

  const [field, direction] = raw.split(":");
  if (!field) return null;

  return {
    field,
    direction: (direction as SortDirection) === "asc" ? "asc" : "desc",
  };
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
