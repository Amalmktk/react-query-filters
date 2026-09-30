import { decodeArrayItem, resolveKeys } from "./keys.js";
import type {
  FilterType,
  FilterValue,
  QueryKeyOptions,
  QueryState,
  SortDirection,
  SortState,
} from "./types.js";

export interface ParseOptions extends QueryKeyOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function parseQueryState(
  input: string | URLSearchParams,
  options: ParseOptions = {},
): QueryState {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const { defaultPage = 1, defaultPageSize = 20, schema = {} } = options;
  const keys = resolveKeys(options);
  const reserved = new Set([keys.search, keys.sort, keys.page, keys.pageSize]);

  const filters: Record<string, FilterValue> = {};
  for (const param of params.keys()) {
    if (!keys.owns(param)) continue;
    const key = keys.toLocal(param);
    if (reserved.has(key)) continue;

    const type = Object.prototype.hasOwnProperty.call(schema, key) ? schema[key] : undefined;
    if (type) {
      const value = parseTypedFilter(params.getAll(param), type);
      if (value === undefined) delete filters[key];
      else filters[key] = value;
      continue;
    }

    const raw = params.get(param);
    if (raw === null) continue;
    filters[key] = raw.includes(",") ? raw.split(",") : raw;
  }

  return {
    search: params.get(keys.toParam(keys.search)) ?? "",
    filters,
    sort: parseSort(params.get(keys.toParam(keys.sort))),
    pagination: {
      page: parsePositiveInt(params.get(keys.toParam(keys.page)), defaultPage),
      pageSize: parsePositiveInt(params.get(keys.toParam(keys.pageSize)), defaultPageSize),
    },
  };
}

/** Parses a schema-typed filter. Returns `undefined` for a value that doesn't fit the type, so it's dropped. */
function parseTypedFilter(raws: string[], type: FilterType): FilterValue | undefined {
  if (type === "array") {
    // Accepts both `tags=a,b` and repeated `tags=a&tags=b`.
    const items = raws.flatMap((raw) => (raw === "" ? [] : raw.split(",").map(decodeArrayItem)));
    return items.length > 0 ? items : undefined;
  }

  const raw = raws[0];
  if (raw === undefined) return undefined;

  if (type === "number") {
    if (raw.trim() === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  if (type === "boolean") {
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return undefined;
  }

  return raw;
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
