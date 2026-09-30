export type FilterValue = string | number | boolean | string[] | null;

/**
 * A two-sided bound filter (a date range, a price range, etc). Not a
 * distinct `FilterValue` variant — it's a convenience shape read from, and
 * written to, two ordinary string filters (`${key}From` / `${key}To`), so it
 * needs no changes to `parseQueryState`/`serializeQueryState` and works with
 * every existing filter mechanism. Either side may be `null` for an
 * open-ended range (e.g. "$10 and up").
 */
export interface RangeValue {
  from: string | null;
  to: string | null;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  field: string;
  direction: SortDirection;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface QueryState {
  search: string;
  filters: Record<string, FilterValue>;
  sort: SortState | null;
  pagination: PaginationState;
}

/**
 * How a filter's URL value is parsed. Filters not listed in a schema keep the
 * untyped behavior: a plain string, or a string array when it contains a comma.
 */
export type FilterType = "string" | "number" | "boolean" | "array";

/** Maps filter keys to their `FilterType`, e.g. `{ price: "number", tags: "array" }`. */
export type FilterSchema = Record<string, FilterType>;

interface FilterTypeMap {
  string: string;
  number: number;
  boolean: boolean;
  array: string[];
}

/** The typed filters record a `FilterSchema` describes. Every key is optional, since it may be absent from the URL. */
export type InferFilters<S extends FilterSchema> = {
  [K in keyof S]?: FilterTypeMap[S[K]];
};

/** A `QueryState` whose `filters` are typed by a `FilterSchema` (untyped keys are still allowed). */
export type TypedQueryState<S extends FilterSchema> = Omit<QueryState, "filters"> & {
  filters: InferFilters<S> & Record<string, FilterValue>;
};

/** Custom URL param names for the reserved keys, e.g. `{ search: "q" }`. */
export interface ParamNames {
  search?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

/** Options shared by the parser, serializer, and hook that decide where state lives in the URL. */
export interface QueryKeyOptions {
  /** Namespaces every param as `${prefix}.${key}`, so several instances can share one URL. */
  prefix?: string;
  /** Renames the reserved params (`search`, `sort`, `page`, `pageSize`). */
  paramNames?: ParamNames;
  /** Parses and serializes the listed filters as typed values. */
  schema?: FilterSchema;
}
