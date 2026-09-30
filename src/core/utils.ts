import { serializeQueryState } from "./serializer.js";
import type { SerializeOptions } from "./serializer.js";
import type { FilterValue, PaginationState, QueryState, RangeValue } from "./types.js";

export interface DefaultQueryStateOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function createDefaultQueryState(
  options: DefaultQueryStateOptions = {},
): QueryState {
  const { defaultPage = 1, defaultPageSize = 20 } = options;

  return {
    search: "",
    filters: {},
    sort: null,
    pagination: { page: defaultPage, pageSize: defaultPageSize },
  };
}

export function isEqualQueryState(a: QueryState, b: QueryState): boolean {
  return (
    a.search === b.search &&
    isEqualPagination(a.pagination, b.pagination) &&
    isEqualSort(a, b) &&
    isEqualFilters(a, b)
  );
}

function isEqualPagination(a: PaginationState, b: PaginationState): boolean {
  return a.page === b.page && a.pageSize === b.pageSize;
}

function isEqualSort(a: QueryState, b: QueryState): boolean {
  if (a.sort === b.sort) return true;
  if (!a.sort || !b.sort) return false;
  return a.sort.field === b.sort.field && a.sort.direction === b.sort.direction;
}

/** The two underlying filter keys a range filter named `key` reads/writes. */
export function getRangeFilterKeys(key: string): { fromKey: string; toKey: string } {
  return { fromKey: `${key}From`, toKey: `${key}To` };
}

/** Reads a range filter back out of a plain filters record (see `RangeValue`). */
export function getRangeFilter(
  filters: Record<string, FilterValue>,
  key: string,
): RangeValue {
  const { fromKey, toKey } = getRangeFilterKeys(key);
  const from = filters[fromKey];
  const to = filters[toKey];

  return {
    from: typeof from === "string" ? from : null,
    to: typeof to === "string" ? to : null,
  };
}

function isEqualFilters(a: QueryState, b: QueryState): boolean {
  const aKeys = Object.keys(a.filters);
  const bKeys = Object.keys(b.filters);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => {
    const aValue = a.filters[key];
    const bValue = b.filters[key];

    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      return aValue.length === bValue.length && aValue.every((v, i) => v === bValue[i]);
    }

    return aValue === bValue;
  });
}

export interface ActiveFilter {
  key: string;
  value: Exclude<FilterValue, null>;
}

/** The filters that are actually applied, skipping `null`, `""`, and empty arrays (the values the serializer omits). */
export function getActiveFilters(filters: Record<string, FilterValue>): ActiveFilter[] {
  const active: ActiveFilter[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    active.push({ key, value });
  }

  return active;
}

/**
 * A stable cache key for data-fetching libraries (TanStack Query, SWR).
 * Two states that describe the same query get the same key, whatever order
 * their filters were set in.
 */
export function toQueryKey(
  state: QueryState,
  options: SerializeOptions = {},
): readonly ["react-query-filters", string] {
  const params = new URLSearchParams(serializeQueryState(state, options));
  params.sort();
  return ["react-query-filters", params.toString()];
}

/** Search params in any of the shapes frameworks hand you, e.g. a Next.js page's `searchParams` prop. */
export type SearchParamsInput =
  | string
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

/** Converts a `SearchParamsInput` into a query string with no leading `?`. */
export function toSearchString(input: SearchParamsInput): string {
  if (typeof input === "string") return input.replace(/^\?/, "");
  if (input instanceof URLSearchParams) return input.toString();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }

  return params.toString();
}
